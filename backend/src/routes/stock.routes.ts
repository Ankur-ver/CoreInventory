// src/routes/stock.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getStockMovements, getLowStockItems } from '../controllers/stock.controller';

const router = Router();
router.use(authenticate);

router.get('/movements', getStockMovements);
router.get('/low', getLowStockItems);

export default router;
