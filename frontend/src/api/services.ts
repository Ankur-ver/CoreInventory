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
export const warehouseApi = {
  getAll: () => api.get<{ data: Warehouse[] }>('/warehouses'),

  create: (payload: { name: string; address?: string; capacity?: number }) =>
    api.post<{ data: Warehouse }>('/warehouses', payload),

  createLocation: (payload: { name: string; warehouseId: string }) =>
    api.post('/warehouses/locations', payload),
};
