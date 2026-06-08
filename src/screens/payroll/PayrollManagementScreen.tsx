import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { MANAGEMENT_ROLES } from '../../constants/roles';
import { getMonthlyAttendance, type MonthlyAttendanceData } from '../../services/attendance';
import { calculatePayroll, getPayrollRecordDetail, getPayrollRecords, type PayrollRecord } from '../../services/payroll';
import { getStaffUsers, type StaffRole, type StaffStatus } from '../../services/staff';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { getPayrollBackendStatusLabel, getPayrollSourceLabel, getStaffRoleLabel, type PayrollFilterStatus } from '../../utils/displayLabels';
import { extractBackendLatePenaltyRecords } from '../../utils/payroll';
import { formatCurrencyVnd, formatDateTime, formatPenaltyDateLabel, getCurrentMonthInput } from '../../utils/format';
import type { StaffFilterRole } from '../../utils/staffForms';

type PayrollViewRow = {
  userId: string;
  name: string;
  account: string;
  role: StaffRole;
  status: StaffStatus | 'UNKNOWN';
  hourlyWage: number | null;
  workedHours: number;
  grossSalary: number | null;
  latePenaltyTotal: number;
  finalSalaryPreview: number | null;
  monthlyAttendance: MonthlyAttendanceData | null;
  penaltyRecords: {
    date: string;
    checkInTime?: string | null;
    lateMinutes: number;
    penaltyAmount: number;
  }[];
  penaltySource: 'BACKEND' | 'ATTENDANCE';
  payrollRecord: PayrollRecord | null;
};

const PAYROLL_STATUS_FILTER_OPTIONS: PayrollFilterStatus[] = ['ALL', 'ACTIVE', 'LOCKED', 'DELETED', 'UNKNOWN'];
const PAYROLL_LATE_MINUTES_THRESHOLD = 5;
const PAYROLL_LATE_PENALTY_AMOUNT = 20000;
function normalizeToStaffRole(role: string | undefined | null): StaffRole {
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'USER' || role === 'KITCHEN') {
    return role;
  }
  return 'USER';
}

function getPayrollRecordUserId(record: PayrollRecord) {
  if (typeof record.userId === 'string') return record.userId;
  if (record.userId && typeof record.userId._id === 'string') return record.userId._id;
  return '';
}

function getPayrollFilterStatusLabel(status: PayrollFilterStatus) {
  if (status === 'ALL') return 'Tất cả';
  if (status === 'ACTIVE') return 'Đang hoạt động';
  if (status === 'LOCKED') return 'Đã khóa';
  if (status === 'DELETED') return 'Vô hiệu hóa';
  return 'Không rõ';
}

function getPayrollRowStatusLabel(status: PayrollViewRow['status']) {
  if (status === 'UNKNOWN') return 'Không rõ';
  if (status === 'LOCKED') return 'Đã khóa';
  if (status === 'DELETED') return 'Vô hiệu hóa';
  return 'Đang hoạt động';
}

function getAttendanceRecordHours(record: NonNullable<MonthlyAttendanceData['records']>[number]) {
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

export function PayrollManagementScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PayrollViewRow[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [payrollApiNotice, setPayrollApiNotice] = useState('');

  const [monthInput, setMonthInput] = useState(getCurrentMonthInput());
  const [appliedMonth, setAppliedMonth] = useState(getCurrentMonthInput());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffFilterRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<PayrollFilterStatus>('ALL');
  const [calculating, setCalculating] = useState(false);

  const [detailUserId, setDetailUserId] = useState('');
  const [detailPayroll, setDetailPayroll] = useState<PayrollRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const canViewPayroll = Boolean(user && MANAGEMENT_ROLES.includes(user.role));
  const canCalculatePayroll = user?.role === 'ADMIN';

  const fetchPayrollData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      setPayrollApiNotice('');

      const staffRows = await getStaffUsers();
        const staffUsers = staffRows.filter((member) => member.role !== 'SYSTEM_OWNER' && member.role !== 'ADMIN');
      const staffMap = new Map(staffUsers.map((member) => [member._id, member] as const));

      let payrollRows: PayrollRecord[] = [];
      try {
        payrollRows = await getPayrollRecords(appliedMonth);
      } catch (err: any) {
        const statusCode = err?.response?.status;
        if (statusCode === 404) {
          setPayrollApiNotice('Máy chủ chưa có API bảng lương riêng');
        } else {
          setPayrollApiNotice('Không thể tải API bảng lương. Đang hiển thị lương tạm tính từ chấm công.');
        }
      }

      const payrollMap = new Map<string, PayrollRecord>();
      payrollRows.forEach((record) => {
        const recordUserId = getPayrollRecordUserId(record);
        if (recordUserId) {
          payrollMap.set(recordUserId, record);
        }
      });

      const userIds = Array.from(
        new Set([
          ...staffUsers.map((member) => member._id),
          ...payrollRows.map((record) => getPayrollRecordUserId(record)).filter((recordUserId) => !!recordUserId),
        ]),
      );

      const monthlyEntries = await Promise.all(
        userIds.map(async (targetUserId) => {
          try {
            const monthly = await getMonthlyAttendance(targetUserId, appliedMonth);
            return [targetUserId, monthly] as const;
          } catch {
            return [targetUserId, null] as const;
          }
        }),
      );
      const monthlyMap = new Map(monthlyEntries);

      const mappedRows: PayrollViewRow[] = userIds.map((targetUserId) => {
        const staffMember = staffMap.get(targetUserId);
        const payrollRecord = payrollMap.get(targetUserId) || null;
        const monthlyAttendance = monthlyMap.get(targetUserId) || null;
        const payrollUserRef = payrollRecord && typeof payrollRecord.userId !== 'string' ? payrollRecord.userId : null;

        const role = normalizeToStaffRole(staffMember?.role || payrollUserRef?.role);
        const status: PayrollViewRow['status'] = staffMember?.status || 'UNKNOWN';
        const account = staffMember?.email || staffMember?.phone || payrollUserRef?.email || '';
        const name = staffMember?.name || payrollUserRef?.name || 'Nhân viên';
        const hourlyWage = typeof staffMember?.salaryConfig?.baseHourly === 'number' ? staffMember.salaryConfig.baseHourly : null;

        const workedHoursFromRecords = monthlyAttendance?.records?.reduce((sum, record) => sum + getAttendanceRecordHours(record), 0) || 0;
        const workedHours =
          payrollRecord && Number.isFinite(payrollRecord.workedHours)
            ? payrollRecord.workedHours
            : monthlyAttendance && Number.isFinite(monthlyAttendance.totalWorkedHours)
              ? monthlyAttendance.totalWorkedHours
              : Number(workedHoursFromRecords.toFixed(2));

        const attendancePenaltyRecords = (monthlyAttendance?.records || [])
          .filter((record) => (record.lateMinutes || 0) >= PAYROLL_LATE_MINUTES_THRESHOLD)
          .map((record) => ({
            date: record.date,
            checkInTime: record.checkInTime,
            lateMinutes: record.lateMinutes || 0,
            penaltyAmount: PAYROLL_LATE_PENALTY_AMOUNT,
          }));

        const backendPenaltyRecords = extractBackendLatePenaltyRecords(payrollRecord?.deductions);
        const hasBackendPenaltyData = !!payrollRecord && backendPenaltyRecords.length > 0;
        const penaltyRecords = hasBackendPenaltyData
          ? backendPenaltyRecords.map((record) => ({
              date: record.date,
              lateMinutes: record.lateMinutes,
              penaltyAmount: record.penaltyAmount,
            }))
          : attendancePenaltyRecords;
        const penaltySource: PayrollViewRow['penaltySource'] = hasBackendPenaltyData ? 'BACKEND' : 'ATTENDANCE';
        const latePenaltyTotal = penaltyRecords.reduce((sum, record) => sum + record.penaltyAmount, 0);
        const grossSalary = hourlyWage === null ? null : Math.round(workedHours * hourlyWage);
        const finalSalaryPreview =
          payrollRecord && Number.isFinite(payrollRecord.finalSalary)
            ? Math.max(0, Number(payrollRecord.finalSalary))
            : grossSalary === null
              ? null
              : Math.max(0, grossSalary - latePenaltyTotal);

        return {
          userId: targetUserId,
          name,
          account,
          role,
          status,
          hourlyWage,
          workedHours,
          grossSalary,
          latePenaltyTotal,
          finalSalaryPreview,
          monthlyAttendance,
          penaltyRecords,
          penaltySource,
          payrollRecord,
        };
      });

      mappedRows.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      setRows(mappedRows);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải bảng lương');
      setRows([]);
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [appliedMonth]);

  useEffect(() => {
    setDetailUserId('');
    setDetailPayroll(null);
    setDetailError('');
  }, [appliedMonth]);

  useEffect(() => {
    void fetchPayrollData();
  }, [fetchPayrollData]);

  const applyMonth = useCallback(() => {
    const normalizedMonth = monthInput.trim();
    if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
      Alert.alert('Tháng không hợp lệ', 'Vui lòng nhập tháng theo định dạng YYYY-MM');
      return;
    }
    setAppliedMonth(normalizedMonth);
  }, [monthInput]);

  const handleCalculatePayroll = useCallback(() => {
    if (!canCalculatePayroll) return;

    runConfirmedAction({
      title: 'Tính lương nhân viên',
      message: `Bạn muốn tính lương tháng ${appliedMonth}?`,
      confirmText: 'Tính lương',
      onConfirm: async () => {
        try {
          setCalculating(true);
          const result = await calculatePayroll(appliedMonth);
          Alert.alert('Thành công', result?.message || `Đã gửi tính lương tháng ${appliedMonth}`);
          void fetchPayrollData(true);
        } catch (err: any) {
          Alert.alert('Lỗi', err.response?.data?.message || 'Không thể tính lương');
        } finally {
          setCalculating(false);
        }
      },
    });
  }, [appliedMonth, canCalculatePayroll, fetchPayrollData]);

  const openPayrollDetail = useCallback(async (row: PayrollViewRow) => {
    setDetailUserId(row.userId);
    setDetailPayroll(row.payrollRecord);
    setDetailError('');
    setDetailLoading(true);

    try {
      const detail = await getPayrollRecordDetail(row.userId, appliedMonth);
      if (detail) {
        setDetailPayroll(detail);
      }
    } catch (err: any) {
      const statusCode = err?.response?.status;
      if (statusCode === 404) {
        setDetailError('Máy chủ chưa có API bảng lương riêng');
      } else {
        setDetailError(err.response?.data?.message || 'Không thể tải chi tiết lương');
      }
    } finally {
      setDetailLoading(false);
    }
  }, [appliedMonth]);

  if (!canViewPayroll) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình bảng lương." />
      </View>
    );
  }

  if (screenLoading) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <LoadingView />
      </View>
    );
  }

  const keyword = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (roleFilter !== 'ALL' && row.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
    if (!keyword) return true;
    const searchable = `${row.name} ${row.account} ${row.role}`.toLowerCase();
    return searchable.includes(keyword);
  });

  const totalGrossSalary = filteredRows.reduce((sum, row) => sum + (row.grossSalary || 0), 0);
  const totalPenalty = filteredRows.reduce((sum, row) => sum + row.latePenaltyTotal, 0);
  const totalFinalPreview = filteredRows.reduce((sum, row) => sum + (row.finalSalaryPreview || 0), 0);

  const selectedRow = detailUserId ? rows.find((row) => row.userId === detailUserId) || null : null;
  const detailAttendanceRecords = selectedRow?.monthlyAttendance?.records || [];

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchPayrollData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Bảng lương</Text>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Tháng lương (YYYY-MM)"
              value={monthInput}
              onChangeText={setMonthInput}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <View style={styles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={applyMonth}>
                <Text style={styles.buttonText}>Lương tháng</Text>
              </TouchableOpacity>

              {canCalculatePayroll ? (
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={handleCalculatePayroll}>
                  {calculating ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Tính lương nhân viên</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.flex1, styles.moduleCardDisabled]}>
                  <Text style={styles.buttonText}>Chỉ xem (Manager)</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              placeholder="Tìm theo tên nhân viên / tài khoản"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.helperText}>Lọc theo vai trò</Text>
            <View style={styles.filterRow}>
              {(['ALL', 'MANAGER', 'USER', 'KITCHEN'] as const).map((role) => {
                const selected = roleFilter === role;
                return (
                  <TouchableOpacity
                    key={role}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setRoleFilter(role)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                      {role === 'ALL' ? 'Tất cả' : getStaffRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helperText}>Lọc theo trạng thái</Text>
            <View style={styles.filterRow}>
              {PAYROLL_STATUS_FILTER_OPTIONS.map((status) => {
                const selected = statusFilter === status;
                return (
                  <TouchableOpacity
                    key={status}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getPayrollFilterStatusLabel(status)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {payrollApiNotice ? (
            <View style={[styles.glassCard, styles.disabledBlock]}>
              <Text style={styles.helperText}>{payrollApiNotice}</Text>
            </View>
          ) : (
            <View style={[styles.glassCard, styles.disabledBlock]}>
              <Text style={styles.helperText}>
                Ưu tiên dữ liệu bảng lương từ máy chủ khi có. Nếu chưa có, hệ thống tạm tính theo quy tắc đi trễ từ 5 phút trở lên trừ 20,000 VND/lần.
              </Text>
            </View>
          )}

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Lương tạm tính</Text>
              <Text style={styles.metricValue}>{formatCurrencyVnd(totalGrossSalary)}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Tổng phạt đi trễ</Text>
              <Text style={styles.metricValue}>{formatCurrencyVnd(totalPenalty)}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Lương thực nhận</Text>
              <Text style={styles.metricValue}>{formatCurrencyVnd(totalFinalPreview)}</Text>
            </View>
          </View>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchPayrollData()} /> : null}

          {!loadError && filteredRows.length === 0 ? (
            <EmptyStateView message="Không có dữ liệu bảng lương trong tháng này." />
          ) : (
            filteredRows.map((row) => {
              const statusStyle = row.status === 'LOCKED' ? styles.statusPending : row.status === 'DELETED' ? styles.statusLowStock : styles.statusProgress;
              return (
                <View key={row.userId} style={[styles.glassCard, styles.staffCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{row.name}</Text>
                      <Text style={styles.staffMeta}>Vai trò: {getStaffRoleLabel(row.role)}</Text>
                      <Text style={styles.staffMeta}>Tài khoản: {row.account || '-'}</Text>
                      <Text style={styles.staffMeta}>
                        Lương theo giờ:{' '}
                        {row.hourlyWage === null ? 'Chưa cấu hình lương' : formatCurrencyVnd(row.hourlyWage)}
                      </Text>
                      <Text style={styles.staffMeta}>Tổng giờ làm: {Number(row.workedHours.toFixed(2))}</Text>
                      <Text style={styles.staffMeta}>
                        Lương tạm tính: {row.grossSalary === null ? 'Chưa cấu hình lương' : formatCurrencyVnd(row.grossSalary)}
                      </Text>
                      <Text style={styles.staffMeta}>Tổng phạt đi trễ: {formatCurrencyVnd(row.latePenaltyTotal)}</Text>
                      <Text style={styles.staffMeta}>
                        Nguồn dữ liệu phạt đi trễ: {getPayrollSourceLabel(row.penaltySource)}
                      </Text>
                      <Text style={styles.staffMeta}>
                        Lương thực nhận: {row.finalSalaryPreview === null ? 'Chưa cấu hình lương' : formatCurrencyVnd(row.finalSalaryPreview)}
                      </Text>
                      {row.payrollRecord ? (
                        <Text style={styles.staffMeta}>
                          Lương từ máy chủ: {formatCurrencyVnd(row.payrollRecord.finalSalary || 0)} ({getPayrollBackendStatusLabel(row.payrollRecord.status)})
                        </Text>
                      ) : (
                        <Text style={styles.staffMeta}>Máy chủ chưa có API bảng lương riêng</Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, statusStyle]}>
                      <Text style={styles.statusText}>{getPayrollRowStatusLabel(row.status)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={() => void openPayrollDetail(row)}>
                    <Text style={styles.buttonText}>Chi tiết lương</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {selectedRow ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Chi tiết lương - {selectedRow.name}</Text>
              <Text style={styles.staffMeta}>Lương tháng: {appliedMonth}</Text>
              <Text style={styles.staffMeta}>Vai trò: {getStaffRoleLabel(selectedRow.role)}</Text>
              <Text style={styles.staffMeta}>
                Lương theo giờ: {selectedRow.hourlyWage === null ? 'Chưa cấu hình lương' : formatCurrencyVnd(selectedRow.hourlyWage)}
              </Text>
              <Text style={styles.staffMeta}>Tổng giờ làm: {Number(selectedRow.workedHours.toFixed(2))}</Text>
              <Text style={styles.staffMeta}>
                Lương tạm tính: {selectedRow.grossSalary === null ? 'Chưa cấu hình lương' : formatCurrencyVnd(selectedRow.grossSalary)}
              </Text>
              <Text style={styles.staffMeta}>Tổng phạt đi trễ: {formatCurrencyVnd(selectedRow.latePenaltyTotal)}</Text>
              <Text style={styles.staffMeta}>
                Lương thực nhận: {selectedRow.finalSalaryPreview === null ? 'Chưa cấu hình lương' : formatCurrencyVnd(selectedRow.finalSalaryPreview)}
              </Text>

              {detailLoading ? <LoadingView /> : null}
              {detailError ? <Text style={styles.otpNotice}>{detailError}</Text> : null}

              {detailPayroll ? (
                <View style={[styles.glassCard, styles.disabledBlock]}>
                  <Text style={styles.sectionTitle}>Dữ liệu bảng lương từ máy chủ</Text>
                  <Text style={styles.staffMeta}>Trạng thái: {getPayrollBackendStatusLabel(detailPayroll.status)}</Text>
                  <Text style={styles.staffMeta}>Giờ làm việc: {detailPayroll.workedHours || 0}</Text>
                  <Text style={styles.staffMeta}>Tổng khấu trừ từ máy chủ: {formatCurrencyVnd(detailPayroll.totalDeductions || 0)}</Text>
                  <Text style={styles.staffMeta}>Lương từ máy chủ: {formatCurrencyVnd(detailPayroll.finalSalary || 0)}</Text>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Khoản trừ đi trễ</Text>
              {selectedRow.penaltyRecords.length === 0 ? (
                <EmptyStateView message="Không có khoản trừ đi trễ trong tháng này." />
              ) : (
                selectedRow.penaltyRecords.map((penalty, idx) => (
                  <View key={`${selectedRow.userId}-penalty-${idx}`} style={[styles.glassCard, styles.staffCard]}>
                    <Text style={styles.staffMeta}>Ngày: {formatPenaltyDateLabel(penalty.date)}</Text>
                    <Text style={styles.staffMeta}>Giờ vào ca: Máy chủ chưa hỗ trợ</Text>
                    <Text style={styles.staffMeta}>Giờ check-in: {formatDateTime(penalty.checkInTime)}</Text>
                    <Text style={styles.staffMeta}>Đi trễ: {penalty.lateMinutes} phút</Text>
                    <Text style={styles.staffMeta}>Khoản trừ đi trễ: {formatCurrencyVnd(penalty.penaltyAmount)}</Text>
                    <Text style={styles.staffMeta}>
                      Trạng thái: {selectedRow.penaltySource === 'BACKEND' ? 'Tính từ API bảng lương' : 'Tính từ dữ liệu chấm công'}
                    </Text>
                  </View>
                ))
              )}

              <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.moduleCardDisabled]}>
                <Text style={styles.buttonText}>Xóa khoản trừ đi trễ</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>Máy chủ chưa hỗ trợ xóa khoản trừ lương</Text>

              <Text style={styles.sectionTitle}>Bản ghi chấm công dùng để tính lương</Text>
              {detailAttendanceRecords.length === 0 ? (
                <EmptyStateView message="Không có bản ghi chấm công cho tháng này." />
              ) : (
                detailAttendanceRecords.map((record) => {
                  const lateMinutes = record.lateMinutes || 0;
                  const penaltyApplied = lateMinutes >= PAYROLL_LATE_MINUTES_THRESHOLD;
                  const recordHours = getAttendanceRecordHours(record);
                  return (
                    <View key={record._id} style={[styles.glassCard, styles.staffCard]}>
                      <Text style={styles.staffMeta}>Ngày: {new Date(record.date).toLocaleDateString()}</Text>
                      <Text style={styles.staffMeta}>Giờ check-in: {formatDateTime(record.checkInTime)}</Text>
                      <Text style={styles.staffMeta}>Giờ check-out: {formatDateTime(record.checkOutTime)}</Text>
                      <Text style={styles.staffMeta}>Tổng giờ làm: {recordHours}</Text>
                      <Text style={styles.staffMeta}>Đi trễ: {lateMinutes} phút</Text>
                      <Text style={styles.staffMeta}>
                        Khoản trừ áp dụng: {penaltyApplied ? formatCurrencyVnd(PAYROLL_LATE_PENALTY_AMOUNT) : 'Không'}
                      </Text>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.buttonBase, styles.buttonSecondary]}
                onPress={() => {
                  setDetailUserId('');
                  setDetailPayroll(null);
                  setDetailError('');
                }}
              >
                <Text style={styles.buttonText}>Đóng chi tiết</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
