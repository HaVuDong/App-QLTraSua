export function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function getTodayDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`;
}

export function getCurrentMonthInput() {
  return getTodayDateInput().slice(0, 7);
}

export function getMonthFromDateInput(dateInput: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput.slice(0, 7);
  }
  return getCurrentMonthInput();
}

export function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString();
}

export function toDateTimeInputValue(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())} ${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`;
}

export function parseDateTimeInputToIso(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const replaced = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const parsed = new Date(replaced);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function formatCurrencyVnd(value: number) {
  return `${Math.round(value).toLocaleString()}d`;
}

export function formatPenaltyDateLabel(dateValue: string) {
  if (!dateValue) return 'Không rõ ngày';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString();
}

