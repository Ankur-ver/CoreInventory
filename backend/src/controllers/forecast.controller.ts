// src/controllers/forecast.controller.ts
import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';
import eventBus from '../utils/eventBus';
import {
  ensemble, holtwinters, arimalite, prophetLite,
  seasonalDecomposition, buildTimeSeries,
} from '../utils/mlForecast';

// ── Method map ────────────────────────────────────────────────────────────────
const MODEL_LABELS: Record<string, string> = {
  ENSEMBLE:               'Ensemble (Auto-select + Weighted Average)',
  HOLT_WINTERS:           'Holt-Winters Triple Exponential Smoothing',
  ARIMA:                  'ARIMA(1,1,1)-lite',
  PROPHET:                'Prophet-lite (Fourier Seasonality)',
  SEASONAL_DECOMPOSITION: 'STL Seasonal Decomposition',
};

// ── Single product forecast ───────────────────────────────────────────────────
export const getForecast = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, warehouseId } = req.params;
    const method     = (req.query.method as string) ?? 'ENSEMBLE';
    const periodDays = Number(req.query.periodDays ?? 30);
    const horizon    = Number(req.query.horizon ?? 1);
    const periods    = 12; // 12 historical periods for ML training

    // Get product
    const product = await prisma.product.findUnique({
      where:   { id: productId },
      include: { stockItems: { include: { location: { include: { warehouse: true } } } } },
    });
    if (!product) { sendError(res, 'Product not found', 404); return; }

    // Get warehouse
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) { sendError(res, 'Warehouse not found', 404); return; }

    // Get stock movements (last 2 years for training data)
    const movements = await prisma.stockMovement.findMany({
      where:   { productId, createdAt: { gte: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'asc' },
    });

    // Build time series
    const { values: series, labels } = buildTimeSeries(
      movements as { quantity: number; type: string; createdAt: Date }[],
      periods,
      periodDays
    );

    // Run selected ML model
    let forecastResult;
    let allModels;

    if (method === 'ENSEMBLE' || !MODEL_LABELS[method]) {
      const result = ensemble(series, horizon);
      forecastResult = result.ensemble;
      allModels      = result.allModels;
    } else if (method === 'HOLT_WINTERS') {
      const period = Number(req.query.seasonPeriod ?? 0);
      forecastResult = holtwinters(series, period, horizon);
      allModels = [forecastResult];
    } else if (method === 'ARIMA') {
      forecastResult = arimalite(series, horizon);
      allModels = [forecastResult];
    } else if (method === 'PROPHET') {
      forecastResult = prophetLite(series, horizon);
      allModels = [forecastResult];
    } else if (method === 'SEASONAL_DECOMPOSITION') {
      const period = Number(req.query.seasonPeriod ?? 4);
      forecastResult = seasonalDecomposition(series, period, horizon);
      allModels = [forecastResult];
    } else {
      const result = ensemble(series, horizon);
      forecastResult = result.ensemble;
      allModels      = result.allModels;
    }

    // Current stock in this warehouse
    const currentStock = product.stockItems
      .filter(si => si.location.warehouseId === warehouseId)
      .reduce((sum, si) => sum + si.quantity, 0);

    const daysOfStock    = forecastResult.forecastQty > 0
      ? Math.round((currentStock / forecastResult.forecastQty) * periodDays)
      : 999;
    const suggestedOrder = Math.max(0, forecastResult.forecastQty * 2 - currentStock);
    const stockoutRisk   = daysOfStock < periodDays * 0.5 ? 'HIGH'
      : daysOfStock < periodDays ? 'MEDIUM' : 'LOW';

    // Persist forecast
    const saved = await prisma.demandForecast.create({
      data: {
        productId,
        warehouseId,
        method:      'MOVING_AVERAGE', // enum compat — store as string in notes
        forecastQty: forecastResult.forecastQty,
        periodDays,
        confidence:  forecastResult.confidence,
        notes:       `Model: ${forecastResult.model} | MAPE: ${forecastResult.mape}% | ${forecastResult.explanation}`,
      },
    });

    // Emit event
    await eventBus.emit({
      type:       'FORECAST_GENERATED',
      message:    `ML forecast for ${product.name}: ${forecastResult.forecastQty} units / ${periodDays} days (${forecastResult.model})`,
      severity:   'info',
      entityId:   productId,
      entityType: 'Product',
      payload:    { productId, productName: product.name, warehouseId, ...forecastResult },
    });

    sendSuccess(res, {
      forecast: saved,
      ml: {
        ...forecastResult,
        series,
        labels,
        periods,
        periodDays,
        horizon,
      },
      allModels: allModels?.map(m => ({
        model:       m.model,
        forecastQty: m.forecastQty,
        confidence:  m.confidence,
        mape:        m.mape,
        rmse:        m.rmse,
        mae:         m.mae,
        trend:       m.trend,
        seasonality: m.seasonality,
        periodicity: m.periodicity,
        upperBound:  m.upperBound,
        lowerBound:  m.lowerBound,
        modelParams: m.modelParams,
        explanation: m.explanation,
      })),
      analysis: {
        productName:   product.name,
        productSku:    product.sku,
        unit:          product.unit,
        warehouseName: warehouse.name,
        currentStock,
        forecastQty:   forecastResult.forecastQty,
        daysOfStock,
        suggestedOrder: Math.round(suggestedOrder),
        stockoutRisk,
        confidence:     forecastResult.confidence,
        trend:          forecastResult.trend,
        seasonality:    forecastResult.seasonality,
        periodicity:    forecastResult.periodicity,
        upperBound:     forecastResult.upperBound,
        lowerBound:     forecastResult.lowerBound,
        mape:           forecastResult.mape,
        rmse:           forecastResult.rmse,
        mae:            forecastResult.mae,
        explanation:    forecastResult.explanation,
      },
    });
  } catch (err) { next(err); }
};

// ── All forecasts ──────────────────────────────────────────────────────────────
export const getAllForecasts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { warehouseId, productId } = req.query;
    const where: Record<string, unknown> = {};
    if (warehouseId) where.warehouseId = String(warehouseId);
    if (productId)   where.productId   = String(productId);

    const forecasts = await prisma.demandForecast.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: 50,
      include: {
        product:   { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
    sendSuccess(res, forecasts);
  } catch (err) { next(err); }
};

// ── Bulk forecast for all products in a warehouse ────────────────────────────
export const getBulkForecast = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { warehouseId } = req.params;
    const method     = (req.query.method as string) ?? 'ENSEMBLE';
    const periodDays = Number(req.query.periodDays ?? 30);
    const periods    = 12;

    const warehouse = await prisma.warehouse.findUnique({
      where:   { id: warehouseId },
      include: {
        locations: {
          include: {
            stockItems: {
              include: { product: { include: { category: true } } },
            },
          },
        },
      },
    });
    if (!warehouse) { sendError(res, 'Warehouse not found', 404); return; }

    // Unique products in this warehouse
    const productMap = new Map<string, {
      name: string; sku: string; unit: string; category: string;
      reorderPoint: number; currentStock: number;
    }>();

    for (const loc of warehouse.locations) {
      for (const si of loc.stockItems) {
        const existing = productMap.get(si.productId);
        productMap.set(si.productId, {
          name:         si.product.name,
          sku:          si.product.sku,
          unit:         si.product.unit,
          category:     si.product.category.name,
          reorderPoint: si.product.reorderPoint,
          currentStock: (existing?.currentStock ?? 0) + si.quantity,
        });
      }
    }

    const results = [];
    const productIds = [...productMap.keys()].slice(0, 25); // limit to 25 per bulk request

    for (const productId of productIds) {
      const meta = productMap.get(productId)!;

      // Get movements for this product
      const movements = await prisma.stockMovement.findMany({
        where:   { productId, createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: 'asc' },
      });

      const { values: series, labels } = buildTimeSeries(
        movements as { quantity: number; type: string; createdAt: Date }[],
        periods,
        periodDays
      );

      // Run ML model
      let forecastResult;
      if (method === 'ENSEMBLE') {
        forecastResult = ensemble(series, 1).ensemble;
      } else if (method === 'HOLT_WINTERS') {
        forecastResult = holtwinters(series, 0, 1);
      } else if (method === 'ARIMA') {
        forecastResult = arimalite(series, 1);
      } else if (method === 'PROPHET') {
        forecastResult = prophetLite(series, 1);
      } else {
        forecastResult = ensemble(series, 1).ensemble;
      }

      const daysOfStock    = forecastResult.forecastQty > 0
        ? Math.round((meta.currentStock / forecastResult.forecastQty) * periodDays)
        : 999;
      const suggestedOrder = Math.max(0, forecastResult.forecastQty * 2 - meta.currentStock);
      const stockoutRisk   = daysOfStock < periodDays * 0.5 ? 'HIGH'
        : daysOfStock < periodDays ? 'MEDIUM' : 'LOW';

      results.push({
        productId,
        productName:    meta.name,
        sku:            meta.sku,
        unit:           meta.unit,
        category:       meta.category,
        currentStock:   meta.currentStock,
        reorderPoint:   meta.reorderPoint,
        forecastQty:    forecastResult.forecastQty,
        daysOfStock,
        stockoutRisk,
        suggestedOrder: Math.round(suggestedOrder),
        confidence:     forecastResult.confidence,
        trend:          forecastResult.trend,
        seasonality:    forecastResult.seasonality,
        mape:           forecastResult.mape,
        model:          forecastResult.model,
        upperBound:     forecastResult.upperBound,
        lowerBound:     forecastResult.lowerBound,
        historicalValues: series,
        labels,
        explanation:    forecastResult.explanation,
      });
    }

    // Sort: HIGH risk first, then by days of stock
    results.sort((a, b) => {
      const riskOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const rd = riskOrder[a.stockoutRisk] - riskOrder[b.stockoutRisk];
      return rd !== 0 ? rd : a.daysOfStock - b.daysOfStock;
    });

    sendSuccess(res, {
      warehouseName: warehouse.name,
      periodDays,
      method: MODEL_LABELS[method] ?? method,
      totalProducts: results.length,
      highRisk:   results.filter(r => r.stockoutRisk === 'HIGH').length,
      mediumRisk: results.filter(r => r.stockoutRisk === 'MEDIUM').length,
      lowRisk:    results.filter(r => r.stockoutRisk === 'LOW').length,
      forecasts:  results,
    });
  } catch (err) { next(err); }
};
