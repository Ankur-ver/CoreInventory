// src/routes/operation.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getOperations, getOperation, createOperation,
  validateOperation, cancelOperation,
} from '../controllers/operation.controller';

const router = Router();
router.use(authenticate);

router.get('/', getOperations);
router.get('/:id', getOperation);
router.post('/', createOperation);
router.post('/:id/validate', validateOperation);
router.post('/:id/cancel', authorize('ADMIN', 'MANAGER'), cancelOperation);

export default router;
