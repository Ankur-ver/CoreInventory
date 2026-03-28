// src/routes/forecast.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getForecast, getAllForecasts, getBulkForecast } from '../controllers/forecast.controller';

const router = Router();
router.use(authenticate);

router.get('/',                           getAllForecasts);
router.get('/bulk/:warehouseId',          getBulkForecast);
router.get('/:productId/:warehouseId',    getForecast);

export default router;
