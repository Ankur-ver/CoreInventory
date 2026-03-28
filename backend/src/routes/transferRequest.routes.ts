// src/routes/transferRequest.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getTransferRequests, createTransferRequest, approveTransferRequest,
  executeTransferRequest, rejectTransferRequest, getWarehouseStockComparison,
} from '../controllers/transferRequest.controller';

const router = Router();
router.use(authenticate);

router.get('/',                    getTransferRequests);
router.get('/comparison',          getWarehouseStockComparison);
router.post('/',                   createTransferRequest);
router.post('/:id/approve',        authorize('ADMIN','MANAGER'), approveTransferRequest);
router.post('/:id/execute',        authorize('ADMIN','MANAGER'), executeTransferRequest);
router.post('/:id/reject',         authorize('ADMIN','MANAGER'), rejectTransferRequest);

export default router;
