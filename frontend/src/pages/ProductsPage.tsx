// src/pages/ProductsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { productApi, warehouseApi } from '../api/services';
import type { Product, Category, Warehouse } from '../types';
import { stockStatusColor } from '../utils';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected]   = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (catFilter) params.categoryId = catFilter;
      const [prodRes, catRes, whRes] = await Promise.all([
        productApi.getAll(params),
        productApi.getCategories(),
        warehouseApi.getAll(),
      ]);
      setProducts(prodRes.data.data.products);
      setTotal(prodRes.data.data.total);
      setCategories(catRes.data.data);
      setWarehouses(whRes.data.data);
    } catch { toast.error('Failed to load products'); }
    finally  { setLoading(false); }
  }, [search, catFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try { await productApi.delete(id); toast.success('Product deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const allZones = warehouses.flatMap(wh =>
    wh.locations.map(loc => ({ id: loc.id, label: `${loc.name} (${wh.name})` }))
  );

  const displayProducts = zoneFilter
    ? products.filter(p => p.stockItems.some(s => s.location.id === zoneFilter && s.quantity > 0))
    : products;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Products</h1>
          <p className="text-text-secondary text-sm mt-0.5">{total} products in catalogue</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setShowModal(true); }}>
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 bg-bg-surface2 border border-border rounded px-3 py-2 flex-1 min-w-[200px] max-w-xs hover:border-border-strong transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#4A5568">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or SKU…"
            className="bg-transparent outline-none text-sm text-text-primary placeholder-text-muted w-full" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="select w-44">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} className="select w-52">
          <option value="">All Zones</option>
          {warehouses.map(wh => (
            <optgroup key={wh.id} label={wh.name}>
              {wh.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button onClick={load} className="btn-ghost text-xs px-3">↻</button>
      </div>

      {/* Zone filter pill */}
      {zoneFilter && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[12px] text-text-muted">Filtered by zone:</span>
          <span className="flex items-center gap-1.5 text-[12px] bg-accent/10 text-accent px-3 py-1 rounded-full font-medium">
            {allZones.find(z => z.id === zoneFilter)?.label}
            <button onClick={() => setZoneFilter('')} className="hover:opacity-70 leading-none">✕</button>
          </span>
          <span className="text-[12px] text-text-muted">({displayProducts.length} products)</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 bg-bg-surface animate-pulse rounded-lg" />
          ))}
        </div>
      ) : displayProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-text-muted">
          <div className="text-4xl mb-3 opacity-30">📦</div>
          <p className="text-sm">No products found</p>
          {!search && !catFilter && !zoneFilter && (
            <button className="btn-primary mt-4 text-xs" onClick={() => setShowModal(true)}>Add first product</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {displayProducts.map(p => {
            const totalQty = p.stockItems.reduce((sum, s) => sum + s.quantity, 0);
            const worstStatus = p.stockItems.some(s => s.status === 'OUT') ? 'OUT'
              : p.stockItems.some(s => s.status === 'LOW') ? 'LOW' : 'OK';

            const zoneBreakdown = p.stockItems
              .filter(s => s.quantity > 0)
              .map(s => ({
                locationId:    s.location.id,
                locationName:  s.location.name,
                warehouseName: s.location.warehouse?.name ?? '',
                quantity:      s.quantity,
                status:        s.status,
              }));

            return (
              <div
                key={p.id}
                className="card p-4 cursor-pointer hover:border-border-strong hover:-translate-y-px transition-all duration-200 group flex flex-col gap-2"
                onClick={() => { setSelected(p); setShowModal(true); }}
              >
                {/* SKU + Category */}
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-mono">{p.sku}</div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-bg-surface2 rounded text-text-muted">{p.category.name}</span>
                </div>

                {/* Name */}
                <div className="font-head font-semibold text-[14px] text-text-primary leading-tight group-hover:text-accent transition-colors">
                  {p.name}
                </div>

                {/* Stock qty + Price row */}
                <div className="flex items-end justify-between">
                  {/* Qty */}
                  <div>
                    <div className={`font-head text-2xl font-bold ${stockStatusColor(worstStatus)}`}>
                      {totalQty.toLocaleString()}
                      <span className="text-[12px] font-normal ml-1 text-text-muted">{p.unit}</span>
                    </div>
                    <div className={`text-[11px] mt-0.5 ${stockStatusColor(worstStatus)}`}>
                      {worstStatus === 'OUT' ? 'Out of stock' : worstStatus === 'LOW' ? 'Low stock' : 'In stock'}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    {p.price != null ? (
                      <>
                        <div className="font-head font-bold text-[15px] text-text-primary text-blue-400">
                          ${(p.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-text-muted">per {p.unit}</div>
                      </>
                    ) : (
                      <div className="text-[11px] text-text-muted italic">No price</div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Zone breakdown */}
                <div className="text-[10px] text-text-muted uppercase tracking-wide font-medium">Stored in</div>
                {zoneBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    {zoneBreakdown.slice(0, 2).map(z => (
                      <div key={z.locationId} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            z.status === 'OUT' ? 'bg-status-danger' :
                            z.status === 'LOW' ? 'bg-status-warn' : 'bg-status-success'
                          }`} />
                          <span className="text-[11px] text-text-secondary truncate" title={`${z.locationName} · ${z.warehouseName}`}>
                            {z.locationName}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-text-muted flex-shrink-0 ml-1">
                          {z.quantity} {p.unit}
                        </span>
                      </div>
                    ))}
                    {zoneBreakdown.length > 2 && (
                      <div className="text-[10px] text-text-muted">
                        +{zoneBreakdown.length - 2} more zone{zoneBreakdown.length - 2 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-text-muted italic">Not assigned to any zone</div>
                )}

                {/* Reorder note — text only, no bar */}
                {p.reorderPoint > 0 && (
                  <div className="text-[10px] text-text-muted mt-auto pt-1 border-t border-border">
                    Reorder at {p.reorderPoint} {p.unit}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ProductModal
          product={selected}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({ product, categories, onClose, onSaved, onDelete }: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name:         product?.name         ?? '',
    sku:          product?.sku          ?? '',
    barcode:      product?.barcode      ?? '',
    categoryId:   product?.category.id  ?? '',
    unit:         product?.unit         ?? 'pcs',
    reorderPoint: product?.reorderPoint ?? 0,
    price:        product?.price        ?? '',
    description:  product?.description  ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.sku || !form.categoryId) { toast.error('Fill in required fields'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: form.price !== '' ? Number(form.price) : undefined,
      };
      if (isEdit) { await productApi.update(product!.id, payload); toast.success('Product updated'); }
      else        { await productApi.create({ ...payload, categoryId: form.categoryId }); toast.success('Product created'); }
      onSaved();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const zoneBreakdown = product?.stockItems
    .filter(s => s.quantity > 0)
    .map(s => ({
      locationName:  s.location.name,
      warehouseName: s.location.warehouse?.name ?? '',
      quantity:      s.quantity,
      status:        s.status,
      unit:          product.unit,
    })) ?? [];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-head font-bold text-[16px] text-text-primary">
            {isEdit ? 'Edit Product' : 'New Product'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Product Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Steel Rods 8mm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">SKU / Code *</label>
              <input className="input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="SKU-0001" />
            </div>
            <div>
              <label className="label">Barcode</label>
              <input className="input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select className="select" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">Select…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit of Measure</label>
              <select className="select" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {['pcs','kg','g','L','ml','m','cm','box','roll'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                <input
                  type="number" min={0} step={0.01}
                  className="input pl-7"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="label">Reorder Point</label>
              <input type="number" className="input" value={form.reorderPoint}
                onChange={e => set('reorderPoint', Number(e.target.value))} min={0} />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)} placeholder="Optional notes…" />
          </div>

          {/* Zone breakdown — edit mode only */}
          {isEdit && zoneBreakdown.length > 0 && (
            <div>
              <label className="label">Stock by Zone</label>
              <div className="space-y-1.5">
                {zoneBreakdown.map((z, i) => (
                  <div key={i} className="flex items-center justify-between bg-bg-surface2 border border-border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        z.status==='OUT'?'bg-status-danger':z.status==='LOW'?'bg-status-warn':'bg-status-success'
                      }`} />
                      <div className="min-w-0">
                        <div className="text-[13px] text-text-primary truncate">{z.locationName}</div>
                        <div className="text-[11px] text-text-muted">{z.warehouseName}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className={`text-[13px] font-mono font-semibold ${
                        z.status==='OUT'?'text-status-danger':z.status==='LOW'?'text-status-warn':'text-status-success'
                      }`}>{z.quantity} {z.unit}</div>
                      <div className="text-[10px] text-text-muted uppercase">{z.status}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-text-muted">
                To restock: <span className="text-accent">Warehouses → Zone → Add Inventory</span>
              </div>
            </div>
          )}

          {isEdit && zoneBreakdown.length === 0 && (
            <div className="bg-bg-surface2 border border-dashed border-border rounded-lg p-3 text-center">
              <div className="text-[12px] text-text-muted mb-1">No stock in any zone yet</div>
              <div className="text-[11px] text-text-muted">Go to <span className="text-accent">Warehouses → Zone → Add Inventory</span></div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border">
          {isEdit && (
            <button className="btn-danger text-xs px-3" onClick={() => { onDelete(product!.id); onClose(); }}>Delete</button>
          )}
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
