// src/pages/WarehousesPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
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

type Mode = 'dashboard' | 'manage';
const ZONE_COLORS = ['#4F8EF7','#00D4A8','#F7C04F','#7B5CEA','#F7914F','#4FF79A','#F75F5F','#F4B942'];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function WarehousesPage() {
  const [mode, setMode]             = useState<Mode>('dashboard');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showWHModal, setShowWHModal]               = useState(false);
  const [showLocModal, setShowLocModal]             = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showDetailModal, setShowDetailModal]       = useState(false);
  const [selectedWH, setSelectedWH]     = useState<Warehouse | null>(null);
  const [selectedZone, setSelectedZone] = useState<{ warehouse: Warehouse; location: Location } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const whRes   = await warehouseApi.getAll();
      const prodRes = await productApi.getAll({ limit: 200 });
      setWarehouses(whRes.data.data);
      setProducts(prodRes.data.data.products);
    } catch { toast.error('Failed to load data'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalZones    = warehouses.reduce((s, w) => s + w.locations.length, 0);
  const lowStockCount = products.filter(p =>
    (p.stockItems ?? []).some(s => s.status === 'LOW' || s.status === 'OUT')
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Warehouses</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''} · {totalZones} zones · {products.length} products
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex bg-bg-surface2 border border-border rounded-lg p-0.5">
            {(['dashboard','manage'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
                  mode === m ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}>
                {m === 'dashboard' ? '📊 Dashboard' : '⚙ Manage'}
              </button>
            ))}
          </div>
          {mode === 'manage' && (
            <button className="btn-primary text-xs" onClick={() => setShowWHModal(true)}>+ Add Warehouse</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <div key={i} className="h-40 bg-bg-surface animate-pulse rounded-lg" />)}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-text-muted">
          <div className="text-5xl mb-4 opacity-20">🏭</div>
          <p className="text-sm mb-4">No warehouses configured yet</p>
          <button className="btn-primary text-xs" onClick={() => { setMode('manage'); setShowWHModal(true); }}>Create first warehouse</button>
        </div>
      ) : mode === 'dashboard' ? (
        <DashboardMode 
          warehouses={warehouses.filter(wh =>
            wh.locations.length > 0 &&
            wh.locations.some(loc =>
              products.some(p => (p.stockItems ?? []).some(s => s.location?.id === loc.id && s.quantity > 0))
            )
          )}
          products={products}
          lowStockCount={lowStockCount}
        />
      ) : (
        <ManageMode
          warehouses={warehouses}
          onAddZone={(wh) => { setSelectedWH(wh); setShowLocModal(true); }}
          onAddInventory={(wh, loc) => { setSelectedZone({ warehouse: wh, location: loc }); setShowInventoryModal(true); }}
          onViewDetail={(wh) => { setSelectedWH(wh); setShowDetailModal(true); }}
        />
      )}

      {showWHModal && <WHModal onClose={() => setShowWHModal(false)} onSaved={() => { setShowWHModal(false); load(); }} />}
      {showLocModal && selectedWH && <LocationModal warehouse={selectedWH} onClose={() => setShowLocModal(false)} onSaved={() => { setShowLocModal(false); load(); }} />}
      {showInventoryModal && selectedZone && (
        <ZoneInventoryModal warehouse={selectedZone.warehouse} location={selectedZone.location}
          onClose={() => setShowInventoryModal(false)} onSaved={() => { setShowInventoryModal(false); load(); }} />
      )}
      {showDetailModal && selectedWH && (
        <WarehouseDetailModal warehouse={selectedWH} products={products}
          onClose={() => setShowDetailModal(false)}
          onAddInventory={(loc) => { setShowDetailModal(false); setSelectedZone({ warehouse: selectedWH, location: loc }); setShowInventoryModal(true); }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD MODE
// ══════════════════════════════════════════════════════════════════════════════
function DashboardMode({ warehouses, products, lowStockCount }: {
  warehouses: Warehouse[]; products: Product[]; lowStockCount: number;
}) {
  const barRef    = useRef<HTMLCanvasElement>(null);
  const donutRef  = useRef<HTMLCanvasElement>(null);
  const barChart  = useRef<unknown>(null);
  const donutChart = useRef<unknown>(null);

  const allZones = warehouses.flatMap(wh =>
    wh.locations.map(loc => {
      const sis = products.flatMap(p => (p.stockItems ?? []).filter(s => s.location?.id === loc.id));
      return {
        loc, wh,
        totalQty:  sis.reduce((s, x) => s + x.quantity, 0),
        lowCount:  sis.filter(x => x.status === 'LOW' || x.status === 'OUT').length,
        okCount:   sis.filter(x => x.status === 'OK').length,
        itemCount: sis.length,
      };
    })
  );

  const whTotals = warehouses.map(wh => {
    const zs = allZones.filter(z => z.wh.id === wh.id);
    return { wh, totalQty: zs.reduce((s,z) => s+z.totalQty,0), lowCount: zs.reduce((s,z) => s+z.lowCount,0), okCount: zs.reduce((s,z) => s+z.okCount,0), zoneCount: zs.length };
  });

  const allSIs   = products.flatMap(p => p.stockItems ?? []);
  const okTotal  = allSIs.filter(s => s.status === 'OK').length;
  const lowTotal = allSIs.filter(s => s.status === 'LOW').length;
  const outTotal = allSIs.filter(s => s.status === 'OUT').length;

  const renderCharts = useCallback((C: new (...a: unknown[]) => { destroy: () => void }) => {
    const tip = { backgroundColor:'#1A1D24', titleColor:'#F0F2F7', bodyColor:'#8892A4', borderColor:'#2A2E38', borderWidth:1 };
    if (barRef.current) {
      if (barChart.current) (barChart.current as { destroy:()=>void }).destroy();
      const top = [...allZones].sort((a,b) => b.totalQty - a.totalQty).slice(0, 8);
      barChart.current = new C(barRef.current, {
        type: 'bar',
        data: {
          labels: top.map(z => z.loc.name.length > 14 ? z.loc.name.slice(0,14)+'…' : z.loc.name),
          datasets: [{ label:'Total Stock', data: top.map(z => z.totalQty), backgroundColor: top.map((_,i) => ZONE_COLORS[i%ZONE_COLORS.length]), borderRadius:4, borderSkipped:false }],
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:tip },
          scales: { x:{grid:{color:'#2A2E38'},ticks:{color:'#8892A4',font:{size:10}}}, y:{grid:{color:'#2A2E38'},ticks:{color:'#8892A4',font:{size:10}},beginAtZero:true} } },
      });
    }
    if (donutRef.current) {
      if (donutChart.current) (donutChart.current as { destroy:()=>void }).destroy();
      donutChart.current = new C(donutRef.current, {
        type: 'doughnut',
        data: { labels:['Healthy','Low Stock','Out of Stock'], datasets:[{ data:[okTotal,lowTotal,outTotal], backgroundColor:['#4FF79A','#F7C04F','#F75F5F'], borderColor:'#111318', borderWidth:2, hoverOffset:4 }] },
        options: { responsive:true, maintainAspectRatio:false, cutout:'68%', plugins:{ legend:{position:'bottom',labels:{color:'#8892A4',font:{size:11},padding:12,boxWidth:10,boxHeight:10}}, tooltip:tip } },
      });
    }
  }, [allZones, okTotal, lowTotal, outTotal]);

  useEffect(() => {
    const C = (window as unknown as { Chart?: new (...a: unknown[]) => { destroy:()=>void } }).Chart;
    if (C) { renderCharts(C); return; }
    if (document.querySelector('script[data-chartjs]')) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.setAttribute('data-chartjs','1');
    s.onload = () => {
      const CC = (window as unknown as { Chart?: new (...a: unknown[]) => { destroy:()=>void } }).Chart;
      if (CC) renderCharts(CC);
    };
    document.head.appendChild(s);
    return () => {
      if (barChart.current)  (barChart.current  as { destroy:()=>void }).destroy();
      if (donutChart.current)(donutChart.current as { destroy:()=>void }).destroy();
    };
  }, [renderCharts]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5">
        {[
          { label:'Total Warehouses', value:warehouses.length, accent:'kpi-blue',   sub:`${warehouses.reduce((s,w)=>s+w.locations.length,0)} zones` },
          { label:'Total Products',   value:products.length,   accent:'kpi-purple', sub:'in catalogue' },
          { label:'Low / Out Stock',  value:lowStockCount,     accent:'kpi-danger', sub:'need attention', danger:true },
          { label:'Healthy Zones',    value:allZones.filter(z=>z.lowCount===0&&z.itemCount>0).length, accent:'kpi-green', sub:'fully stocked' },
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.accent}`}>
            <div className="text-[11px] text-text-secondary uppercase tracking-wide font-medium mb-2">{k.label}</div>
            <div className={`font-head text-[28px] font-bold leading-none ${k.danger ? 'text-status-danger':'text-text-primary'}`}>{k.value}</div>
            <div className="text-[11px] text-text-muted mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-[1fr_300px] gap-4">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Stock Volume by Zone</span>
            <span className="text-[11px] text-text-muted">Top 8 zones</span>
          </div>
          <div className="p-5" style={{ height:220 }}>
            {allZones.length === 0
              ? <div className="h-full flex items-center justify-center text-text-muted text-sm">No zone data yet</div>
              : <canvas ref={barRef} />}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Stock Health</span></div>
          <div className="p-5" style={{ height:220 }}>
            {(okTotal+lowTotal+outTotal) === 0
              ? <div className="h-full flex items-center justify-center text-text-muted text-sm">No stock data</div>
              : <canvas ref={donutRef} />}
          </div>
        </div>
      </div>

      {/* Warehouse health cards */}
      <div className="grid grid-cols-2 gap-4">
        {whTotals.map(({ wh, totalQty, lowCount, okCount, zoneCount }) => (
          <div key={wh.id} className="card">
            <div className="card-header">
              <div>
                <div className="card-title">{wh.name}</div>
                {wh.address && <div className="text-[11px] text-text-muted mt-0.5">{wh.address}</div>}
              </div>
              <div className="flex items-center gap-2">
                {lowCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger">{lowCount} LOW</span>}
                {wh.capacity && <span className="text-[11px] text-text-muted bg-bg-surface2 px-2 py-1 rounded border border-border">{wh.capacity.toLocaleString()} m³</span>}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-0 border-b border-border">
              {[{ label:'Zones', value:zoneCount },{ label:'Total Units', value:totalQty.toLocaleString() },{ label:'Healthy', value:okCount }].map((s,i) => (
                <div key={i} className={`px-4 py-3 text-center ${i<2?'border-r border-border':''}`}>
                  <div className="font-head font-bold text-lg text-text-primary">{s.value}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Zone bars */}
            <div className="p-4 space-y-2.5">
              {wh.locations.length === 0
                ? <div className="text-center py-4 text-text-muted text-xs">No zones configured</div>
                : wh.locations.map((loc, idx) => {
                    const z    = allZones.find(x => x.loc.id === loc.id);
                    const pct  = wh.capacity && z ? Math.min(100, Math.round((z.totalQty / wh.capacity) * 100)) : 0;
                    return (
                      <div key={loc.id}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ZONE_COLORS[idx%ZONE_COLORS.length] }} />
                            <span className="text-[12px] font-medium text-text-primary">{loc.name}</span>
                            {(z?.lowCount??0)>0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-status-warn/10 text-status-warn">LOW</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-[12px] font-mono text-text-secondary">{(z?.totalQty??0).toLocaleString()} units</span>
                            {z && z.itemCount>0 && <span className="text-[10px] text-text-muted ml-2">· {z.itemCount} SKU{z.itemCount!==1?'s':''}</span>}
                          </div>
                        </div>
                        <div className="h-1.5 bg-bg-surface3 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width:`${pct||(z&&z.totalQty>0?15:0)}%`, background:ZONE_COLORS[idx%ZONE_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
            </div>

            {/* Zone product breakdown */}
            {wh.locations.some(loc => allZones.find(z => z.loc.id===loc.id && z.itemCount>0)) && (
              <div className="border-t border-border px-4 py-3">
                <div className="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-2.5">Products by Zone</div>
                {wh.locations.map((loc, idx) => {
                  const zoneProds = products.filter(p => (p.stockItems??[]).some(s => s.location?.id===loc.id && s.quantity>0));
                  if (zoneProds.length===0) return null;
                  return (
                    <div key={loc.id} className="mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background:ZONE_COLORS[idx%ZONE_COLORS.length] }} />
                        <span className="text-[11px] font-medium text-text-secondary">{loc.name}</span>
                      </div>
                      <div className="space-y-1">
                        {zoneProds.slice(0,4).map(p => {
                          const si = (p.stockItems??[]).find(s => s.location?.id===loc.id);
                          if (!si) return null;
                          return (
                            <div key={p.id} className="flex items-center justify-between bg-bg-surface2 rounded px-2.5 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${si.status==='OUT'?'bg-status-danger':si.status==='LOW'?'bg-status-warn':'bg-status-success'}`} />
                                <span className="text-[12px] text-text-primary truncate">{p.name}</span>
                                <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{p.sku}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className={`text-[11px] font-mono font-semibold ${si.status==='OUT'?'text-status-danger':si.status==='LOW'?'text-status-warn':'text-status-success'}`}>{si.quantity} {p.unit}</span>
                                {si.status!=='OK' && <span className="text-[9px] font-bold px-1.5 rounded-full bg-status-danger/10 text-status-danger">{si.status}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {zoneProds.length>4 && <div className="text-[10px] text-text-muted pl-2">+{zoneProds.length-4} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Low stock alert table */}
      {(() => {
        const lowItems = products.flatMap(p =>
          (p.stockItems??[]).filter(s => s.status==='LOW'||s.status==='OUT').map(s => ({ p, s }))
        );
        if (lowItems.length===0) return null;
        return (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Stock Alerts</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger">{lowItems.length} item{lowItems.length!==1?'s':''} need attention</span>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Product</th><th>SKU</th><th>Zone</th><th>Warehouse</th><th>Qty</th><th>Reorder At</th><th>Status</th></tr></thead>
                <tbody>
                  {lowItems.map(({ p, s }) => (
                    <tr key={`${p.id}-${s.location?.id}`}>
                      <td className="font-medium">{p.name}</td>
                      <td className="font-mono text-xs">{p.sku}</td>
                      <td className="text-text-muted">{s.location?.name??'—'}</td>
                      <td className="text-text-muted">{s.location?.warehouse?.name??'—'}</td>
                      <td className={`font-mono font-bold ${s.status==='OUT'?'text-status-danger':'text-status-warn'}`}>{s.quantity} {p.unit}</td>
                      <td className="text-text-muted">{p.reorderPoint} {p.unit}</td>
                      <td><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status==='OUT'?'bg-status-danger/10 text-status-danger':'bg-status-warn/10 text-status-warn'}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MANAGE MODE
// ══════════════════════════════════════════════════════════════════════════════
function ManageMode({ warehouses, onAddZone, onAddInventory, onViewDetail }: {
  warehouses: Warehouse[];
  onAddZone: (wh: Warehouse) => void;
  onAddInventory: (wh: Warehouse, loc: Location) => void;
  onViewDetail: (wh: Warehouse) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {warehouses.map(wh => (
        <div key={wh.id} className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{wh.name}</div>
              {wh.address && <div className="text-[11px] text-text-muted mt-0.5">{wh.address}</div>}
            </div>
            <div className="flex items-center gap-2">
              {wh.capacity && <span className="text-[11px] text-text-muted bg-bg-surface2 px-2 py-1 rounded border border-border">{wh.capacity.toLocaleString()} m³</span>}
              <button className="btn-ghost text-xs px-2.5 py-1" onClick={() => onViewDetail(wh)}>Details</button>
              <button className="btn-ghost text-xs px-2.5 py-1" onClick={() => onAddZone(wh)}>+ Zone</button>
            </div>
          </div>
          <div className="p-4">
            {wh.locations.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-text-muted">
                <div className="text-2xl mb-2 opacity-20">📦</div>
                <p className="text-xs">No zones yet</p>
                <button className="mt-3 text-accent text-xs hover:underline" onClick={() => onAddZone(wh)}>Add first zone</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {wh.locations.map((loc, idx) => {
                  const hasLow   = (loc as Location & { stockItems?: {status:string}[] }).stockItems?.some(s => s.status==='LOW'||s.status==='OUT') ?? false;
                  const itemCount= (loc as Location & { stockItems?: unknown[] }).stockItems?.length ?? 0;
                  return (
                    <div key={loc.id} className="bg-bg-surface2 border border-border rounded-lg p-3 hover:border-border-strong transition-all duration-200">
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:ZONE_COLORS[idx%ZONE_COLORS.length] }} />
                          <span className="text-[12px] font-medium text-text-primary leading-tight truncate">{loc.name}</span>
                        </div>
                        {hasLow && <span className="flex-shrink-0 text-[9px] font-bold bg-status-danger/10 text-status-danger px-1.5 py-0.5 rounded-full">LOW</span>}
                      </div>
                      <div className="text-[11px] text-text-muted mb-2.5">
                        {itemCount > 0 ? `${itemCount} product${itemCount!==1?'s':''}` : 'No inventory yet'}
                      </div>
                      <button onClick={() => onAddInventory(wh, loc)}
                        className="w-full text-center text-[11px] font-medium py-1.5 rounded border border-dashed border-border-strong text-text-muted hover:border-accent hover:text-accent hover:bg-accent/5 transition-all duration-150">
                        + Add Inventory
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WAREHOUSE DETAIL MODAL
// ══════════════════════════════════════════════════════════════════════════════
function WarehouseDetailModal({ warehouse, products, onClose, onAddInventory }: {
  warehouse: Warehouse; products: Product[];
  onClose: () => void; onAddInventory: (loc: Location) => void;
}) {
  const [activeZone, setActiveZone] = useState(warehouse.locations[0]?.id ?? '');
  const currentLoc  = warehouse.locations.find(l => l.id === activeZone);
  const zoneProducts = currentLoc ? products.filter(p => (p.stockItems??[]).some(s => s.location?.id===currentLoc.id)) : [];
  const totalUnits   = zoneProducts.reduce((sum,p) => {
    const si = (p.stockItems??[]).find(s => s.location?.id===currentLoc?.id);
    return sum + (si?.quantity??0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-head font-bold text-[16px] text-text-primary">{warehouse.name}</h2>
            <p className="text-[12px] text-text-muted mt-0.5">{warehouse.address}{warehouse.capacity?` · ${warehouse.capacity.toLocaleString()} m³ capacity`:''}</p>
          </div>
          <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Zone sidebar */}
          <div className="w-52 flex-shrink-0 border-r border-border p-3 space-y-1 overflow-y-auto">
            <div className="text-[10px] text-text-muted uppercase tracking-wide px-2 mb-2">Zones</div>
            {warehouse.locations.length === 0
              ? <div className="text-center py-6 text-text-muted text-xs">No zones yet</div>
              : warehouse.locations.map((loc, idx) => {
                  const lps    = products.filter(p => (p.stockItems??[]).some(s => s.location?.id===loc.id));
                  const hasLow = lps.some(p => (p.stockItems??[]).some(s => s.location?.id===loc.id&&(s.status==='LOW'||s.status==='OUT')));
                  return (
                    <button key={loc.id} onClick={() => setActiveZone(loc.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${activeZone===loc.id?'bg-accent/10 border border-accent/30':'hover:bg-bg-surface2 border border-transparent'}`}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:ZONE_COLORS[idx%ZONE_COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-medium truncate ${activeZone===loc.id?'text-accent':'text-text-primary'}`}>{loc.name}</div>
                        <div className="text-[10px] text-text-muted">{lps.length} products</div>
                      </div>
                      {hasLow && <span className="w-1.5 h-1.5 rounded-full bg-status-danger flex-shrink-0" />}
                    </button>
                  );
                })}
          </div>

          {/* Zone detail */}
          <div className="flex-1 overflow-y-auto p-5">
            {!currentLoc ? (
              <div className="text-center py-16 text-text-muted">Select a zone</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-head font-semibold text-[15px] text-text-primary">{currentLoc.name}</h3>
                    <p className="text-[12px] text-text-muted mt-0.5">{zoneProducts.length} products · {totalUnits.toLocaleString()} total units</p>
                  </div>
                  <button className="btn-primary text-xs" onClick={() => onAddInventory(currentLoc)}>+ Add Inventory</button>
                </div>

                {zoneProducts.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-text-muted border-2 border-dashed border-border rounded-lg">
                    <div className="text-3xl mb-3 opacity-20">📦</div>
                    <p className="text-sm mb-3">No inventory in this zone</p>
                    <button className="btn-primary text-xs" onClick={() => onAddInventory(currentLoc)}>Add Inventory</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {zoneProducts.map(p => {
                      const si  = (p.stockItems??[]).find(s => s.location?.id===currentLoc.id);
                      if (!si) return null;
                      const pct = p.reorderPoint>0 ? Math.min(100, Math.round((si.quantity/(p.reorderPoint*3))*100)) : 50;
                      return (
                        <div key={p.id} className={`p-3.5 rounded-lg border transition-colors ${si.status==='OUT'?'border-status-danger/30 bg-status-danger/5':si.status==='LOW'?'border-status-warn/30 bg-status-warn/5':'border-border bg-bg-surface2'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="text-[13px] font-medium text-text-primary">{p.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-text-muted font-mono">{p.sku}</span>
                                <span className="text-[10px] text-text-muted">· {p.category.name}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-head font-bold text-lg ${si.status==='OUT'?'text-status-danger':si.status==='LOW'?'text-status-warn':'text-status-success'}`}>
                                {si.quantity}<span className="text-[12px] font-normal text-text-muted ml-1">{p.unit}</span>
                              </div>
                              {p.reorderPoint>0 && <div className="text-[10px] text-text-muted">Reorder at {p.reorderPoint}</div>}
                            </div>
                          </div>
                          {p.reorderPoint>0 && (
                            <div>
                              <div className="h-1.5 bg-bg-surface3 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${si.status==='OUT'?'bg-status-danger':si.status==='LOW'?'bg-status-warn':'bg-status-success'}`} style={{ width:`${pct}%` }} />
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-text-muted">{pct}% of target</span>
                                <span className={`text-[10px] font-semibold ${si.status==='OUT'?'text-status-danger':si.status==='LOW'?'text-status-warn':'text-status-success'}`}>{si.status}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ZONE INVENTORY MODAL
// ══════════════════════════════════════════════════════════════════════════════
function ZoneInventoryModal({ warehouse, location, onClose, onSaved }: {
  warehouse: Warehouse; location: Location; onClose: () => void; onSaved: () => void;
}) {
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<{id:string;name:string}[]>([]);
  const [lines, setLines]           = useState<StockLine[]>([]);
  const [step, setStep]             = useState<'select'|'fill'>('select');
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('');

  useEffect(() => {
    productApi.getAll({ limit:200 }).then(r => setProducts(r.data.data.products));
    productApi.getCategories().then(r => setCategories(r.data.data));
  }, []);

  const filtered    = products.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return ms && (!catFilter || p.category.id===catFilter);
  });
  const isSelected  = (id:string) => lines.some(l => l.productId===id);
  const toggleProduct = (p:Product) => {
    if (isSelected(p.id)) { setLines(l => l.filter(x => x.productId!==p.id)); return; }
    const currentStock = (p.stockItems??[]).filter(s => s.location?.id===location.id).reduce((sum,s) => sum+s.quantity, 0);
    setLines(l => [...l, { productId:p.id, productName:p.name, sku:p.sku, unit:p.unit, quantity:0, reorderPoint:p.reorderPoint, currentStock }]);
  };
  const setQty = (pid:string, qty:number) => setLines(l => l.map(x => x.productId===pid ? {...x, quantity:Math.max(0,qty)} : x));
  const totalCapacityPct = lines.length===0 ? 0 : Math.min(100, Math.round(lines.reduce((sum,l) => sum+(l.reorderPoint>0?(l.quantity/(l.reorderPoint*5))*100:0), 0)/lines.length));

  const handleSave = async () => {
    const vl = lines.filter(l => l.quantity>0);
    if (!vl.length) { toast.error('Enter at least one quantity'); return; }
    setSaving(true);
    try {
      const op = await operationApi.create({ type:'RECEIPT', toLocationId:location.id, notes:`Zone fill — ${location.name}`, lines:vl.map(l=>({productId:l.productId,quantity:l.quantity})) });
      await operationApi.validate(op.data.data.id);
      const low = vl.filter(l => l.reorderPoint>0 && l.quantity<l.reorderPoint);
      if (low.length>0) toast(`⚠ ${low.length} product${low.length>1?'s':''} below reorder point`, {icon:'⚠️'});
      toast.success(`Inventory updated — ${location.name}`);
      onSaved();
    } catch (err:unknown) {
      toast.error((err as {response?:{data?:{message?:string}}})?.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
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

        <div className="flex border-b border-border flex-shrink-0">
          <button onClick={()=>setStep('select')} className={`flex-1 py-2.5 text-xs font-medium transition-colors ${step==='select'?'text-accent border-b-2 border-accent bg-accent/5':'text-text-muted hover:text-text-secondary'}`}>Step 1 — Select Products ({lines.length} selected)</button>
          <button onClick={()=>lines.length>0&&setStep('fill')} disabled={lines.length===0} className={`flex-1 py-2.5 text-xs font-medium transition-colors ${step==='fill'?'text-accent border-b-2 border-accent bg-accent/5':lines.length===0?'text-text-muted opacity-40 cursor-not-allowed':'text-text-muted hover:text-text-secondary'}`}>Step 2 — Fill Quantities</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step==='select' ? (
            <div className="p-5">
              <div className="flex gap-2 mb-4">
                <div className="flex items-center gap-2 bg-bg-surface2 border border-border rounded px-3 py-2 flex-1 hover:border-border-strong transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#4A5568"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…" className="bg-transparent outline-none text-sm text-text-primary placeholder-text-muted w-full" autoFocus />
                </div>
                <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="select w-40 text-xs">
                  <option value="">All Categories</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                {filtered.length===0 ? <div className="text-center py-10 text-text-muted text-sm">No products found</div>
                : filtered.map(p => {
                  const sel = isSelected(p.id);
                  const totalQty = (p.stockItems??[]).reduce((s,x)=>s+x.quantity,0);
                  const zoneQty  = (p.stockItems??[]).filter(s=>s.location?.id===location.id).reduce((s,x)=>s+x.quantity,0);
                  const isLow    = p.reorderPoint>0 && totalQty<p.reorderPoint;
                  return (
                    <div key={p.id} onClick={()=>toggleProduct(p)} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all duration-150 ${sel?'border-accent bg-accent/5':'border-border bg-bg-surface2 hover:border-border-strong'}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${sel?'border-accent bg-accent':'border-border-strong'}`}>
                        {sel&&<svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-text-primary truncate">{p.name}</span>
                          <span className="text-[10px] text-text-muted font-mono flex-shrink-0">{p.sku}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-text-muted">{p.category.name}</span>
                          <span className="text-[11px] text-text-muted">· Total: {totalQty} {p.unit}</span>
                          {zoneQty>0&&<span className="text-[11px] text-accent">· This zone: {zoneQty} {p.unit}</span>}
                          {p.reorderPoint>0&&<span className="text-[11px] text-text-muted">· Reorder at {p.reorderPoint}</span>}
                        </div>
                      </div>
                      {isLow&&<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-warn/10 text-status-warn flex-shrink-0">LOW</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-5 p-4 bg-bg-surface2 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-text-secondary">Estimated Zone Capacity Usage</span>
                  <span className={`text-[12px] font-bold ${totalCapacityPct>80?'text-status-warn':totalCapacityPct>60?'text-accent':'text-status-success'}`}>{totalCapacityPct}%</span>
                </div>
                <div className="h-2 bg-bg-surface3 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${totalCapacityPct>80?'bg-status-warn':totalCapacityPct>60?'bg-accent':'bg-status-success'}`} style={{width:`${totalCapacityPct}%`}} />
                </div>
                <div className="text-[11px] text-text-muted mt-1.5">{lines.filter(l=>l.quantity>0).length} of {lines.length} products filled</div>
              </div>
              <div className="space-y-2">
                {lines.map(line => {
                  const isLow = line.quantity>0&&line.reorderPoint>0&&line.quantity<line.reorderPoint;
                  const isOk  = line.reorderPoint>0&&line.quantity>=line.reorderPoint;
                  return (
                    <div key={line.productId} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${isLow?'border-status-warn/40 bg-status-warn/5':isOk?'border-status-success/30 bg-status-success/5':'border-border bg-bg-surface2'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text-primary truncate">{line.productName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-text-muted font-mono">{line.sku}</span>
                          {line.currentStock>0&&<span className="text-[11px] text-text-muted">· Current: {line.currentStock} {line.unit}</span>}
                          {line.reorderPoint>0&&<span className="text-[11px] text-text-muted">· Reorder at: {line.reorderPoint}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-24 text-right">
                        {isLow&&<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-warn/10 text-status-warn">Below reorder</span>}
                        {isOk &&<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-success/10 text-status-success">✓ Adequate</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={()=>setQty(line.productId,line.quantity-1)} className="w-7 h-7 rounded bg-bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">−</button>
                        <input type="number" value={line.quantity} min={0} onChange={e=>setQty(line.productId,Number(e.target.value))} className="w-20 text-center input py-1 text-sm font-mono" />
                        <button onClick={()=>setQty(line.productId,line.quantity+1)} className="w-7 h-7 rounded bg-bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors">+</button>
                        <span className="text-[11px] text-text-muted w-8">{line.unit}</span>
                        <button onClick={()=>setLines(l=>l.filter(x=>x.productId!==line.productId))} className="text-text-muted hover:text-status-danger transition-colors text-sm w-5">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {lines.some(l=>l.quantity>0) && (
                <div className="mt-4 p-3 bg-bg-surface2 border border-border rounded-lg">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-2 font-medium">Summary</div>
                  <div className="flex gap-6 text-sm">
                    <div><div className="font-head font-bold text-text-primary">{lines.filter(l=>l.quantity>0).length}</div><div className="text-[11px] text-text-muted">Products</div></div>
                    <div><div className="font-head font-bold text-text-primary">{lines.reduce((s,l)=>s+l.quantity,0).toLocaleString()}</div><div className="text-[11px] text-text-muted">Total units</div></div>
                    <div><div className="font-head font-bold text-status-warn">{lines.filter(l=>l.quantity>0&&l.reorderPoint>0&&l.quantity<l.reorderPoint).length}</div><div className="text-[11px] text-text-muted">Below reorder</div></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          {step==='select' ? (
            <>
              <span className="text-[12px] text-text-muted flex-1">{lines.length===0?'Select products to stock this zone':`${lines.length} product${lines.length!==1?'s':''} selected`}</span>
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={lines.length===0} onClick={()=>setStep('fill')}>Next: Fill Quantities →</button>
            </>
          ) : (
            <>
              <button className="btn-ghost text-xs" onClick={()=>setStep('select')}>← Back</button>
              <div className="flex-1" />
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={saving||lines.every(l=>l.quantity===0)} onClick={handleSave}>
                {saving?<span className="flex items-center gap-2"><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>Saving…</span>:'Save Inventory'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODALS: CREATE WAREHOUSE & ADD ZONE
// ══════════════════════════════════════════════════════════════════════════════
function WHModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name,setName]=useState('');const [address,setAddress]=useState('');const [capacity,setCapacity]=useState('');const [saving,setSaving]=useState(false);
  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try { await warehouseApi.create({ name, address:address||undefined, capacity:capacity?Number(capacity):undefined }); toast.success('Warehouse created'); onSaved(); }
    catch { toast.error('Failed'); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-head font-bold text-[16px] text-text-primary">New Warehouse</h2>
          <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className="label">Name *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="" autoFocus /></div>
          <div><label className="label">Address</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street address (optional)" /></div>
          <div><label className="label">Total Capacity (m³)</label><input type="number" className="input" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="e.g. 10000" min={0} /></div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border justify-end">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'Creating…':'Create Warehouse'}</button>
        </div>
      </div>
    </div>
  );
}

function LocationModal({ warehouse, onClose, onSaved }: { warehouse: Warehouse; onClose: () => void; onSaved: () => void }) {
  const [name,setName]=useState('');const [saving,setSaving]=useState(false);
  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try { await warehouseApi.createLocation({ name, warehouseId:warehouse.id }); toast.success('Zone created'); onSaved(); }
    catch { toast.error('Failed'); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-bg-surface border border-border-strong rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div><h2 className="font-head font-bold text-[16px] text-text-primary">Add Zone</h2><p className="text-[11px] text-text-muted mt-0.5">in {warehouse.name}</p></div>
          <button onClick={onClose} className="text-text-muted w-7 h-7 rounded bg-bg-surface2 flex items-center justify-center text-sm hover:text-text-primary">✕</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div><label className="label">Zone Name *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Zone A — Raw Materials" autoFocus /></div>
          <div className="text-[12px] text-text-muted bg-bg-surface2 border border-border rounded-lg p-3">After creating, click <span className="text-accent font-medium">+ Add Inventory</span> to stock it.</div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border justify-end">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?'Creating…':'Add Zone'}</button>
        </div>
      </div>
    </div>
  );
}
