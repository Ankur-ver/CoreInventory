// src/pages/EventsPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';

interface InventoryEvent {
  id?: string;
  type: string;
  status?: string;
  message: string;
  severity: string;
  entityId?: string;
  entityType?: string;
  payload: Record<string, unknown>;
  createdAt?: string;
  processedAt?: string;
}

interface EventStats {
  byType:     { type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byStatus:   { status: string; count: number }[];
  last24h:    number;
}

const SEV_COLOR: Record<string, string> = {
  critical: 'bg-status-danger/10 text-status-danger border-l-status-danger',
  warning:  'bg-status-warn/10 text-status-warn border-l-status-warn',
  info:     'bg-accent/10 text-accent border-l-accent',
};
const SEV_DOT: Record<string, string> = {
  critical: 'bg-status-danger animate-pulse',
  warning:  'bg-status-warn',
  info:     'bg-accent',
};
const TYPE_ICONS: Record<string, string> = {
  STOCK_LOW:           '⚠',
  STOCK_OUT:           '🔴',
  PO_CREATED:          '📋',
  PO_RECEIVED:         '✅',
  SO_CREATED:          '🛒',
  SO_FULFILLED:        '📦',
  TRANSFER_REQUESTED:  '⇄',
  TRANSFER_COMPLETED:  '✓',
  ADJUSTMENT_MADE:     '△',
  FORECAST_GENERATED:  '🔮',
  REORDER_TRIGGERED:   '🔔',
};

export default function EventsPage() {
  const [events, setEvents]         = useState<InventoryEvent[]>([]);
  const [liveEvents, setLiveEvents] = useState<InventoryEvent[]>([]);
  const [stats, setStats]           = useState<EventStats | null>(null);
  const [connected, setConnected]   = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [sevFilter, setSevFilter]   = useState('');
  const [activeTab, setActiveTab]   = useState<'live' | 'log'>('live');
  const [total, setTotal]           = useState(0);
  const esRef   = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Load persisted events ───────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    try {
      const params: Record<string,string> = {};
      if (typeFilter) params.type     = typeFilter;
      if (sevFilter)  params.severity = sevFilter;
      const [evRes, statRes] = await Promise.all([
        api.get<{ data: { events: InventoryEvent[]; total: number } }>('/events', { params }),
        api.get<{ data: EventStats }>('/events/stats'),
      ]);
      setEvents(evRes.data.data.events);
      setTotal(evRes.data.data.total);
      setStats(statRes.data.data);
    } catch { /* silent */ }
  }, [typeFilter, sevFilter]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── SSE connection ──────────────────────────────────────────────────────────
  useEffect(() => {

    const url   = `${window.location.origin.replace(':5173', ':4000')}/api/events/stream`;
    const es    = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'CONNECTED') {
          // Initial batch
          setLiveEvents(data.events ?? []);
          return;
        }
        // New event
        setLiveEvents(prev => [data, ...prev].slice(0, 100));
        // Auto-scroll feed
        setTimeout(() => {
          feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
        // Toast for critical/warning
        if (data.severity === 'critical') toast.error(data.message);
        else if (data.severity === 'warning') toast(data.message, { icon: '⚠️' });
      } catch { /* ignore parse errors */ }
    };

    return () => { es.close(); setConnected(false); };
  }, []);

  const acknowledgeAll = async () => {
    try {
      await api.post('/events/ack-all');
      toast.success('All events acknowledged');
      loadEvents();
    } catch { toast.error('Failed to acknowledge'); }
  };

  const ackEvent = async (id: string) => {
    try {
      await api.patch(`/events/${id}/ack`);
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'ACKNOWLEDGED' } : e));
    } catch { /* silent */ }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-head font-bold text-xl text-text-primary">Event-Driven System</h1>
          <p className="text-text-secondary text-sm mt-0.5">Real-time inventory events, alerts, and automation log</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
            connected ? 'border-status-success/30 bg-status-success/10 text-status-success' : 'border-status-danger/30 bg-status-danger/10 text-status-danger'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-status-success animate-pulse' : 'bg-status-danger'}`} />
            {connected ? 'Live Connected' : 'Disconnected'}
          </div>
          <button onClick={loadEvents} className="btn-ghost text-xs">↻ Refresh</button>
          <button onClick={acknowledgeAll} className="btn-ghost text-xs">✓ Ack All</button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3.5 mb-5">
          {[
            { label:'Events (24h)',  value:stats.last24h,                                          accent:'kpi-blue' },
            { label:'Critical',     value:stats.bySeverity.find(s=>s.severity==='critical')?.count??0, accent:'kpi-danger', danger:true },
            { label:'Warnings',     value:stats.bySeverity.find(s=>s.severity==='warning')?.count??0,  accent:'kpi-warn' },
            { label:'Pending',      value:stats.byStatus.find(s=>s.status==='PENDING')?.count??0,      accent:'kpi-purple' },
          ].map(k => (
            <div key={k.label} className={`kpi-card ${k.accent}`}>
              <div className="text-[11px] text-text-secondary uppercase tracking-wide font-medium mb-2">{k.label}</div>
              <div className={`font-head text-[28px] font-bold leading-none ${k.danger ? 'text-status-danger':'text-text-primary'}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Main panel */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {[['live','Live Feed'],['log','Event Log']].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab as 'live'|'log')}
                className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}>
                {label}
                {tab === 'live' && liveEvents.length > 0 && (
                  <span className="ml-2 text-[10px] bg-accent text-white px-1.5 py-0.5 rounded-full">{liveEvents.length}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'live' ? (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Live Event Stream</span>
                <div className={`flex items-center gap-1.5 text-[11px] font-medium ${connected ? 'text-status-success' : 'text-text-muted'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-status-success animate-pulse' : 'bg-text-muted'}`} />
                  {connected ? 'Streaming' : 'Offline'}
                </div>
              </div>
              <div ref={feedRef} className="max-h-[500px] overflow-y-auto">
                {liveEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-text-muted">
                    <div className="text-4xl mb-3 opacity-20">📡</div>
                    <p className="text-sm">Waiting for events…</p>
                    <p className="text-[12px] mt-1">Events appear here in real-time as inventory changes happen</p>
                  </div>
                ) : liveEvents.map((ev, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b border-border border-l-2 ${SEV_COLOR[ev.severity] ?? SEV_COLOR.info} transition-all`}>
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-current/10 text-sm flex-shrink-0">
                      {TYPE_ICONS[ev.type] ?? '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold opacity-70 uppercase tracking-wide">{ev.type.replace(/_/g,' ')}</span>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV_DOT[ev.severity] ?? 'bg-accent'}`} />
                      </div>
                      <p className="text-[13px] text-text-primary mt-0.5">{ev.message}</p>
                      {ev.createdAt && (
                        <p className="text-[10px] text-text-muted mt-1">{new Date(ev.createdAt).toLocaleTimeString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                <span className="text-[13px] font-medium text-text-primary flex-1">Persisted Event Log</span>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="select text-xs w-44">
                  <option value="">All Types</option>
                  {['STOCK_LOW','STOCK_OUT','PO_CREATED','PO_RECEIVED','SO_CREATED','SO_FULFILLED',
                    'TRANSFER_REQUESTED','TRANSFER_COMPLETED','ADJUSTMENT_MADE','FORECAST_GENERATED','REORDER_TRIGGERED']
                    .map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
                <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="select text-xs w-32">
                  <option value="">All Severity</option>
                  {['info','warning','critical'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Time</th><th>Type</th><th>Message</th><th>Severity</th><th>Status</th><th>Ack</th></tr>
                  </thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-text-muted">No events logged yet</td></tr>
                    ) : events.map(ev => (
                      <tr key={ev.id}>
                        <td className="text-text-muted text-xs font-mono">
                          {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span>{TYPE_ICONS[ev.type] ?? '📌'}</span>
                            <span className="text-[11px] font-medium">{ev.type.replace(/_/g,' ')}</span>
                          </div>
                        </td>
                        <td className="max-w-[280px]">
                          <p className="text-[12px] truncate" title={ev.message}>{ev.message}</p>
                        </td>
                        <td>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ev.severity==='critical'?'bg-status-danger/10 text-status-danger':
                            ev.severity==='warning' ?'bg-status-warn/10 text-status-warn':
                            'bg-accent/10 text-accent'
                          }`}>{ev.severity}</span>
                        </td>
                        <td>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            ev.status==='ACKNOWLEDGED'?'text-text-muted':
                            ev.status==='PROCESSED'   ?'text-status-success':'text-status-warn'
                          }`}>{ev.status}</span>
                        </td>
                        <td>
                          {ev.id && ev.status !== 'ACKNOWLEDGED' && (
                            <button onClick={() => ackEvent(ev.id!)} className="text-[11px] text-accent hover:underline">Ack</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-border flex justify-between">
                <span className="text-[12px] text-text-muted">{total} events total</span>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: event type breakdown */}
        <div className="space-y-4">
          {/* Event type breakdown */}
          {stats && stats.byType.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Event Breakdown</span></div>
              <div className="p-4 space-y-2">
                {stats.byType.sort((a,b) => b.count - a.count).map(t => {
                  const max = Math.max(...stats.byType.map(x => x.count));
                  return (
                    <div key={t.type}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{TYPE_ICONS[t.type] ?? '📌'}</span>
                          <span className="text-[11px] text-text-secondary">{t.type.replace(/_/g,' ')}</span>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-text-primary">{t.count}</span>
                      </div>
                      <div className="h-1 bg-bg-surface3 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(t.count/max)*100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Architecture diagram */}
          <div className="card p-4">
            <div className="text-[12px] font-semibold text-text-primary mb-3">Architecture Overview</div>
            <div className="space-y-2 text-[11px]">
              {[
                { icon:'📥', label:'Stock Operations', desc:'PO receive, SO fulfill, adjustments' },
                { icon:'⚡', label:'Event Bus',        desc:'Emits typed events on every change' },
                { icon:'💾', label:'Event Store',      desc:'PostgreSQL — full audit trail' },
                { icon:'📡', label:'SSE Stream',       desc:'Real-time push to frontend' },
                { icon:'🔔', label:'Auto Handlers',    desc:'Reorder trigger, low-stock alerts' },
                { icon:'🔮', label:'Forecasting',      desc:'Demand prediction on movement data' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2.5 p-2 bg-bg-surface2 rounded-lg">
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <div>
                    <div className="font-medium text-text-primary">{item.label}</div>
                    <div className="text-text-muted mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
