import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { MANAGEMENT_ROLES } from '../../constants/roles';
import { createWorkShift, editAttendanceRecord, getDailyAttendance, getMonthlyAttendance, getWorkShifts, reviewShiftCancellation, reviewWorkShift, type DailyAttendanceRow, type MonthlyAttendanceData, type WorkShift } from '../../services/attendance';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { getShiftRegistrationStatusLabel, getShiftStatusLabel, getStaffRoleLabel } from '../../utils/displayLabels';
import { formatDateTime, getCurrentMonthInput, getMonthFromDateInput, getTodayDateInput, parseDateTimeInputToIso, toDateTimeInputValue } from '../../utils/format';
import { ATTENDANCE_FILTER_OPTIONS, type AttendanceFilterStatus, type AttendancePrimaryStatus, type AttendancePunctualStatus } from '../../utils/attendanceView';
import type { StaffFilterRole } from '../../utils/staffForms';
function getAttendanceUserId(row: DailyAttendanceRow) {
  if (typeof row.userId === 'string') return row.userId;
  if (row.userId && typeof row.userId._id === 'string') return row.userId._id;
  return '';
}

function getAttendancePrimaryStatus(row: DailyAttendanceRow): AttendancePrimaryStatus {
  if (row.status === 'ON_LEAVE') return 'ON_LEAVE';
  if (!row.checkInTime) return 'ABSENT';
  if (!row.checkOutTime) return 'MISSING_CHECKOUT';
  return 'COMPLETED';
}

function getAttendancePunctualStatus(row: DailyAttendanceRow): AttendancePunctualStatus {
  if (!row.checkInTime) return 'UNKNOWN';
  if (row.status === 'LATE') return 'LATE';
  if (row.status === 'ON_TIME') return 'ON_TIME';
  return 'UNKNOWN';
}

function getAttendanceStatusLabel(status: AttendanceFilterStatus) {
  if (status === 'ALL') return 'Tất cả';
  if (status === 'COMPLETED') return 'Đã hoàn thành';
  if (status === 'MISSING_CHECKOUT') return 'Chưa checkout';
  if (status === 'LATE') return 'Đi trễ';
  if (status === 'ON_TIME') return 'Đúng giờ';
  if (status === 'ABSENT') return 'Vắng mặt';
  if (status === 'ON_LEAVE') return 'Nghỉ phép';
  return status;
}

export function AttendanceManagementScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DailyAttendanceRow[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [shiftManagers, setShiftManagers] = useState('0');
  const [shiftUsers, setShiftUsers] = useState('0');
  const [shiftKitchen, setShiftKitchen] = useState('0');
  const [shiftFormError, setShiftFormError] = useState('');
  const [shiftSubmitting, setShiftSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(getTodayDateInput());
  const [appliedDate, setAppliedDate] = useState(getTodayDateInput());
  const [roleFilter, setRoleFilter] = useState<StaffFilterRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<AttendanceFilterStatus>('ALL');

  const [detailUser, setDetailUser] = useState<DailyAttendanceRow | null>(null);
  const [detailMonth, setDetailMonth] = useState(getCurrentMonthInput());
  const [detailData, setDetailData] = useState<MonthlyAttendanceData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [editingRecordId, setEditingRecordId] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const canEditAttendance = user?.role === 'ADMIN';
  const canCreateShift = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canReviewShift = user?.role === 'ADMIN';
  const canReviewShiftCancellation = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const fetchAttendanceData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const dayStart = `${appliedDate.trim()}T00:00:00.000Z`;
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const [dailyRows, shiftRows] = await Promise.all([
        getDailyAttendance(appliedDate.trim() || undefined),
        getWorkShifts({ from: dayStart, to: dayEnd.toISOString(), status: 'ALL' }),
      ]);
      setRows(dailyRows);
      setWorkShifts(shiftRows);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải danh sách chấm công');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [appliedDate]);

  useEffect(() => {
    void fetchAttendanceData();
  }, [fetchAttendanceData]);

  const submitCreateShift = useCallback(async () => {
    if (!canCreateShift) return;

    const name = shiftName.trim();
    const startAt = parseDateTimeInputToIso(shiftStart.trim());
    const endAt = parseDateTimeInputToIso(shiftEnd.trim());
    const managerCount = Number(shiftManagers);
    const userCount = Number(shiftUsers);
    const kitchenCount = Number(shiftKitchen);

    if (!name) {
      setShiftFormError('Tên ca làm là bắt buộc');
      return;
    }
    if (!startAt || !endAt) {
      setShiftFormError('Giờ bắt đầu/kết thúc phải đúng định dạng YYYY-MM-DD HH:mm');
      return;
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setShiftFormError('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    if (![managerCount, userCount, kitchenCount].every((count) => Number.isInteger(count) && count >= 0)) {
      setShiftFormError('Số lượng nhân viên phải là số nguyên không âm');
      return;
    }
    if (managerCount + userCount + kitchenCount <= 0) {
      setShiftFormError('Cần ít nhất một vị trí trong ca');
      return;
    }

    setShiftSubmitting(true);
    setShiftFormError('');
    try {
      await createWorkShift({
        name,
        startAt,
        endAt,
        requiredStaffByRole: {
          MANAGER: managerCount,
          USER: userCount,
          KITCHEN: kitchenCount,
        },
      });
      setShiftName('');
      setShiftStart('');
      setShiftEnd('');
      setShiftManagers('0');
      setShiftUsers('0');
      setShiftKitchen('0');
      void fetchAttendanceData(true);
    } catch (err: any) {
      setShiftFormError(err.response?.data?.message || 'Không thể tạo ca làm');
    } finally {
      setShiftSubmitting(false);
    }
  }, [canCreateShift, fetchAttendanceData, shiftEnd, shiftKitchen, shiftManagers, shiftName, shiftStart, shiftUsers]);

  const handleReviewShift = useCallback((shift: WorkShift, status: 'APPROVED' | 'REJECTED') => {
    if (!canReviewShift) return;
    runConfirmedAction({
      title: status === 'APPROVED' ? 'Duyệt ca làm' : 'Từ chối ca làm',
      message: `${status === 'APPROVED' ? 'Duyệt' : 'Từ chối'} ca ${shift.name}?`,
      confirmText: 'Đồng ý',
      onConfirm: async () => {
        try {
          await reviewWorkShift(shift._id, status);
          void fetchAttendanceData(true);
        } catch (err: any) {
          Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật ca làm');
        }
      },
    });
  }, [canReviewShift, fetchAttendanceData]);

  const handleReviewCancel = useCallback((registrationId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!canReviewShiftCancellation) return;
    runConfirmedAction({
      title: status === 'APPROVED' ? 'Duyệt hủy ca' : 'Từ chối hủy ca',
      message: status === 'APPROVED' ? 'Duyệt hủy ca thành nghỉ phép?' : 'Từ chối yêu cầu hủy ca?',
      confirmText: 'Đồng ý',
      onConfirm: async () => {
        try {
          await reviewShiftCancellation(registrationId, status);
          void fetchAttendanceData(true);
        } catch (err: any) {
          Alert.alert('Lỗi', err.response?.data?.message || 'Không thể xử lý yêu cầu hủy ca');
        }
      },
    });
  }, [canReviewShiftCancellation, fetchAttendanceData]);

  const closeDetail = useCallback(() => {
    setDetailUser(null);
    setDetailData(null);
    setDetailError('');
    setEditingRecordId('');
    setEditCheckIn('');
    setEditCheckOut('');
    setEditError('');
  }, []);

  const loadMonthlyDetail = useCallback(async (targetUser: DailyAttendanceRow, month: string) => {
    const targetUserId = getAttendanceUserId(targetUser);
    if (!targetUserId) {
      setDetailError('Không xác định được userId nhân viên');
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      setDetailError('Tháng không hợp lệ. Định dạng đúng: YYYY-MM');
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await getMonthlyAttendance(targetUserId, month);
      setDetailData(data);
    } catch (err: any) {
      setDetailError(err.response?.data?.message || 'Không thể tải chi tiết chấm công theo tháng');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = useCallback((member: DailyAttendanceRow) => {
    const month = getMonthFromDateInput(appliedDate);
    setDetailUser(member);
    setDetailMonth(month);
    setDetailData(null);
    setEditingRecordId('');
    setEditCheckIn('');
    setEditCheckOut('');
    setEditError('');
    void loadMonthlyDetail(member, month);
  }, [appliedDate, loadMonthlyDetail]);

  const openEditAttendance = useCallback((record: NonNullable<MonthlyAttendanceData['records']>[number]) => {
    const attendanceId = record.attendanceId || record._id;
    if (!attendanceId || !record.attendanceId) {
      setEditError('Chỉ điều chỉnh được bản ghi đã có check-in');
      return;
    }
    setEditingRecordId(attendanceId);
    setEditCheckIn(toDateTimeInputValue(record.checkInTime));
    setEditCheckOut(toDateTimeInputValue(record.checkOutTime));
    setEditError('');
  }, []);

  const submitEditAttendance = useCallback(async () => {
    if (!canEditAttendance) {
      setEditError('Máy chủ chỉ cho phép admin điều chỉnh chấm công');
      return;
    }
    if (!editingRecordId || !detailUser) {
      setEditError('Không tìm thấy bản ghi cần điều chỉnh');
      return;
    }

    const checkInInput = editCheckIn.trim();
    const checkOutInput = editCheckOut.trim();
    const checkInIso = checkInInput ? parseDateTimeInputToIso(checkInInput) : null;
    const checkOutIso = checkOutInput ? parseDateTimeInputToIso(checkOutInput) : null;

    if (checkInInput && !checkInIso) {
      setEditError('Giờ check-in không hợp lệ. Định dạng: YYYY-MM-DD HH:mm');
      return;
    }
    if (checkOutInput && !checkOutIso) {
      setEditError('Giờ check-out không hợp lệ. Định dạng: YYYY-MM-DD HH:mm');
      return;
    }
    if (!checkInIso && !checkOutIso) {
      setEditError('Cần nhập ít nhất một trường check-in/check-out');
      return;
    }
    if (checkInIso && checkOutIso && new Date(checkOutIso).getTime() <= new Date(checkInIso).getTime()) {
      setEditError('Giờ check-out phải sau giờ check-in');
      return;
    }

    setEditSubmitting(true);
    setEditError('');
    try {
      await editAttendanceRecord(editingRecordId, {
        checkInTime: checkInIso || undefined,
        checkOutTime: checkOutIso || undefined,
      });
      Alert.alert('Thành công', 'Đã cập nhật bản ghi chấm công');
      setEditingRecordId('');
      setEditCheckIn('');
      setEditCheckOut('');
      await loadMonthlyDetail(detailUser, detailMonth);
      void fetchAttendanceData(true);
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Không thể điều chỉnh chấm công');
    } finally {
      setEditSubmitting(false);
    }
  }, [canEditAttendance, detailMonth, detailUser, editCheckIn, editCheckOut, editingRecordId, fetchAttendanceData, loadMonthlyDetail]);

  if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình chấm công." />
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

    if (statusFilter !== 'ALL') {
      const primary = getAttendancePrimaryStatus(row);
      const punctual = getAttendancePunctualStatus(row);

      if ((statusFilter === 'COMPLETED' || statusFilter === 'MISSING_CHECKOUT' || statusFilter === 'ABSENT' || statusFilter === 'ON_LEAVE') && primary !== statusFilter) {
        return false;
      }
      if ((statusFilter === 'LATE' || statusFilter === 'ON_TIME') && punctual !== statusFilter) {
        return false;
      }
    }

    if (!keyword) return true;
    const searchable = `${row.name || ''} ${row.email || ''} ${row.role || ''}`.toLowerCase();
    return searchable.includes(keyword);
  });

  const completedCount = rows.filter((row) => getAttendancePrimaryStatus(row) === 'COMPLETED').length;
  const workingCount = rows.filter((row) => getAttendancePrimaryStatus(row) === 'MISSING_CHECKOUT').length;
  const lateCount = rows.filter((row) => getAttendancePunctualStatus(row) === 'LATE').length;
  const absentCount = rows.filter((row) => getAttendancePrimaryStatus(row) === 'ABSENT').length;

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchAttendanceData(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quản lý chấm công</Text>

          <View style={[styles.glassCard, styles.formCard]}>
            <Text style={styles.sectionTitle}>Bảng chia ca</Text>
            {shiftFormError ? <Text style={styles.errorText}>{shiftFormError}</Text> : null}
            {canCreateShift ? (
              <>
                <TextInput
                  placeholder="Tên ca làm"
                  value={shiftName}
                  onChangeText={setShiftName}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Giờ bắt đầu (YYYY-MM-DD HH:mm)"
                  value={shiftStart}
                  onChangeText={setShiftStart}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Giờ kết thúc (YYYY-MM-DD HH:mm)"
                  value={shiftEnd}
                  onChangeText={setShiftEnd}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                />
                <View style={styles.rowSplit}>
                  <TextInput
                    placeholder="Quản lý"
                    value={shiftManagers}
                    onChangeText={setShiftManagers}
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.input, styles.flex1]}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    placeholder="Nhân viên"
                    value={shiftUsers}
                    onChangeText={setShiftUsers}
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.input, styles.flex1]}
                    keyboardType="number-pad"
                  />
                  <TextInput
                    placeholder="Bếp"
                    value={shiftKitchen}
                    onChangeText={setShiftKitchen}
                    placeholderTextColor={COLORS.textMuted}
                    style={[styles.input, styles.flex1]}
                    keyboardType="number-pad"
                  />
                </View>
                <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={() => void submitCreateShift()}>
                  {shiftSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Tạo ca làm</Text>}
                </TouchableOpacity>
                <Text style={styles.helperText}>
                  Admin tạo ca sẽ được duyệt ngay. Quản lý tạo ca sẽ chờ admin duyệt.
                </Text>
              </>
            ) : null}

            {workShifts.length === 0 ? (
              <EmptyStateView message="Chưa có ca làm trong ngày đã chọn." />
            ) : (
              workShifts.map((shift) => (
                <View key={shift._id} style={[styles.glassCard, styles.staffCard]}>
                  <Text style={styles.staffName}>{shift.name}</Text>
                  <Text style={styles.staffMeta}>Bắt đầu: {formatDateTime(shift.startAt)}</Text>
                  <Text style={styles.staffMeta}>Kết thúc: {formatDateTime(shift.endAt)}</Text>
                  <Text style={styles.staffMeta}>Trạng thái: {getShiftStatusLabel(shift.status)}</Text>
                  <Text style={styles.staffMeta}>
                    Cần: Quản lý {shift.requiredStaffByRole?.MANAGER || 0}; Nhân viên {shift.requiredStaffByRole?.USER || 0}; Bếp {shift.requiredStaffByRole?.KITCHEN || 0}
                  </Text>
                  <Text style={styles.staffMeta}>
                    Đã đăng ký: Quản lý {shift.registeredStaffByRole?.MANAGER || 0}; Nhân viên {shift.registeredStaffByRole?.USER || 0}; Bếp {shift.registeredStaffByRole?.KITCHEN || 0}
                  </Text>
                  {shift.status === 'PENDING_APPROVAL' && canReviewShift ? (
                    <View style={styles.rowSplit}>
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => handleReviewShift(shift, 'APPROVED')}>
                        <Text style={styles.buttonText}>Duyệt ca</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => handleReviewShift(shift, 'REJECTED')}>
                        <Text style={styles.buttonText}>Từ chối</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>

          <View style={styles.metricGrid}>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Đang làm</Text>
              <Text style={styles.metricValue}>{workingCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Đã hoàn thành</Text>
              <Text style={styles.metricValue}>{completedCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Đi trễ</Text>
              <Text style={styles.metricValue}>{lateCount}</Text>
            </View>
            <View style={[styles.glassCard, styles.metricCard]}>
              <Text style={styles.metricLabel}>Vắng mặt</Text>
              <Text style={styles.metricValue}>{absentCount}</Text>
            </View>
          </View>

          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Ngày lọc (YYYY-MM-DD)"
              value={dateFilter}
              onChangeText={setDateFilter}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <View style={styles.rowSplit}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}
                onPress={() => {
                  const today = getTodayDateInput();
                  setDateFilter(today);
                  setAppliedDate(today);
                  setDetailMonth(getMonthFromDateInput(today));
                }}
              >
                <Text style={styles.buttonText}>Hôm nay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                onPress={() => {
                  const normalizedDate = dateFilter.trim();
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
                    Alert.alert('Ngày không hợp lệ', 'Vui lòng nhập ngày theo định dạng YYYY-MM-DD');
                    return;
                  }
                  setAppliedDate(normalizedDate);
                  setDetailMonth(getMonthFromDateInput(normalizedDate));
                }}
              >
                <Text style={styles.buttonText}>Tải dữ liệu</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Tìm theo tên nhân viên"
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
              {ATTENDANCE_FILTER_OPTIONS.map((option) => {
                const selected = statusFilter === option;
                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.8}
                    style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                    onPress={() => setStatusFilter(option)}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getAttendanceStatusLabel(option)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchAttendanceData()} /> : null}

          {!loadError && filteredRows.length === 0 ? (
            <EmptyStateView message="Danh sách chấm công trong ngày đang trống." />
          ) : (
            filteredRows.map((row) => {
              const primary = getAttendancePrimaryStatus(row);
              const punctual = getAttendancePunctualStatus(row);
              const primaryStyle =
                primary === 'ABSENT' ? styles.statusPending : primary === 'MISSING_CHECKOUT' ? styles.statusLowStock : styles.statusProgress;
              const punctualStyle = punctual === 'LATE' ? styles.statusPending : styles.statusProgress;
              return (
                <View key={`${row.shiftRegistrationId || getAttendanceUserId(row)}-${row.name}`} style={[styles.glassCard, styles.staffCard]}>
                  <View style={styles.staffHeader}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{row.name || 'Nhân viên'}</Text>
                      <Text style={styles.staffMeta}>Vai trò: {getStaffRoleLabel(row.role)}</Text>
                      <Text style={styles.staffMeta}>Ca làm: {row.shiftName || '-'}</Text>
                      <Text style={styles.staffMeta}>Giờ vào ca: {formatDateTime(row.shiftStartAt)}</Text>
                      <Text style={styles.staffMeta}>Giờ kết thúc: {formatDateTime(row.shiftEndAt)}</Text>
                      <Text style={styles.staffMeta}>Đăng ký ca: {getShiftRegistrationStatusLabel(row.registrationStatus)}</Text>
                      <Text style={styles.staffMeta}>Giờ check-in: {formatDateTime(row.checkInTime)}</Text>
                      <Text style={styles.staffMeta}>Giờ check-out: {formatDateTime(row.checkOutTime)}</Text>
                      <Text style={styles.staffMeta}>Tổng giờ làm: {row.totalHours || 0}</Text>
                      <Text style={styles.staffMeta}>Phút đi trễ: {row.lateMinutes || 0}</Text>
                    </View>
                    <View style={styles.staffInfo}>
                      <View style={[styles.statusBadge, primaryStyle]}>
                        <Text style={styles.statusText}>{getAttendanceStatusLabel(primary)}</Text>
                      </View>
                      {punctual !== 'UNKNOWN' ? (
                        <View style={[styles.statusBadge, punctualStyle]}>
                          <Text style={styles.statusText}>{getAttendanceStatusLabel(punctual)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={() => openDetail(row)}>
                    <Text style={styles.buttonText}>Danh sách chấm công</Text>
                  </TouchableOpacity>
                  {row.registrationStatus === 'CANCEL_PENDING' && row.shiftRegistrationId && canReviewShiftCancellation ? (
                    <View style={styles.rowSplit}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                        onPress={() => handleReviewCancel(row.shiftRegistrationId!, 'APPROVED')}
                      >
                        <Text style={styles.buttonText}>Duyệt hủy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[styles.buttonBase, styles.buttonAmber, styles.flex1]}
                        onPress={() => handleReviewCancel(row.shiftRegistrationId!, 'REJECTED')}
                      >
                        <Text style={styles.buttonText}>Từ chối hủy</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {detailUser ? (
            <View style={[styles.glassCard, styles.formCard]}>
              <Text style={styles.sectionTitle}>Chi tiết chấm công: {detailUser.name}</Text>
              <View style={styles.rowSplit}>
                <TextInput
                  placeholder="Tháng (YYYY-MM)"
                  value={detailMonth}
                  onChangeText={setDetailMonth}
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, styles.flex1]}
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.buttonBase, styles.buttonPrimary]}
                  onPress={() => void loadMonthlyDetail(detailUser, detailMonth)}
                >
                  <Text style={styles.buttonText}>Tải chi tiết</Text>
                </TouchableOpacity>
              </View>

              {detailError ? <ErrorStateView message={detailError} onRetry={() => void loadMonthlyDetail(detailUser, detailMonth)} /> : null}
              {detailLoading ? <LoadingView /> : null}

              {!detailLoading && !detailError && detailData ? (
                <>
                  <View style={styles.metricGrid}>
                    <View style={[styles.glassCard, styles.metricCard]}>
                      <Text style={styles.metricLabel}>Tổng ngày làm</Text>
                      <Text style={styles.metricValue}>{detailData.totalWorkedDays || 0}</Text>
                    </View>
                    <View style={[styles.glassCard, styles.metricCard]}>
                      <Text style={styles.metricLabel}>Tổng giờ làm</Text>
                      <Text style={styles.metricValue}>{detailData.totalWorkedHours || 0}</Text>
                    </View>
                    <View style={[styles.glassCard, styles.metricCard]}>
                      <Text style={styles.metricLabel}>Tổng phút đi trễ</Text>
                      <Text style={styles.metricValue}>{detailData.totalLateMinutes || 0}</Text>
                    </View>
                  </View>

                  {!Array.isArray(detailData.records) || detailData.records.length === 0 ? (
                    <EmptyStateView message="Không có bản ghi chấm công trong tháng này." />
                  ) : (
                    detailData.records.map((record) => {
                      const isEditing = editingRecordId === record._id;
                      const statusText =
                        record.status === 'ON_LEAVE'
                          ? 'Nghỉ phép'
                          : !record.checkInTime
                            ? 'Vắng mặt'
                            : record.checkOutTime
                              ? 'Đã hoàn thành'
                              : 'Chưa checkout';

                      return (
                        <View key={record._id} style={[styles.glassCard, styles.staffCard]}>
                          <Text style={styles.staffName}>{new Date(record.date).toLocaleDateString()}</Text>
                          <Text style={styles.staffMeta}>Ca làm: {record.shiftName || '-'}</Text>
                          <Text style={styles.staffMeta}>Giờ vào ca: {formatDateTime(record.shiftStartAt)}</Text>
                          <Text style={styles.staffMeta}>Giờ kết thúc ca: {formatDateTime(record.shiftEndAt)}</Text>
                          <Text style={styles.staffMeta}>Đăng ký ca: {getShiftRegistrationStatusLabel(record.registrationStatus)}</Text>
                          <Text style={styles.staffMeta}>Giờ check-in: {formatDateTime(record.checkInTime)}</Text>
                          <Text style={styles.staffMeta}>Giờ check-out: {formatDateTime(record.checkOutTime)}</Text>
                          <Text style={styles.staffMeta}>Tổng giờ làm: {record.totalHours || 0}</Text>
                          <Text style={styles.staffMeta}>Trạng thái: {statusText}</Text>
                          <Text style={styles.staffMeta}>Đi trễ: {record.lateMinutes || 0} phút</Text>

                          {canEditAttendance && record.attendanceId ? (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              style={[styles.buttonBase, styles.buttonSecondary]}
                              onPress={() => openEditAttendance(record)}
                            >
                              <Text style={styles.buttonText}>Điều chỉnh chấm công</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity activeOpacity={1} disabled style={[styles.buttonBase, styles.buttonSecondary, styles.moduleCardDisabled]}>
                              <Text style={styles.buttonText}>Cần quyền ADMIN để điều chỉnh chấm công</Text>
                            </TouchableOpacity>
                          )}

                          {isEditing ? (
                            <View style={styles.formStack}>
                              {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
                              <TextInput
                                placeholder="Giờ check-in (YYYY-MM-DD HH:mm)"
                                value={editCheckIn}
                                onChangeText={setEditCheckIn}
                                placeholderTextColor={COLORS.textMuted}
                                style={styles.input}
                              />
                              <TextInput
                                placeholder="Giờ check-out (YYYY-MM-DD HH:mm)"
                                value={editCheckOut}
                                onChangeText={setEditCheckOut}
                                placeholderTextColor={COLORS.textMuted}
                                style={styles.input}
                              />
                              <View style={styles.rowSplit}>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]}
                                  onPress={() => {
                                    setEditingRecordId('');
                                    setEditCheckIn('');
                                    setEditCheckOut('');
                                    setEditError('');
                                  }}
                                >
                                  <Text style={styles.buttonText}>Hủy</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  activeOpacity={0.8}
                                  style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                                  onPress={() => void submitEditAttendance()}
                                >
                                  {editSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Lưu điều chỉnh</Text>}
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </>
              ) : null}

              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary]} onPress={closeDetail}>
                <Text style={styles.buttonText}>Đóng chi tiết</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
