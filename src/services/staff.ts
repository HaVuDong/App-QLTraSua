import { api } from "./api";
import type { UserPermission, UserRole } from "../types/auth";

export type StaffRole = Exclude<UserRole, "SYSTEM_OWNER">;
export type StaffStatus = "ACTIVE" | "LOCKED" | "DELETED";
export type StaffPermission = UserPermission;

export interface StaffPermissionOverrides {
  allow?: StaffPermission[];
  deny?: StaffPermission[];
}

export interface StaffPermissionCatalog {
  permissions: StaffPermission[];
  roleDefaults: Record<UserRole, StaffPermission[]>;
}

export interface StaffSalaryConfig {
  baseHourly?: number;
  baseShift?: number;
  overtimeMultiplier?: number;
}

export interface StaffUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: StaffStatus;
  salaryConfig?: StaffSalaryConfig;
  permissionOverrides?: StaffPermissionOverrides;
  effectivePermissions?: StaffPermission[];
  createdAt?: string;
  updatedAt?: string;
  mustChangePassword?: boolean;
  tempPassword?: string;
}

export interface CreateStaffInput {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: StaffRole;
  baseHourly?: number;
  baseShift?: number;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  phone?: string;
  baseHourly?: number;
  baseShift?: number;
}

export async function getStaffUsers() {
  const res = await api.get("/users");
  return Array.isArray(res.data) ? (res.data as StaffUser[]) : [];
}

export async function createStaffUser(payload: CreateStaffInput) {
  const res = await api.post("/users", payload);
  return res.data as StaffUser & { tempPassword?: string };
}

export async function updateStaffUser(
  userId: string,
  payload: UpdateStaffInput,
) {
  const res = await api.put(`/users/${userId}`, payload);
  return res.data as StaffUser;
}

export async function deactivateStaffUser(userId: string) {
  const res = await api.delete(`/users/${userId}`);
  return res.data as StaffUser;
}

export async function lockStaffUser(userId: string) {
  const res = await api.patch(`/users/${userId}/lock`);
  return res.data as StaffUser;
}

export async function unlockStaffUser(userId: string) {
  const res = await api.patch(`/users/${userId}/unlock`);
  return res.data as StaffUser;
}

export async function changeStaffRole(userId: string, role: StaffRole) {
  const res = await api.patch(`/users/${userId}/role`, { role });
  return res.data as StaffUser;
}

export async function resetStaffPassword(userId: string) {
  const res = await api.post(`/users/${userId}/reset-password`);
  return res.data as { tempPassword?: string };
}

export async function getStaffPermissionCatalog() {
  const res = await api.get("/users/permissions/catalog");
  return res.data as StaffPermissionCatalog;
}

export async function updateStaffPermissionOverrides(
  userId: string,
  permissionOverrides: StaffPermissionOverrides,
) {
  const res = await api.patch(`/users/${userId}/permissions`, {
    permissionOverrides,
  });
  return res.data as StaffUser;
}
