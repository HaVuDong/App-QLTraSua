import type { PayrollDeduction } from '../services/payroll';

const PAYROLL_LATE_PENALTY_REASON_PREFIX = 'LATE_ATTENDANCE_PENALTY';

export type BackendLatePenaltyRecord = {
  date: string;
  lateMinutes: number;
  penaltyAmount: number;
};

function parseLatePenaltyReason(reason?: string) {
  if (!reason || !reason.startsWith(`${PAYROLL_LATE_PENALTY_REASON_PREFIX}|`)) {
    return null;
  }

  const pairs = reason.split('|').slice(1);
  let date = '';
  let lateMinutes = 0;

  pairs.forEach((pair) => {
    const [key, rawValue] = pair.split('=');
    const value = (rawValue || '').trim();
    if (key === 'date') {
      date = value;
      return;
    }
    if (key === 'lateMinutes') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        lateMinutes = parsed;
      }
    }
  });

  return {
    date: date || '',
    lateMinutes,
  };
}

export function extractBackendLatePenaltyRecords(
  deductions: PayrollDeduction[] | undefined,
): BackendLatePenaltyRecord[] {
  if (!Array.isArray(deductions)) return [];

  return deductions
    .map((deduction) => {
      const parsed = parseLatePenaltyReason(deduction.reason);
      if (!parsed) return null;
      return {
        date: parsed.date,
        lateMinutes: parsed.lateMinutes,
        penaltyAmount: Number(deduction.amount) || 0,
      };
    })
    .filter((item): item is BackendLatePenaltyRecord => item !== null);
}
