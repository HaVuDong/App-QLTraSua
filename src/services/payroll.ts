import { api } from './api';
import type { UserRole } from '../types/auth';

export interface PayrollUserRef {
  _id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface PayrollAllowance {
  name: string;
  amount: number;
}

export interface PayrollDeduction {
  name: string;
  amount: number;
  reason?: string;
}

export interface PayrollRecord {
  _id: string;
  userId: string | PayrollUserRef;
  month: string;
  baseSalary: number;
  workedHours: number;
  workedShifts: number;
  overtimeHours: number;
  overtimePay: number;
  weekendHours: number;
  weekendPay: number;
  holidayHours: number;
  holidayPay: number;
  unpaidLeaveDays: number;
  allowances: PayrollAllowance[];
  totalAllowances: number;
  deductions: PayrollDeduction[];
  totalDeductions: number;
  totalPayout: number;
  finalSalary: number;
  status: string;
  confirmedBy?: string;
  confirmedAt?: string;
  adjustmentNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function calculatePayroll(month: string) {
  const res = await api.post('/attendance/payroll/calculate', undefined, { params: { month } });
  return (res.data || null) as { status?: string; message?: string; jobId?: string } | null;
}

export async function getPayrollRecords(month: string) {
  const res = await api.get('/attendance/payroll', { params: { month } });
  return Array.isArray(res.data) ? (res.data as PayrollRecord[]) : [];
}

export async function getPayrollRecordDetail(userId: string, month: string) {
  const res = await api.get(`/attendance/payroll/detail/${userId}`, { params: { month } });
  return (res.data || null) as PayrollRecord | null;
}
