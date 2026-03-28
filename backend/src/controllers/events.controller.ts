// src/controllers/events.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';
import { addSSEClient, removeSSEClient, eventBus } from '../utils/eventBus';

// ── SSE Stream ────────────────────────────────────────────────────────────────
export const streamEvents = (req: Request, res: Response): void => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || '*');
  res.flushHeaders();

  // Send recent events immediately on connect
  const recent = eventBus.getRecentEvents().slice(0, 20);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', events: recent })}\n\n`);

  // Keep-alive ping every 25s
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25000);

  addSSEClient(res);

  req.on('close', () => {
    clearInterval(ping);
    removeSSEClient(res);
  });
};

// ── REST endpoints ────────────────────────────────────────────────────────────
export const getEvents = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, severity, status, page = '1', limit = '50' } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const where: Record<string, unknown> = {};
    if (type)     where.type     = String(type);
    if (severity) where.severity = String(severity);
    if (status)   where.status   = String(status);

    const [events, total] = await Promise.all([
      prisma.inventoryEvent.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.inventoryEvent.count({ where }),
    ]);
    sendSuccess(res, { events, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

export const acknowledgeEvent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = await prisma.inventoryEvent.update({
      where: { id: req.params.id },
      data:  { status: 'ACKNOWLEDGED', processedAt: new Date() },
    });
    sendSuccess(res, event, 'Event acknowledged');
  } catch (err) { next(err); }
};

export const acknowledgeAll = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.inventoryEvent.updateMany({
      where: { status: { in: ['PENDING', 'PROCESSED'] } },
      data:  { status: 'ACKNOWLEDGED', processedAt: new Date() },
    });
    sendSuccess(res, null, 'All events acknowledged');
  } catch (err) { next(err); }
};

export const getEventStats = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [byType, bySeverity, byStatus, recent] = await Promise.all([
      prisma.inventoryEvent.groupBy({ by: ['type'],     _count: { type: true } }),
      prisma.inventoryEvent.groupBy({ by: ['severity'], _count: { severity: true } }),
      prisma.inventoryEvent.groupBy({ by: ['status'],   _count: { status: true } }),
      prisma.inventoryEvent.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    sendSuccess(res, {
      byType:     byType.map((r: any) => ({ type: r.type,         count: r._count.type })),
      bySeverity: bySeverity.map((r: any) => ({ severity: r.severity, count: r._count.severity })),
      byStatus:   byStatus.map((r: any) => ({ status: r.status,     count: r._count.status })),
      last24h:    recent,
    });
  } catch (err) { next(err); }
};
