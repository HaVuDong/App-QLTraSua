import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { SHIFT_ROLES } from '../../constants/roles';
import { cancelShiftRegistration, checkInShift, checkOutShift, getMyShifts, registerShift, type WorkShift } from '../../services/attendance';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { getShiftRegistrationStatusLabel } from '../../utils/displayLabels';
import { formatDateTime } from '../../utils/format';

export function ShiftScreen() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  const fetchMyShifts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const from = `${dateFilter}T00:00:00.000Z`;
      const toDate = new Date(`${dateFilter}T00:00:00.000Z`);
      toDate.setDate(toDate.getDate() + 7);
      const rows = await getMyShifts({ from, to: toDate.toISOString() });
      setShifts(rows);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải danh sách ca làm');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    void fetchMyShifts();
  }, [fetchMyShifts]);

  const handleShiftAction = useCallback(
    (shift: WorkShift, action: 'register' | 'cancel' | 'checkin' | 'checkout') => {
      const registrationId = shift.myRegistration?._id;
      const actionLabel =
        action === 'register' ? 'đăng ký ca' : action === 'cancel' ? 'hủy ca' : action === 'checkin' ? 'vào ca' : 'ra ca';
      runConfirmedAction({
        title: `Xác nhận ${actionLabel}`,
        message: `Bạn muốn ${actionLabel} ${shift.name}?`,
        confirmText: 'Đồng ý',
        onConfirm: async () => {
          try {
            if (action === 'register') {
              await registerShift(shift._id);
            } else if (action === 'cancel') {
              if (!registrationId) throw new Error('Không tìm thấy đăng ký ca');
              await cancelShiftRegistration(registrationId, 'Nhân viên tự hủy ca');
            } else if (action === 'checkin') {
              await checkInShift(registrationId);
            } else {
              await checkOutShift(registrationId);
            }
            Alert.alert('Thành công', `Đã ${actionLabel}`);
            void fetchMyShifts(true);
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Có lỗi xảy ra');
          }
        },
      });
    },
    [fetchMyShifts],
  );

  if (!user || !SHIFT_ROLES.includes(user.role)) {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình ca làm." />
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

  return (
    <View style={styles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchMyShifts(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Điểm danh ca làm việc</Text>
          <View style={[styles.glassCard, styles.inventoryToolbar]}>
            <TextInput
              placeholder="Ngày bắt đầu (YYYY-MM-DD)"
              value={dateFilter}
              onChangeText={setDateFilter}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={() => void fetchMyShifts(true)}>
              <Text style={styles.buttonText}>Tải ca làm</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>Ca có thể đăng ký / ca của tôi</Text>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchMyShifts()} /> : null}

          {!loadError && shifts.length === 0 ? (
            <EmptyStateView message="Chưa có ca làm nào trong khoảng thời gian này." />
          ) : (
            shifts.map((shift) => {
              const registration = shift.myRegistration;
              const registered = !!registration && ['REGISTERED', 'CANCEL_PENDING'].includes(registration.status);
              const statusText = getShiftRegistrationStatusLabel(registration?.status || 'CHUA_DANG_KY');
              const registeredForRole = user?.role ? shift.registeredStaffByRole?.[user.role as keyof typeof shift.registeredStaffByRole] || 0 : 0;
              const requiredForRole = user?.role ? shift.requiredStaffByRole?.[user.role as keyof typeof shift.requiredStaffByRole] || 0 : 0;
              const slotFull = requiredForRole > 0 && registeredForRole >= requiredForRole && !registered;
              return (
                <View key={shift._id} style={[styles.glassCard, styles.staffCard]}>
                  <Text style={styles.staffName}>{shift.name}</Text>
                  <Text style={styles.staffMeta}>Bắt đầu: {formatDateTime(shift.startAt)}</Text>
                  <Text style={styles.staffMeta}>Kết thúc: {formatDateTime(shift.endAt)}</Text>
                  <Text style={styles.staffMeta}>Trạng thái đăng ký: {statusText}</Text>
                  <Text style={styles.staffMeta}>
                    Vị trí của bạn: {registeredForRole}/{requiredForRole}
                  </Text>

                  {!registration ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={slotFull}
                      style={[styles.buttonBase, slotFull ? styles.buttonSecondary : styles.buttonPrimary, slotFull ? styles.moduleCardDisabled : null]}
                      onPress={() => handleShiftAction(shift, 'register')}
                    >
                      <Text style={styles.buttonText}>{slotFull ? 'Ca đã đủ người' : 'Đăng ký ca'}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {registration?.status === 'REGISTERED' || registration?.status === 'CANCEL_PENDING' ? (
                    <>
                      <View style={styles.rowSplit}>
                        <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => handleShiftAction(shift, 'checkin')}>
                          <Text style={styles.buttonText}>Vào ca</Text>
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonAmber, styles.flex1]} onPress={() => handleShiftAction(shift, 'checkout')}>
                          <Text style={styles.buttonText}>Ra ca</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary]} onPress={() => handleShiftAction(shift, 'cancel')}>
                        <Text style={styles.buttonText}>{registration.status === 'CANCEL_PENDING' ? 'Đang chờ duyệt hủy ca' : 'Hủy ca'}</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
