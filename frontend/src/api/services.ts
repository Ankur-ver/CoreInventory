// src/api/services.ts
import api from './client';
import type {
  User, Product, Operation, DashboardStats, Warehouse, StockMovement, Category,
} from '../types';

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ data: { accessToken: string; user: User } }>('/auth/login', { email, password }),

  register: (payload: { email: string; password: string; name: string; role?: string }) =>
    api.post('/auth/register', payload),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<{ data: User }>('/auth/me'),

  refresh: () => api.post<{ data: { accessToken: string } }>('/auth/refresh'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get<{ data: DashboardStats }>('/dashboard'),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<{ data: { products: Product[]; total: number } }>('/products', { params }),

  getOne: (id: string) => api.get<{ data: Product }>(`/products/${id}`),

  create: (payload: Partial<Product> & { categoryId: string }) =>
    api.post<{ data: Product }>('/products', payload),

  update: (id: string, payload: Partial<Product>) =>
    api.patch<{ data: Product }>(`/products/${id}`, payload),

  delete: (id: string) => api.delete(`/products/${id}`),

  getCategories: () => api.get<{ data: Category[] }>('/products/categories'),

  createCategory: (name: string) =>
    api.post<{ data: Category }>('/products/categories', { name }),
};

// ── Operations ────────────────────────────────────────────────────────────────
export const operationApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<{ data: { operations: Operation[]; total: number } }>('/operations', { params }),

  getOne: (id: string) => api.get<{ data: Operation }>(`/operations/${id}`),

  create: (payload: { type: string; supplierId?: string; fromLocationId?: string; toLocationId?: string; scheduledDate?: string; notes?: string; lines: { productId: string; quantity: number }[] }) =>
    api.post<{ data: Operation }>('/operations', payload),

  validate: (id: string, body?: Record<string, unknown>) =>
    api.post<{ data: Operation }>(`/operations/${id}/validate`, body ?? {}),

  cancel: (id: string) => api.post<{ data: Operation }>(`/operations/${id}/cancel`),
};

// ── Stock ─────────────────────────────────────────────────────────────────────
export const stockApi = {
  getMovements: (params?: Record<string, string | number>) =>
    api.get<{ data: { movements: StockMovement[]; total: number } }>('/stock/movements', { params }),

  getLowStock: () =>
    api.get<{ data: Array<{ quantity: number; status: string; product: Product; location: unknown }> }>('/stock/low'),
};

// ── Warehouses ────────────────────────────────────────────────────────────────
// ── Warehouses ────────────────────────────────────────────────────────────────
export const warehouseApi = {
  getAll: () => api.get<{ data: Warehouse[] }>('/warehouses'),

  create: (payload: { name: string; address?: string; capacity?: number }) =>
    api.post<{ data: Warehouse }>('/warehouses', payload),

  createLocation: (payload: { name: string; warehouseId: string }) =>
    api.post('/warehouses/locations', payload),
};

// ── Sales Orders ──────────────────────────────────────────────────────────────
export const salesOrderApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<{ data: { orders: any[]; total: number; page: number; limit: number } }>('/sales-orders', { params }),

  getOne: (id: string) => api.get<{ data: any }>(`/sales-orders/${id}`),

  create: (payload: { customerName: string; customerId?: string; locationId?: string; notes?: string; orderDate?: string; lines: { productId: string; quantity: number; unitPrice: number }[] }) =>
    api.post<{ data: any }>('/sales-orders', payload),

  update: (id: string, payload: { status?: string; notes?: string; shippedDate?: string }) =>
    api.patch<{ data: any }>(`/sales-orders/${id}`, payload),

  fulfill: (id: string, lines?: { lineId: string; qty: number }[]) =>
    api.post<{ data: any }>(`/sales-orders/${id}/fulfill`, { lines }),

  cancel: (id: string) => api.post<{ data: any }>(`/sales-orders/${id}/cancel`),
};

// ── Purchase Orders ───────────────────────────────────────────────────────────
export const purchaseOrderApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<{ data: { orders: any[]; total: number; page: number; limit: number } }>('/purchase-orders', { params }),

  getOne: (id: string) => api.get<{ data: any }>(`/purchase-orders/${id}`),

  create: (payload: { supplierName: string; supplierId?: string; locationId?: string; notes?: string; orderDate?: string; expectedDate?: string; lines: { productId: string; quantity: number; unitPrice: number }[] }) =>
    api.post<{ data: any }>('/purchase-orders', payload),

  update: (id: string, payload: { status?: string; notes?: string; expectedDate?: string; receivedDate?: string }) =>
    api.patch<{ data: any }>(`/purchase-orders/${id}`, payload),

  receive: (id: string, lines?: { lineId: string; qty: number }[]) =>
    api.post<{ data: any }>(`/purchase-orders/${id}/receive`, { lines }),

  cancel: (id: string) => api.post<{ data: any }>(`/purchase-orders/${id}/cancel`),
};
