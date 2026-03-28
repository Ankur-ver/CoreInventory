// src/controllers/stock.controller.ts
import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

export const getStockMovements = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, type, page = '1', limit = '30' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};
    if (productId) where.productId = String(productId);
    if (type) where.type = String(type);

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    sendSuccess(res, { movements, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

export const getLowStockItems = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const items = await prisma.stockItem.findMany({
      where: { status: { in: ['LOW', 'OUT'] } },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true, reorderPoint: true } },
        location: { select: { name: true, warehouse: { select: { name: true } } } },
      },
      orderBy: { quantity: 'asc' },
    });
    sendSuccess(res, items);
  } catch (err) { next(err); }
};

// ── Warehouse controller ──────────────────────────────────────────────────────

export const getWarehouses = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        locations: {
          include: { _count: { select: { stockItems: true } } },
        },
      },
    });
    sendSuccess(res, warehouses);
  } catch (err) { next(err); }
};

export const createWarehouse = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, address, capacity } = req.body;
    const wh = await prisma.warehouse.create({ data: { name, address, capacity } });
    sendSuccess(res, wh, 'Warehouse created', 201);
  } catch (err) { next(err); }
};

export const createLocation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, warehouseId } = req.body;
    const loc = await prisma.location.create({ data: { name, warehouseId } });
    sendSuccess(res, loc, 'Location created', 201);
  } catch (err) { next(err); }
};

// ── Reports controller ────────────────────────────────────────────────────────

export const getReports = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Run in small sequential batches to avoid pool exhaustion
    const movements = await prisma.stockMovement.findMany({
      take: 50, orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });

    const topProducts = await prisma.stockMovement.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 8,
    });

    const [poStatusDist, soStatusDist, opStatusDist] = await Promise.all([
      prisma.purchaseOrder.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.salesOrder.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.operation.groupBy({ by: ['status'], _count: { status: true } }),
    ]);

    const [totalInAgg, totalOutAgg, totalPOs, totalSOs] = await Promise.all([
      prisma.stockMovement.aggregate({ where: { type: 'IN' },  _sum: { quantity: true } }),
      prisma.stockMovement.aggregate({ where: { type: 'OUT' }, _sum: { quantity: true } }),
      prisma.purchaseOrder.count(),
      prisma.salesOrder.count(),
    ]);

    // Enrich top products with names
    const productIds = topProducts.map(p => p.productId);
    const products   = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    const topSKUs = topProducts.map(p => ({
      productId: p.productId,
      sku:       productMap[p.productId]?.sku  ?? 'Unknown',
      name:      productMap[p.productId]?.name ?? 'Unknown',
      volume:    Math.abs(p._sum.quantity ?? 0),
    }));

    const statusDist = [
      ...poStatusDist.map(s => ({ label: `PO:${s.status}`, count: s._count.status })),
      ...soStatusDist.map(s => ({ label: `SO:${s.status}`, count: s._count.status })),
      ...opStatusDist.map(s => ({ label: s.status,          count: s._count.status })),
    ];

    sendSuccess(res, {
      movements,
      topSKUs,
      statusDist,
      summary: {
        totalIn:        totalInAgg._sum.quantity  ?? 0,
        totalOut:       Math.abs(totalOutAgg._sum.quantity ?? 0),
        totalMovements: movements.length,
        totalPOs,
        totalSOs,
      },
    });
  } catch (err) { next(err); }
};

// ── Dashboard controller ──────────────────────────────────────────────────────

export const getDashboardStats = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Batch 1: simple counts (5 queries max at a time)
    const [totalProducts, lowStock, outOfStock, pendingReceipts, scheduledTransfers] =
      await Promise.all([
        prisma.product.count(),
        prisma.stockItem.count({ where: { status: 'LOW' } }),
        prisma.stockItem.count({ where: { status: 'OUT' } }),
        prisma.operation.count({ where: { type: 'RECEIPT',  status: { in: ['DRAFT', 'WAITING', 'READY'] } } }),
        prisma.operation.count({ where: { type: 'TRANSFER', status: { in: ['DRAFT', 'WAITING', 'READY'] } } }),
      ]);

    // Batch 2: PO / SO counts
    const [pendingPOs, openSOs] = await Promise.all([
      prisma.purchaseOrder.count({ where: { status: { in: ['DRAFT', 'OPEN', 'PARTIALLY_RECEIVED'] } } }),
      prisma.salesOrder.count({   where: { status: { in: ['OPEN', 'PARTIALLY_FULFILLED'] } } }),
    ]);

    // Batch 3: recent data (sequentially — these are heavy queries)
    const recentMovements = await prisma.stockMovement.findMany({
      take: 10, orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });

    const recentOps = await prisma.operation.findMany({
      take: 8, orderBy: { createdAt: 'desc' },
      select: {
        id: true, reference: true, type: true, status: true, createdAt: true,
        supplier: { select: { name: true } },
        lines:    { select: { quantity: true, product: { select: { name: true, unit: true } } } },
        user:     { select: { name: true } },
      },
    });

    sendSuccess(res, {
      kpis: {
        totalProducts, lowStock, outOfStock,
        pendingReceipts, scheduledTransfers,
        pendingPOs, openSOs,
        pendingDeliveries: openSOs, // legacy key
      },
      recentMovements,
      recentOps,
    });
  } catch (err) { next(err); }
};

// ── Stock check helper — emit events when stock is low/out ────────────────────
import eventBus from '../utils/eventBus';

export async function checkAndEmitStockEvents(
  productId: string,
  locationId: string,
  quantity: number
): Promise<void> {
  try {
    const product  = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, sku: true, reorderPoint: true } });
    const location = await prisma.location.findUnique({ where: { id: locationId }, include: { warehouse: true } });
    if (!product || !location) return;

    if (quantity === 0) {
      await eventBus.emit({
        type:       'STOCK_OUT',
        message:    `${product.name} is OUT OF STOCK in ${location.warehouse.name}`,
        severity:   'critical',
        entityId:   productId,
        entityType: 'Product',
        payload:    { productId, productName: product.name, sku: product.sku, quantity: 0, warehouseId: location.warehouseId, locationId },
      });
    } else if (product.reorderPoint > 0 && quantity < product.reorderPoint) {
      await eventBus.emit({
        type:       'STOCK_LOW',
        message:    `${product.name} is LOW in ${location.warehouse.name}: ${quantity} remaining (reorder at ${product.reorderPoint})`,
        severity:   'warning',
        entityId:   productId,
        entityType: 'Product',
        payload:    { productId, productName: product.name, sku: product.sku, quantity, reorderPoint: product.reorderPoint, warehouseId: location.warehouseId, locationId },
      });
    }
  } catch { /* non-blocking */ }
}
