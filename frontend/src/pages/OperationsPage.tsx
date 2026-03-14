// src/pages/OperationsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { operationApi, productApi, warehouseApi } from '../api/services';
import type { Operation, OperationType, Product, Location } from '../types';
import { formatDateTime, statusBadgeClass, typeTagClass } from '../utils';
import toast from 'react-hot-toast';

interface Props { type: OperationType }

const PAGE_META: Record<OperationType, { title: string; desc: string; color: string }> = {
  RECEIPT:    { title: 'Receipts',       desc: 'Incoming stock from vendors',          color: 'text-status-success' },
  DELIVERY:   { title: 'Deliveries',     desc: 'Outgoing shipments to customers',      color: 'text-accent' },
  TRANSFER:   { title: 'Transfers',      desc: 'Internal stock movements',             color: 'text-accent-purple' },
  ADJUSTMENT: { title: 'Adjustments',    desc: 'Fix stock discrepancies',              color: 'text-status-warn' },
};

export default function OperationsPage({ type }: Props) {
  const [ops, setOps] = useState<Operation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Operation | null>(null);
  const meta = PAGE_META[type];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { type };
      if (statusFilter) params.status = statusFilter;
      const res = await operationApi.getAll(params);
      setOps(res.data.data.operations);
      setTotal(res.data.data.total);
    } catch {
      toast.error('Failed to load operations');
    } finally {
      setLoading(false);
    }
  }, [type, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleValidate = async (op: Operation, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await operationApi.validate(op.id);
      toast.success(`${op.reference} validated — stock updated`);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Validation failed';
      toast.error(msg);
    }
  };

  const handleCancel = async (op: Operation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Cancel this operation?')) return;
    try {
      await operationApi.cancel(op.id);
      toast.success(`${op.reference} canceled`);
      load();
    } catch {
      toast.error('Cancel failed');
    }
  };

  const miniStats = {
    pending:  ops.filter(o => ['DRAFT','WAITING','READY'].includes(o.status)).length,
    done:     ops.filter(o => o.status === 'DONE').length,
    canceled: ops.filter(o => o.status === 'CANCELED').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`font-head font-bold text-xl ${meta.color}`}>{meta.title}</h1>
          <p className="text-text-secondary text-sm mt-0.5">{meta.desc}</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setShowModal(true); }}>
          + New {meta.title.replace(/s$/, '')}
        </button>
      </div>

      {/* Mini stats + filter row */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex gap-3 flex-1">
          <StatPill label="Pending" value={miniStats.pending} color="text-text-primary" />
          <StatPill label="Done" value={miniStats.done} color="text-status-success" />
          <StatPill label="Canceled" value={miniStats.canceled} color="text-status-danger" />
          <StatPill label="Total" value={total} color="text-text-muted" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select w-40"
        >
          <option value="">All Status</option>
          {['DRAFT','WAITING','READY','DONE','CANCELED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={load} className="btn-ghost text-xs px-3">↻</button>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center text-text-muted animate-pulse text-sm">Loading…</div>
        ) : ops.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-4xl mb-3 opacity-20">📋</div>
            <p className="text-text-muted text-sm mb-4">No {meta.title.toLowerCase()} found</p>
            <button className="btn-primary text-xs" onClick={() => setShowModal(true)}>
              Create first {meta.title.replace(/s$/, '').toLowerCase()}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>{type === 'RECEIPT' ? 'Supplier' : type === 'DELIVERY' ? 'Customer' : 'From → To'}</th>
                  <th>Lines</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((op) => (
                  <tr key={op.id} onClick={() => { setSelected(op); setShowModal(true); }}>
                    <td className="font-mono text-xs">{op.reference}</td>
                    <td className="text-text-secondary">
                      {type === 'RECEIPT' ? op.supplier?.name :
                       type === 'DELIVERY' ? 'Customer' :
                       type === 'TRANSFER' ? `${op.fromLocation?.name ?? '?'} → ${op.toLocation?.name ?? '?'}` :
                       op.toLocation?.name}
                      {' '}
                      {type === 'RECEIPT' || type === 'DELIVERY' ? null : ''}
                    </td>
                    <td>{op.lines.length} item{op.lines.length !== 1 ? 's' : ''}</td>
                    <td className="text-text-muted text-xs">
                      {op.scheduledDate ? formatDateTime(op.scheduledDate) : '—'}
                    </td>
                    <td><span className={statusBadgeClass(op.status)}>{op.status}</span></td>
                    <td className="text-text-muted text-xs">{formatDateTime(op.createdAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        {['DRAFT','WAITING','READY'].includes(op.status) && (
                          <button
                            className="px-2.5 py-1 rounded text-[11px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                            onClick={(e) => handleValidate(op, e)}
                          >
                            Validate
                          </button>
                        )}
                        {op.status !== 'DONE' && op.status !== 'CANCELED' && (
                          <button
                            className="px-2.5 py-1 rounded text-[11px] font-medium bg-status-danger/10 text-status-danger hover:bg-status-danger/20 transition-colors"
                            onClick={(e) => handleCancel(op, e)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <OperationModal
          type={type}
          operation={selected}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-surface border border-border rounded px-3 py-2 flex items-center gap-2">
      <span className={`font-head font-bold text-lg leading-none ${color}`}>{value}</span>
      <span className="text-[11px] text-text-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Create / View operation modal ─────────────────────────────────────────────
function OperationModal({ type, operation, onClose, onSaved }: {
  type: OperationType;
  operation: Operation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isView = !!operation;
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lines, setLines] = useState<{ productId: string; quantity: number }[]>([{ productId: '', quantity: 1 }]);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productApi.getAll({ limit: 200 }).then(r => setProducts(r.data.data.products));
    warehouseApi.getAll().then(r => {
      const locs = r.data.data.flatMap((w) => w.locations);
      setLocations(locs);
    });
  }, []);

  const addLine = () => setLines([...lines, { productId: '', quantity: 1 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, k: 'productId' | 'quantity', v: string | number) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const handleSave = async () => {
    const validLines = lines.filter(l => l.productId && l.quantity > 0);
    if (!validLines.length) { toast.error('Add at least one product line'); return; }
    setSaving(true);
    try {
      await operationApi.create({
        type,
        supplierId: supplierId || undefined,
        fromLocationId: fromLocationId || undefined,
        toLocationId: toLocationId || undefined,
        notes: notes || undefined,
        lines: validLines,
      });
      toast.success('Operation created');
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-head font-bold text-[16px] text-text-primary">
              {isView ? operation.reference : `New ${PAGE_META[type].title.replace(/s$/, '')}`}
            </h2>
            {isView && (
              <div className="flex items-center gap-2 mt-1">
                <span className={typeTagClass(type)}>{type}</span>
                <span className={statusBadgeClass(operation.status)}>{operation.status}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isView ? (
            // Read-only view
            <>
              <InfoRow label="Type" value={type} />
              <InfoRow label="Status" value={operation.status} />
              <InfoRow label="Created by" value={operation.user.name} />
              {operation.supplier && <InfoRow label="Supplier" value={operation.supplier.name} />}
              {operation.fromLocation && <InfoRow label="From" value={`${operation.fromLocation.name} (${operation.fromLocation.warehouse?.name})`} />}
              {operation.toLocation && <InfoRow label="To" value={`${operation.toLocation.name} (${operation.toLocation.warehouse?.name})`} />}
              {operation.notes && <InfoRow label="Notes" value={operation.notes} />}
              <div>
                <label className="label">Lines</label>
                <div className="space-y-1">
                  {operation.lines.map((l) => (
                    <div key={l.id} className="flex items-center justify-between bg-bg-surface2 rounded px-3 py-2 text-sm">
                      <span className="text-text-primary">{l.product.name}</span>
                      <span className="text-text-secondary font-mono">{l.quantity} {l.product.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // Create form
            <>
              {type === 'RECEIPT' && (
                <div>
                  <label className="label">Supplier</label>
                  <input className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Supplier name or ID (optional)" />
                </div>
              )}

              {(type === 'TRANSFER' || type === 'DELIVERY' || type === 'ADJUSTMENT') && (
                <div>
                  <label className="label">{type === 'TRANSFER' ? 'From Location' : 'Dispatch From'}</label>
                  <select className="select" value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)}>
                    <option value="">Select location…</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.warehouse?.name})</option>)}
                  </select>
                </div>
              )}

              {(type === 'RECEIPT' || type === 'TRANSFER' || type === 'ADJUSTMENT') && (
                <div>
                  <label className="label">{type === 'TRANSFER' ? 'To Location' : 'Receiving Location'}</label>
                  <select className="select" value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}>
                    <option value="">Select location…</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.warehouse?.name})</option>)}
                  </select>
                </div>
              )}

              {/* Product lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Products *</label>
                  <button onClick={addLine} className="text-accent text-xs hover:underline">+ Add line</button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        className="select flex-1"
                        value={line.productId}
                        onChange={(e) => setLine(i, 'productId', e.target.value)}
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                      <input
                        type="number"
                        className="input w-24"
                        value={line.quantity}
                        min={1}
                        onChange={(e) => setLine(i, 'quantity', Number(e.target.value))}
                      />
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(i)} className="text-status-danger text-sm w-6 flex-shrink-0 hover:opacity-70">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={notes}
                  onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border justify-end">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          {!isView && (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create Operation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] text-text-muted uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
