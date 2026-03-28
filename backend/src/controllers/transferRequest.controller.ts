// src/controllers/transferRequest.controller.ts
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { MovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';
import eventBus from '../utils/eventBus';

const createSchema = z.object({
  fromWarehouseId: z.string(),
  toWarehouseId:   z.string(),
  productId:       z.string(),
  requestedQty:    z.number().positive(),
  reason:          z.string().optional(),
});

async function generateRef(): Promise<string> {
  const count = await prisma.transferRequest.count();
  return `TRQ-${new Date().getFullYear()}${String(count + 1).padStart(4, '0')}`;
}

const trSelect = {
  id: true, reference: true, status: true, requestedQty: true, approvedQty: true,
  reason: true, createdAt: true, updatedAt: true,
  fromWarehouse: { select: { id: true, name: true } },
  toWarehouse:   { select: { id: true, name: true } },
  product:       { select: { id: true, name: true, sku: true, unit: true } },
  requestedBy:   { select: { id: true, name: true } },
  approvedBy:    { select: { id: true, name: true } },
};

export const getTransferRequests = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, warehouseId, page = '1', limit = '20' } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};
    if (status) where.status = String(status);
    if (warehouseId) where.OR = [
      { fromWarehouseId: String(warehouseId) },
      { toWarehouseId:   String(warehouseId) },
    ];

    const [requests, total] = await Promise.all([
      prisma.transferRequest.findMany({ where, select: trSelect, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.transferRequest.count({ where }),
    ]);
    sendSuccess(res, { requests, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

export const createTransferRequest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = createSchema.parse(req.body);

    if (body.fromWarehouseId === body.toWarehouseId) {
      sendError(res, 'Source and destination warehouses must be different', 400);
      return;
    }

    // Check available stock in source warehouse
    const fromStock = await prisma.stockItem.findMany({
      where: { productId: body.productId, location: { warehouseId: body.fromWarehouseId } },
    });
    const availableQty = fromStock.reduce((s, si) => s + si.quantity, 0);
    if (availableQty < body.requestedQty) {
      sendError(res, `Insufficient stock. Available: ${availableQty}, Requested: ${body.requestedQty}`, 400);
      return;
    }

    const reference = await generateRef();
    const request   = await prisma.transferRequest.create({
      data: {
        reference,
        fromWarehouseId: body.fromWarehouseId,
        toWarehouseId:   body.toWarehouseId,
        productId:       body.productId,
        requestedQty:    body.requestedQty,
        reason:          body.reason,
        requestedById:   req.user!.userId,
      },
      select: trSelect,
    });

    // Emit event
    await eventBus.emit({
      type:       'TRANSFER_REQUESTED',
      message:    `Transfer request ${reference}: ${body.requestedQty} units from ${request.fromWarehouse.name} → ${request.toWarehouse.name}`,
      severity:   'info',
      entityId:   request.id,
      entityType: 'TransferRequest',
      payload:    { reference, ...body, requestedBy: req.user!.userId },
    });

    sendSuccess(res, request, 'Transfer request created', 201);
  } catch (err) { next(err); }
};

export const approveTransferRequest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id }          = req.params;
    const { approvedQty } = z.object({ approvedQty: z.number().positive().optional() }).parse(req.body);

    const tr = await prisma.transferRequest.findUnique({ where: { id }, select: trSelect });
    if (!tr) { sendError(res, 'Transfer request not found', 404); return; }
    if (tr.status !== 'PENDING') { sendError(res, 'Only PENDING requests can be approved', 400); return; }

    const finalQty = approvedQty ?? tr.requestedQty;
    const updated  = await prisma.transferRequest.update({
      where: { id },
      data:  { status: 'APPROVED', approvedQty: finalQty, approvedById: req.user!.userId },
      select: trSelect,
    });

    sendSuccess(res, updated, 'Transfer request approved');
  } catch (err) { next(err); }
};

export const executeTransferRequest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tr = await prisma.transferRequest.findUnique({
      where:   { id: req.params.id },
      include: { product: true, fromWarehouse: { include: { locations: true } }, toWarehouse: { include: { locations: true } } },
    });
    if (!tr) { sendError(res, 'Transfer request not found', 404); return; }
    if (!['APPROVED', 'PENDING'].includes(tr.status)) {
      sendError(res, 'Request must be APPROVED or PENDING to execute', 400); return;
    }

    const qty            = tr.approvedQty ?? tr.requestedQty;
    const fromLocationId = tr.fromWarehouse.locations[0]?.id;
    const toLocationId   = tr.toWarehouse.locations[0]?.id;

    if (!fromLocationId || !toLocationId) {
      sendError(res, 'Warehouses must have at least one zone/location', 400); return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Deduct from source
      const fromStock = await tx.stockItem.findFirst({
        where: { productId: tr.productId, locationId: fromLocationId },
      });
      const newFromQty = (fromStock?.quantity ?? 0) - qty;
      if (newFromQty < 0) throw new Error(`Insufficient stock in source warehouse`);

      const fromStatus = newFromQty === 0 ? 'OUT' : newFromQty < tr.product.reorderPoint ? 'LOW' : 'OK';
      await tx.stockItem.upsert({
        where:  { productId_locationId: { productId: tr.productId, locationId: fromLocationId } },
        update: { quantity: newFromQty, status: fromStatus },
        create: { productId: tr.productId, locationId: fromLocationId, quantity: newFromQty, status: fromStatus },
      });

      // Add to destination
      const toStock = await tx.stockItem.findFirst({
        where: { productId: tr.productId, locationId: toLocationId },
      });
      const newToQty   = (toStock?.quantity ?? 0) + qty;
      const toStatus   = newToQty === 0 ? 'OUT' : newToQty < tr.product.reorderPoint ? 'LOW' : 'OK';
      await tx.stockItem.upsert({
        where:  { productId_locationId: { productId: tr.productId, locationId: toLocationId } },
        update: { quantity: newToQty, status: toStatus },
        create: { productId: tr.productId, locationId: toLocationId, quantity: newToQty, status: toStatus },
      });

      // Log movements
      await tx.stockMovement.create({
        data: { productId: tr.productId, type: MovementType.OUT, quantity: qty, reference: tr.reference, userId: req.user!.userId, note: `Inter-warehouse transfer to ${tr.toWarehouse.name}` },
      });
      await tx.stockMovement.create({
        data: { productId: tr.productId, type: MovementType.IN, quantity: qty, reference: tr.reference, userId: req.user!.userId, note: `Inter-warehouse transfer from ${tr.fromWarehouse.name}` },
      });

      // Update request status
      return tx.transferRequest.update({
        where: { id: tr.id },
        data:  { status: 'COMPLETED' },
        select: {
          id: true, reference: true, status: true,
          fromWarehouse: { select: { name: true } },
          toWarehouse:   { select: { name: true } },
          product:       { select: { name: true, sku: true, unit: true } },
        },
      });
    });

    await eventBus.emit({
      type:       'TRANSFER_COMPLETED',
      message:    `Inter-warehouse transfer ${tr.reference} completed: ${qty} × ${tr.product.name} from ${tr.fromWarehouse.name} → ${tr.toWarehouse.name}`,
      severity:   'info',
      entityId:   tr.id,
      entityType: 'TransferRequest',
      payload:    { reference: tr.reference, quantity: qty, productName: tr.product.name, fromWarehouse: tr.fromWarehouse.name, toWarehouse: tr.toWarehouse.name },
    });

    sendSuccess(res, result, 'Transfer executed — stock updated in both warehouses');
  } catch (err) { next(err); }
};

export const rejectTransferRequest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tr = await prisma.transferRequest.findUnique({ where: { id: req.params.id } });
    if (!tr) { sendError(res, 'Not found', 404); return; }
    if (tr.status !== 'PENDING') { sendError(res, 'Only PENDING requests can be rejected', 400); return; }
    const updated = await prisma.transferRequest.update({
      where: { id: req.params.id },
      data:  { status: 'REJECTED', approvedById: req.user!.userId },
      select: trSelect,
    });
    sendSuccess(res, updated, 'Transfer request rejected');
  } catch (err) { next(err); }
};

export const getWarehouseStockComparison = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        locations: {
          include: {
            stockItems: {
              include: { product: { include: { category: true } } },
            },
          },
        },
      },
    });

    // Build per-product per-warehouse matrix
    const productMap: Record<string, { name: string; sku: string; unit: string; category: string; warehouses: Record<string, number> }> = {};

    for (const wh of warehouses) {
      for (const loc of wh.locations) {
        for (const si of loc.stockItems) {
          const pid = si.productId;
          if (!productMap[pid]) {
            productMap[pid] = {
              name:       si.product.name,
              sku:        si.product.sku,
              unit:       si.product.unit,
              category:   si.product.category.name,
              warehouses: {},
            };
          }
          productMap[pid].warehouses[wh.id] = (productMap[pid].warehouses[wh.id] ?? 0) + si.quantity;
        }
      }
    }

    const matrix = Object.entries(productMap).map(([productId, data]) => ({
      productId,
      ...data,
      total: Object.values(data.warehouses).reduce((s, v) => s + v, 0),
    }));

    sendSuccess(res, {
      warehouses: warehouses.map(w => ({ id: w.id, name: w.name })),
      matrix: matrix.sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) { next(err); }
};
