export type UserRole =
  | "SYSTEM_OWNER"
  | "ADMIN"
  | "MANAGER"
  | "USER"
  | "KITCHEN";

export type UserPermission =
  | "ORDER_CANCEL_LATE"
  | "ORDER_MARK_FREE"
  | "ORDER_DISCOUNT"
  | "ORDER_REFUND"
  | "REPORT_VIEW"
  | "INVENTORY_ADJUST"
  | "PAYROLL_CONFIRM"
  | "PRINT_QUEUE_MANAGE"
  | "INVOICE_VIEW"
  | "INVOICE_PRINT_REQUEST"
  | "CASHIER_SHIFT_OPEN"
  | "CASHIER_SHIFT_CLOSE"
  | "CASHIER_SHIFT_VIEW_HISTORY"
  | "STAFF_PERMISSION_MANAGE"
  | "MENU_MANAGE"
  | "TABLE_MANAGE";

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  tenantId?: string | null;
  exp?: number;
  iat?: number;
  purpose?: string;
  effectivePermissions?: UserPermission[] | string[];
  permissionVersion?: number;
}

export interface SessionUser {
  userId: string;
  email?: string;
  phone?: string;
  role: UserRole;
  tenantId?: string | null;
  effectivePermissions?: UserPermission[];
  permissionVersion?: number;
}
