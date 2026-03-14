// src/controllers/product.controller.ts
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  categoryId: z.string(),
  unit: z.string().default('pcs'),
  reorderPoint: z.number().min(0),
  description: z.string().optional(),
  initialStock:z.number().optional().default(0),
  price:z.number(),
});

const productSelect = {
  id: true, name: true, sku: true, barcode: true, unit: true,
  reorderPoint: true, initialStock: true, price: true, description: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true } },
  stockItems: {
    select: {
      id: true, quantity: true, status: true,
      location: { select: { id: true, name: true, warehouse: { select: { id: true, name: true } } } },
    },
  },
};

export const getProducts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, categoryId, status, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (search) where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { sku: { contains: String(search), mode: 'insensitive' } },
    ];
    if (categoryId) where.categoryId = String(categoryId);
    if (status) where.stockItems = { some: { status: String(status) } };

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, select: productSelect, skip, take: Number(limit), orderBy: { name: 'asc' } }),
      prisma.product.count({ where }),
    ]);

    sendSuccess(res, { products, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

export const getProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: productSelect });
    if (!product) { sendError(res, 'Product not found', 404); return; }
    sendSuccess(res, product);
  } catch (err) { next(err); }
};

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = productSchema.parse(req.body);
    const product = await prisma.product.create({ data: body, select: productSelect });
    sendSuccess(res, product, 'Product created', 201);
  } catch (err) { next(err); }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data: body, select: productSelect });
    sendSuccess(res, product, 'Product updated');
  } catch (err) { next(err); }
};

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Product deleted');
  } catch (err) { next(err); }
};

export const getCategories = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    sendSuccess(res, categories);
  } catch (err) { next(err); }
};

export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const category = await prisma.category.create({ data: { name } });
    sendSuccess(res, category, 'Category created', 201);
  } catch (err) { next(err); }
};
