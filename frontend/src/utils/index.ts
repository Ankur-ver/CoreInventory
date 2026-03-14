// src/utils/index.ts
import { format, formatDistanceToNow } from 'date-fns';
import type { OperationType, OperationStatus, StockStatus } from '../types';

export const formatDate = (d: string | Date) => format(new Date(d), 'MMM d, yyyy');
export const formatDateTime = (d: string | Date) => format(new Date(d), 'MMM d · HH:mm');
export const timeAgo = (d: string | Date) => formatDistanceToNow(new Date(d), { addSuffix: true });

export const statusBadgeClass = (status: OperationStatus): string => {
  const map: Record<OperationStatus, string> = {
    DONE: 'badge-done', READY: 'badge-ready', WAITING: 'badge-waiting',
    DRAFT: 'badge-draft', CANCELED: 'badge-canceled',
  };
  return map[status] ?? 'badge-draft';
};

export const typeTagClass = (type: OperationType): string => {
  const map: Record<OperationType, string> = {
    RECEIPT: 'tag-receipt', DELIVERY: 'tag-delivery',
    TRANSFER: 'tag-transfer', ADJUSTMENT: 'tag-adjustment',
  };
  return map[type] ?? 'tag-receipt';
};

export const stockStatusColor = (status: StockStatus): string => {
  const map: Record<StockStatus, string> = {
    OK: 'text-status-success', LOW: 'text-status-warn', OUT: 'text-status-danger',
  };
  return map[status];
};

export const movementColor = (type: string, qty: number): string => {
  if (type === 'IN') return 'text-status-success';
  if (type === 'OUT') return 'text-status-danger';
  if (type === 'ADJUSTMENT') return qty >= 0 ? 'text-status-success' : 'text-status-danger';
  return 'text-text-secondary';
};

export const movementPrefix = (type: string, qty: number): string => {
  if (type === 'IN') return '+';
  if (type === 'OUT') return '−';
  if (type === 'ADJUSTMENT') return qty >= 0 ? '+' : '−';
  return '⇄';
};

export const cn = (...classes: (string | undefined | false | null)[]): string =>
  classes.filter(Boolean).join(' ');
