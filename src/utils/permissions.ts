import type { SessionUser, UserPermission, UserRole } from "../types/auth";

export const USER_PERMISSIONS: UserPermission[] = [
  "ORDER_CANCEL_LATE",
  "ORDER_MARK_FREE",
  "ORDER_DISCOUNT",
  "ORDER_REFUND",
  "REPORT_VIEW",
  "INVENTORY_ADJUST",
  "PAYROLL_CONFIRM",
  "PRINT_QUEUE_MANAGE",
  "INVOICE_VIEW",
  "INVOICE_PRINT_REQUEST",
  "CASHIER_SHIFT_OPEN",
  "CASHIER_SHIFT_CLOSE",
  "CASHIER_SHIFT_VIEW_HISTORY",
  "STAFF_PERMISSION_MANAGE",
  "MENU_MANAGE",
  "TABLE_MANAGE",
];

const ALL_PERMISSIONS = USER_PERMISSIONS;

const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, UserPermission[]> = {
  SYSTEM_OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  MANAGER: [
    "ORDER_CANCEL_LATE",
    "ORDER_DISCOUNT",
    "REPORT_VIEW",
    "INVENTORY_ADJUST",
    "PRINT_QUEUE_MANAGE",
    "INVOICE_VIEW",
    "INVOICE_PRINT_REQUEST",
    "CASHIER_SHIFT_OPEN",
    "CASHIER_SHIFT_CLOSE",
    "CASHIER_SHIFT_VIEW_HISTORY",
    "MENU_MANAGE",
    "TABLE_MANAGE",
  ],
  USER: [
    "INVOICE_VIEW",
    "INVOICE_PRINT_REQUEST",
    "CASHIER_SHIFT_OPEN",
    "CASHIER_SHIFT_CLOSE",
  ],
  KITCHEN: [],
};

export function isUserPermission(value: unknown): value is UserPermission {
  return USER_PERMISSIONS.includes(value as UserPermission);
}

export function getSessionPermissions(user: SessionUser | null | undefined) {
  if (!user) return [];
  if (Array.isArray(user.effectivePermissions)) {
    return user.effectivePermissions.filter(isUserPermission);
  }
  return ROLE_DEFAULT_PERMISSIONS[user.role] || [];
}

export function hasPermission(
  user: SessionUser | null | undefined,
  permission: UserPermission,
) {
  if (user?.role === "SYSTEM_OWNER") return true;
  return getSessionPermissions(user).includes(permission);
}
