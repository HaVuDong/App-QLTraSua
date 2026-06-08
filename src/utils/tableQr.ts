import { CUSTOMER_APP_BASE_URL } from '../config/api';
import type { DiningTable } from '../services/table';

export type TableViewStatus = 'AVAILABLE' | 'ACTIVE' | 'DISABLED';

export function getTableViewStatus(table: DiningTable): TableViewStatus {
  if (table.isHidden) return 'DISABLED';
  if (table.status === 'EMPTY') return 'AVAILABLE';
  return 'ACTIVE';
}

export function getTableViewStatusLabel(viewStatus: TableViewStatus) {
  if (viewStatus === 'AVAILABLE') return 'Còn trống';
  if (viewStatus === 'ACTIVE') return 'Đang hoạt động';
  return 'Tạm ngưng';
}

export function getTableFilterLabel(filter: TableViewStatus | 'ALL') {
  if (filter === 'ALL') return 'Tất cả';
  return getTableViewStatusLabel(filter);
}

export function parseTableName(tableName: string) {
  const normalized = tableName.trim();
  const numberMatch = normalized.match(/\d+/);
  const tableNumber = numberMatch ? numberMatch[0] : '';
  const isGeneratedName = /^ban\s*\d+$/i.test(normalized);
  return {
    tableNumber,
    displayName: isGeneratedName ? '' : normalized,
  };
}

export function buildTableName(tableNumber: string, displayName: string) {
  const normalizedDisplay = displayName.trim();
  if (normalizedDisplay) return normalizedDisplay;
  return `Bàn ${tableNumber.trim()}`;
}

export function normalizeQrUrl(rawQrUrl?: string) {
  const trimmed = rawQrUrl?.trim() || '';
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${CUSTOMER_APP_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function isValidHttpUrl(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export function getDiningTableNumber(table: DiningTable) {
  const persistedNumber = table.tableNumber?.trim();
  if (persistedNumber) return persistedNumber;
  return parseTableName(table.name || '').tableNumber;
}

export function buildCustomerQrUrl(table: DiningTable | null, tenantId?: string | null) {
  if (!table) return '';
  const backendQrUrl = normalizeQrUrl(table.qrUrl);
  if (backendQrUrl) return backendQrUrl;

  const tenant = tenantId?.trim() || '';
  const qrToken = table.qrCodeToken?.trim() || '';
  if (!tenant || !qrToken) return '';

  return `${CUSTOMER_APP_BASE_URL}/table/${encodeURIComponent(tenant)}/${encodeURIComponent(qrToken)}`;
}
