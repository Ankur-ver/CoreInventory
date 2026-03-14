// src/routes/salesOrder.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getSalesOrders, getSalesOrder, createSalesOrder,
  updateSalesOrder, fulfillSalesOrder, cancelSalesOrder,
  getCustomers, createCustomer, updateCustomer,
} from '../controllers/salesOrder.controller';

const router = Router();
router.use(authenticate);

// Sales Orders
router.get('/',                                   getSalesOrders);
router.get('/:id',                                getSalesOrder);
router.post('/',        authorize('ADMIN','MANAGER'), createSalesOrder);
router.patch('/:id',    authorize('ADMIN','MANAGER'), updateSalesOrder);
router.post('/:id/fulfill',                       fulfillSalesOrder);
router.post('/:id/cancel', authorize('ADMIN','MANAGER'), cancelSalesOrder);

// Customers
router.get('/customers/all',                        getCustomers);
router.post('/customers/create', authorize('ADMIN','MANAGER'), createCustomer);
router.patch('/customers/:id',   authorize('ADMIN','MANAGER'), updateCustomer);

export default router;
