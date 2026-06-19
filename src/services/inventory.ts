import { api } from './api';

export type InventoryCategory = 'DRINK' | 'FOOD' | 'FRUIT' | 'OTHER';
export type InventoryStatus = 'ACTIVE' | 'HIDDEN' | 'DELETED';

export interface InventoryItem {
  _id: string;
  name: string;
  unit: string;
  category: InventoryCategory;
  imageUrl?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockLevel: number;
  status: InventoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryStatusSummary {
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
  statusSummary?: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
}

export interface SaveInventoryItemInput {
  name: string;
  unit: string;
  category: InventoryCategory;
  stock: number;
  minStockLevel: number;
  costPrice: number;
  sellingPrice: number;
  imageUrl?: string;
  status?: Exclude<InventoryStatus, 'DELETED'>;
}

export interface InventoryExcelImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface InventoryExcelImportResult {
  createdCount: number;
  updatedCount: number;
  stockImportedQuantity: number;
  importTicketId?: string;
  rows: Array<{
    row: number;
    id: string;
    name: string;
    action: 'CREATED' | 'UPDATED';
    previousStock: number;
    nextStock: number;
  }>;
  errors: InventoryExcelImportError[];
}

export async function getInventoryItems() {
  const res = await api.get('/inventory/items');
  return Array.isArray(res.data) ? (res.data as InventoryItem[]) : [];
}

export async function getInventoryStatusSummary() {
  const res = await api.get('/inventory/items/status');
  return (res.data || null) as InventoryStatusSummary | null;
}

export async function createInventoryItem(payload: SaveInventoryItemInput) {
  const res = await api.post('/inventory/items', payload);
  return res.data as InventoryItem;
}

export async function updateInventoryItem(itemId: string, payload: Partial<SaveInventoryItemInput>) {
  const res = await api.put(`/inventory/items/${itemId}`, payload);
  return res.data as InventoryItem;
}

export async function deleteInventoryItem(itemId: string) {
  const res = await api.delete(`/inventory/items/${itemId}`);
  return res.data as InventoryItem;
}

export async function downloadInventoryImportTemplate() {
  const res = await api.get('/inventory/items/import-template', {
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function importInventoryItemsExcel(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post('/inventory/items/import-excel', formData);
  return res.data as InventoryExcelImportResult;
}
