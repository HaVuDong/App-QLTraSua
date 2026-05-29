import type { UserRole } from '../types/auth';

export const VALID_ROLES: UserRole[] = ['SYSTEM_OWNER', 'ADMIN', 'MANAGER', 'USER', 'KITCHEN'];

export const ADMIN_DASHBOARD_ROLES: UserRole[] = ['ADMIN', 'MANAGER'];
export const EMPLOYEE_ROLES: UserRole[] = ['USER', 'KITCHEN'];

// Shift check-in/out is employee flow only.
export const SHIFT_ROLES: UserRole[] = ['USER'];
export const ORDER_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'USER', 'KITCHEN'];
export const MANAGEMENT_ROLES: UserRole[] = ['ADMIN', 'MANAGER'];

export function isUserRole(role: string | undefined | null): role is UserRole {
  if (!role) return false;
  return VALID_ROLES.includes(role as UserRole);
}
