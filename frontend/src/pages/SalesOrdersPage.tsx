// src/pages/SalesOrdersPage.tsx
import { useState, useEffect } from 'react';
import { productApi, warehouseApi } from '../api/services';
import type { Product, Warehouse } from '../types';
import { formatDate } from '../utils';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SOLine {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface SalesOrder {
  id: string;
  reference: string;
  customer: string;
  date: string;
  status: 'Open' | 'Partially Fulfilled' | 'Fulfilled' | 'Canceled';
  lines: SOLine[];
  notes?: string;
  locationId?: string;
  total: number;
  createdAt: string;
}

// In-memory store
let soStore: SalesOrder[] = [
  { id: '1', reference: 'SO-202500', customer: 'John Smith', date: '2025-09-06', status: 'Open', lines: [{ productId: '', productName: 'Chairs Type A', sku: 'SKU-0601', unit: 'pcs', quantity: 1, unitPrice: 150 }], total: 150, createdAt: '2025-09-06' },
  { id: '2', reference: 'SO-202501', customer: 'Jane Lee', date: '2025-09-05', status: 'Partially Fulfilled', lines: [{ productId: '', productName: 'Steel Rods 6mm', sku: 'SKU-0712', unit: 'kg', quantity: 2, unitPrice: 99 }], total: 198, createdAt: '2025-09-05' },
  { id: '3', reference: 'SO-202502', customer: 'Acme Retail', date: '2025-09-04', status: 'Fulfilled', lines: [{ productId: '', productName: 'Bearing 6205', sku: 'SKU-0512', unit: 'pcs', quantity: 4, unitPrice: 53 }], total: 212, createdAt: '2025-09-04' },
  { id: '4', reference: 'SO-202503', customer: 'Blue Mart', date: '2025-09-03', status: 'Canceled', lines: [{ productId: '', productName: 'Aluminum Sheets', sku: 'SKU-0089', unit: 'pcs', quantity: 3, unitPrice: 72 }], total: 216, createdAt: '2025-09-03' },
  { id: '5', reference: 'SO-202504', customer: 'John Smith', date: '2025-09-02', status: 'Open', lines: [{ productId: '', productName: 'Hydraulic Fluid', sku: 'SKU-0203', unit: 'L', quantity: 1, unitPrice: 81 }], total: 81, createdAt: '2025-09-02' },
  { id: '6', reference: 'SO-202505', customer: 'Jane Lee', date: '2025-09-01', status: 'Partially Fulfilled', lines: [{ productId: '', productName: 'Safety Gloves L', sku: 'SKU-0445', unit: 'pcs', quantity: 1, unitPrice: 56 }], total: 56, createdAt: '2025-09-01' },
];
let soCounter = 6;

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-accent/10 text-accent',
  'Partially Fulfilled': 'bg-status-warn/10 text-status-warn',
  Fulfilled: 'bg-status-success/10 text-status-success',
  Canceled: 'bg-status-danger/10 text-status-danger',
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([...soStore]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<SalesOrder | null>(null);

  const refresh = () => setOrders([...soStore]);

  const filtered = orders.filter(o => {
    const ms = !search || o.reference.toLowerCase().includes(search.toLowerCase()) || o.customer.toLowerCase().includes(search.toLowerCase());
    const mst = !statusFilter || o.status === statusFilter;
    const mdf = !dateFrom || o.date >= dateFrom;
    const mdt = !dateTo || o.date <= dateTo;
    return ms && mst && mdf && mdt;
  });

  const exportCSV = () => {
    const rows = [['Reference', 'Customer', 'Date', 'Status', 'Items', 'Total (USD)'],
      ...filtered.map(o => [o.reference, o.customer, o.date, o.status, o.lines.length, o.total.toFixed(2)])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'sales-orders.csv'; a.click();
  };

  const handleStatusChange = (id: string, status: SalesOrder['status']) => {
    soStore = soStore.map(o => o.id === id ? { ...o, status } : o);
    refresh();
    toast.success(`Status updated to ${status}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Sales Orders</h1>
          <p className="text-text-secondary text-sm mt-0.5">Orders sold to customers</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setShowModal(true); }}>+ New Sales Order</button>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[13px] font-medium text-text-primary mb-3">All Sales Orders</div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-bg-surface2 border border-border rounded px-3 py-2 flex-1 min-w-[180px] hover:border-border-strong transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#4A5568">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SO number, customer…" className="bg-transparent outline-none text-sm text-text-primary placeholder-text-muted w-full" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-44">
              <option value="">All Statuses</option>
              {['Open','Partially Fulfilled','Fulfilled','Canceled'].map(s => <option key={s}>{s}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-40 text-xs" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-40 text-xs" />
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
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Items</th>
                <th className="text-right">Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-text-muted">No sales orders found</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id}>
                  <td className="font-mono text-xs font-semibold">{o.reference}</td>
                  <td>{o.customer}</td>
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
        <SOModal
          order={selected}
          onClose={() => setShowModal(false)}
          onSaved={so => {
            if (selected) {
              soStore = soStore.map(o => o.id === so.id ? so : o);
            } else {
              soStore = [so, ...soStore];
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

// ── SO Modal ──────────────────────────────────────────────────────────────────
function SOModal({ order, onClose, onSaved, onStatusChange }: {
  order: SalesOrder | null;
  onClose: () => void;
  onSaved: (so: SalesOrder) => void;
  onStatusChange: (id: string, status: SalesOrder['status']) => void;
}) {
  const isView = !!order;
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customer, setCustomer] = useState(order?.customer ?? '');
  const [date, setDate] = useState(order?.date ?? new Date().toISOString().split('T')[0]);
  const [locationId, setLocationId] = useState(order?.locationId ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState<SOLine[]>(order?.lines ?? [{ productId: '', productName: '', sku: '', unit: 'pcs', quantity: 1, unitPrice: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productApi.getAll({ limit: 200 }).then(r => setProducts(r.data.data.products));
    warehouseApi.getAll().then(r => setWarehouses(r.data.data));
  }, []);

  const allLocations = warehouses.flatMap(w => w.locations.map(l => ({ id: l.id, label: `${l.name} (${w.name})` })));
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const setLine = (i: number, k: keyof SOLine, v: string | number) => {
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
    if (!customer.trim()) { toast.error('Customer name is required'); return; }
    if (lines.some(l => !l.productId)) { toast.error('Select a product for each line'); return; }
    setSaving(true);
    try {
      soCounter++;
      const so: SalesOrder = {
        id: String(Date.now()),
        reference: `SO-2025${String(soCounter).padStart(2, '0')}`,
        customer, date, locationId, notes,
        status: 'Open',
        lines,
        total,
        createdAt: new Date().toISOString(),
      };
      onSaved(so);
      toast.success(`${so.reference} created`);
    } catch {
      toast.error('Failed to create sales order');
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
              {isView ? order.reference : 'New Sales Order'}
            </h2>
            {isView && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                <span className="text-[11px] text-text-muted">{order.customer} · {formatDate(order.date)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isView && order.status !== 'Canceled' && order.status !== 'Fulfilled' && (
              <select
                value={order.status}
                onChange={e => onStatusChange(order.id, e.target.value as SalesOrder['status'])}
                className="select text-xs w-48"
              >
                {['Open','Partially Fulfilled','Fulfilled','Canceled'].map(s => <option key={s}>{s}</option>)}
              </select>
            )}
            <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Customer *</label>
              {!isView
                ? <input className="input" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. John Smith" autoFocus />
                : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">{order.customer}</div>
              }
            </div>
            <div>
              <label className="label">Order Date</label>
              {!isView
                ? <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
                : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">{formatDate(order.date)}</div>
              }
            </div>
          </div>

          <div>
            <label className="label">Dispatch From</label>
            {!isView
              ? <select className="select" value={locationId} onChange={e => setLocationId(e.target.value)}>
                  <option value="">Select zone (optional)</option>
                  {allLocations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              : <div className="text-sm text-text-primary bg-bg-surface2 border border-border rounded px-3 py-2">
                  {allLocations.find(l => l.id === order.locationId)?.label ?? '—'}
                </div>
            }
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Order Lines</label>
              {!isView && (
                <button onClick={() => setLines(l => [...l, { productId: '', productName: '', sku: '', unit: 'pcs', quantity: 1, unitPrice: 0 }])}
                  className="text-accent text-xs hover:underline">+ Add line</button>
              )}
            </div>

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
                  {!isView ? (
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
                  {!isView
                    ? <input type="number" className="input text-xs text-center" value={line.quantity} min={1} onChange={e => setLine(i, 'quantity', Number(e.target.value))} />
                    : <div className="text-sm text-text-secondary text-center">{line.quantity} {line.unit}</div>
                  }
                  {!isView
                    ? <input type="number" className="input text-xs text-center" value={line.unitPrice} min={0} step={0.01} onChange={e => setLine(i, 'unitPrice', Number(e.target.value))} />
                    : <div className="text-sm text-text-secondary text-center">USD {line.unitPrice.toFixed(2)}</div>
                  }
                  <div className="text-sm font-mono text-text-primary text-right">
                    {(line.quantity * line.unitPrice).toFixed(2)}
                  </div>
                  {!isView && lines.length > 1
                    ? <button onClick={() => setLines(l => l.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-status-danger text-sm">✕</button>
                    : <span />
                  }
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-3 pt-3 border-t border-border">
              <div className="text-right">
                <div className="text-[11px] text-text-muted uppercase tracking-wide">Order Total</div>
                <div className="font-head font-bold text-xl text-text-primary mt-0.5">USD {total.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            {!isView
              ? <textarea className="input resize-none text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
              : <div className="text-sm text-text-secondary bg-bg-surface2 border border-border rounded px-3 py-2 min-h-[40px]">{order.notes || '—'}</div>
            }
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border flex-shrink-0 justify-end">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          {!isView && (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create Sales Order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
