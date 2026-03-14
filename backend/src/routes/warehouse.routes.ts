// src/routes/warehouse.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getWarehouses, createWarehouse, createLocation } from '../controllers/stock.controller';

const router = Router();
router.use(authenticate);

router.get('/', getWarehouses);
router.post('/', authorize('ADMIN', 'MANAGER'), createWarehouse);
router.post('/locations', authorize('ADMIN', 'MANAGER'), createLocation);

export default router;
