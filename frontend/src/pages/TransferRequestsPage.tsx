// src/pages/TransferRequestsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { warehouseApi, productApi } from '../api/services';
import type { Warehouse, Product } from '../types';
import { formatDate } from '../utils';
import toast from 'react-hot-toast';

interface TransferRequest {
  id: string;
  reference: string;
  status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED';
  requestedQty: number;
  approvedQty?: number;
  reason?: string;
  createdAt: string;
  fromWarehouse: { id: string; name: string };
  toWarehouse:   { id: string; name: string };
  product:       { id: string; name: string; sku: string; unit: string };
  requestedBy:   { id: string; name: string };
  approvedBy?:   { id: string; name: string };
}

interface StockMatrix {
  warehouses: { id: string; name: string }[];
  matrix: {
    productId: string;
    name: string;
    sku: string;
    unit: string;
    category: string;
    total: number;
    warehouses: Record<string, number>;
  }[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:    'bg-status-warn/10 text-status-warn',
  APPROVED:   'bg-accent/10 text-accent',
  IN_TRANSIT: 'bg-accent-purple/10 text-accent-purple',
  COMPLETED:  'bg-status-success/10 text-status-success',
  REJECTED:   'bg-status-danger/10 text-status-danger',
};

export default function TransferRequestsPage() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [matrix, setMatrix]     = useState<StockMatrix | null>(null);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'matrix'>('requests');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<{ data: { requests: TransferRequest[]; total: number } }>('/transfer-requests', { params });
      setRequests(res.data.data.requests);
      setTotal(res.data.data.total);
    } catch { toast.error('Failed to load transfer requests'); }
    finally  { setLoading(false); }
  }, [statusFilter]);

  const loadMatrix = useCallback(async () => {
    try {
      const res = await api.get<{ data: StockMatrix }>('/transfer-requests/comparison');
      setMatrix(res.data.data);
    } catch { toast.error('Failed to load stock matrix'); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeTab === 'matrix') loadMatrix(); }, [activeTab, loadMatrix]);

  const handleAction = async (id: string, action: 'approve' | 'execute' | 'reject') => {
    try {
      await api.post(`/transfer-requests/${id}/${action}`);
      toast.success(`Request ${action}d successfully`);
      load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? `${action} failed`);
    }
  };

  const pending  = requests.filter(r => r.status === 'PENDING').length;
  const approved = requests.filter(r => r.status === 'APPROVED').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Multi-Warehouse Transfers</h1>
          <p className="text-text-secondary text-sm mt-0.5">Inter-warehouse stock movement requests</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Transfer Request</button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        {[
          { label:'Total Requests', value:total,    accent:'kpi-blue' },
          { label:'Pending',        value:pending,  accent:'kpi-warn' },
          { label:'Approved',       value:approved, accent:'kpi-purple' },
          { label:'Completed',      value:requests.filter(r=>r.status==='COMPLETED').length, accent:'kpi-green' },
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.accent}`}>
            <div className="text-[11px] text-text-secondary uppercase tracking-wide font-medium mb-2">{k.label}</div>
            <div className="font-head text-[28px] font-bold text-text-primary leading-none">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {[['requests','Transfer Requests'],['matrix','Stock Matrix']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as 'requests'|'matrix')}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'requests' ? (
        <div className="card">
          <div className="px-5 py-3 border-b border-border flex items-center gap-3">
            <span className="text-[13px] font-medium text-text-primary flex-1">All Transfer Requests</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-36 text-xs">
              <option value="">All Status</option>
              {['PENDING','APPROVED','IN_TRANSIT','COMPLETED','REJECTED'].map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={load} className="btn-ghost text-xs px-3">↻</button>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-text-muted animate-pulse">Loading…</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Reference</th><th>Product</th><th>From</th><th>To</th>
                    <th>Qty</th><th>Status</th><th>Requested By</th><th>Date</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-text-muted">No transfer requests found</td></tr>
                  ) : requests.map(r => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs font-semibold">{r.reference}</td>
                      <td>
                        <div className="font-medium">{r.product.name}</div>
                        <div className="text-[10px] text-text-muted font-mono">{r.product.sku}</div>
                      </td>
                      <td className="text-text-muted text-sm">{r.fromWarehouse.name}</td>
                      <td className="text-text-muted text-sm">{r.toWarehouse.name}</td>
                      <td>
                        <span className="font-mono text-sm">{r.requestedQty} {r.product.unit}</span>
                        {r.approvedQty && r.approvedQty !== r.requestedQty && (
                          <div className="text-[10px] text-accent">Approved: {r.approvedQty}</div>
                        )}
                      </td>
                      <td>
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-text-muted text-xs">{r.requestedBy.name}</td>
                      <td className="text-text-muted text-xs">{formatDate(r.createdAt)}</td>
                      <td>
                        <div className="flex gap-1.5">
                          {r.status === 'PENDING' && (
                            <>
                              <button onClick={() => handleAction(r.id, 'approve')}
                                className="text-[11px] px-2.5 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
                                Approve
                              </button>
                              <button onClick={() => handleAction(r.id, 'reject')}
                                className="text-[11px] px-2.5 py-1 rounded bg-status-danger/10 text-status-danger hover:bg-status-danger/20 transition-colors font-medium">
                                Reject
                              </button>
                            </>
                          )}
                          {r.status === 'APPROVED' && (
                            <button onClick={() => handleAction(r.id, 'execute')}
                              className="text-[11px] px-2.5 py-1 rounded bg-status-success/10 text-status-success hover:bg-status-success/20 transition-colors font-medium">
                              Execute ⇄
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Stock Matrix */
        <div className="card">
          <div className="card-header">
            <span className="card-title">Stock Distribution Matrix</span>
            <span className="text-[12px] text-text-muted">All products across all warehouses</span>
          </div>
          {!matrix ? (
            <div className="p-10 text-center text-text-muted animate-pulse">Loading matrix…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    {matrix.warehouses.map(w => <th key={w.id}>{w.name}</th>)}
                    <th>Total</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.matrix.map(row => {
                    const whValues = matrix.warehouses.map(w => row.warehouses[w.id] ?? 0);
                    const max   = Math.max(...whValues);
                    const min   = Math.min(...whValues.filter(v => v > 0));
                    const imbalanced = max > 0 && min > 0 && max / min > 3;
                    return (
                      <tr key={row.productId}>
                        <td className="font-medium">{row.name}</td>
                        <td className="font-mono text-xs">{row.sku}</td>
                        <td className="text-text-muted text-xs">{row.category}</td>
                        {matrix.warehouses.map(w => {
                          const qty = row.warehouses[w.id] ?? 0;
                          const pct = row.total > 0 ? (qty / row.total) * 100 : 0;
                          return (
                            <td key={w.id}>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm ${qty === 0 ? 'text-text-muted' : 'text-text-primary'}`}>
                                  {qty.toLocaleString()}
                                </span>
                                {qty > 0 && (
                                  <div className="w-12 h-1.5 bg-bg-surface3 rounded-full overflow-hidden">
                                    <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] text-text-muted">{row.unit}</div>
                            </td>
                          );
                        })}
                        <td className="font-mono font-semibold text-text-primary">{row.total.toLocaleString()}</td>
                        <td>
                          {imbalanced ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-warn/10 text-status-warn">
                              Imbalanced
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-success/10 text-status-success">
                              Balanced
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {matrix.matrix.length === 0 && (
                    <tr><td colSpan={matrix.warehouses.length + 5} className="text-center py-10 text-text-muted">No stock data across warehouses</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <CreateTransferModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Create Transfer Request Modal ─────────────────────────────────────────────
function CreateTransferModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [warehouses, setWarehouses]   = useState<Warehouse[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [fromWH, setFromWH]           = useState('');
  const [toWH, setToWH]               = useState('');
  const [productId, setProductId]     = useState('');
  const [qty, setQty]                 = useState(1);
  const [reason, setReason]           = useState('');
  const [saving, setSaving]           = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  useEffect(() => {
    warehouseApi.getAll().then(r => setWarehouses(r.data.data));
    productApi.getAll({ limit: 200 }).then(r => setProducts(r.data.data.products));
  }, []);

  // Show available stock when product + fromWarehouse selected
  useEffect(() => {
    if (!productId || !fromWH) { setAvailableStock(null); return; }
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const wh = warehouses.find(w => w.id === fromWH);
    const locIds = new Set(wh?.locations.map(l => l.id) ?? []);
    const stock  = (product.stockItems ?? [])
      .filter(si => locIds.has(si.location.id))
      .reduce((s, si) => s + si.quantity, 0);
    setAvailableStock(stock);
  }, [productId, fromWH, products, warehouses]);

  const handleSave = async () => {
    if (!fromWH || !toWH || !productId || qty <= 0) { toast.error('Fill all required fields'); return; }
    if (fromWH === toWH) { toast.error('Source and destination must be different'); return; }
    setSaving(true);
    try {
      await api.post('/transfer-requests', { fromWarehouseId: fromWH, toWarehouseId: toWH, productId, requestedQty: qty, reason: reason || undefined });
      toast.success('Transfer request created');
      onSaved();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-head font-bold text-[16px] text-text-primary">New Transfer Request</h2>
          <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From Warehouse *</label>
              <select className="select" value={fromWH} onChange={e => setFromWH(e.target.value)}>
                <option value="">Select…</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">To Warehouse *</label>
              <select className="select" value={toWH} onChange={e => setToWH(e.target.value)}>
                <option value="">Select…</option>
                {warehouses.filter(w => w.id !== fromWH).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Product *</label>
            <select className="select" value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">Select product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
            {availableStock !== null && (
              <div className={`text-[12px] mt-1.5 font-medium ${availableStock < qty ? 'text-status-danger' : 'text-status-success'}`}>
                Available in {warehouses.find(w=>w.id===fromWH)?.name}: {availableStock.toLocaleString()} {products.find(p=>p.id===productId)?.unit}
              </div>
            )}
          </div>
          <div>
            <label className="label">Quantity *</label>
            <input type="number" className="input" value={qty} min={1} max={availableStock ?? undefined}
              onChange={e => setQty(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea className="input resize-none" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this transfer needed?" />
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border justify-end">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Submit Request'}</button>
        </div>
      </div>
    </div>
  );
}
