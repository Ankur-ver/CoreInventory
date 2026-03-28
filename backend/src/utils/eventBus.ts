// src/utils/eventBus.ts
import prisma from './prisma';

// ── Types ─────────────────────────────────────────────────────────────────────
export type EventType =
  | 'STOCK_LOW' | 'STOCK_OUT' | 'PO_CREATED' | 'PO_RECEIVED'
  | 'SO_CREATED' | 'SO_FULFILLED' | 'TRANSFER_REQUESTED' | 'TRANSFER_COMPLETED'
  | 'ADJUSTMENT_MADE' | 'FORECAST_GENERATED' | 'REORDER_TRIGGERED';

type Severity = 'info' | 'warning' | 'critical';

export interface EventPayload {
  type: EventType;
  message: string;
  severity?: Severity;
  entityId?: string;
  entityType?: string;
  payload: Record<string, unknown>;
}

type EventHandler = (event: EventPayload) => Promise<void> | void;

// ── In-memory event bus with persistent logging ───────────────────────────────
class EventBus {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private recentEvents: EventPayload[] = []; // in-memory cache for SSE

  /** Register a handler for an event type */
  on(type: EventType, handler: EventHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  /** Emit an event — persists to DB and notifies all handlers */
  async emit(event: EventPayload): Promise<void> {
    // 1. Persist to DB (fire and forget — don't block business logic)
    prisma.inventoryEvent.create({
      data: {
        type:       event.type as never,
        status:     'PENDING',
        payload:    event.payload as never,
        entityId:   event.entityId,
        entityType: event.entityType,
        message:    event.message,
        severity:   event.severity ?? 'info',
      },
    }).then((record: any) => {
      // Mark processed
      return prisma.inventoryEvent.update({
        where: { id: record.id },
        data:  { status: 'PROCESSED', processedAt: new Date() },
      });
    }).catch((err: any) => console.error('[EventBus] DB persist error:', err));

    // 2. Cache for SSE stream
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 100) this.recentEvents.pop();

    // 3. Notify SSE clients
    sseClients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch { /* client disconnected */ }
    });

    // 4. Run handlers
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.allSettled(handlers.map(h => h(event)));
  }

  getRecentEvents() { return this.recentEvents; }
}

// ── SSE client registry ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sseClients = new Set<any>();

export function addSSEClient(res: unknown) { sseClients.add(res); }
export function removeSSEClient(res: unknown) { sseClients.delete(res); }

// ── Singleton ─────────────────────────────────────────────────────────────────
export const eventBus = new EventBus();

// ── Built-in handlers ─────────────────────────────────────────────────────────

// Auto-trigger reorder when stock goes low
eventBus.on('STOCK_LOW', async (event) => {
  const { productId, productName, quantity, reorderPoint, warehouseId } = event.payload as {
    productId: string; productName: string; quantity: number;
    reorderPoint: number; warehouseId: string;
  };

  console.log(`[EventBus] STOCK_LOW: ${productName} (${quantity} left, reorder at ${reorderPoint})`);

  // Auto-emit reorder suggestion
  await eventBus.emit({
    type:       'REORDER_TRIGGERED',
    message:    `Auto-reorder suggested for ${productName} — only ${quantity} units remaining`,
    severity:   'warning',
    entityId:   productId,
    entityType: 'Product',
    payload:    { productId, productName, currentQty: quantity, reorderPoint, warehouseId, suggestedQty: reorderPoint * 3 },
  });
});

eventBus.on('STOCK_OUT', async (event) => {
  const { productName } = event.payload as { productName: string };
  console.log(`[EventBus] CRITICAL STOCK_OUT: ${productName}`);
});

eventBus.on('PO_RECEIVED', async (event) => {
  const { reference } = event.payload as { reference: string };
  console.log(`[EventBus] PO received: ${reference} — stock updated`);
});

eventBus.on('SO_FULFILLED', async (event) => {
  const { reference } = event.payload as { reference: string };
  console.log(`[EventBus] SO fulfilled: ${reference}`);
});

eventBus.on('REORDER_TRIGGERED', async (event) => {
  console.log(`[EventBus] Reorder triggered:`, event.message);
});

export default eventBus;
