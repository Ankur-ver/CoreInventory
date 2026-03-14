// src/pages/PurchaseOrdersPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { productApi, warehouseApi } from '../api/services';
import type { Product, Warehouse } from '../types';
import { formatDate } from '../utils';
import toast from 'react-hot-toast';
import api from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface POLine {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  supplier: string;
  date: string;
  status: 'Draft' | 'Open' | 'Partially Received' | 'Received' | 'Canceled';
  lines: POLine[];
  notes?: string;
  locationId?: string;
  total: number;
  createdAt: string;
}

// In-memory store (replace with real API calls when backend PO endpoint is ready)
let poStore: PurchaseOrder[] = [
  { id: '1', reference: 'PO-202500', supplier: 'AcmeCorp', date: '2025-09-06', status: 'Draft', lines: [{ productId: '', productName: 'Steel Rods 8mm', sku: 'SKU-0041', unit: 'kg', quantity: 100, unitPrice: 3.64 }, { productId: '', productName: 'Aluminum Sheets', sku: 'SKU-0089', unit: 'pcs', quantity: 50, unitPrice: 3.64 }], total: 728, createdAt: '2025-09-06' },
  { id: '2', reference: 'PO-202501', supplier: 'MetalSupply Ltd', date: '2025-09-04', status: 'Open', lines: [{ productId: '', productName: 'Copper Wire 2.5mm', sku: 'SKU-0317', unit: 'm', quantity: 200, unitPrice: 0.7 }, { productId: '', productName: 'Bearing 6205', sku: 'SKU-0512', unit: 'pcs', quantity: 200, unitPrice: 0.7 }], total: 280, createdAt: '2025-09-04' },
  { id: '3', reference: 'PO-202502', supplier: 'GlobalParts Inc', date: '2025-09-02', status: 'Partially Received', lines: [{ productId: '', productName: 'Hydraulic Fluid', sku: 'SKU-0203', unit: 'L', quantity: 80, unitPrice: 1.8 }, { productId: '', productName: 'Safety Gloves L', sku: 'SKU-0445', unit: 'pcs', quantity: 80, unitPrice: 1.8 }], total: 288, createdAt: '2025-09-02' },
  { id: '4', reference: 'PO-202503', supplier: 'AcmeCorp', date: '2025-08-31', status: 'Received', lines: [{ productId: '', productName: 'Steel Rods 6mm', sku: 'SKU-0712', unit: 'kg', quantity: 300, unitPrice: 2.0 }, { productId: '', productName: 'Aluminum Profiles', sku: 'SKU-0823', unit: 'm', quantity: 300, unitPrice: 2.01 }], total: 1203, createdAt: '2025-08-31' },
  { id: '5', reference: 'PO-202504', supplier: 'MetalSupply Ltd', date: '2025-08-29', status: 'Canceled', lines: [{ productId: '', productName: 'Copper Wire 2.5mm', sku: 'SKU-0317', unit: 'm', quantity: 400, unitPrice: 1.575 }, { productId: '', productName: 'Bearing 6205', sku: 'SKU-0512', unit: 'pcs', quantity: 400, unitPrice: 1.575 }], total: 1260, createdAt: '2025-08-29' },
];
let poCounter = 8;

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-text-secondary/10 text-text-secondary',
  Open: 'bg-accent/10 text-accent',
  'Partially Received': 'bg-status-warn/10 text-status-warn',
  Received: 'bg-status-success/10 text-status-success',
  Canceled: 'bg-status-danger/10 text-status-danger',
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([...poStore]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);

  const refresh = () => setOrders([...poStore]);

  const filtered = orders.filter(o => {
    const ms = !search || o.reference.toLowerCase().includes(search.toLowerCase()) || o.supplier.toLowerCase().includes(search.toLowerCase());
    const mst = !statusFilter || o.status === statusFilter;
    const mdf = !dateFrom || o.date >= dateFrom;
    const mdt = !dateTo || o.date <= dateTo;
    return ms && mst && mdf && mdt;
  });

  const exportCSV = () => {
    const rows = [['Reference', 'Supplier', 'Date', 'Status', 'Items', 'Total (USD)'],
      ...filtered.map(o => [o.reference, o.supplier, o.date, o.status, o.lines.length, o.total.toFixed(2)])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'purchase-orders.csv'; a.click();
  };

  const handleStatusChange = (id: string, status: PurchaseOrder['status']) => {
    poStore = poStore.map(o => o.id === id ? { ...o, status } : o);
    refresh();
    toast.success(`Status updated to ${status}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Purchase Orders</h1>
          <p className="text-text-secondary text-sm mt-0.5">Orders placed with suppliers</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setShowModal(true); }}>+ New Purchase Order</button>
      </div>

      {/* Table card */}
      <div className="card">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[13px] font-medium text-text-primary mb-3">All Purchase Orders</div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-bg-surface2 border border-border rounded px-3 py-2 flex-1 min-w-[180px] hover:border-border-strong transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#4A5568">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PO number, supplier…" className="bg-transparent outline-none text-sm text-text-primary placeholder-text-muted w-full" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-44">
              <option value="">All Statuses</option>
              {['Draft','Open','Partially Received','Received','Canceled'].map(s => <option key={s}>{s}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-40 text-xs" placeholder="From date" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-40 text-xs" placeholder="To date" />
            <button onClick={exportCSV} className="btn-ghost text-xs flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Export CSV
            </button>
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
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">No purchase orders found</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id}>
                  <td className="font-mono text-xs font-semibold">{o.reference}</td>
                  <td>{o.supplier}</td>
                  <td className="text-text-muted">{formatDate(o.date)}</td>
                  <td>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[o.status]}`}>
                      {o.status}
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
          onSaved={(po) => {
            if (selected) {
              poStore = poStore.map(o => o.id === po.id ? po : o);
            } else {
              poStore = [po, ...poStore];
            }
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
  onSaved: (po: PurchaseOrder) => void;
  onStatusChange: (id: string, status: PurchaseOrder['status']) => void;
}) {
  const isView = !!order;
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [supplier, setSupplier] = useState(order?.supplier ?? '');
  const [date, setDate] = useState(order?.date ?? new Date().toISOString().split('T')[0]);
  const [locationId, setLocationId] = useState(order?.locationId ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState<POLine[]>(order?.lines ?? [{ productId: '', productName: '', sku: '', unit: 'pcs', quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(!isView);

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
        return p ? { ...l, productId: p.id, productName: p.name, sku: p.sku, unit: p.unit } : l;
      }
      return { ...l, [k]: v };
    }));
  };

  const handleSave = async () => {
    if (!supplier.trim()) { toast.error('Supplier is required'); return; }
    if (lines.some(l => !l.productId)) { toast.error('Select a product for each line'); return; }
    setSaving(true);
    try {
      poCounter++;
      const po: PurchaseOrder = {
        id: String(Date.now()),
        reference: `PO-2025${String(poCounter).padStart(2, '0')}`,
        supplier, date, locationId, notes,
        status: 'Draft',
        lines,
        total,
        createdAt: new Date().toISOString(),
      };
      onSaved(po);
      toast.success(`${po.reference} created`);
    } catch {
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-head font-bold text-[16px] text-text-primary">
              {isView ? order.reference : 'New Purchase Order'}
            </h2>
            {isView && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                <span className="text-[11px] text-text-muted">{order.supplier} · {formatDate(order.date)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isView && order.status !== 'Canceled' && order.status !== 'Received' && (
              <select
                value={order.status}
                onChange={e => onStatusChange(order.id, e.target.value as PurchaseOrder['status'])}
                className="select text-xs w-44"
              >
                {['Draft','Open','Partially Received','Received','Canceled'].map(s => <option key={s}>{s}</option>)}
              </select>
            )}
            <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Supplier + Date + Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier *</label>
              {editMode
                ? <input className="input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. AcmeCorp" autoFocus />
                : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">{order?.supplier}</div>
              }
            </div>
            <div>
              <label className="label">Order Date</label>
              {editMode
                ? <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
                : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">{formatDate(order?.date ?? '')}</div>
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
                  {allLocations.find(l => l.id === order?.locationId)?.label ?? '—'}
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

            {/* Header */}
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
                    <select className="select text-xs" value={line.productId} onChange={e => setLine(i, 'productId', e.target.value)}>
                      <option value="">Select product…</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  ) : (
                    <div className="text-sm text-text-primary">
                      <div>{line.productName}</div>
                      <div className="text-[11px] text-text-muted font-mono">{line.sku}</div>
                    </div>
                  )}
                  {editMode
                    ? <input type="number" className="input text-xs text-center" value={line.quantity} min={1} onChange={e => setLine(i, 'quantity', Number(e.target.value))} />
                    : <div className="text-sm text-text-secondary text-center">{line.quantity} {line.unit}</div>
                  }
                  {editMode
                    ? <input type="number" className="input text-xs text-center" value={line.unitPrice} min={0} step={0.01} onChange={e => setLine(i, 'unitPrice', Number(e.target.value))} />
                    : <div className="text-sm text-text-secondary text-center">USD {line.unitPrice.toFixed(2)}</div>
                  }
                  <div className="text-sm font-mono text-text-primary text-right">
                    {(line.quantity * line.unitPrice).toFixed(2)}
                  </div>
                  {editMode && lines.length > 1
                    ? <button onClick={() => setLines(l => l.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-status-danger text-sm">✕</button>
                    : <span />
                  }
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end mt-3 pt-3 border-t border-border">
              <div className="text-right">
                <div className="text-[11px] text-text-muted uppercase tracking-wide">Order Total</div>
                <div className="font-head font-bold text-xl text-text-primary mt-0.5">USD {total.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            {editMode
              ? <textarea className="input resize-none text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
              : <div className="text-sm text-text-secondary bg-bg-surface2 border border-border rounded px-3 py-2 min-h-[40px]">{order?.notes || '—'}</div>
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
