import { api } from './api';

export type TableStatus = 'EMPTY' | 'SERVING' | 'PAYING' | 'CLEANING';

export interface DiningTable {
  _id: string;
  name: string;
  location?: string;
  capacity?: number;
  status: TableStatus;
  qrCodeToken?: string;
  isHidden?: boolean;
  defaultItemsEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveTableInput {
  name: string;
  location?: string;
  capacity?: number;
}

export async function getTables() {
  const res = await api.get('/tables');
  return Array.isArray(res.data) ? (res.data as DiningTable[]) : [];
}

export async function createTable(payload: SaveTableInput) {
  const res = await api.post('/tables', payload);
  return res.data as DiningTable;
}

export async function updateTable(tableId: string, payload: Partial<SaveTableInput>) {
  const res = await api.put(`/tables/${tableId}`, payload);
  return res.data as DiningTable;
}

export async function deleteTable(tableId: string) {
  const res = await api.delete(`/tables/${tableId}`);
  return res.data as { message: string };
}

export async function resetTableQr(tableId: string) {
  const res = await api.patch(`/tables/${tableId}/reset-qr`);
  return res.data as DiningTable;
}

export async function updateTableStatus(tableId: string, status: TableStatus) {
  const res = await api.patch(`/tables/${tableId}/status`, { status });
  return res.data as DiningTable;
}

export async function toggleTableVisibility(tableId: string) {
  const res = await api.patch(`/tables/${tableId}/toggle-visibility`);
  return res.data as DiningTable;
}
