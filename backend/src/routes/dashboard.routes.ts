// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getDashboardStats } from '../controllers/stock.controller';

const router = Router();
router.use(authenticate);
router.get('/', getDashboardStats);

export default router;
