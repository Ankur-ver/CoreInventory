// src/pages/PurchaseOrdersPage.tsx
import { useState, useEffect } from 'react';
import { productApi, warehouseApi, purchaseOrderApi } from '../api/services';
import type { Product, Warehouse } from '../types';
import { formatDate } from '../utils';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface POLine {
  id?: string;
  productId?: string;
  productName?: string;
  sku?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  receivedQty?: number;
  product?: { id: string; name: string; sku: string; unit: string };
}

interface PurchaseOrder {
  id: string;
  reference: string;
  supplier: { id: string; name: string; email?: string; phone?: string } | string;
  orderDate?: string;
  expectedDate?: string;
  receivedDate?: string;
  createdAt: string;
  status: string;
  lines: POLine[];
  notes?: string;
  locationId?: string;
  location?: { id: string; name: string; warehouse?: { name: string } };
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-text-secondary/10 text-text-secondary',
  OPEN: 'bg-accent/10 text-accent',
  PARTIALLY_RECEIVED: 'bg-status-warn/10 text-status-warn',
  RECEIVED: 'bg-status-success/10 text-status-success',
  CANCELED: 'bg-status-danger/10 text-status-danger',
  Draft: 'bg-text-secondary/10 text-text-secondary',
  Open: 'bg-accent/10 text-accent',
  'Partially Received': 'bg-status-warn/10 text-status-warn',
  Received: 'bg-status-success/10 text-status-success',
  Canceled: 'bg-status-danger/10 text-status-danger',
};

function formatStatus(status: string) {
  if (status === 'PARTIALLY_RECEIVED') return 'Partially Received';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await purchaseOrderApi.getAll();
      setOrders(res.data.data.orders);
    } catch (e) {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const refresh = fetchOrders;

  const filtered = orders.filter(o => {
    const supName = typeof o.supplier === 'object' ? o.supplier?.name : o.supplier;
    const ms = !search || o.reference.toLowerCase().includes(search.toLowerCase()) || (supName && supName.toLowerCase().includes(search.toLowerCase()));
    
    // Status filter
    let mst = true;
    if (statusFilter) {
      const normalizedStatus = o.status.toUpperCase();
      const normalizedFilter = statusFilter.toUpperCase().replace(' ', '_');
      mst = normalizedStatus === normalizedFilter;
    }

    const d = (o.orderDate || o.createdAt)?.split('T')[0];
    const mdf = !dateFrom || (d && d >= dateFrom);
    const mdt = !dateTo || (d && d <= dateTo);
    return ms && mst && mdf && mdt;
  });

  const exportCSV = () => {
    const rows = [['Reference', 'Supplier', 'Date', 'Status', 'Items', 'Total (USD)'],
      ...filtered.map(o => [
        o.reference,
        typeof o.supplier === 'object' ? o.supplier?.name : o.supplier,
        (o.orderDate || o.createdAt)?.split('T')[0] || '',
        formatStatus(o.status),
        o.lines.length.toString(),
        o.total.toFixed(2)
      ])];
    const csv = rows.map(r => r.join(',')).join('\\n');
    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'purchase-orders.csv'; a.click();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const backendStatus = status.toUpperCase().replace(' ', '_');
    try {
      await purchaseOrderApi.update(id, { status: backendStatus });
      refresh();
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Purchase Orders</h1>
          <p className="text-text-secondary text-sm mt-0.5">Orders placed with suppliers</p>
        </div>
        <button className="btn-primary w-full md:w-auto justify-center" onClick={() => { setSelected(null); setShowModal(true); }}>+ New Purchase Order</button>
      </div>

      {/* Table card */}
      <div className="card">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[13px] font-medium text-text-primary mb-3">All Purchase Orders</div>
          <div className="flex flex-col md:flex-row gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-bg-surface2 border border-border rounded px-3 py-2 flex-1 hover:border-border-strong transition-colors min-w-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#4A5568" className="flex-shrink-0">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO number, supplier…" className="bg-transparent outline-none text-sm text-text-primary placeholder-text-muted w-full min-w-0" />
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-nowrap gap-2 w-full md:w-auto">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-full md:w-44">
                <option value="">All Statuses</option>
                {['Draft','Open','Partially Received','Received','Canceled'].map(s => <option key={s}>{s}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-full md:w-36 text-xs" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-full md:w-36 text-xs" />
              <button onClick={exportCSV} className="btn-ghost text-xs flex items-center justify-center gap-1.5 w-full md:w-auto">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Status</th>
                <th>Items</th>
                <th className="text-right">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">No purchase orders found</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id}>
                  <td className="font-mono text-xs font-semibold">{o.reference}</td>
                  <td>{typeof o.supplier === 'object' ? o.supplier?.name : o.supplier}</td>
                  <td className="text-text-muted">{formatDate(o.orderDate || o.createdAt)}</td>
                  <td>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[o.status] || STATUS_COLORS['OPEN']}`}>
                      {formatStatus(o.status)}
                    </span>
                  </td>
                  <td className="text-text-muted">{o.lines.length}</td>
                  <td className="text-right font-mono text-sm">USD {o.total.toFixed(2)}</td>
                  <td>
                    <button
                      className="text-accent text-sm hover:underline font-medium"
                      onClick={() => { setSelected(o); setShowModal(true); }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-[12px] text-text-muted">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-[12px] text-text-muted font-mono">
              Total: USD {filtered.reduce((s, o) => s + o.total, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {showModal && (
        <POModal
          order={selected}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            refresh();
            setShowModal(false);
          }}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// ── PO Modal ──────────────────────────────────────────────────────────────────
function POModal({ order, onClose, onSaved, onStatusChange }: {
  order: PurchaseOrder | null;
  onClose: () => void;
  onSaved: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const isView = !!order;
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const initialSupplierName = typeof order?.supplier === 'object' ? order.supplier?.name : (order?.supplier ?? '');
  const [supplier, setSupplier] = useState(initialSupplierName);
  
  const initialDate = order?.orderDate 
    ? new Date(order.orderDate).toISOString().split('T')[0] 
    : (order?.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [date, setDate] = useState(initialDate);
  
  const [locationId, setLocationId] = useState(
    order?.location?.id || order?.locationId || ''
  );
  
  const [notes, setNotes] = useState(order?.notes ?? '');
  
  const [lines, setLines] = useState<POLine[]>(
    order?.lines?.map(l => ({
      ...l,
      productId: l.product?.id || l.productId,
      productName: l.product?.name || l.productName,
      sku: l.product?.sku || l.sku,
      unit: l.product?.unit || l.unit,
    })) ?? [{ productId: '', productName: '', sku: '', unit: 'pcs', quantity: 1, unitPrice: 0 }]
  );
  
  const [saving, setSaving] = useState(false);
  const [editMode] = useState(!isView);

  useEffect(() => {
    productApi.getAll({ limit: 200 }).then(r => setProducts(r.data.data.products));
    warehouseApi.getAll().then(r => setWarehouses(r.data.data));
  }, []);

  const allLocations = warehouses.flatMap(w => w.locations.map(l => ({ id: l.id, label: `${l.name} (${w.name})` })));
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const setLine = (i: number, k: keyof POLine, v: string | number) => {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      if (k === 'productId') {
        const p = products.find(p => p.id === v);
        return p ? { ...l, productId: p.id, productName: p.name, sku: p.sku, unit: p.unit, unitPrice: p.price ?? 0 } : l;
      }
      return { ...l, [k]: v };
    }));
  };

  const handleSave = async () => {
    if (isView) {
      onClose();
      return;
    }
    
    if (!supplier.trim()) { toast.error('Supplier is required'); return; }
    if (lines.some(l => !l.productId)) { toast.error('Select a product for each line'); return; }
    setSaving(true);
    try {
      const payload = {
        supplierName: supplier,
        orderDate: new Date(date).toISOString(),
        locationId: locationId || undefined,
        notes,
        lines: lines.map(l => ({ productId: l.productId!, quantity: l.quantity, unitPrice: l.unitPrice }))
      };
      
      const res = await purchaseOrderApi.create(payload);
      toast.success(`${res.data.data.reference} created`);
      onSaved();
    } catch {
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-0 md:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg-surface border-0 md:border border-border-strong w-full h-full md:h-auto md:max-h-[92vh] md:rounded-xl md:max-w-2xl flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-head font-bold text-[16px] text-text-primary">
              {isView ? order.reference : 'New Purchase Order'}
            </h2>
            {isView && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[order.status] || STATUS_COLORS['OPEN']}`}>{formatStatus(order.status)}</span>
                <span className="text-[11px] text-text-muted">{initialSupplierName} · {formatDate(order.orderDate || order.createdAt)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isView && order.status !== 'CANCELED' && order.status !== 'RECEIVED' && (
              <select
                value={formatStatus(order.status)}
                onChange={e => onStatusChange(order.id, e.target.value)}
                className="select text-xs w-44"
              >
                {['Draft','Open','Partially Received','Received','Canceled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Supplier + Date + Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier *</label>
              {editMode
                ? <input className="input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. AcmeCorp" autoFocus />
                : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">{initialSupplierName}</div>
              }
            </div>
            <div>
              <label className="label">Order Date</label>
              {editMode
                ? <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
                : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">{formatDate(order?.orderDate || order?.createdAt || '')}</div>
              }
            </div>
          </div>

          <div>
            <label className="label">Receiving Location</label>
            {editMode
              ? <select className="select" value={locationId} onChange={e => setLocationId(e.target.value)}>
                  <option value="">Select zone (optional)</option>
                  {allLocations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">
                  {allLocations.find(l => l.id === locationId)?.label ?? '—'}
                </div>
            }
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Order Lines</label>
              {editMode && (
                <button onClick={() => setLines(l => [...l, { productId: '', productName: '', sku: '', unit: 'pcs', quantity: 1, unitPrice: 0 }])}
                  className="text-accent text-xs hover:underline">+ Add line</button>
              )}
            </div>

            <div className="overflow-x-auto mt-2 -mx-2 px-2 md:mx-0 md:px-0 pb-2">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-[1fr_80px_90px_80px_24px] gap-2 mb-1 px-1">
                  <span className="text-[10px] text-text-muted uppercase tracking-wide">Product</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wide">Qty</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wide">Unit Price</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wide text-right">Total</span>
                  <span />
                </div>

                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_90px_80px_24px] gap-2 items-center">
                      {editMode ? (
                        <select className="select text-xs w-full" value={line.productId} onChange={e => setLine(i, 'productId', e.target.value)}>
                          <option value="">Select product…</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                      ) : (
                        <div className="text-sm text-text-primary">
                          <div className="truncate">{line.productName}</div>
                          <div className="text-[11px] text-text-muted font-mono">{line.sku}</div>
                        </div>
                      )}
                      {editMode
                        ? <input type="number" className="input text-xs text-center w-full min-w-0 px-1" value={line.quantity} min={1} onChange={e => setLine(i, 'quantity', Number(e.target.value))} />
                        : <div className="text-sm text-text-secondary text-center">{line.quantity} {line.unit}</div>
                      }
                      {editMode
                        ? <input type="number" className="input text-xs text-center w-full min-w-0 px-1" value={line.unitPrice} min={0} step={0.01} onChange={e => setLine(i, 'unitPrice', Number(e.target.value))} />
                        : <div className="text-sm text-text-secondary text-center">USD {line.unitPrice?.toFixed(2) || '0.00'}</div>
                      }
                      <div className="text-sm font-mono text-text-primary text-right pl-1">
                        {((line.quantity || 0) * (line.unitPrice || 0)).toFixed(2)}
                      </div>
                      {editMode && lines.length > 1
                        ? <button onClick={() => setLines(l => l.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-status-danger text-sm flex-shrink-0">✕</button>
                        : <span />
                      }
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-3 pt-3 border-t border-border">
                  <div className="text-right pr-6">
                    <div className="text-[11px] text-text-muted uppercase tracking-wide">Order Total</div>
                    <div className="font-head font-bold text-xl text-text-primary mt-0.5">USD {total.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            {editMode
              ? <textarea className="input resize-none text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
              : <div className="text-sm text-text-secondary bg-bg-surface2 border border-border rounded px-3 py-2 min-h-[40px]">{notes || '—'}</div>
            }
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-border flex-shrink-0 justify-end">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          {!isView && (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create Purchase Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
