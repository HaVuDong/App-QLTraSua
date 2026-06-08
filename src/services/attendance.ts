import { api } from './api';
import type { UserRole } from '../types/auth';

export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'ABSENT' | 'ON_LEAVE';
export type WorkShiftStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ShiftRegistrationStatus = 'REGISTERED' | 'CANCEL_PENDING' | 'CANCELLED' | 'LEAVE_APPROVED' | 'NO_SHOW';

export interface RequiredStaffByRole {
  MANAGER: number;
  USER: number;
  KITCHEN: number;
}

export interface ShiftRegistration {
  _id: string;
  shiftId: string;
  userId: string;
  role: UserRole;
  status: ShiftRegistrationStatus;
  cancelReason?: string;
  cancelRequestedAt?: string;
  cancelReviewNotes?: string;
  absencePenaltyAmount?: number;
}

export interface WorkShift {
  _id: string;
  name: string;
  startAt: string;
  endAt: string;
  requiredStaffByRole: RequiredStaffByRole;
  registeredStaffByRole?: RequiredStaffByRole;
  status: WorkShiftStatus;
  reviewNotes?: string;
  myRegistration?: ShiftRegistration | null;
}

export interface DailyAttendanceUserRef {
  _id?: string;
}

export interface DailyAttendanceRow {
  userId: string | DailyAttendanceUserRef;
  name: string;
  email?: string;
  role: UserRole;
  attendanceId?: string | null;
  shiftRegistrationId?: string;
  registrationStatus?: ShiftRegistrationStatus;
  shiftId?: string;
  shiftName?: string;
  shiftStartAt?: string;
  shiftEndAt?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalHours?: number;
  status: AttendanceStatus | string;
  lateMinutes?: number;
  ipAddress?: string | null;
}

export interface AttendanceRecord {
  _id: string;
  attendanceId?: string | null;
  shiftRegistrationId?: string;
  registrationStatus?: ShiftRegistrationStatus;
  shiftName?: string;
  shiftStartAt?: string | null;
  shiftEndAt?: string | null;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalHours?: number;
  status: AttendanceStatus | string;
  lateMinutes?: number;
  ipAddress?: string | null;
}

export interface MonthlyAttendanceData {
  month: string;
  totalWorkedDays: number;
  totalWorkedHours: number;
  totalLateDays: number;
  totalLateMinutes: number;
  paidLeaveDays?: number;
  unpaidLeaveDays?: number;
  records: AttendanceRecord[];
}

export interface AttendanceEditInput {
  checkInTime?: string;
  checkOutTime?: string;
}

export interface CreateShiftInput {
  name: string;
  startAt: string;
  endAt: string;
  requiredStaffByRole: RequiredStaffByRole;
}

export async function getDailyAttendance(date?: string) {
  const res = await api.get('/attendance/daily', { params: date ? { date } : undefined });
  return Array.isArray(res.data) ? (res.data as DailyAttendanceRow[]) : [];
}

export async function getMonthlyAttendance(userId: string, month: string) {
  const res = await api.get(`/attendance/monthly/${userId}`, { params: { month } });
  return (res.data || null) as MonthlyAttendanceData | null;
}

export async function editAttendanceRecord(attendanceId: string, payload: AttendanceEditInput) {
  const res = await api.patch(`/attendance/${attendanceId}/edit`, payload);
  return res.data as AttendanceRecord;
}

export async function getWorkShifts(params: { from?: string; to?: string; status?: WorkShiftStatus | 'ALL' }) {
  const query: Record<string, string> = {};
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (params.status && params.status !== 'ALL') query.status = params.status;
  const res = await api.get('/attendance/shifts', { params: query });
  return Array.isArray(res.data) ? (res.data as WorkShift[]) : [];
}

export async function createWorkShift(payload: CreateShiftInput) {
  const res = await api.post('/attendance/shifts', payload);
  return res.data as WorkShift;
}

export async function reviewWorkShift(shiftId: string, status: 'APPROVED' | 'REJECTED', reviewNotes?: string) {
  const res = await api.patch(`/attendance/shifts/${shiftId}/review`, { status, reviewNotes });
  return res.data as WorkShift;
}

export async function getMyShifts(params: { from?: string; to?: string }) {
  const res = await api.get('/attendance/my-shifts', { params });
  return Array.isArray(res.data) ? (res.data as WorkShift[]) : [];
}

export async function registerShift(shiftId: string) {
  const res = await api.post(`/attendance/shifts/${shiftId}/register`);
  return res.data as ShiftRegistration;
}

export async function cancelShiftRegistration(registrationId: string, reason?: string) {
  const res = await api.post(`/attendance/shift-registrations/${registrationId}/cancel`, { reason });
  return res.data as ShiftRegistration;
}

export async function reviewShiftCancellation(registrationId: string, status: 'APPROVED' | 'REJECTED', reviewNotes?: string) {
  const res = await api.patch(`/attendance/shift-registrations/${registrationId}/review-cancel`, { status, reviewNotes });
  return res.data as ShiftRegistration;
}

export async function checkInShift(shiftRegistrationId?: string) {
  const res = await api.post('/attendance/check-in', { gps: '10.7,106.6', shiftRegistrationId });
  return res.data as AttendanceRecord;
}

export async function checkOutShift(shiftRegistrationId?: string) {
  const res = await api.post('/attendance/check-out', { shiftRegistrationId });
  return res.data as AttendanceRecord;
}
