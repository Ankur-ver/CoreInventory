// src/components/layout/AppLayout.tsx
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { label: 'Overview', items: [
    { to: '/dashboard',         icon: DashboardIcon,  label: 'Dashboard' },
  ]},
  { label: 'Inventory', items: [
    { to: '/products',          icon: ProductIcon,    label: 'Products' },
    { to: '/warehouses',        icon: WarehouseIcon,  label: 'Warehouses' },
    { to: '/receipts',          icon: ReceiptIcon,    label: 'Receipts',      badge: 'warn' as const },
    { to: '/transfers',         icon: TransferIcon,   label: 'Transfers' },
    { to: '/adjustments',       icon: AdjustIcon,     label: 'Adjustments' },
  ]},
  { label: 'Orders', items: [
    { to: '/purchase-orders',   icon: POIcon,         label: 'Purchase Orders' },
    { to: '/sales-orders',      icon: SOIcon,         label: 'Sales Orders',   badge: 'danger' as const },
  ]},
  { label: 'Intelligence', items: [
    { to: '/forecast',          icon: ForecastIcon,   label: 'Forecasting' },
    { to: '/transfer-requests', icon: MultiWHIcon,    label: 'WH Transfers' },
    { to: '/events',            icon: EventIcon,      label: 'Event Stream',   badge: 'live' as const },
  ]},
  { label: 'Analytics', items: [
    { to: '/history',           icon: HistoryIcon,    label: 'Move History' },
    { to: '/reports',           icon: ReportIcon,     label: 'Reports' },
  ]},
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchVal, setSearchVal] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-40 transform transition-transform duration-200 ease-in-out w-[220px] min-w-[220px] flex flex-col bg-bg-surface border-r border-border h-full ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-[22px] border-b border-border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg,#4F8EF7,#7B5CEA)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM4 5h16a1 1 0 011 1v1H3V6a1 1 0 011-1z"/></svg>
          </div>
          <div>
            <div className="font-head font-extrabold text-[15px] text-text-primary tracking-tight">CoreInventory</div>
            <div className="text-[10px] text-text-muted uppercase tracking-widest">IMS v2.0</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto pb-6">
          {NAV.map(section => (
            <div key={section.label}>
              <div className="text-[10px] text-text-muted uppercase tracking-[1.5px] font-medium px-5 pt-4 pb-1.5">{section.label}</div>
              {section.items.map(item => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <item.icon />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge === 'warn'   && <span className="bg-status-warn text-bg-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">3</span>}
                  {item.badge === 'danger' && <span className="bg-status-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">5</span>}
                  {item.badge === 'live'   && <span className="bg-status-success/20 text-status-success text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 animate-pulse">LIVE</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div className="border-t border-border mt-auto">
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-5 py-3.5 hover:bg-bg-surface2 transition-colors text-left">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg,#7B5CEA,#4F8EF7)' }}>
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-text-primary truncate">{user?.name}</div>
              <div className="text-[11px] text-text-secondary capitalize">{user?.role?.toLowerCase()}</div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#4A5568"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        <header className="h-[60px] bg-bg-surface border-b border-border flex items-center justify-between md:justify-end gap-3 px-4 md:px-7 flex-shrink-0 z-10 w-full">
          {/* Hamburger Menu - Only on mobile */}
          <button 
            className="md:hidden text-text-secondary hover:text-text-primary p-1 focus:outline-none"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>

          <div className="hidden md:flex flex-1" />

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-bg-surface2 border border-border rounded px-3 py-1.5 flex-1 max-w-[200px] md:max-w-none md:flex-none md:w-56 hover:border-border-strong transition-colors min-w-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#4A5568" className="flex-shrink-0"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Search..."
              className="bg-transparent outline-none text-[13px] text-text-primary placeholder-text-muted w-full min-w-0" />
          </div>

          <button className="relative w-9 h-9 rounded bg-bg-surface2 border border-border flex items-center justify-center hover:border-border-strong transition-colors flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#8892A4"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-status-danger rounded-full border border-bg-surface" />
          </button>
        </header>

        {/* Main Body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-7 relative w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function DashboardIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>; }
function ProductIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>; }
function WarehouseIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 9V7h-2V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2v-2h-2V9h2zm-4 10H4V5h14v14z"/></svg>; }
function ReceiptIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>; }
function TransferIcon()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>; }
function AdjustIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>; }
function POIcon()        { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>; }
function SOIcon()        { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.45 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>; }
function ForecastIcon()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99l1.5 1.5z"/></svg>; }
function MultiWHIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>; }
function EventIcon()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>; }
function HistoryIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>; }
function ReportIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>; }
