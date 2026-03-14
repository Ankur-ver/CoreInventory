// src/pages/HistoryPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { stockApi } from '../api/services';
import type { StockMovement } from '../types';
import { formatDateTime, movementColor, movementPrefix } from '../utils';
import toast from 'react-hot-toast';

export default function HistoryPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (typeFilter) params.type = typeFilter;
      const res = await stockApi.getMovements(params);
      setMovements(res.data.data.movements);
      setTotal(res.data.data.total);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Move History</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Complete stock ledger — {total.toLocaleString()} movements logged
          </p>
        </div>
        <button className="btn-ghost text-xs">↓ Export CSV</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        {(['', 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === t
                ? 'bg-accent border-accent text-white'
                : 'bg-bg-surface border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
            }`}
          >
            {t === '' ? 'All' : t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-text-muted animate-pulse text-sm">Loading ledger…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Quantity</th>
                  <th>User</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="text-text-muted text-xs font-mono">{formatDateTime(m.createdAt)}</td>
                    <td>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        m.type === 'IN'         ? 'bg-status-success/10 text-status-success' :
                        m.type === 'OUT'        ? 'bg-status-danger/10 text-status-danger' :
                        m.type === 'TRANSFER'   ? 'bg-accent/10 text-accent' :
                                                  'bg-status-warn/10 text-status-warn'
                      }`}>{m.type}</span>
                    </td>
                    <td className="font-mono text-xs">{m.reference}</td>
                    <td>
                      <span className={`font-head font-bold text-sm ${movementColor(m.type, m.quantity)}`}>
                        {movementPrefix(m.type, m.quantity)}{Math.abs(m.quantity)}
                      </span>
                    </td>
                    <td className="text-text-secondary text-xs">{m.user.name}</td>
                    <td className="text-text-muted text-xs">{m.note ?? '—'}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-text-muted">No movements logged yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-text-muted">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-1">
              <button
                className="btn-ghost text-xs px-3 py-1.5"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >← Prev</button>
              <button
                className="btn-ghost text-xs px-3 py-1.5"
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
