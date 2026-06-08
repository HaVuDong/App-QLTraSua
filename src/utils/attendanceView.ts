import type { DailyAttendanceRow, MonthlyAttendanceData } from '../services/attendance';

export type AttendancePrimaryStatus = 'ABSENT' | 'ON_LEAVE' | 'MISSING_CHECKOUT' | 'COMPLETED';
export type AttendancePunctualStatus = 'ON_TIME' | 'LATE' | 'UNKNOWN';
export type AttendanceFilterStatus = 'ALL' | AttendancePrimaryStatus | AttendancePunctualStatus;

export const ATTENDANCE_FILTER_OPTIONS: AttendanceFilterStatus[] = ['ALL', 'COMPLETED', 'MISSING_CHECKOUT', 'LATE', 'ON_TIME', 'ABSENT', 'ON_LEAVE'];

export function getAttendanceUserId(row: DailyAttendanceRow) {
  if (typeof row.userId === 'string') return row.userId;
  if (row.userId && typeof row.userId._id === 'string') return row.userId._id;
  return '';
}

export function getAttendancePrimaryStatus(row: DailyAttendanceRow): AttendancePrimaryStatus {
  if (row.status === 'ON_LEAVE') return 'ON_LEAVE';
  if (!row.checkInTime) return 'ABSENT';
  if (!row.checkOutTime) return 'MISSING_CHECKOUT';
  return 'COMPLETED';
}

export function getAttendancePunctualStatus(row: DailyAttendanceRow): AttendancePunctualStatus {
  if (!row.checkInTime) return 'UNKNOWN';
  if (row.status === 'LATE') return 'LATE';
  if (row.status === 'ON_TIME') return 'ON_TIME';
  return 'UNKNOWN';
}

export function getAttendanceStatusLabel(status: AttendanceFilterStatus) {
  if (status === 'ALL') return 'Tất cả';
  if (status === 'COMPLETED') return 'Đã hoàn thành';
  if (status === 'MISSING_CHECKOUT') return 'Chưa checkout';
  if (status === 'LATE') return 'Đi trễ';
  if (status === 'ON_TIME') return 'Đúng giờ';
  if (status === 'ABSENT') return 'Vắng mặt';
  if (status === 'ON_LEAVE') return 'Nghỉ phép';
  return status;
}

export function getAttendanceRecordHours(record: NonNullable<MonthlyAttendanceData['records']>[number]) {
  if (typeof record.totalHours === 'number' && Number.isFinite(record.totalHours)) {
    return record.totalHours;
  }
  if (record.checkInTime && record.checkOutTime) {
    const start = new Date(record.checkInTime).getTime();
    const end = new Date(record.checkOutTime).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      return Number(((end - start) / (1000 * 60 * 60)).toFixed(2));
    }
  }
  return 0;
}
