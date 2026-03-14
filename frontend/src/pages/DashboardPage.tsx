// src/pages/DashboardPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api/services';
import type { DashboardStats, Operation } from '../types';
import { formatDateTime, statusBadgeClass, typeTagClass, movementColor, movementPrefix, timeAgo } from '../utils';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await dashboardApi.getStats();
      setStats(res.data.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton />;
  if (!stats) return null;

  const { kpis, recentMovements, recentOps } = stats;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5">Real-time inventory overview</p>
        </div>
        <button onClick={load} className="btn-ghost text-xs">↻ Refresh</button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-3.5 mb-6">
        <KpiCard label="Total Products" value={kpis.totalProducts.toLocaleString()} accent="kpi-blue"
                 onClick={() => navigate('/products')} sub="across all locations" />
        <KpiCard label="Low / Out of Stock" value={kpis.lowStock + kpis.outOfStock}
                 accent="kpi-danger" onClick={() => navigate('/products')}
                 sub={`${kpis.outOfStock} out of stock`} danger />
        <KpiCard label="Pending Receipts" value={kpis.pendingReceipts} accent="kpi-warn"
                 onClick={() => navigate('/receipts')} sub="awaiting validation" />
        <KpiCard label="Pending Deliveries" value={kpis.pendingDeliveries} accent="kpi-purple"
                 onClick={() => navigate('/deliveries')} sub="to be dispatched" />
        <KpiCard label="Transfers Scheduled" value={kpis.scheduledTransfers} accent="kpi-green"
                 onClick={() => navigate('/transfers')} sub="in progress" />
      </div>

      {/* Main panels */}
      <div className="grid grid-cols-[1fr_360px] gap-4 mb-4">
        {/* Recent operations */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Operations</span>
            <button onClick={() => navigate('/history')} className="text-accent text-xs hover:underline">View all →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(recentOps as Operation[]).map((op) => (
                  <tr key={op.id} onClick={() => navigate(`/${op.type?.toLowerCase()}s`)}>
                    <td className="font-mono text-xs">{op.reference}</td>
                    <td><span className={typeTagClass(op.type!)}>{op.type}</span></td>
                    <td className="text-text-secondary">
                      {op.supplier?.name ?? op.fromLocation?.name ?? '—'}
                    </td>
                    <td><span className={statusBadgeClass(op.status!)}>{op.status}</span></td>
                    <td className="text-text-muted text-xs">{op.createdAt ? formatDateTime(op.createdAt) : '—'}</td>
                  </tr>
                ))}
                {recentOps.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-text-muted">No operations yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live activity feed */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Activity</span>
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
          </div>
          <div>
            {recentMovements.map((m) => (
              <div key={m.id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-bg-surface2 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 font-bold
                  ${m.type === 'IN' ? 'bg-status-success/10 text-status-success' :
                    m.type === 'OUT' ? 'bg-status-danger/10 text-status-danger' :
                    m.type === 'TRANSFER' ? 'bg-accent/10 text-accent' :
                    'bg-status-warn/10 text-status-warn'}`}>
                  {m.type === 'IN' ? '↓' : m.type === 'OUT' ? '↑' : m.type === 'TRANSFER' ? '⇄' : '△'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-text-primary truncate">
                    <span className={`font-semibold ${movementColor(m.type, m.quantity)}`}>
                      {movementPrefix(m.type, m.quantity)}{Math.abs(m.quantity)}
                    </span>
                    {' · '}
                    <span className="font-mono text-[11px] text-text-muted">{m.reference}</span>
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {m.user.name} · {timeAgo(m.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {recentMovements.length === 0 && (
              <div className="py-8 text-center text-text-muted text-sm">No recent movements</div>
            )}
          </div>
        </div>
      </div>

      {/* Throughput bar chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Weekly Throughput (units)</span>
          <div className="flex gap-4 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-accent inline-block" /> In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-accent-orange inline-block" /> Out
            </span>
          </div>
        </div>
        <div className="p-5">
          <ThroughputChart />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, accent, onClick, sub, danger }: {
  label: string; value: number | string; accent: string;
  onClick?: () => void; sub?: string; danger?: boolean;
}) {
  return (
    <div className={`kpi-card ${accent}`} onClick={onClick}>
      <div className="text-[11px] text-text-secondary uppercase tracking-wide font-medium mb-2">{label}</div>
      <div className={`font-head text-[28px] font-bold leading-none ${danger ? 'text-status-danger' : 'text-text-primary'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="text-[11px] text-text-muted mt-1.5">{sub}</div>}
    </div>
  );
}

function ThroughputChart() {
  // Static demo data — connect to real API endpoint for live data
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const inData  = [42, 68, 53, 87, 74, 36, 61];
  const outData = [29, 51, 44, 62, 88, 41, 55];
  const max = Math.max(...inData, ...outData);

  return (
    <div className="flex items-end gap-3 h-28">
      {days.map((day, i) => (
        <div key={day} className="flex-1 flex flex-col items-center gap-1">
          <div className="text-[10px] text-text-muted font-medium">{inData[i]}</div>
          <div className="flex gap-1 items-end w-full" style={{ height: 80 }}>
            <div
              className="flex-1 rounded-t-sm bg-accent hover:brightness-125 transition-all cursor-pointer"
              style={{ height: `${(inData[i] / max) * 80}px` }}
              title={`In: ${inData[i]}`}
            />
            <div
              className="flex-1 rounded-t-sm hover:brightness-125 transition-all cursor-pointer"
              style={{ height: `${(outData[i] / max) * 80}px`, background: '#F7914F' }}
              title={`Out: ${outData[i]}`}
            />
          </div>
          <div className="text-[10px] text-text-muted">{day}</div>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-48 bg-bg-surface2 rounded" />
      <div className="grid grid-cols-5 gap-3.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-bg-surface2 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="h-64 bg-bg-surface2 rounded-lg" />
        <div className="h-64 bg-bg-surface2 rounded-lg" />
      </div>
    </div>
  );
}
