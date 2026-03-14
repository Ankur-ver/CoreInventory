// src/routes/purchaseOrder.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  updatePurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder,
  getSuppliers, createSupplier, updateSupplier,
} from '../controllers/purchaseOrder.controller';

const router = Router();
router.use(authenticate);

// Purchase Orders
router.get('/',                                    getPurchaseOrders);
router.get('/:id',                                 getPurchaseOrder);
router.post('/',          authorize('ADMIN','MANAGER'), createPurchaseOrder);
router.patch('/:id',      authorize('ADMIN','MANAGER'), updatePurchaseOrder);
router.post('/:id/receive',                        receivePurchaseOrder);
router.post('/:id/cancel', authorize('ADMIN','MANAGER'), cancelPurchaseOrder);

// Suppliers (nested under purchase-orders for convenience)
router.get('/suppliers/all',                        getSuppliers);
router.post('/suppliers/create', authorize('ADMIN','MANAGER'), createSupplier);
router.patch('/suppliers/:id',   authorize('ADMIN','MANAGER'), updateSupplier);

export default router;
