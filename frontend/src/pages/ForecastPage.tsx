// src/pages/ForecastPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';
import { warehouseApi } from '../api/services';
import type { Warehouse } from '../types';
import toast from 'react-hot-toast';

interface ModelResult {
  model: string;
  forecastQty: number;
  confidence: number;
  mape: number;
  rmse: number;
  mae: number;
  trend: string;
  seasonality: boolean;
  periodicity: number;
  upperBound: number;
  lowerBound: number;
  modelParams: Record<string, number>;
  explanation: string;
  fitted?: number[];
}

interface ForecastItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  forecastQty: number;
  daysOfStock: number;
  stockoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedOrder: number;
  confidence: number;
  trend: string;
  seasonality: boolean;
  mape: number;
  model: string;
  upperBound: number;
  lowerBound: number;
  historicalValues: number[];
  labels: string[];
  explanation: string;
}

interface BulkData {
  warehouseName: string;
  periodDays: number;
  method: string;
  totalProducts: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  forecasts: ForecastItem[];
}

const RISK_BG: Record<string, string> = {
  HIGH:   'bg-status-danger/10 text-status-danger',
  MEDIUM: 'bg-status-warn/10 text-status-warn',
  LOW:    'bg-status-success/10 text-status-success',
};

const TREND_ICON: Record<string, string> = {
  RISING:   '↑',
  FALLING:  '↓',
  STABLE:   '→',
  VOLATILE: '⚡',
};
const TREND_COLOR: Record<string, string> = {
  RISING:   'text-status-success',
  FALLING:  'text-status-danger',
  STABLE:   'text-text-muted',
  VOLATILE: 'text-status-warn',
};

const METHODS = [
  { value: 'ENSEMBLE',               label: 'Ensemble (Recommended)',      desc: 'Runs all models, weights by accuracy, auto-selects best' },
  { value: 'HOLT_WINTERS',           label: 'Holt-Winters',                desc: 'Triple exponential smoothing — captures level, trend, seasonality' },
  { value: 'ARIMA',                  label: 'ARIMA(1,1,1)',                 desc: 'Autoregressive integrated moving average — momentum-based' },
  { value: 'PROPHET',                label: 'Prophet-lite',                 desc: 'Fourier-basis seasonality + piecewise linear trend (inspired by Meta Prophet)' },
  { value: 'SEASONAL_DECOMPOSITION', label: 'STL Decomposition',           desc: 'Separates trend, seasonality, and residual — then extrapolates' },
];

export default function ForecastPage() {
  const [warehouses, setWarehouses]   = useState<Warehouse[]>([]);
  const [selectedWH, setSelectedWH]  = useState('');
  const [method, setMethod]          = useState('ENSEMBLE');
  const [periodDays, setPeriodDays]  = useState(30);
  const [data, setData]              = useState<BulkData | null>(null);
  const [loading, setLoading]        = useState(false);
  const [sortBy, setSortBy]          = useState<'risk' | 'stock' | 'confidence' | 'mape'>('risk');
  const [filterRisk, setFilterRisk]  = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ForecastItem | null>(null);
  const [detailData, setDetailData]  = useState<{ allModels: ModelResult[]; ml: ModelResult & { series: number[]; labels: string[] } } | null>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInst = useRef<unknown>(null);

  useEffect(() => {
    warehouseApi.getAll().then(r => {
      setWarehouses(r.data.data);
      if (r.data.data.length > 0) setSelectedWH(r.data.data[0].id);
    });
    // Load Chart.js
    if (!(window as unknown as { Chart?: unknown }).Chart) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      document.head.appendChild(s);
    }
  }, []);

  // Draw chart when detail modal opens
  useEffect(() => {
    if (!detailData || !chartRef.current) return;
    const C = (window as unknown as { Chart?: new (...a: unknown[]) => { destroy: () => void } }).Chart;
    if (!C) return;
    if (chartInst.current) (chartInst.current as { destroy: () => void }).destroy();

    const series  = detailData.ml.series;
    const labels  = detailData.ml.labels;
    const fitted  = detailData.ml.fitted ?? [];
    const upper   = series.map(() => detailData.ml.upperBound);
    const lower   = series.map(() => detailData.ml.lowerBound);

    chartInst.current = new C(chartRef.current, {
      type: 'line',
      data: {
        labels: [...labels, 'Forecast'],
        datasets: [
          {
            label: 'Actual Demand',
            data: [...series, null],
            borderColor: '#4F8EF7', backgroundColor: 'rgba(79,142,247,0.08)',
            borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false,
          },
          {
            label: 'Fitted (In-sample)',
            data: [...fitted.slice(0, series.length), null],
            borderColor: '#00D4A8', backgroundColor: 'transparent',
            borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0.3,
          },
          {
            label: 'Forecast',
            data: [...series.map(() => null as null), detailData.ml.forecastQty],
            borderColor: '#F7C04F', backgroundColor: 'rgba(247,192,79,0.15)',
            borderWidth: 2, pointRadius: 6, pointStyle: 'triangle', tension: 0,
          },
          {
            label: '95% Upper',
            data: [...upper, detailData.ml.upperBound],
            borderColor: 'rgba(247,95,95,0.3)', backgroundColor: 'rgba(247,95,95,0.05)',
            borderWidth: 1, borderDash: [2, 4], pointRadius: 0, fill: false,
          },
          {
            label: '95% Lower',
            data: [...lower, detailData.ml.lowerBound],
            borderColor: 'rgba(79,247,154,0.3)', backgroundColor: 'rgba(79,247,154,0.05)',
            borderWidth: 1, borderDash: [2, 4], pointRadius: 0, fill: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8892A4', font: { size: 11 }, padding: 12, boxWidth: 10 } },
          tooltip: { backgroundColor: '#1A1D24', titleColor: '#F0F2F7', bodyColor: '#8892A4', borderColor: '#2A2E38', borderWidth: 1 },
        },
        scales: {
          x: { grid: { color: '#2A2E38' }, ticks: { color: '#8892A4', font: { size: 10 }, maxTicksLimit: 8 } },
          y: { grid: { color: '#2A2E38' }, ticks: { color: '#8892A4', font: { size: 10 } }, beginAtZero: true },
        },
      },
    });
  }, [detailData]);

  const runForecast = useCallback(async () => {
    if (!selectedWH) { toast.error('Select a warehouse'); return; }
    setLoading(true);
    try {
      const res = await api.get<{ data: BulkData }>(
        `/forecasts/bulk/${selectedWH}?method=${method}&periodDays=${periodDays}`
      );
      setData(res.data.data);
      toast.success(`ML forecast complete — ${res.data.data.totalProducts} products analysed`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Forecast failed');
    } finally { setLoading(false); }
  }, [selectedWH, method, periodDays]);

  const openDetail = async (item: ForecastItem) => {
    setSelectedProduct(item);
    setDetailData(null);
    try {
      const res = await api.get<{ data: { allModels: ModelResult[]; ml: ModelResult & { series: number[]; labels: string[] } } }>(
        `/forecasts/${item.productId}/${selectedWH}?method=ENSEMBLE&periodDays=${periodDays}`
      );
      setDetailData(res.data.data);
    } catch { toast.error('Failed to load model details'); }
  };

  const sorted = [...(data?.forecasts ?? [])].sort((a, b) => {
    if (sortBy === 'risk')       { const r = { HIGH:0, MEDIUM:1, LOW:2 }; return r[a.stockoutRisk]-r[b.stockoutRisk]; }
    if (sortBy === 'stock')      return a.daysOfStock - b.daysOfStock;
    if (sortBy === 'confidence') return b.confidence - a.confidence;
    if (sortBy === 'mape')       return a.mape - b.mape;
    return 0;
  }).filter(f => !filterRisk || f.stockoutRisk === filterRisk);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">ML Demand Forecasting</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Holt-Winters · ARIMA · Prophet-lite · STL Decomposition · Ensemble
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-5 mb-5">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="label">Warehouse</label>
            <select className="select" value={selectedWH} onChange={e => setSelectedWH(e.target.value)}>
              <option value="">Select warehouse…</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">ML Model</label>
            <select className="select" value={method} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Forecast Period</label>
            <select className="select" value={periodDays} onChange={e => setPeriodDays(Number(e.target.value))}>
              {[7,14,30,60,90].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full justify-center" onClick={runForecast} disabled={loading || !selectedWH}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Running ML…
                </span>
              ) : '🤖 Run ML Forecast'}
            </button>
          </div>
        </div>

        {/* Model description */}
        <div className="bg-bg-surface2 rounded-lg px-4 py-3 border border-border">
          <div className="text-[12px] font-medium text-text-primary mb-0.5">
            {METHODS.find(m => m.value === method)?.label}
          </div>
          <div className="text-[12px] text-text-muted">
            {METHODS.find(m => m.value === method)?.desc}
          </div>
        </div>
      </div>

      {/* Results */}
      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-5 gap-3.5 mb-5">
            {[
              { label:'Products Analysed', value:data.totalProducts,  accent:'kpi-blue' },
              { label:'High Risk',         value:data.highRisk,       accent:'kpi-danger', danger:true },
              { label:'Medium Risk',       value:data.mediumRisk,     accent:'kpi-warn' },
              { label:'Low Risk',          value:data.lowRisk,        accent:'kpi-green' },
              { label:'Total to Order',    value:data.forecasts.reduce((s,f)=>s+f.suggestedOrder,0).toLocaleString(), accent:'kpi-purple' },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.accent}`}>
                <div className="text-[11px] text-text-secondary uppercase tracking-wide font-medium mb-2">{k.label}</div>
                <div className={`font-head text-[26px] font-bold leading-none ${k.danger ? 'text-status-danger':'text-text-primary'}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm text-text-secondary">
              {data.warehouseName} · {data.periodDays}-day period · <span className="text-accent font-medium">{data.method}</span>
            </span>
            <div className="flex-1" />
            {['','HIGH','MEDIUM','LOW'].map(r => (
              <button key={r} onClick={() => setFilterRisk(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filterRisk===r ? 'bg-accent border-accent text-white' : 'border-border text-text-secondary hover:border-border-strong'
                }`}>
                {r || 'All Risk'}
              </button>
            ))}
            <select className="select text-xs w-40" value={sortBy} onChange={e => setSortBy(e.target.value as 'risk'|'stock'|'confidence'|'mape')}>
              <option value="risk">Sort: Risk</option>
              <option value="stock">Sort: Days Left</option>
              <option value="confidence">Sort: Confidence ↓</option>
              <option value="mape">Sort: MAPE ↑</option>
            </select>
          </div>

          {/* Table */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Forecast ({data.periodDays}d)</th>
                    <th>Interval (95%)</th>
                    <th>Days of Stock</th>
                    <th>Risk</th>
                    <th>Trend</th>
                    <th>Confidence</th>
                    <th>MAPE</th>
                    <th>Suggest Order</th>
                    <th>History</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={12} className="text-center py-10 text-text-muted">No products match filter</td></tr>
                  ) : sorted.map(f => (
                    <tr key={f.productId}>
                      <td>
                        <div className="font-medium">{f.productName}</div>
                        <div className="text-[10px] text-text-muted font-mono">{f.sku} · {f.category}</div>
                        <div className="text-[10px] text-text-muted truncate max-w-[160px]" title={f.model}>
                          {f.model.split('(')[0].trim()}
                        </div>
                      </td>
                      <td>
                        <span className="font-mono font-semibold">{f.currentStock.toLocaleString()}</span>
                        <span className="text-[11px] text-text-muted ml-1">{f.unit}</span>
                      </td>
                      <td>
                        <span className="font-mono text-accent font-semibold">{f.forecastQty.toLocaleString()}</span>
                        <span className="text-[11px] text-text-muted ml-1">{f.unit}</span>
                      </td>
                      <td>
                        <div className="text-[11px] font-mono">
                          <span className="text-status-success">{f.lowerBound}</span>
                          <span className="text-text-muted"> – </span>
                          <span className="text-status-danger">{f.upperBound}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`font-mono font-bold text-sm ${
                          f.daysOfStock < 7 ? 'text-status-danger' :
                          f.daysOfStock < 30 ? 'text-status-warn' : 'text-status-success'
                        }`}>{f.daysOfStock > 365 ? '∞' : `${f.daysOfStock}d`}</span>
                      </td>
                      <td>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${RISK_BG[f.stockoutRisk]}`}>
                          {f.stockoutRisk}
                        </span>
                      </td>
                      <td>
                        <span className={`text-sm font-bold ${TREND_COLOR[f.trend]}`}>
                          {TREND_ICON[f.trend]} {f.trend}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-bg-surface3 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${f.confidence > 70 ? 'bg-status-success' : f.confidence > 50 ? 'bg-status-warn' : 'bg-status-danger'}`}
                              style={{ width: `${f.confidence}%` }} />
                          </div>
                          <span className="text-[11px] font-mono">{f.confidence}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`text-[11px] font-mono font-semibold ${
                          f.mape < 20 ? 'text-status-success' : f.mape < 40 ? 'text-status-warn' : 'text-status-danger'
                        }`}>{f.mape}%</span>
                      </td>
                      <td>
                        {f.suggestedOrder > 0
                          ? <span className="font-mono font-semibold text-accent">{f.suggestedOrder} {f.unit}</span>
                          : <span className="text-text-muted text-xs">Sufficient</span>}
                      </td>
                      <td>
                        <MiniSparkline values={f.historicalValues} forecast={f.forecastQty} />
                      </td>
                      <td>
                        <button onClick={() => openDetail(f)}
                          className="text-[11px] text-accent hover:underline font-medium whitespace-nowrap">
                          Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <span className="text-[12px] text-text-muted">{sorted.length} products</span>
              <button onClick={() => {
                const rows = [['Product','SKU','Current','Forecast','Lower','Upper','Days','Risk','Trend','Confidence%','MAPE%','SuggestOrder','Model'],
                  ...sorted.map(f => [f.productName,f.sku,f.currentStock,f.forecastQty,f.lowerBound,f.upperBound,f.daysOfStock,f.stockoutRisk,f.trend,f.confidence,f.mape,f.suggestedOrder,f.model])];
                const a = document.createElement('a');
                a.href = 'data:text/csv,' + encodeURIComponent(rows.map(r => r.join(',')).join('\n'));
                a.download = `ml-forecast-${data.warehouseName}-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }} className="btn-ghost text-xs">↓ Export CSV</button>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center py-24 text-text-muted">
          <div className="text-5xl mb-4 opacity-20">🤖</div>
          <p className="text-sm font-medium mb-1">ML-powered demand forecasting</p>
          <p className="text-[12px] max-w-md text-center">
            Runs Holt-Winters, ARIMA, Prophet-lite, and STL decomposition in parallel.
            The Ensemble model auto-selects and weights them by accuracy (MAPE).
          </p>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget&&setSelectedProduct(null)}>
          <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
              <div>
                <h2 className="font-head font-bold text-[16px] text-text-primary">{selectedProduct.productName}</h2>
                <p className="text-[12px] text-text-muted mt-0.5">{selectedProduct.sku} · {selectedProduct.category} · {periodDays}-day forecast</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Chart */}
              <div className="card p-4">
                <div className="text-[13px] font-medium text-text-primary mb-3">
                  Demand Series + Fitted Values + {periodDays}-day Forecast
                </div>
                <div style={{ height: 220 }}>
                  {detailData ? <canvas ref={chartRef} /> : (
                    <div className="h-full flex items-center justify-center text-text-muted animate-pulse text-sm">Loading chart…</div>
                  )}
                </div>
              </div>

              {/* Model comparison table */}
              {detailData?.allModels && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Model Comparison</span>
                    <span className="text-[11px] text-text-muted">Lower MAPE/RMSE = better fit</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr><th>Model</th><th>Forecast</th><th>Lower</th><th>Upper</th><th>Confidence</th><th>MAPE</th><th>RMSE</th><th>Seasonality</th><th>Trend</th></tr>
                      </thead>
                      <tbody>
                        {detailData.allModels.sort((a,b) => a.mape-b.mape).map((m, i) => (
                          <tr key={m.model} className={i===0 ? 'bg-accent/5' : ''}>
                            <td>
                              <div className="flex items-center gap-1.5">
                                {i===0 && <span className="text-[9px] bg-accent text-white px-1.5 py-0.5 rounded font-bold">BEST</span>}
                                <span className="text-[12px]">{m.model}</span>
                              </div>
                            </td>
                            <td className="font-mono font-semibold text-accent">{m.forecastQty} {selectedProduct.unit}</td>
                            <td className="font-mono text-[12px] text-status-success">{m.lowerBound}</td>
                            <td className="font-mono text-[12px] text-status-danger">{m.upperBound}</td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1 bg-bg-surface3 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${m.confidence>70?'bg-status-success':m.confidence>50?'bg-status-warn':'bg-status-danger'}`} style={{width:`${m.confidence}%`}}/>
                                </div>
                                <span className="text-[11px] font-mono">{m.confidence}%</span>
                              </div>
                            </td>
                            <td><span className={`font-mono text-[12px] font-semibold ${m.mape<20?'text-status-success':m.mape<40?'text-status-warn':'text-status-danger'}`}>{m.mape}%</span></td>
                            <td className="font-mono text-[12px] text-text-secondary">{m.rmse}</td>
                            <td>{m.seasonality ? <span className="text-[10px] text-accent font-medium">Period={m.periodicity}</span> : <span className="text-text-muted text-[10px]">None</span>}</td>
                            <td><span className={`text-sm font-bold ${TREND_COLOR[m.trend]}`}>{TREND_ICON[m.trend]} {m.trend}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Model explanation */}
              {detailData?.ml && (
                <div className="bg-bg-surface2 border border-border rounded-lg p-4">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-2">Selected Model Explanation</div>
                  <p className="text-[13px] text-text-primary leading-relaxed">{detailData.ml.explanation}</p>
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    {Object.entries(detailData.ml.modelParams ?? {}).map(([k, v]) => (
                      <div key={k} className="text-center">
                        <div className="font-mono text-sm font-bold text-text-primary">{typeof v === 'number' ? v.toFixed ? v.toFixed(3) : v : v}</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wide">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini sparkline with forecast dot ─────────────────────────────────────────
function MiniSparkline({ values, forecast }: { values: number[]; forecast: number }) {
  if (!values || values.every(v => v === 0)) {
    return <span className="text-[11px] text-text-muted italic">No history</span>;
  }
  const all  = [...values, forecast];
  const max  = Math.max(...all, 1);
  const w    = 88;
  const h    = 28;
  const pts  = values.map((v, i) => `${Math.round((i / (values.length)) * (w - 12))},${Math.round(h - (v / max) * h)}`).join(' ');
  const lastX = Math.round(((values.length - 1) / values.length) * (w - 12));
  const lastY = Math.round(h - ((values[values.length - 1] ?? 0) / max) * h);
  const fcX   = w - 4;
  const fcY   = Math.round(h - (forecast / max) * h);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke="#4F8EF7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1={lastX} y1={lastY} x2={fcX} y2={fcY} stroke="#F7C04F" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx={fcX} cy={fcY} r="3" fill="#F7C04F" />
    </svg>
  );
}
