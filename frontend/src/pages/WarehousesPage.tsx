// src/pages/WarehousesPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { warehouseApi, productApi, operationApi } from '../api/services';
import type { Warehouse, Product, Location } from '../types';
import toast from 'react-hot-toast';

interface StockLine {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  reorderPoint: number;
  currentStock: number;
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWHModal, setShowWHModal] = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedWH, setSelectedWH] = useState<Warehouse | null>(null);
  const [selectedZone, setSelectedZone] = useState<{ warehouse: Warehouse; location: Location } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getAll();
      setWarehouses(res.data.data);
    } catch {
      toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Warehouses</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''} ·{' '}
            {warehouses.reduce((s, w) => s + w.locations.length, 0)} zones configured
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowWHModal(true)}>+ Add Warehouse</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map(i => <div key={i} className="h-72 bg-bg-surface animate-pulse rounded-lg" />)}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-text-muted">
          <div className="text-5xl mb-4 opacity-20">🏭</div>
          <p className="text-sm mb-4">No warehouses configured yet</p>
          <button className="btn-primary text-xs" onClick={() => setShowWHModal(true)}>Create first warehouse</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {warehouses.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              onAddZone={() => { setSelectedWH(wh); setShowLocModal(true); }}
              onAddInventory={(loc) => { setSelectedZone({ warehouse: wh, location: loc }); setShowInventoryModal(true); }}
            />
          ))}
        </div>
      )}

      {showWHModal && (
        <WHModal onClose={() => setShowWHModal(false)} onSaved={() => { setShowWHModal(false); load(); }} />
      )}
      {showLocModal && selectedWH && (
        <LocationModal
          warehouse={selectedWH}
          onClose={() => setShowLocModal(false)}
          onSaved={() => { setShowLocModal(false); load(); }}
        />
      )}
      {showInventoryModal && selectedZone && (
        <ZoneInventoryModal
          warehouse={selectedZone.warehouse}
          location={selectedZone.location}
          onClose={() => setShowInventoryModal(false)}
          onSaved={() => { setShowInventoryModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Warehouse Card ─────────────────────────────────────────────────────────────
function WarehouseCard({
  warehouse, onAddZone, onAddInventory,
}: {
  warehouse: Warehouse;
  onAddZone: () => void;
  onAddInventory: (loc: Location) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{warehouse.name}</div>
          {warehouse.address && <div className="text-[11px] text-text-muted mt-0.5">{warehouse.address}</div>}
        </div>
        <div className="flex items-center gap-2">
          {warehouse.capacity && (
            <span className="text-[11px] text-text-muted bg-bg-surface2 px-2 py-1 rounded border border-border">
              {warehouse.capacity.toLocaleString()} m³
            </span>
          )}
          <button className="btn-ghost text-xs px-2.5 py-1" onClick={onAddZone}>+ Zone</button>
        </div>
      </div>
      <div className="p-4">
        {warehouse.locations.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-text-muted">
            <div className="text-2xl mb-2 opacity-20">📦</div>
            <p className="text-xs">No zones yet</p>
            <button className="mt-3 text-accent text-xs hover:underline" onClick={onAddZone}>Add first zone</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {warehouse.locations.map((loc) => (
              <ZoneCard key={loc.id} location={loc} onAddInventory={() => onAddInventory(loc)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Zone Card ──────────────────────────────────────────────────────────────────
function ZoneCard({ location, onAddInventory }: { location: Location; onAddInventory: () => void }) {
  const stockItems = (location as Location & { stockItems?: { quantity: number; status: string }[] }).stockItems ?? [];
  const hasLowStock = stockItems.some(s => s.status === 'LOW' || s.status === 'OUT');
  const itemCount = stockItems.length;

  return (
    <div className="bg-bg-surface2 border border-border rounded-lg p-3 hover:border-border-strong transition-all duration-200">
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="text-[13px] font-medium text-text-primary leading-tight truncate flex-1">{location.name}</div>
        {hasLowStock && (
          <span className="flex-shrink-0 text-[9px] font-bold bg-status-danger/10 text-status-danger px-1.5 py-0.5 rounded-full">LOW</span>
        )}
      </div>
      <div className="text-[11px] text-text-muted mb-3">
        {itemCount > 0 ? `${itemCount} product${itemCount !== 1 ? 's' : ''}` : 'No inventory yet'}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onAddInventory(); }}
        className="w-full text-center text-[11px] font-medium py-1.5 rounded border border-dashed border-border-strong
                   text-text-muted hover:border-accent hover:text-accent hover:bg-accent/5 transition-all duration-150"
      >
        + Add Inventory
      </button>
    </div>
  );
}

// ── Zone Inventory Modal ───────────────────────────────────────────────────────
function ZoneInventoryModal({
  warehouse, location, onClose, onSaved,
}: {
  warehouse: Warehouse;
  location: Location;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [lines, setLines] = useState<StockLine[]>([]);
  const [step, setStep] = useState<'select' | 'fill'>('select');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  useEffect(() => {
    productApi.getAll({ limit: 200 }).then(r => setProducts(r.data.data.products));
    productApi.getCategories().then(r => setCategories(r.data.data));
  }, []);

  const filtered = products.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const mc = !catFilter || p.category.id === catFilter;
    return ms && mc;
  });

  const isSelected = (id: string) => lines.some(l => l.productId === id);

  const toggleProduct = (p: Product) => {
    if (isSelected(p.id)) {
      setLines(l => l.filter(x => x.productId !== p.id));
    } else {
      const currentStock = p.stockItems
        .filter(s => s.location.id === location.id)
        .reduce((sum, s) => sum + s.quantity, 0);
      setLines(l => [...l, {
        productId: p.id, productName: p.name, sku: p.sku,
        unit: p.unit, quantity: 0, reorderPoint: p.reorderPoint, currentStock,
      }]);
    }
  };

  const setQty = (productId: string, qty: number) =>
    setLines(l => l.map(x => x.productId === productId ? { ...x, quantity: Math.max(0, qty) } : x));

  const totalCapacityPct = lines.length === 0 ? 0 : Math.min(100,
    Math.round(lines.reduce((sum, l) =>
      sum + (l.reorderPoint > 0 ? (l.quantity / (l.reorderPoint * 5)) * 100 : 0), 0) / lines.length)
  );

  const handleSave = async () => {
    const validLines = lines.filter(l => l.quantity > 0);
    if (!validLines.length) { toast.error('Enter at least one quantity'); return; }
    setSaving(true);
    try {
      const opRes = await operationApi.create({
        type: 'RECEIPT',
        toLocationId: location.id,
        notes: `Zone inventory fill — ${location.name}, ${warehouse.name}`,
        lines: validLines.map(l => ({ productId: l.productId, quantity: l.quantity })),
      });

      // Auto-validate so stock updates immediately
      await operationApi.validate(opRes.data.data.id);

      const lowItems = validLines.filter(l => l.reorderPoint > 0 && l.quantity < l.reorderPoint);
      if (lowItems.length > 0) {
        toast(`⚠ ${lowItems.length} product${lowItems.length > 1 ? 's' : ''} still below reorder point`, { icon: '⚠️' });
      }
      toast.success(`Inventory updated — ${location.name}`);
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] text-text-muted bg-bg-surface2 px-2 py-0.5 rounded border border-border">{warehouse.name}</span>
              <span className="text-text-muted text-[11px]">→</span>
              <span className="text-[11px] text-accent font-medium">{location.name}</span>
            </div>
            <h2 className="font-head font-bold text-[16px] text-text-primary">Add Inventory to Zone</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm flex-shrink-0">✕</button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          <button
            onClick={() => setStep('select')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${step === 'select' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Step 1 — Select Products ({lines.length} selected)
          </button>
          <button
            onClick={() => lines.length > 0 && setStep('fill')}
            disabled={lines.length === 0}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${step === 'fill' ? 'text-accent border-b-2 border-accent bg-accent/5' : lines.length === 0 ? 'text-text-muted opacity-40 cursor-not-allowed' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Step 2 — Fill Quantities
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'select' ? (
            <div className="p-5">
              <div className="flex gap-2 mb-4">
                <div className="flex items-center gap-2 bg-bg-surface2 border border-border rounded px-3 py-2 flex-1 hover:border-border-strong transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#4A5568">
                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search products by name or SKU…"
                    className="bg-transparent outline-none text-sm text-text-primary placeholder-text-muted w-full"
                    autoFocus
                  />
                </div>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="select w-40 text-xs">
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                {filtered.length === 0 ? (
                  <div className="text-center py-10 text-text-muted text-sm">No products found</div>
                ) : filtered.map(p => {
                  const selected = isSelected(p.id);
                  const totalQty = p.stockItems.reduce((sum, s) => sum + s.quantity, 0);
                  const zoneQty = p.stockItems.filter(s => s.location.id === location.id).reduce((sum, s) => sum + s.quantity, 0);
                  const isLow = p.reorderPoint > 0 && totalQty < p.reorderPoint;
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProduct(p)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                        selected ? 'border-accent bg-accent/5' : 'border-border bg-bg-surface2 hover:border-border-strong'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'border-accent bg-accent' : 'border-border-strong'}`}>
                        {selected && (
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-text-primary truncate">{p.name}</span>
                          <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{p.sku}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-text-muted">{p.category.name}</span>
                          <span className="text-[11px] text-text-muted">· Total: {totalQty} {p.unit}</span>
                          {zoneQty > 0 && <span className="text-[11px] text-accent">· This zone: {zoneQty} {p.unit}</span>}
                          {p.reorderPoint > 0 && <span className="text-[11px] text-text-muted">· Reorder at {p.reorderPoint}</span>}
                        </div>
                      </div>
                      {isLow && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-warn/10 text-status-warn flex-shrink-0">LOW</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-5">
              {/* Capacity bar */}
              <div className="mb-5 p-4 bg-bg-surface2 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-text-secondary">Estimated Zone Capacity Usage</span>
                  <span className={`text-[12px] font-bold ${totalCapacityPct > 80 ? 'text-status-warn' : totalCapacityPct > 60 ? 'text-accent' : 'text-status-success'}`}>
                    {totalCapacityPct}%
                  </span>
                </div>
                <div className="h-2 bg-bg-surface3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${totalCapacityPct > 80 ? 'bg-status-warn' : totalCapacityPct > 60 ? 'bg-accent' : 'bg-status-success'}`}
                    style={{ width: `${totalCapacityPct}%` }}
                  />
                </div>
                <div className="text-[11px] text-text-muted mt-1.5">
                  {lines.filter(l => l.quantity > 0).length} of {lines.length} products filled
                </div>
              </div>

              {/* Quantity inputs */}
              <div className="space-y-2">
                {lines.map((line) => {
                  const isLow = line.quantity > 0 && line.reorderPoint > 0 && line.quantity < line.reorderPoint;
                  const isOk = line.reorderPoint > 0 && line.quantity >= line.reorderPoint;
                  return (
                    <div
                      key={line.productId}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                        isLow ? 'border-status-warn/40 bg-status-warn/5' :
                        isOk  ? 'border-status-success/30 bg-status-success/5' :
                                'border-border bg-bg-surface2'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text-primary truncate">{line.productName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-text-muted font-mono">{line.sku}</span>
                          {line.currentStock > 0 && <span className="text-[11px] text-text-muted">· Current: {line.currentStock} {line.unit}</span>}
                          {line.reorderPoint > 0 && <span className="text-[11px] text-text-muted">· Reorder at: {line.reorderPoint}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-24 text-right">
                        {isLow && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-warn/10 text-status-warn">Below reorder</span>}
                        {isOk  && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-success/10 text-status-success">✓ Adequate</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setQty(line.productId, line.quantity - 1)}
                          className="w-7 h-7 rounded bg-bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">−</button>
                        <input
                          type="number" value={line.quantity} min={0}
                          onChange={e => setQty(line.productId, Number(e.target.value))}
                          className="w-20 text-center input py-1 text-sm font-mono"
                        />
                        <button onClick={() => setQty(line.productId, line.quantity + 1)}
                          className="w-7 h-7 rounded bg-bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">+</button>
                        <span className="text-[11px] text-text-muted w-8">{line.unit}</span>
                        <button onClick={() => setLines(l => l.filter(x => x.productId !== line.productId))}
                          className="text-text-muted hover:text-status-danger transition-colors text-sm w-5">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              {lines.some(l => l.quantity > 0) && (
                <div className="mt-4 p-3 bg-bg-surface2 border border-border rounded-lg">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-2 font-medium">Summary</div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <div className="font-head font-bold text-text-primary">{lines.filter(l => l.quantity > 0).length}</div>
                      <div className="text-[11px] text-text-muted">Products</div>
                    </div>
                    <div>
                      <div className="font-head font-bold text-text-primary">{lines.reduce((s, l) => s + l.quantity, 0).toLocaleString()}</div>
                      <div className="text-[11px] text-text-muted">Total units</div>
                    </div>
                    <div>
                      <div className="font-head font-bold text-status-warn">
                        {lines.filter(l => l.quantity > 0 && l.reorderPoint > 0 && l.quantity < l.reorderPoint).length}
                      </div>
                      <div className="text-[11px] text-text-muted">Below reorder point</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          {step === 'select' ? (
            <>
              <span className="text-[12px] text-text-muted flex-1">
                {lines.length === 0 ? 'Select products to stock this zone' : `${lines.length} product${lines.length !== 1 ? 's' : ''} selected`}
              </span>
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={lines.length === 0} onClick={() => setStep('fill')}>
                Next: Fill Quantities →
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost text-xs" onClick={() => setStep('select')}>← Back</button>
              <div className="flex-1" />
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={saving || lines.every(l => l.quantity === 0)} onClick={handleSave}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                    </svg>
                    Saving…
                  </span>
                ) : 'Save Inventory'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Warehouse Modal ─────────────────────────────────────────────────────
function WHModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await warehouseApi.create({ name, address: address || undefined, capacity: capacity ? Number(capacity) : undefined });
      toast.success('Warehouse created');
      onSaved();
    } catch {
      toast.error('Failed to create warehouse');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-head font-bold text-[16px] text-text-primary">New Warehouse</h2>
          <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className="label">Name *</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Warehouse" autoFocus /></div>
          <div><label className="label">Address</label><input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address (optional)" /></div>
          <div><label className="label">Total Capacity (m³)</label><input type="number" className="input" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 10000" min={0} /></div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border justify-end">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create Warehouse'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Zone Modal ─────────────────────────────────────────────────────────────
function LocationModal({ warehouse, onClose, onSaved }: { warehouse: Warehouse; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await warehouseApi.createLocation({ name, warehouseId: warehouse.id });
      toast.success('Zone created');
      onSaved();
    } catch {
      toast.error('Failed to create zone');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-head font-bold text-[16px] text-text-primary">Add Zone</h2>
            <p className="text-[11px] text-text-muted mt-0.5">in {warehouse.name}</p>
          </div>
          <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="label">Zone Name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Zone A — Raw Materials" autoFocus />
          </div>
          <div className="text-[12px] text-text-muted bg-bg-surface2 border border-border rounded-lg p-3">
            After creating the zone, click <span className="text-accent font-medium">+ Add Inventory</span> to stock it with products.
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border justify-end">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Add Zone'}</button>
        </div>
      </div>
    </div>
  );
}
