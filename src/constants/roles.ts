import type { UserRole } from '../types/auth';

export const VALID_ROLES: UserRole[] = ['SYSTEM_OWNER', 'ADMIN', 'MANAGER', 'USER', 'KITCHEN'];

export const ADMIN_DASHBOARD_ROLES: UserRole[] = ['ADMIN', 'MANAGER'];
export const EMPLOYEE_ROLES: UserRole[] = ['USER', 'KITCHEN'];

// Shift check-in/out and registration flow.
export const SHIFT_ROLES: UserRole[] = ['MANAGER', 'USER', 'KITCHEN'];
export const ORDER_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'USER', 'KITCHEN'];
export const STAFF_WORKSPACE_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'USER'];
export const KITCHEN_QUEUE_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'KITCHEN'];
export const MANAGEMENT_ROLES: UserRole[] = ['ADMIN', 'MANAGER'];

export function isUserRole(role: string | undefined | null): role is UserRole {
  if (!role) return false;
  return VALID_ROLES.includes(role as UserRole);
}
