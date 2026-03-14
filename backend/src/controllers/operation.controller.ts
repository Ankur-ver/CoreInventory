// src/controllers/operation.controller.ts
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { OperationType, OperationStatus, MovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Schemas ───────────────────────────────────────────────────────────────────
const lineSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
});

const operationSchema = z.object({
  type: z.nativeEnum(OperationType),
  supplierId: z.string().optional(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

const opSelect = {
  id: true, reference: true, type: true, status: true, notes: true,
  scheduledDate: true, completedAt: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  fromLocation: { select: { id: true, name: true, warehouse: { select: { name: true } } } },
  toLocation: { select: { id: true, name: true, warehouse: { select: { name: true } } } },
  lines: {
    select: {
      id: true, quantity: true, received: true,
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
  },
};

// ── Generate reference number ─────────────────────────────────────────────────
const prefixMap: Record<OperationType, string> = {
  RECEIPT: 'REC', DELIVERY: 'DEL', TRANSFER: 'TRF', ADJUSTMENT: 'ADJ',
};

async function generateReference(type: OperationType): Promise<string> {
  const count = await prisma.operation.count({ where: { type } });
  return `${prefixMap[type]}-${String(count + 1).padStart(4, '0')}`;
}

// ── Update stock helper ───────────────────────────────────────────────────────
async function updateStock(
  productId: string,
  locationId: string,
  delta: number,
  tx: typeof prisma
) {
  const existing = await tx.stockItem.findUnique({
    where: { productId_locationId: { productId, locationId } },
  });

  const newQty = Math.max(0, (existing?.quantity ?? 0) + delta);
  const status = newQty === 0 ? 'OUT' : newQty < 20 ? 'LOW' : 'OK';

  return tx.stockItem.upsert({
    where: { productId_locationId: { productId, locationId } },
    update: { quantity: newQty, status },
    create: { productId, locationId, quantity: newQty, status },
  });
}

// ── Controllers ───────────────────────────────────────────────────────────────
export const getOperations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, status, search, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (type) where.type = String(type);
    if (status) where.status = String(status);
    if (search) where.reference = { contains: String(search), mode: 'insensitive' };

    const [operations, total] = await Promise.all([
      prisma.operation.findMany({ where, select: opSelect, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.operation.count({ where }),
    ]);

    sendSuccess(res, { operations, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

export const getOperation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const op = await prisma.operation.findUnique({ where: { id: req.params.id }, select: opSelect });
    if (!op) { sendError(res, 'Operation not found', 404); return; }
    sendSuccess(res, op);
  } catch (err) { next(err); }
};

export const createOperation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = operationSchema.parse(req.body);
    const reference = await generateReference(body.type);

    const op = await prisma.operation.create({
      data: {
        reference,
        type: body.type,
        userId: req.user!.userId,
        supplierId: body.supplierId,
        fromLocationId: body.fromLocationId,
        toLocationId: body.toLocationId,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
        notes: body.notes,
        lines: { create: body.lines.map(l => ({ productId: l.productId, quantity: l.quantity })) },
      },
      select: opSelect,
    });

    sendSuccess(res, op, 'Operation created', 201);
  } catch (err) { next(err); }
};

export const validateOperation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const op = await prisma.operation.findUnique({
      where: { id: req.params.id },
      include: { lines: { include: { product: true } } },
    });

    if (!op) { sendError(res, 'Operation not found', 404); return; }
    if (op.status === 'DONE') { sendError(res, 'Operation already validated', 400); return; }
    if (op.status === 'CANCELED') { sendError(res, 'Cannot validate canceled operation', 400); return; }

    const result = await prisma.$transaction(async (tx) => {
      for (const line of op.lines) {
        const qty = line.quantity;

        if (op.type === OperationType.RECEIPT && op.toLocationId) {
          await updateStock(line.productId, op.toLocationId, qty, tx as typeof prisma);
          await tx.stockMovement.create({
            data: { productId: line.productId, type: MovementType.IN, quantity: qty, reference: op.reference, operationId: op.id, userId: req.user!.userId },
          });
        }

        if (op.type === OperationType.DELIVERY && op.fromLocationId) {
          await updateStock(line.productId, op.fromLocationId, -qty, tx as typeof prisma);
          await tx.stockMovement.create({
            data: { productId: line.productId, type: MovementType.OUT, quantity: qty, reference: op.reference, operationId: op.id, userId: req.user!.userId },
          });
        }

        if (op.type === OperationType.TRANSFER && op.fromLocationId && op.toLocationId) {
          await updateStock(line.productId, op.fromLocationId, -qty, tx as typeof prisma);
          await updateStock(line.productId, op.toLocationId, qty, tx as typeof prisma);
          await tx.stockMovement.create({
            data: { productId: line.productId, type: MovementType.TRANSFER, quantity: qty, reference: op.reference, operationId: op.id, userId: req.user!.userId },
          });
        }

        if (op.type === OperationType.ADJUSTMENT && op.toLocationId) {
          const delta = req.body.delta ?? qty;
          await updateStock(line.productId, op.toLocationId, delta, tx as typeof prisma);
          await tx.stockMovement.create({
            data: { productId: line.productId, type: MovementType.ADJUSTMENT, quantity: delta, reference: op.reference, operationId: op.id, userId: req.user!.userId, note: op.notes ?? undefined },
          });
        }
      }

      return tx.operation.update({
        where: { id: op.id },
        data: { status: OperationStatus.DONE, completedAt: new Date() },
        select: opSelect,
      });
    });

    sendSuccess(res, result, 'Operation validated — stock updated');
  } catch (err) { next(err); }
};

export const cancelOperation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const op = await prisma.operation.findUnique({ where: { id: req.params.id } });
    if (!op) { sendError(res, 'Operation not found', 404); return; }
    if (op.status === 'DONE') { sendError(res, 'Cannot cancel a completed operation', 400); return; }

    const updated = await prisma.operation.update({
      where: { id: req.params.id },
      data: { status: OperationStatus.CANCELED },
      select: opSelect,
    });
    sendSuccess(res, updated, 'Operation canceled');
  } catch (err) { next(err); }
};
