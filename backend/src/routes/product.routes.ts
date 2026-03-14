// src/routes/product.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getCategories, createCategory,
} from '../controllers/product.controller';

const router = Router();
router.use(authenticate);

router.get('/', getProducts);
router.get('/categories', getCategories);
router.post('/categories', authorize('ADMIN', 'MANAGER'), createCategory);
router.get('/:id', getProduct);
router.post('/', authorize('ADMIN', 'MANAGER'), createProduct);
router.patch('/:id', authorize('ADMIN', 'MANAGER'), updateProduct);
router.delete('/:id', authorize('ADMIN'), deleteProduct);

export default router;
