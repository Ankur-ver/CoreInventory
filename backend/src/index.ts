// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes          from './routes/auth.routes';
import productRoutes       from './routes/product.routes';
import operationRoutes     from './routes/operation.routes';
import stockRoutes         from './routes/stock.routes';
import warehouseRoutes     from './routes/warehouse.routes';
import dashboardRoutes     from './routes/dashboard.routes';
import purchaseOrderRoutes from './routes/purchaseOrder.routes';
import salesOrderRoutes    from './routes/salesOrder.routes';
import reportsRoutes       from './routes/reports.routes';
import { errorHandler }    from './middleware/error.middleware';

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many auth attempts' });
app.use('/api/auth', authLimiter);
app.use('/api',      limiter);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/products',       productRoutes);
app.use('/api/operations',     operationRoutes);
app.use('/api/stock',          stockRoutes);
app.use('/api/warehouses',     warehouseRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sales-orders',    salesOrderRoutes);
app.use('/api/reports',         reportsRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 CoreInventory API running on http://localhost:${PORT}`);
});

export default app;
