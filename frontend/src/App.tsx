// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage            from './pages/LoginPage';
import DashboardPage        from './pages/DashboardPage';
import ProductsPage         from './pages/ProductsPage';
import OperationsPage       from './pages/OperationsPage';
import HistoryPage          from './pages/HistoryPage';
import WarehousesPage       from './pages/WarehousesPage';
import PurchaseOrdersPage   from './pages/PurchaseOrdersPage';
import SalesOrdersPage      from './pages/SalesOrdersPage';
import ReportsPage          from './pages/ReportsPage';
import ForecastPage         from './pages/ForecastPage';
import TransferRequestsPage from './pages/TransferRequestsPage';
import EventsPage           from './pages/EventsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <div className="text-text-secondary text-sm animate-pulse">Loading CoreInventory…</div>
    </div>
  );
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"         element={<DashboardPage />} />
        <Route path="products"          element={<ProductsPage />} />
        <Route path="warehouses"        element={<WarehousesPage />} />
        <Route path="purchase-orders"   element={<PurchaseOrdersPage />} />
        <Route path="sales-orders"      element={<SalesOrdersPage />} />
        <Route path="receipts"          element={<OperationsPage type="RECEIPT" />} />
        <Route path="transfers"         element={<OperationsPage type="TRANSFER" />} />
        <Route path="adjustments"       element={<OperationsPage type="ADJUSTMENT" />} />
        <Route path="history"           element={<HistoryPage />} />
        <Route path="reports"           element={<ReportsPage />} />
        <Route path="forecast"          element={<ForecastPage />} />
        <Route path="transfer-requests" element={<TransferRequestsPage />} />
        <Route path="events"            element={<EventsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
