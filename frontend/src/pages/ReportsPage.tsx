// src/pages/ReportsPage.tsx
import { useEffect, useRef, useState } from 'react';
import { stockApi, operationApi } from '../api/services';
import type { StockMovement, Operation } from '../types';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CHART_COLORS = {
  bar: '#4F8EF7',
  barHover: '#7EB0FF',
  pieColors: ['#4F8EF7', '#7B5CEA', '#00D4A8', '#F7C04F', '#F7914F', '#F75F5F', '#4FF79A', '#F4B942'],
};

function useChart(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  type: 'bar' | 'pie' | 'doughnut',
  data: { labels: string[]; datasets: object[] },
  options: object
) {
  useEffect(() => {
    if (!canvasRef.current || !data.labels.length) return;
    let chart: unknown;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => {
      const C = (window as unknown as { Chart: new (ctx: unknown, cfg: unknown) => { destroy: () => void } }).Chart;
      if (!C || !canvasRef.current) return;
      chart = new C(canvasRef.current, { type, data, options });
    };
    if (!(window as unknown as { Chart?: unknown }).Chart) {
      document.head.appendChild(script);
    } else {
      const C = (window as unknown as { Chart: new (ctx: unknown, cfg: unknown) => { destroy: () => void } }).Chart;
      if (canvasRef.current) chart = new C(canvasRef.current, { type, data, options });
    }
    return () => {
      if (chart && typeof chart === 'object' && 'destroy' in chart) {
        (chart as { destroy: () => void }).destroy();
      }
    };
  }, [JSON.stringify(data)]);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const barRef = useRef<HTMLCanvasElement>(null);
  const pieRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all([
      stockApi.getMovements({ limit: 200 }),
      operationApi.getAll({ limit: 200 }),
    ]).then(([mvRes, opRes]) => {
      setMovements(mvRes.data.data.movements);
      setOperations(opRes.data.data.operations);
    }).catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, []);

  // ── Bar chart: top SKUs by movement ──────────────────────────────────────
  const skuMap: Record<string, number> = {};
  movements.forEach(m => {
    const key = m.reference.split('-')[0] + '-' + (m.productId?.slice(-4) ?? '????');
    skuMap[key] = (skuMap[key] ?? 0) + Math.abs(m.quantity);
  });
  const topSKUs = Object.entries(skuMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const barData = {
    labels: topSKUs.length > 0 ? topSKUs.map(([k]) => k) : ['SKU-1','SKU-2','SKU-3','SKU-4','SKU-5','SKU-6','SKU-7','SKU-8'],
    datasets: [{
      label: 'Movement Volume',
      data: topSKUs.length > 0 ? topSKUs.map(([, v]) => v) : [22, 30, 17, 24, 26, 15, 7, 6],
      backgroundColor: CHART_COLORS.bar,
      hoverBackgroundColor: CHART_COLORS.barHover,
      borderRadius: 4,
      borderSkipped: false,
    }],
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1A1D24', titleColor: '#F0F2F7', bodyColor: '#8892A4', borderColor: '#2A2E38', borderWidth: 1 } },
    scales: {
      x: { grid: { color: '#2A2E38', lineWidth: 0.5 }, ticks: { color: '#8892A4', font: { size: 11 } } },
      y: { grid: { color: '#2A2E38', lineWidth: 0.5 }, ticks: { color: '#8892A4', font: { size: 11 } }, beginAtZero: true },
    },
  };

  // ── Pie chart: order status distribution ─────────────────────────────────
  const statusMap: Record<string, number> = {};
  operations.forEach(op => { statusMap[op.status] = (statusMap[op.status] ?? 0) + 1; });

  // Merge with SO statuses from in-memory store
  const pieLabels = Object.keys(statusMap).length > 0 ? Object.keys(statusMap) : ['Draft','Open','Partially Received','Received','Canceled','Fulfilled','Partially Fulfilled'];
  const pieValues = Object.keys(statusMap).length > 0
    ? Object.values(statusMap)
    : [2, 3, 2, 1, 1, 3, 2];

  const pieData = {
    labels: pieLabels,
    datasets: [{
      data: pieValues,
      backgroundColor: CHART_COLORS.pieColors.slice(0, pieLabels.length),
      borderColor: '#111318',
      borderWidth: 2,
      hoverOffset: 6,
    }],
  };
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#8892A4', font: { size: 11 }, padding: 12, boxWidth: 12, boxHeight: 12 },
      },
      tooltip: { backgroundColor: '#1A1D24', titleColor: '#F0F2F7', bodyColor: '#8892A4', borderColor: '#2A2E38', borderWidth: 1 },
    },
  };

  useChart(barRef, 'bar', barData, barOptions);
  useChart(pieRef, 'pie', pieData, pieOptions);

  // ── Summary KPIs ──────────────────────────────────────────────────────────
  const totalIn  = movements.filter(m => m.type === 'IN').reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter(m => m.type === 'OUT').reduce((s, m) => s + Math.abs(m.quantity), 0);
  const totalOps = operations.length;
  const doneOps  = operations.filter(o => o.status === 'DONE').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Reports</h1>
          <p className="text-text-secondary text-sm mt-0.5">Inventory analytics & order insights</p>
        </div>
        <button
          className="btn-ghost text-xs flex items-center gap-1.5"
          onClick={() => window.print()}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
          Print / Export
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        {[
          { label: 'Total Movements', value: movements.length.toLocaleString(), sub: 'all time', accent: 'kpi-blue' },
          { label: 'Units Received', value: totalIn.toLocaleString(), sub: 'stock in', accent: 'kpi-green' },
          { label: 'Units Dispatched', value: totalOut.toLocaleString(), sub: 'stock out', accent: 'kpi-danger' },
          { label: 'Operations Done', value: `${doneOps} / ${totalOps}`, sub: 'completion rate', accent: 'kpi-purple' },
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.accent}`}>
            <div className="text-[11px] text-text-secondary uppercase tracking-wide font-medium mb-2">{k.label}</div>
            <div className="font-head text-[26px] font-bold text-text-primary leading-none">{k.value}</div>
            <div className="text-[11px] text-text-muted mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Overview</span>
        </div>

        {loading ? (
          <div className="h-72 flex items-center justify-center text-text-muted animate-pulse text-sm">Loading charts…</div>
        ) : (
          <div className="grid grid-cols-[1fr_420px] gap-0 divide-x divide-border">
            {/* Bar chart */}
            <div className="p-6">
              <div className="text-[13px] font-medium text-text-primary mb-4">Top SKUs by Movement</div>
              <div style={{ height: 260 }}>
                <canvas ref={barRef} />
              </div>
            </div>

            {/* Pie chart */}
            <div className="p-6">
              <div className="text-[13px] font-medium text-text-primary mb-4">Order Status Distribution</div>
              <div style={{ height: 260 }}>
                <canvas ref={pieRef} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Movement breakdown table */}
      <div className="card mt-4">
        <div className="card-header">
          <span className="card-title">Recent Movement Breakdown</span>
          <span className="text-[12px] text-text-muted">Last 15 entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Qty</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 15).map(m => (
                <tr key={m.id}>
                  <td className="text-text-muted text-xs font-mono">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      m.type === 'IN' ? 'bg-status-success/10 text-status-success' :
                      m.type === 'OUT' ? 'bg-status-danger/10 text-status-danger' :
                      m.type === 'TRANSFER' ? 'bg-accent/10 text-accent' :
                      'bg-status-warn/10 text-status-warn'
                    }`}>{m.type}</span>
                  </td>
                  <td className="font-mono text-xs">{m.reference}</td>
                  <td className={`font-mono font-bold ${m.type === 'IN' ? 'text-status-success' : m.type === 'OUT' ? 'text-status-danger' : 'text-text-secondary'}`}>
                    {m.type === 'IN' ? '+' : m.type === 'OUT' ? '−' : '⇄'}{Math.abs(m.quantity)}
                  </td>
                  <td className="text-text-muted text-xs">{m.user?.name ?? '—'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-text-muted">No movements recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
