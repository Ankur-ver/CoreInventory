// src/routes/reports.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getReports } from '../controllers/stock.controller';

const router = Router();
router.use(authenticate);
router.get('/', getReports);

export default router;
