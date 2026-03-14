// src/types/index.ts

export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';
export type OperationStatus = 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELED';
export type OperationType = 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT';
export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
export type StockStatus = 'OK' | 'LOW' | 'OUT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  capacity?: number;
  locations: Location[];
}

export interface Location {
  id: string;
  name: string;
  warehouseId: string;
  warehouse?: { id: string; name: string };
}

export interface StockItem {
  id: string;
  quantity: number;
  status: StockStatus;
  location: Location & { warehouse: { id: string; name: string } };
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unit: string;
  reorderPoint: number;
  price:number;
  description?: string;
  category: Category;
  stockItems: StockItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OperationLine {
  id: string;
  quantity: number;
  received?: number;
  product: { id: string; name: string; sku: string; unit: string };
}

export interface Operation {
  id: string;
  reference: string;
  type: OperationType;
  status: OperationStatus;
  notes?: string;
  scheduledDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
  supplier?: { id: string; name: string };
  fromLocation?: Location & { warehouse: { name: string } };
  toLocation?: Location & { warehouse: { name: string } };
  lines: OperationLine[];
}

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reference: string;
  operationId?: string;
  note?: string;
  createdAt: string;
  user: { name: string };
}

export interface DashboardStats {
  kpis: {
    totalProducts: number;
    lowStock: number;
    outOfStock: number;
    pendingReceipts: number;
    pendingDeliveries: number;
    scheduledTransfers: number;
  };
  recentMovements: StockMovement[];
  recentOps: Partial<Operation>[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
