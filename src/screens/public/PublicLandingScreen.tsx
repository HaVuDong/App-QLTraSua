import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArrowRight, CheckCircle, Coffee, CreditCard, QrCode, Users } from 'lucide-react-native';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import {
  getPublicSaasPlans,
  resendPublicSignupOtp,
  startPublicSignup,
  verifyPublicSignup,
  type SaasPlan,
} from '../../services/publicSignup';
import { styles as appStyles } from '../../styles/appStyles';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../theme';

const FALLBACK_PLANS: SaasPlan[] = [
  {
    id: 'BASIC',
    name: 'Basic',
    priceMonthly: 199000,
    currency: 'VND',
    billingCycle: 'MONTHLY',
    maxTables: 20,
    maxStaff: 8,
    features: ['QR order', 'Quản lý bàn/menu/kho', 'Nhân viên và bếp'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    priceMonthly: 399000,
    currency: 'VND',
    billingCycle: 'MONTHLY',
    maxTables: 60,
    maxStaff: 25,
    features: ['Tất cả Basic', 'Báo cáo nâng cao', 'Thanh toán online'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: 799000,
    currency: 'VND',
    billingCycle: 'MONTHLY',
    maxTables: 150,
    maxStaff: 80,
    features: ['Tất cả Pro', 'Giới hạn lớn hơn', 'Hỗ trợ ưu tiên'],
  },
];

type SignupStep = 'STORE' | 'ADMIN' | 'PLAN' | 'OTP' | 'SUCCESS';

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function normalizeSubdomain(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

export function PublicLandingScreen({ navigation }: any) {
  const [plans, setPlans] = useState<SaasPlan[]>(FALLBACK_PLANS);
  const [signupVisible, setSignupVisible] = useState(false);
  const [step, setStep] = useState<SignupStep>('STORE');
  const [selectedPlan, setSelectedPlan] = useState('BASIC');
  const [storeName, setStoreName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [address, setAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [signupId, setSignupId] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const data = await getPublicSaasPlans();
        if (data.length > 0) setPlans(data);
      } catch (err) {
        setPlans(FALLBACK_PLANS);
      }
    };
    void loadPlans();
  }, []);

  const selectedPlanDetail = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) || plans[0] || FALLBACK_PLANS[0],
    [plans, selectedPlan],
  );

  const openLogin = useCallback(() => {
    navigation.navigate('Auth', { initialEmail: adminEmail.trim().toLowerCase() || undefined });
  }, [adminEmail, navigation]);

  const resetSignup = useCallback(() => {
    setSignupVisible(false);
    setStep('STORE');
    setError('');
    setOtpCode('');
    setSignupId('');
    setDevOtp('');
  }, []);

  const validateStoreStep = useCallback(() => {
    if (!storeName.trim()) return 'Tên cửa hàng là bắt buộc';
    if (!storePhone.trim()) return 'Số điện thoại cửa hàng là bắt buộc';
    if (subdomain.trim() && !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(normalizeSubdomain(subdomain))) {
      return 'Tên miền phụ chỉ gồm chữ thường, số và dấu gạch ngang';
    }
    return '';
  }, [storeName, storePhone, subdomain]);

  const validateAdminStep = useCallback(() => {
    if (!adminName.trim()) return 'Tên admin là bắt buộc';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) return 'Email admin không hợp lệ';
    if (adminPassword.trim().length < 8 || !/[A-Za-z]/.test(adminPassword) || !/\d/.test(adminPassword)) {
      return 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số';
    }
    return '';
  }, [adminEmail, adminName, adminPassword]);

  const goNext = useCallback(() => {
    setError('');
    if (step === 'STORE') {
      const message = validateStoreStep();
      if (message) return setError(message);
      return setStep('ADMIN');
    }
    if (step === 'ADMIN') {
      const message = validateAdminStep();
      if (message) return setError(message);
      return setStep('PLAN');
    }
    return undefined;
  }, [step, validateAdminStep, validateStoreStep]);

  const submitSignup = useCallback(async () => {
    const storeMessage = validateStoreStep();
    const adminMessage = validateAdminStep();
    if (storeMessage || adminMessage) {
      setError(storeMessage || adminMessage);
      return;
    }

    setLoading(true);
    setError('');
    setDevOtp('');
    try {
      const res = await startPublicSignup({
        storeName: storeName.trim(),
        subdomain: normalizeSubdomain(subdomain) || undefined,
        address: address.trim() || undefined,
        phone: storePhone.trim(),
        plan: selectedPlanDetail.id,
        admin: {
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          phone: adminPhone.trim() || undefined,
          password: adminPassword.trim(),
        },
      });
      setSignupId(res.signupId);
      setDevOtp(res.devOtp || '');
      setStep('OTP');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi OTP đăng ký');
    } finally {
      setLoading(false);
    }
  }, [
    address,
    adminEmail,
    adminName,
    adminPassword,
    adminPhone,
    selectedPlanDetail.id,
    storeName,
    storePhone,
    subdomain,
    validateAdminStep,
    validateStoreStep,
  ]);

  const verifyOtp = useCallback(async () => {
    if (!signupId) return;
    if (otpCode.trim().length !== 6) {
      setError('Vui lòng nhập mã OTP 6 số');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await verifyPublicSignup(signupId, otpCode.trim());
      setTrialEndsAt(res.trialEndsAt);
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể xác minh OTP');
    } finally {
      setLoading(false);
    }
  }, [otpCode, signupId]);

  const resendOtp = useCallback(async () => {
    if (!signupId) return;
    setLoading(true);
    setError('');
    try {
      const res = await resendPublicSignupOtp(signupId);
      setDevOtp(res.devOtp || '');
      Alert.alert('Đã gửi lại OTP', 'Vui lòng kiểm tra email admin.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi lại OTP');
    } finally {
      setLoading(false);
    }
  }, [signupId]);

  return (
    <View style={appStyles.screenContainer}>
      <ScreenBackdrop />
      <ScrollView style={appStyles.screenScroll} contentContainerStyle={localStyles.content} showsVerticalScrollIndicator={false}>
        <View style={localStyles.shell}>
          <View style={[appStyles.glassCard, localStyles.heroCard]}>
            <View style={localStyles.heroTop}>
              <View style={localStyles.logoBox}>
                <Coffee color={COLORS.background} size={28} />
              </View>
              <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonSecondary, localStyles.loginButton]} onPress={openLogin}>
                <Text style={appStyles.buttonText}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
            <Text style={appStyles.brandTitle}>TRÀ SỮA POS</Text>
            <Text style={appStyles.brandSubtitle}>Nền tảng vận hành quán trà sữa theo mô hình SaaS</Text>
            <Text style={localStyles.heroText}>
              Nhận order bằng QR, tách luồng nhân viên - bếp, quản lý kho/menu/bàn và theo dõi thanh toán trong một hệ thống thống nhất.
            </Text>
            <View style={appStyles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonPrimary, appStyles.flex1]} onPress={() => setSignupVisible(true)}>
                <Text style={appStyles.buttonText}>Đăng ký cửa hàng</Text>
                <ArrowRight color={COLORS.text} size={18} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonSecondary, appStyles.flex1]} onPress={openLogin}>
                <Text style={appStyles.buttonText}>Tôi đã có tài khoản</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={localStyles.featureGrid}>
            {[
              { icon: QrCode, title: 'QR order', desc: 'Khách quét bàn, gọi món và theo dõi trạng thái.' },
              { icon: Users, title: 'Phân quyền', desc: 'Admin, nhân viên, bếp và System Owner tách rõ.' },
              { icon: CreditCard, title: 'Thanh toán', desc: 'Hỗ trợ thanh toán bàn và phí SaaS qua payOS.' },
              { icon: CheckCircle, title: 'Vận hành', desc: 'Bàn, menu, kho, chấm công và báo cáo trong một app.' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <View key={item.title} style={[appStyles.glassCard, localStyles.featureCard]}>
                  <View style={localStyles.featureIcon}>
                    <Icon color={COLORS.primaryLight} size={22} />
                  </View>
                  <Text style={localStyles.cardTitle}>{item.title}</Text>
                  <Text style={localStyles.cardDesc}>{item.desc}</Text>
                </View>
              );
            })}
          </View>

          <Text style={appStyles.sectionTitle}>Bảng giá</Text>
          <View style={localStyles.planGrid}>
            {plans.map((plan) => {
              const active = selectedPlan === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.85}
                  style={[appStyles.glassCard, localStyles.planCard, active ? localStyles.planCardActive : null]}
                  onPress={() => {
                    setSelectedPlan(plan.id);
                    setSignupVisible(true);
                    setStep('PLAN');
                  }}
                >
                  <Text style={localStyles.planName}>{plan.name}</Text>
                  <Text style={localStyles.planPrice}>{formatMoney(plan.priceMonthly)} / tháng</Text>
                  <Text style={localStyles.cardDesc}>{plan.maxTables} bàn · {plan.maxStaff} tài khoản</Text>
                  {(plan.features || []).map((feature) => (
                    <Text key={feature} style={localStyles.featureLine}>✓ {feature}</Text>
                  ))}
                </TouchableOpacity>
              );
            })}
          </View>

          {signupVisible ? (
            <View style={[appStyles.glassCard, localStyles.signupCard]}>
              <View style={localStyles.signupHeader}>
                <Text style={appStyles.sectionTitle}>Đăng ký cửa hàng</Text>
                <TouchableOpacity activeOpacity={0.8} onPress={resetSignup}>
                  <Text style={localStyles.linkText}>Đóng</Text>
                </TouchableOpacity>
              </View>
              <Text style={appStyles.helperText}>Dùng thử 7 ngày. Sau đó admin có thể gia hạn bằng payOS trong app.</Text>
              {error ? <Text style={appStyles.errorText}>{error}</Text> : null}

              {step === 'STORE' ? (
                <View style={appStyles.formStack}>
                  <TextInput placeholder="Tên cửa hàng" value={storeName} onChangeText={setStoreName} placeholderTextColor={COLORS.textMuted} style={appStyles.input} />
                  <TextInput placeholder="Tên miền phụ (tùy chọn)" value={subdomain} onChangeText={(value) => setSubdomain(normalizeSubdomain(value))} placeholderTextColor={COLORS.textMuted} style={appStyles.input} autoCapitalize="none" />
                  <TextInput placeholder="Số điện thoại cửa hàng" value={storePhone} onChangeText={setStorePhone} placeholderTextColor={COLORS.textMuted} style={appStyles.input} keyboardType="phone-pad" />
                  <TextInput placeholder="Địa chỉ (tùy chọn)" value={address} onChangeText={setAddress} placeholderTextColor={COLORS.textMuted} style={appStyles.input} />
                  <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonPrimary]} onPress={goNext}>
                    <Text style={appStyles.buttonText}>Tiếp tục</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {step === 'ADMIN' ? (
                <View style={appStyles.formStack}>
                  <TextInput placeholder="Tên admin" value={adminName} onChangeText={setAdminName} placeholderTextColor={COLORS.textMuted} style={appStyles.input} />
                  <TextInput placeholder="Email admin" value={adminEmail} onChangeText={setAdminEmail} placeholderTextColor={COLORS.textMuted} style={appStyles.input} autoCapitalize="none" keyboardType="email-address" />
                  <TextInput placeholder="Số điện thoại admin (tùy chọn)" value={adminPhone} onChangeText={setAdminPhone} placeholderTextColor={COLORS.textMuted} style={appStyles.input} keyboardType="phone-pad" />
                  <TextInput placeholder="Mật khẩu admin" value={adminPassword} onChangeText={setAdminPassword} secureTextEntry placeholderTextColor={COLORS.textMuted} style={appStyles.input} />
                  <View style={appStyles.rowSplit}>
                    <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonSecondary, appStyles.flex1]} onPress={() => setStep('STORE')}>
                      <Text style={appStyles.buttonText}>Quay lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonPrimary, appStyles.flex1]} onPress={goNext}>
                      <Text style={appStyles.buttonText}>Tiếp tục</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {step === 'PLAN' ? (
                <View style={appStyles.formStack}>
                  <View style={localStyles.planGrid}>
                    {plans.map((plan) => {
                      const active = selectedPlan === plan.id;
                      return (
                        <TouchableOpacity key={plan.id} activeOpacity={0.85} style={[localStyles.miniPlan, active ? localStyles.planCardActive : null]} onPress={() => setSelectedPlan(plan.id)}>
                          <Text style={localStyles.planName}>{plan.name}</Text>
                          <Text style={localStyles.cardDesc}>{formatMoney(plan.priceMonthly)} / tháng</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={appStyles.rowSplit}>
                    <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonSecondary, appStyles.flex1]} onPress={() => setStep('ADMIN')}>
                      <Text style={appStyles.buttonText}>Quay lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonPrimary, appStyles.flex1]} onPress={() => void submitSignup()}>
                      {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={appStyles.buttonText}>Gửi OTP</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {step === 'OTP' ? (
                <View style={appStyles.formStack}>
                  <Text style={appStyles.otpNotice}>Nhập mã OTP được gửi đến {adminEmail.trim().toLowerCase()}</Text>
                  {devOtp ? <Text style={appStyles.helperText}>DEV OTP: {devOtp}</Text> : null}
                  <TextInput placeholder="Nhập 6 số OTP" value={otpCode} onChangeText={setOtpCode} keyboardType="numeric" maxLength={6} placeholderTextColor={COLORS.textMuted} style={[appStyles.input, appStyles.inputOtp]} />
                  <View style={appStyles.rowSplit}>
                    <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonSecondary, appStyles.flex1]} onPress={() => void resendOtp()}>
                      <Text style={appStyles.buttonText}>Gửi lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonPrimary, appStyles.flex1]} onPress={() => void verifyOtp()}>
                      {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={appStyles.buttonText}>Xác minh</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {step === 'SUCCESS' ? (
                <View style={appStyles.formStack}>
                  <Text style={localStyles.successText}>Cửa hàng đã được tạo thành công.</Text>
                  <Text style={appStyles.helperText}>
                    Trial kết thúc: {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('vi-VN') : '7 ngày tới'}
                  </Text>
                  <TouchableOpacity activeOpacity={0.8} style={[appStyles.buttonBase, appStyles.buttonPrimary]} onPress={openLogin}>
                    <Text style={appStyles.buttonText}>Đăng nhập admin</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxxl,
  },
  shell: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    rowGap: SPACING.xl,
  },
  heroCard: {
    rowGap: SPACING.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  loginButton: {
    minWidth: 128,
  },
  heroText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSoft,
    lineHeight: 25,
    maxWidth: 760,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  } as any,
  featureCard: {
    flexGrow: 1,
    flexBasis: 240,
    rowGap: SPACING.sm,
  } as any,
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  cardTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
    fontWeight: '800',
  },
  cardDesc: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  } as any,
  planCard: {
    flexGrow: 1,
    flexBasis: 280,
    rowGap: SPACING.sm,
  } as any,
  planCardActive: {
    borderColor: 'rgba(52,211,153,0.6)',
    ...SHADOWS.glowGreen,
  },
  planName: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text,
    fontWeight: '900',
  },
  planPrice: {
    ...TYPOGRAPHY.title,
    color: COLORS.primaryLight,
  },
  featureLine: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSoft,
  },
  signupCard: {
    rowGap: SPACING.md,
  },
  signupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
  },
  linkText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primaryLight,
    fontWeight: '800',
  },
  miniPlan: {
    flexGrow: 1,
    flexBasis: 160,
    padding: SPACING.lg,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
    rowGap: SPACING.xs,
  } as any,
  successText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primaryLight,
    textAlign: 'center',
    fontWeight: '900',
  },
});
