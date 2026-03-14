// src/controllers/salesOrder.controller.ts
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { SOStatus, MovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Schemas ───────────────────────────────────────────────────────────────────
const lineSchema = z.object({
  productId: z.string(),
  quantity:  z.number().positive(),
  unitPrice: z.number().min(0).default(0),
});

const createSOSchema = z.object({
  customerName: z.string().min(1),
  customerId:   z.string().optional(),
  locationId:   z.string().optional(),
  orderDate:    z.string().optional(),
  notes:        z.string().optional(),
  lines:        z.array(lineSchema).min(1),
});

const updateSOSchema = z.object({
  status:     z.nativeEnum(SOStatus).optional(),
  notes:      z.string().optional(),
  shippedDate: z.string().optional(),
});

// ── Select shape ──────────────────────────────────────────────────────────────
const soSelect = {
  id: true, reference: true, status: true, notes: true,
  orderDate: true, shippedDate: true, createdAt: true, updatedAt: true,
  customer: { select: { id: true, name: true, email: true, phone: true } },
  location: { select: { id: true, name: true, warehouse: { select: { id: true, name: true } } } },
  lines: {
    select: {
      id: true, quantity: true, unitPrice: true, fulfilledQty: true,
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
  },
};

// ── Reference generator ───────────────────────────────────────────────────────
async function generateSORef(): Promise<string> {
  const count = await prisma.salesOrder.count();
  const year  = new Date().getFullYear();
  return `SO-${year}${String(count + 1).padStart(4, '0')}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getOrCreateCustomer(customerName: string, customerId?: string): Promise<string> {
  if (customerId) return customerId;
  const existing = await prisma.customer.findFirst({ where: { name: { equals: customerName, mode: 'insensitive' } } });
  if (existing) return existing.id;
  const created = await prisma.customer.create({ data: { name: customerName } });
  return created.id;
}

function computeTotal(lines: { quantity: number; unitPrice: number }[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

// ── Controllers ───────────────────────────────────────────────────────────────
export const getSalesOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, customerId, search, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status)     where.status = String(status);
    if (customerId) where.customerId = String(customerId);
    if (search)     where.OR = [
      { reference: { contains: String(search), mode: 'insensitive' } },
      { customer: { name: { contains: String(search), mode: 'insensitive' } } },
    ];
    if (dateFrom || dateTo) {
      where.orderDate = {
        ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
        ...(dateTo   ? { lte: new Date(String(dateTo))   } : {}),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({ where, select: soSelect, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.salesOrder.count({ where }),
    ]);

    const enriched = orders.map(o => ({ ...o, total: computeTotal(o.lines) }));
    sendSuccess(res, { orders: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

export const getSalesOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const order = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, select: soSelect });
    if (!order) { sendError(res, 'Sales order not found', 404); return; }
    sendSuccess(res, { ...order, total: computeTotal(order.lines) });
  } catch (err) { next(err); }
};

export const createSalesOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body       = createSOSchema.parse(req.body);
    const customerId = await getOrCreateCustomer(body.customerName, body.customerId);
    const reference  = await generateSORef();

    const order = await prisma.salesOrder.create({
      data: {
        reference,
        customerId,
        locationId: body.locationId,
        orderDate:  body.orderDate ? new Date(body.orderDate) : new Date(),
        notes:      body.notes,
        lines: {
          create: body.lines.map(l => ({
            productId: l.productId,
            quantity:  l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
      select: soSelect,
    });

    sendSuccess(res, { ...order, total: computeTotal(order.lines) }, 'Sales order created', 201);
  } catch (err) { next(err); }
};

export const updateSalesOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body  = updateSOSchema.parse(req.body);
    const order = await prisma.salesOrder.update({
      where: { id: req.params.id },
      data:  { ...body, shippedDate: body.shippedDate ? new Date(body.shippedDate) : undefined },
      select: soSelect,
    });
    sendSuccess(res, { ...order, total: computeTotal(order.lines) }, 'Sales order updated');
  } catch (err) { next(err); }
};

export const fulfillSalesOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const so = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: { lines: { include: { product: true } } },
    });
    if (!so) { sendError(res, 'Sales order not found', 404); return; }
    if (so.status === 'CANCELED')  { sendError(res, 'Cannot fulfill a canceled order', 400); return; }
    if (so.status === 'FULFILLED') { sendError(res, 'Order already fulfilled', 400); return; }

    const fulfilledLines: { lineId: string; qty: number }[] = req.body.lines ?? so.lines.map(l => ({ lineId: l.id, qty: l.quantity }));

    const result = await prisma.$transaction(async (tx) => {
      for (const fl of fulfilledLines) {
        const line = so.lines.find(l => l.id === fl.lineId);
        if (!line || fl.qty <= 0) continue;

        // Check stock availability if location is set
        if (so.locationId) {
          const stockItem = await tx.stockItem.findUnique({
            where: { productId_locationId: { productId: line.productId, locationId: so.locationId } },
          });
          const available = stockItem?.quantity ?? 0;
          if (available < fl.qty) {
            throw new Error(`Insufficient stock for ${line.product.name}: available ${available}, requested ${fl.qty}`);
          }

          // Deduct stock
          const newQty = available - fl.qty;
          const status = newQty === 0 ? 'OUT' : newQty < line.product.reorderPoint ? 'LOW' : 'OK';
          await tx.stockItem.update({
            where: { productId_locationId: { productId: line.productId, locationId: so.locationId } },
            data:  { quantity: newQty, status },
          });
        }

        // Update fulfilled qty on line
        await tx.salesOrderLine.update({
          where: { id: fl.lineId },
          data:  { fulfilledQty: { increment: fl.qty } },
        });

        // Log movement
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            type:      MovementType.OUT,
            quantity:  fl.qty,
            reference: so.reference,
            userId:    req.user!.userId,
            note:      `Fulfilled for SO ${so.reference}`,
          },
        });
      }

      // Determine new SO status
      const updatedLines = await tx.salesOrderLine.findMany({ where: { salesOrderId: so.id } });
      const allFulfilled = updatedLines.every(l => l.fulfilledQty >= l.quantity);
      const anyFulfilled = updatedLines.some(l => l.fulfilledQty > 0);
      const newStatus: SOStatus = allFulfilled ? 'FULFILLED' : anyFulfilled ? 'PARTIALLY_FULFILLED' : so.status;

      return tx.salesOrder.update({
        where: { id: so.id },
        data:  { status: newStatus, shippedDate: allFulfilled ? new Date() : undefined },
        select: soSelect,
      });
    });

    sendSuccess(res, { ...result, total: computeTotal(result.lines) }, 'Sales order fulfilled and stock deducted');
  } catch (err) { next(err); }
};

export const cancelSalesOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id } });
    if (!so) { sendError(res, 'Sales order not found', 404); return; }
    if (so.status === 'FULFILLED') { sendError(res, 'Cannot cancel a fulfilled order', 400); return; }

    const updated = await prisma.salesOrder.update({
      where: { id: req.params.id },
      data:  { status: SOStatus.CANCELED },
      select: soSelect,
    });
    sendSuccess(res, { ...updated, total: computeTotal(updated.lines) }, 'Sales order canceled');
  } catch (err) { next(err); }
};

// ── Customer CRUD ─────────────────────────────────────────────────────────────
export const getCustomers = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
    sendSuccess(res, customers);
  } catch (err) { next(err); }
};

export const createCustomer = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, address } = z.object({
      name:    z.string().min(1),
      email:   z.string().email().optional(),
      phone:   z.string().optional(),
      address: z.string().optional(),
    }).parse(req.body);
    const customer = await prisma.customer.create({ data: { name, email, phone, address } });
    sendSuccess(res, customer, 'Customer created', 201);
  } catch (err) { next(err); }
};

export const updateCustomer = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
    sendSuccess(res, customer, 'Customer updated');
  } catch (err) { next(err); }
};
