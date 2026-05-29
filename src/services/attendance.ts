import { api } from './api';
import type { UserRole } from '../types/auth';

export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'ABSENT' | 'ON_LEAVE';

export interface DailyAttendanceUserRef {
  _id?: string;
}

export interface DailyAttendanceRow {
  userId: string | DailyAttendanceUserRef;
  name: string;
  email?: string;
  role: UserRole;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  totalHours?: number;
  status: AttendanceStatus | string;
  lateMinutes?: number;
  ipAddress?: string | null;
}

export interface AttendanceRecord {
  _id: string;
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
