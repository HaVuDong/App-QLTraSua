import type { StaffRole, StaffUser } from '../services/staff';

export type StaffFilterRole = StaffRole | 'ALL';
export type StaffEditableRole = Exclude<StaffRole, 'SYSTEM_OWNER'>;
export type StaffFilterStatus = 'ACTIVE' | 'LOCKED' | 'DELETED' | 'ALL';

export const ADMIN_STAFF_CREATE_ROLE_OPTIONS: StaffEditableRole[] = ['MANAGER', 'USER', 'KITCHEN'];
export const MANAGER_STAFF_CREATE_ROLE_OPTIONS: StaffEditableRole[] = ['USER', 'KITCHEN'];
export const STAFF_EDIT_ROLE_OPTIONS: StaffEditableRole[] = ['MANAGER', 'USER', 'KITCHEN'];
export const STAFF_STATUS_FILTER_OPTIONS: StaffFilterStatus[] = ['ALL', 'ACTIVE', 'LOCKED', 'DELETED'];

export function getStaffLoginIdentifier(member: StaffUser) {
  return member.email || '';
}

export function normalizeEditableRole(role: StaffUser['role']): StaffEditableRole {
  if (STAFF_EDIT_ROLE_OPTIONS.includes(role as StaffEditableRole)) {
    return role as StaffEditableRole;
  }
  return 'USER';
}

export function parseStaffEmail(rawValue: string): { email?: string; error?: string } {
  const value = rawValue.trim();
  if (!value) {
    return { error: 'Email tài khoản là bắt buộc' };
  }

  const normalizedEmail = value.toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    return { error: 'Email không hợp lệ' };
  }
  return { email: normalizedEmail };
}

export function parseStaffPhone(rawValue: string): { phone?: string; error?: string } {
  const value = rawValue.trim();
  if (!value) return {};
  const normalizedPhone = value.replace(/\s+/g, '');
  if (!/^\+?\d{6,15}$/.test(normalizedPhone)) {
    return { error: 'Số điện thoại không hợp lệ' };
  }
  return { phone: normalizedPhone };
}

export function getStaffCreateRoleOptions(currentRole?: StaffRole | null): StaffEditableRole[] {
  if (currentRole === 'ADMIN') return ADMIN_STAFF_CREATE_ROLE_OPTIONS;
  if (currentRole === 'MANAGER') return MANAGER_STAFF_CREATE_ROLE_OPTIONS;
  return [];
}
