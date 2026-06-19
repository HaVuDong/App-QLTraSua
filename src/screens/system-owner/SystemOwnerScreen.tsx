import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { runConfirmedAction } from '../../components/common/ConfirmAction';
import { EmptyStateView, ErrorStateView, LoadingView, RestrictedStateView } from '../../components/StateViews';
import { api } from '../../services/api';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';
import { getTenantStatusLabel } from '../../utils/displayLabels';
import { formatCurrencyVnd } from '../../utils/format';
import { parseStaffEmail, parseStaffPhone } from '../../utils/staffForms';
type TenantFormStatus = 'ACTIVE' | 'SUSPENDED';

const TENANT_STATUS_OPTIONS: TenantFormStatus[] = ['ACTIVE', 'SUSPENDED'];
const TENANT_PLAN_OPTIONS = ['BASIC', 'PRO', 'ENTERPRISE'];

export function SystemOwnerScreen() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantSubdomain, setTenantSubdomain] = useState('');
  const [tenantAddress, setTenantAddress] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantStatus, setTenantStatus] = useState<TenantFormStatus>('ACTIVE');
  const [tenantPlan, setTenantPlan] = useState('BASIC');
  const [tenantDuration, setTenantDuration] = useState('1');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [creationNote, setCreationNote] = useState('');

  const fetchTenants = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setScreenLoading(true);
      }
      setLoadError('');
      const res = await api.get('/tenants');
      setTenants(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Không thể tải danh sách khách hàng');
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  const resetTenantForm = useCallback(() => {
    setFormVisible(false);
    setTenantName('');
    setTenantSubdomain('');
    setTenantAddress('');
    setTenantPhone('');
    setTenantStatus('ACTIVE');
    setTenantPlan('BASIC');
    setTenantDuration('1');
    setAdminName('');
    setAdminEmail('');
    setAdminPhone('');
    setAdminPassword('');
    setFormError('');
  }, []);

  const submitTenantForm = useCallback(async () => {
    const nextTenantName = tenantName.trim();
    if (!nextTenantName) {
      setFormError('Tên cửa hàng là bắt buộc');
      return;
    }

    const tenantPhoneIdentity = parseStaffPhone(tenantPhone);
    if (!tenantPhone.trim()) {
      setFormError('Số điện thoại cửa hàng là bắt buộc');
      return;
    }
    if (tenantPhoneIdentity.error || !tenantPhoneIdentity.phone) {
      setFormError(tenantPhoneIdentity.error || 'Số điện thoại cửa hàng không hợp lệ');
      return;
    }

    const nextAdminName = adminName.trim();
    if (!nextAdminName) {
      setFormError('Tên admin đầu tiên là bắt buộc');
      return;
    }

    const adminEmailIdentity = parseStaffEmail(adminEmail);
    if (adminEmailIdentity.error || !adminEmailIdentity.email) {
      setFormError(adminEmailIdentity.error || 'Email admin không hợp lệ');
      return;
    }

    const adminPhoneIdentity = parseStaffPhone(adminPhone);
    if (adminPhoneIdentity.error) {
      setFormError(adminPhoneIdentity.error);
      return;
    }

    const durationMonths = Number(tenantDuration);
    if (!Number.isInteger(durationMonths) || durationMonths <= 0) {
      setFormError('Thời hạn gói phải là số tháng lớn hơn 0');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    setCreationNote('');
    try {
      const res = await api.post('/tenants', {
        name: nextTenantName,
        slug: tenantSubdomain.trim() || undefined,
        subdomain: tenantSubdomain.trim() || undefined,
        address: tenantAddress.trim() || undefined,
        phone: tenantPhoneIdentity.phone,
        status: tenantStatus,
        subscriptionPlan: tenantPlan,
        subscriptionDurationMonths: durationMonths,
        ownerName: nextAdminName,
        email: adminEmailIdentity.email,
        admin: {
          name: nextAdminName,
          email: adminEmailIdentity.email,
          phone: adminPhoneIdentity.phone,
          password: adminPassword.trim() || undefined,
        },
      });
      const tempPassword = res.data?.tempPassword;
      setCreationNote(
        tempPassword
          ? `Đã tạo khách hàng và admin mới. Mật khẩu tạm thời: ${tempPassword}`
          : 'Đã tạo khách hàng và admin mới.',
      );
      resetTenantForm();
      void fetchTenants(true);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Không thể tạo khách hàng và admin');
    } finally {
      setFormSubmitting(false);
    }
  }, [
    adminEmail,
    adminName,
    adminPassword,
    adminPhone,
    fetchTenants,
    resetTenantForm,
    tenantAddress,
    tenantDuration,
    tenantName,
    tenantPhone,
    tenantPlan,
    tenantStatus,
    tenantSubdomain,
  ]);

  const toggleTenantLock = useCallback(
    (tenantId: string, status: string) => {
      const isLocked = status === 'SUSPENDED';
      runConfirmedAction({
        title: isLocked ? 'Mở khóa khách hàng' : 'Khóa khách hàng',
        message: isLocked ? 'Bạn muốn mở khóa khách hàng này?' : 'Bạn muốn khóa khách hàng này?',
        confirmText: 'Đồng ý',
        onConfirm: async () => {
          try {
            await api.patch(`/tenants/${tenantId}/${isLocked ? 'unlock' : 'lock'}`);
            void fetchTenants(true);
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật khách hàng');
          }
        },
      });
    },
    [fetchTenants],
  );

  const renewTenant = useCallback(
    (tenant: any) => {
      runConfirmedAction({
        title: 'Gia hạn gói',
        message: `Gia hạn ${tenant.name} thêm 1 tháng?`,
        confirmText: 'Gia hạn',
        onConfirm: async () => {
          try {
            await api.post(`/tenants/${tenant._id}/renew`, {
              months: 1,
              amount: Number(tenant.subscription?.amount || 0),
              performedBy: user?.userId,
              notes: 'Manual renewal from System Owner',
            });
            void fetchTenants(true);
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể gia hạn khách hàng');
          }
        },
      });
    },
    [fetchTenants, user?.userId],
  );

  const resetTenantAdminPassword = useCallback(
    (tenant: any) => {
      runConfirmedAction({
        title: 'Reset mật khẩu admin',
        message: `Tạo mật khẩu tạm thời mới cho admin của ${tenant.name}?`,
        confirmText: 'Reset',
        onConfirm: async () => {
          try {
            const res = await api.post(`/tenants/${tenant._id}/reset-admin-password`);
            Alert.alert('Mật khẩu tạm thời', res.data?.tempPassword || 'Đã reset mật khẩu admin.');
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể reset mật khẩu admin');
          }
        },
      });
    },
    [],
  );

  if (!user || user.role !== 'SYSTEM_OWNER') {
    return (
      <View style={styles.screenContainer}>
        <ScreenBackdrop />
        <RestrictedStateView message="Bạn không có quyền truy cập màn hình SaaS owner." />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void fetchTenants(true)} />}
      >
        <View style={styles.screenStack}>
          <Text style={styles.sectionTitle}>Quản lý khách hàng SaaS</Text>

          <View style={[styles.glassCard, styles.formCard]}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.buttonBase, formVisible ? styles.buttonSecondary : styles.buttonPrimary]}
              onPress={() => {
                setCreationNote('');
                if (formVisible) {
                  resetTenantForm();
                } else {
                  setFormVisible(true);
                  setFormError('');
                }
              }}
            >
              <Text style={styles.buttonText}>{formVisible ? 'Đóng form tạo mới' : 'Tạo khách hàng/Admin mới'}</Text>
            </TouchableOpacity>

            {creationNote ? <Text style={styles.otpNotice}>{creationNote}</Text> : null}

            {formVisible ? (
              <View style={styles.buttonTopSpace}>
                <Text style={styles.helperText}>Thông tin cửa hàng</Text>
                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                <TextInput
                  placeholder="Tên cửa hàng"
                  value={tenantName}
                  onChangeText={setTenantName}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Slug/Tên miền phụ (tùy chọn)"
                  value={tenantSubdomain}
                  onChangeText={setTenantSubdomain}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                />
                <TextInput
                  placeholder="Địa chỉ (tùy chọn)"
                  value={tenantAddress}
                  onChangeText={setTenantAddress}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Số điện thoại cửa hàng"
                  value={tenantPhone}
                  onChangeText={setTenantPhone}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  keyboardType="phone-pad"
                />

                <Text style={styles.helperText}>Trạng thái</Text>
                <View style={styles.filterRow}>
                  {TENANT_STATUS_OPTIONS.map((status) => {
                    const selected = tenantStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        activeOpacity={0.8}
                        style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                        onPress={() => setTenantStatus(status)}
                      >
                        <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{getTenantStatusLabel(status)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.helperText}>Gói đăng ký</Text>
                <View style={styles.filterRow}>
                  {TENANT_PLAN_OPTIONS.map((plan) => {
                    const selected = tenantPlan === plan;
                    return (
                      <TouchableOpacity
                        key={plan}
                        activeOpacity={0.8}
                        style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                        onPress={() => setTenantPlan(plan)}
                      >
                        <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>{plan}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  placeholder="Thời hạn gói (tháng)"
                  value={tenantDuration}
                  onChangeText={setTenantDuration}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  keyboardType="number-pad"
                />

                <Text style={styles.helperText}>ADMIN đầu tiên</Text>
                <TextInput
                  placeholder="Tên admin"
                  value={adminName}
                  onChangeText={setAdminName}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Email tài khoản admin"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  placeholder="Số điện thoại admin (tùy chọn)"
                  value={adminPhone}
                  onChangeText={setAdminPhone}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  keyboardType="phone-pad"
                />
                <TextInput
                  placeholder="Mật khẩu tạm thời (bỏ trống để máy chủ tạo)"
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  secureTextEntry
                />

                <View style={styles.rowSplit}>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetTenantForm}>
                    <Text style={styles.buttonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]}
                    onPress={() => void submitTenantForm()}
                  >
                    {formSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Tạo mới</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>

          {loadError ? <ErrorStateView message={loadError} onRetry={() => void fetchTenants()} /> : null}

          {!loadError && tenants.length === 0 ? (
            <EmptyStateView message="Chưa có khách hàng nào." />
          ) : (
            tenants.map((tenant) => (
              <View key={tenant._id} style={[styles.glassCard, styles.staffCard]}>
                <Text style={styles.bentoTitle}>{tenant.name}</Text>
                <Text style={styles.historyText}>Tên miền phụ: {tenant.subdomain || '-'}</Text>
                <Text style={styles.historyText}>Địa chỉ: {tenant.address || '-'}</Text>
                <Text style={styles.historyText}>Trạng thái: {getTenantStatusLabel(tenant.status)}</Text>
                <Text style={styles.historyText}>Chủ sở hữu: {tenant.ownerName || '-'}</Text>
                <Text style={styles.historyText}>Email admin/khách hàng: {tenant.email || '-'}</Text>
                <Text style={styles.historyText}>
                  Gói: {tenant.subscription?.plan || '-'} · {tenant.subscription?.status || 'ACTIVE'} · {formatCurrencyVnd(Number(tenant.subscription?.amount || 0))}/tháng
                </Text>
                <Text style={styles.historyText}>
                  Hạn dùng: {tenant.subscription?.endDate ? new Date(tenant.subscription.endDate).toLocaleDateString('vi-VN') : '-'}
                  {tenant.subscription?.trialEndsAt ? ` · Trial: ${new Date(tenant.subscription.trialEndsAt).toLocaleDateString('vi-VN')}` : ''}
                </Text>

                {tenant.status === 'DELETED' ? null : (
                  <View style={styles.buttonTopSpace}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.buttonBase, tenant.status === 'SUSPENDED' ? styles.buttonPrimary : styles.buttonAmber]}
                      onPress={() => toggleTenantLock(tenant._id, tenant.status)}
                    >
                      <Text style={styles.buttonText}>{tenant.status === 'SUSPENDED' ? 'Mở khóa khách hàng' : 'Khóa khách hàng'}</Text>
                    </TouchableOpacity>
                    <View style={[styles.rowSplit, styles.buttonTopSpace]}>
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={() => renewTenant(tenant)}>
                        <Text style={styles.buttonText}>Gia hạn 1 tháng</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={() => resetTenantAdminPassword(tenant)}>
                        <Text style={styles.buttonText}>Reset admin</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
