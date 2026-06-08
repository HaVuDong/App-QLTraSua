import type { InventoryCategory, InventoryItem } from '../services/inventory';
import type { StaffStatus, StaffUser } from '../services/staff';

export type InventoryFilterStatus = 'ALL' | 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type MenuViewStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'INACTIVE';
export type PayrollFilterStatus = StaffStatus | 'UNKNOWN' | 'ALL';

export function getOrderStatusLabel(status?: string) {
  if (status === 'PENDING') return 'Chờ xác nhận';
  if (status === 'IN_PROGRESS') return 'Đang xử lý';
  if (status === 'COMPLETED') return 'Hoàn thành';
  if (status === 'CANCELLED') return 'Đã hủy';
  return status || '-';
}

export function getOrderItemStatusLabel(status?: string) {
  if (status === 'PENDING') return 'Chờ làm';
  if (status === 'PREPARING') return 'Đang làm';
  if (status === 'READY') return 'Hoàn thành';
  if (status === 'CANCELLED') return 'Đã hủy';
  return status || '-';
}

export function getShiftStatusLabel(status?: string) {
  if (status === 'PENDING_APPROVAL') return 'Chờ duyệt';
  if (status === 'APPROVED') return 'Đã duyệt';
  if (status === 'REJECTED') return 'Đã từ chối';
  if (status === 'CANCELLED') return 'Đã hủy';
  return status || '-';
}

export function getShiftRegistrationStatusLabel(status?: string) {
  if (!status || status === 'CHUA_DANG_KY') return 'Chưa đăng ký';
  if (status === 'REGISTERED') return 'Đã đăng ký';
  if (status === 'CANCEL_PENDING') return 'Chờ duyệt hủy ca';
  if (status === 'CANCELLED') return 'Đã hủy';
  if (status === 'LEAVE_APPROVED') return 'Nghỉ phép đã duyệt';
  if (status === 'NO_SHOW') return 'Vắng không phép';
  return status;
}

export function getPayrollSourceLabel(source?: 'BACKEND' | 'ATTENDANCE') {
  if (source === 'BACKEND') return 'API bảng lương';
  return 'Chấm công tạm tính';
}

export function getPayrollBackendStatusLabel(status?: string | null) {
  if (status === 'DRAFT') return 'Bản nháp';
  if (status === 'CALCULATED') return 'Đã tính';
  if (status === 'PAID') return 'Đã thanh toán';
  if (status === 'LOCKED') return 'Đã khóa';
  if (status === 'CANCELLED') return 'Đã hủy';
  return status || '-';
}

export function getTenantStatusLabel(status?: string | null) {
  if (status === 'ACTIVE') return 'Đang hoạt động';
  if (status === 'SUSPENDED') return 'Tạm khóa';
  if (status === 'DELETED') return 'Đã xóa';
  return status || '-';
}

export function getInventoryStockStatus(item: InventoryItem): InventoryFilterStatus {
  if (item.stock <= 0) return 'OUT_OF_STOCK';
  if (item.stock < item.minStockLevel) return 'LOW_STOCK';
  return 'AVAILABLE';
}

export function getInventoryFilterLabel(status: InventoryFilterStatus) {
  if (status === 'ALL') return 'Tất cả';
  if (status === 'AVAILABLE') return 'Còn hàng';
  if (status === 'LOW_STOCK') return 'Sắp hết hàng';
  if (status === 'OUT_OF_STOCK') return 'Hết hàng';
  return status;
}

export function getInventoryCategoryLabel(category?: InventoryCategory | string) {
  if (category === 'DRINK') return 'Đồ uống';
  if (category === 'FOOD') return 'Đồ ăn';
  if (category === 'FRUIT') return 'Trái cây';
  if (category === 'OTHER') return 'Khác';
  return category || '-';
}

export function getMenuStatusLabel(status: MenuViewStatus) {
  if (status === 'INACTIVE') return 'Tạm ngưng';
  if (status === 'OUT_OF_STOCK') return 'Hết món';
  return 'Đang bán';
}

export function getMenuFilterLabel(status: MenuViewStatus | 'ALL') {
  if (status === 'ALL') return 'Tất cả';
  return getMenuStatusLabel(status);
}

export function getPayrollFilterStatusLabel(status: PayrollFilterStatus) {
  if (status === 'ALL') return 'Tất cả';
  if (status === 'ACTIVE') return 'Đang hoạt động';
  if (status === 'LOCKED') return 'Đã khóa';
  if (status === 'DELETED') return 'Vô hiệu hóa';
  return 'Không rõ';
}

export function getPayrollRowStatusLabel(status: StaffStatus | 'UNKNOWN') {
  if (status === 'UNKNOWN') return 'Không rõ';
  if (status === 'LOCKED') return 'Đã khóa';
  if (status === 'DELETED') return 'Vô hiệu hóa';
  return 'Đang hoạt động';
}

export function getStaffStatusLabel(status: StaffStatus) {
  if (status === 'LOCKED') return 'Đã khóa';
  if (status === 'DELETED') return 'Vô hiệu hóa';
  return 'Đang hoạt động';
}

export function getStaffRoleLabel(role: StaffUser['role']) {
  if (role === 'ADMIN') return 'Chủ quán/Admin';
  if (role === 'MANAGER') return 'Quản lý';
  if (role === 'KITCHEN') return 'Nhân viên bếp';
  if (role === 'USER') return 'Nhân viên';
  return 'Chủ hệ thống';
}
