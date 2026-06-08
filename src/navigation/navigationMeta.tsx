import { Calendar, CheckCircle, Coffee, Home, Users } from 'lucide-react-native';
import { ADMIN_DASHBOARD_ROLES, MANAGEMENT_ROLES, ORDER_ROLES, SHIFT_ROLES } from '../constants/roles';
import type { SessionUser } from '../types/auth';

export function getTabScreensForRole(role: SessionUser['role']) {
  return {
    showShift: SHIFT_ROLES.includes(role),
    showOrders: ORDER_ROLES.includes(role),
    showManagement: MANAGEMENT_ROLES.includes(role),
  };
}

export function isAdminDashboardRole(role: SessionUser['role']) {
  return ADMIN_DASHBOARD_ROLES.includes(role);
}

export function getInitialTabRouteForRole(role: SessionUser['role']) {
  if (MANAGEMENT_ROLES.includes(role)) return 'Quan Ly';
  if (SHIFT_ROLES.includes(role)) return 'Ca Lam';
  if (ORDER_ROLES.includes(role)) return 'Don Hang';
  return undefined;
}

export function getRouteMeta(routeName: string) {
  const meta: Record<string, { label: string; subtitle: string }> = {
    'Quan Ly': { label: 'Quản lý', subtitle: 'Tổng quan vận hành cửa hàng' },
    Kho: { label: 'Kho', subtitle: 'Nguyên liệu, tồn kho và cảnh báo' },
    Menu: { label: 'Menu', subtitle: 'Món bán, công thức và trạng thái' },
    Ban: { label: 'Bàn', subtitle: 'Bàn, QR và trạng thái phục vụ' },
    'Nhan Su': { label: 'Nhân sự', subtitle: 'Tài khoản và phân quyền nhân viên' },
    'Cham Cong': { label: 'Chấm công', subtitle: 'Ca làm, check-in và nghỉ phép' },
    'Bang Luong': { label: 'Bảng lương', subtitle: 'Lương tháng, phụ cấp và khấu trừ' },
    'Don Hang': { label: 'Đơn hàng', subtitle: 'Xác nhận, xử lý và thanh toán' },
    'Ca Lam': { label: 'Ca làm', subtitle: 'Đăng ký ca và chấm công cá nhân' },
  };

  return meta[routeName] || { label: routeName, subtitle: 'Quản trị cửa hàng' };
}

export function getRoleLabel(role?: SessionUser['role']) {
  if (role === 'SYSTEM_OWNER') return 'Chủ hệ thống';
  if (role === 'ADMIN') return 'Chủ quán/Admin';
  if (role === 'MANAGER') return 'Quản lý';
  if (role === 'KITCHEN') return 'Nhân viên bếp';
  if (role === 'USER') return 'Nhân viên';
  return 'Tài khoản';
}

export function getUserInitial(user: SessionUser | null) {
  const source = user?.email || user?.phone || user?.role || 'T';
  return source.trim().charAt(0).toUpperCase() || 'T';
}

export function renderTabIcon(routeName: string, color: string, size: number) {
  if (routeName === 'Ca Lam') return <Calendar color={color} size={size} />;
  if (routeName === 'Don Hang') return <Coffee color={color} size={size} />;
  if (routeName === 'Quan Ly') return <Users color={color} size={size} />;
  if (routeName === 'Nhan Su') return <Users color={color} size={size} />;
  if (routeName === 'Kho') return <Home color={color} size={size} />;
  if (routeName === 'Menu') return <Coffee color={color} size={size} />;
  if (routeName === 'Ban') return <Home color={color} size={size} />;
  if (routeName === 'Cham Cong') return <Calendar color={color} size={size} />;
  if (routeName === 'Bang Luong') return <CheckCircle color={color} size={size} />;
  return <Home color={color} size={size} />;
}
