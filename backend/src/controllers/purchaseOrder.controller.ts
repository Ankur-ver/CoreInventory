// src/controllers/purchaseOrder.controller.ts
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { POStatus, MovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Schemas ───────────────────────────────────────────────────────────────────
const lineSchema = z.object({
  productId: z.string(),
  quantity:  z.number().positive(),
  unitPrice: z.number().min(0).default(0),
});

const createPOSchema = z.object({
  supplierName: z.string().min(1),  // create/find supplier by name
  supplierId:   z.string().optional(),
  locationId:   z.string().optional(),
  orderDate:    z.string().optional(),
  expectedDate: z.string().optional(),
  notes:        z.string().optional(),
  lines:        z.array(lineSchema).min(1),
});

const updatePOSchema = z.object({
  status:       z.nativeEnum(POStatus).optional(),
  notes:        z.string().optional(),
  expectedDate: z.string().optional(),
  receivedDate: z.string().optional(),
});

// ── Select shape ──────────────────────────────────────────────────────────────
const poSelect = {
  id: true, reference: true, status: true, notes: true,
  orderDate: true, expectedDate: true, receivedDate: true,
  createdAt: true, updatedAt: true,
  supplier: { select: { id: true, name: true, email: true, phone: true } },
  location: { select: { id: true, name: true, warehouse: { select: { id: true, name: true } } } },
  lines: {
    select: {
      id: true, quantity: true, unitPrice: true, receivedQty: true,
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
  },
};

// ── Reference generator ───────────────────────────────────────────────────────
async function generatePORef(): Promise<string> {
  const count = await prisma.purchaseOrder.count();
  const year  = new Date().getFullYear();
  return `PO-${year}${String(count + 1).padStart(4, '0')}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getOrCreateSupplier(supplierName: string, supplierId?: string) {
  if (supplierId) return supplierId;
  const existing = await prisma.supplier.findFirst({ where: { name: { equals: supplierName, mode: 'insensitive' } } });
  if (existing) return existing.id;
  const created = await prisma.supplier.create({ data: { name: supplierName } });
  return created.id;
}

function computeTotal(lines: { quantity: number; unitPrice: number }[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

// ── Controllers ───────────────────────────────────────────────────────────────
export const getPurchaseOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, supplierId, search, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status)     where.status = String(status);
    if (supplierId) where.supplierId = String(supplierId);
    if (search)     where.OR = [
      { reference: { contains: String(search), mode: 'insensitive' } },
      { supplier: { name: { contains: String(search), mode: 'insensitive' } } },
    ];
    if (dateFrom || dateTo) {
      where.orderDate = {
        ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
        ...(dateTo   ? { lte: new Date(String(dateTo))   } : {}),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, select: poSelect, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.purchaseOrder.count({ where }),
    ]);

    // Compute total amount per order
    const enriched = orders.map(o => ({
      ...o,
      total: computeTotal(o.lines),
    }));

    sendSuccess(res, { orders: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

export const getPurchaseOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, select: poSelect });
    if (!order) { sendError(res, 'Purchase order not found', 404); return; }
    sendSuccess(res, { ...order, total: computeTotal(order.lines) });
  } catch (err) { next(err); }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body      = createPOSchema.parse(req.body);
    const supplierId = await getOrCreateSupplier(body.supplierName, body.supplierId);
    const reference = await generatePORef();

    const order = await prisma.purchaseOrder.create({
      data: {
        reference,
        supplierId,
        locationId:   body.locationId,
        orderDate:    body.orderDate   ? new Date(body.orderDate)   : new Date(),
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
        notes:        body.notes,
        lines: {
          create: body.lines.map(l => ({
            productId: l.productId,
            quantity:  l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
      select: poSelect,
    });

    sendSuccess(res, { ...order, total: computeTotal(order.lines) }, 'Purchase order created', 201);
  } catch (err) { next(err); }
};

export const updatePurchaseOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body  = updatePOSchema.parse(req.body);
    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        ...body,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
        receivedDate: body.receivedDate ? new Date(body.receivedDate) : undefined,
      },
      select: poSelect,
    });
    sendSuccess(res, { ...order, total: computeTotal(order.lines) }, 'Purchase order updated');
  } catch (err) { next(err); }
};

export const receivePurchaseOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { lines: { include: { product: true } } },
    });
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    if (po.status === 'CANCELED') { sendError(res, 'Cannot receive a canceled order', 400); return; }
    if (po.status === 'RECEIVED') { sendError(res, 'Order already fully received', 400); return; }

    // Receive quantities — use provided partial qtys or full line quantities
    const receivedLines: { lineId: string; qty: number }[] = req.body.lines ?? po.lines.map(l => ({ lineId: l.id, qty: l.quantity }));

    const result = await prisma.$transaction(async (tx) => {
      for (const rl of receivedLines) {
        const line = po.lines.find(l => l.id === rl.lineId);
        if (!line || rl.qty <= 0) continue;

        // Update received qty on line
        await tx.purchaseOrderLine.update({
          where: { id: rl.lineId },
          data:  { receivedQty: { increment: rl.qty } },
        });

        // Update stock if location is specified
        if (po.locationId) {
          const existing = await tx.stockItem.findUnique({
            where: { productId_locationId: { productId: line.productId, locationId: po.locationId } },
          });
          const newQty   = (existing?.quantity ?? 0) + rl.qty;
          const status   = newQty === 0 ? 'OUT' : newQty < line.product.reorderPoint ? 'LOW' : 'OK';

          await tx.stockItem.upsert({
            where:  { productId_locationId: { productId: line.productId, locationId: po.locationId } },
            update: { quantity: newQty, status },
            create: { productId: line.productId, locationId: po.locationId, quantity: newQty, status },
          });
        }

        // Log movement
        await tx.stockMovement.create({
          data: {
            productId:   line.productId,
            type:        MovementType.IN,
            quantity:    rl.qty,
            reference:   po.reference,
            userId:      req.user!.userId,
            note:        `Received from PO ${po.reference}`,
          },
        });
      }

      // Determine new PO status
      const updatedLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
      const allReceived  = updatedLines.every(l => l.receivedQty >= l.quantity);
      const anyReceived  = updatedLines.some(l => l.receivedQty > 0);
      const newStatus: POStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;

      return tx.purchaseOrder.update({
        where: { id: po.id },
        data:  { status: newStatus, receivedDate: allReceived ? new Date() : undefined },
        select: poSelect,
      });
    });

    sendSuccess(res, { ...result, total: computeTotal(result.lines) }, 'Stock received and updated');
  } catch (err) { next(err); }
};

export const cancelPurchaseOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!po) { sendError(res, 'Purchase order not found', 404); return; }
    if (po.status === 'RECEIVED') { sendError(res, 'Cannot cancel a received order', 400); return; }

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data:  { status: POStatus.CANCELED },
      select: poSelect,
    });
    sendSuccess(res, { ...updated, total: computeTotal(updated.lines) }, 'Purchase order canceled');
  } catch (err) { next(err); }
};

// ── Supplier CRUD ─────────────────────────────────────────────────────────────
export const getSuppliers = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    sendSuccess(res, suppliers);
  } catch (err) { next(err); }
};

export const createSupplier = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, address } = z.object({
      name:    z.string().min(1),
      email:   z.string().email().optional(),
      phone:   z.string().optional(),
      address: z.string().optional(),
    }).parse(req.body);
    const supplier = await prisma.supplier.create({ data: { name, email, phone, address } });
    sendSuccess(res, supplier, 'Supplier created', 201);
  } catch (err) { next(err); }
};

export const updateSupplier = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = req.body;
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data });
    sendSuccess(res, supplier, 'Supplier updated');
  } catch (err) { next(err); }
};
