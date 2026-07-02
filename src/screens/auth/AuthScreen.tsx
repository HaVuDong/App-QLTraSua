import { useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';

export function AuthScreen({ route }: any) {
  const { 
    handleLogin, handleVerifyDevice, error, loading, requiresOtp, deviceId, resetOtpFlow,
    requestForgotPasswordOtp, verifyForgotPasswordOtp, resetPasswordWithToken 
  } = useAuth();
  const [email, setEmail] = useState(route?.params?.initialEmail || '');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // Forgot Password States
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'none' | 'request' | 'verify' | 'reset'>('none');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [forgotPasswordNewPass, setForgotPasswordNewPass] = useState('');
  const [forgotPasswordConfirmPass, setForgotPasswordConfirmPass] = useState('');
  const [resetToken, setResetToken] = useState('');

  const submitLogin = () => {
    if (!email.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mật khẩu.');
      return;
    }
    void handleLogin(email.trim(), password);
  };

  const submitOtp = () => {
    if (otpCode.trim().length !== 6) {
      Alert.alert('OTP không hợp lệ', 'Vui lòng nhập mã OTP 6 số.');
      return;
    }
    void handleVerifyDevice(otpCode.trim());
  };

  const handleForgotPasswordRequest = async () => {
    if (!forgotPasswordEmail.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email.');
      return;
    }
    try {
      await requestForgotPasswordOtp(forgotPasswordEmail.trim());
      setForgotPasswordStep('verify');
    } catch (err) {
      // Error is handled in context
    }
  };

  const handleForgotPasswordVerify = async () => {
    if (forgotPasswordOtp.trim().length !== 6) {
      Alert.alert('OTP không hợp lệ', 'Vui lòng nhập mã OTP 6 số.');
      return;
    }
    try {
      const token = await verifyForgotPasswordOtp(forgotPasswordEmail.trim(), forgotPasswordOtp.trim());
      setResetToken(token);
      setForgotPasswordStep('reset');
    } catch (err) {
      // Error is handled in context
    }
  };

  const handleForgotPasswordReset = async () => {
    if (forgotPasswordNewPass.length < 8) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (forgotPasswordNewPass !== forgotPasswordConfirmPass) {
      Alert.alert('Không khớp', 'Mật khẩu xác nhận không khớp.');
      return;
    }
    try {
      await resetPasswordWithToken(resetToken, forgotPasswordNewPass);
      // Reset successful, go back to login
      setForgotPasswordStep('none');
      setForgotPasswordEmail('');
      setForgotPasswordOtp('');
      setForgotPasswordNewPass('');
      setForgotPasswordConfirmPass('');
      setResetToken('');
      setPassword(''); // Clear password field for login
      setEmail(forgotPasswordEmail); // Pre-fill login email
    } catch (err) {
      // Error is handled in context
    }
  };

  const cancelForgotPassword = () => {
    setForgotPasswordStep('none');
    setForgotPasswordEmail('');
    setForgotPasswordOtp('');
    setForgotPasswordNewPass('');
    setForgotPasswordConfirmPass('');
    setResetToken('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenBackdrop />
      <View style={[styles.glassCard, styles.authCard]}>
        <View style={styles.authHeader}>
          <Text style={styles.brandTitle}>TRÀ SỮA POS</Text>
          <Text style={styles.brandSubtitle}>Super App Vận Hành</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {forgotPasswordStep === 'request' ? (
          <View style={styles.formStack}>
            <Text style={styles.otpNotice}>Nhập email của bạn để nhận mã khôi phục mật khẩu.</Text>
            <TextInput
              placeholder="Email"
              value={forgotPasswordEmail}
              onChangeText={setForgotPasswordEmail}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={cancelForgotPassword}>
                <Text style={styles.buttonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={handleForgotPasswordRequest}>
                {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Gửi OTP</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : forgotPasswordStep === 'verify' ? (
          <View style={styles.formStack}>
            <Text style={styles.otpNotice}>Nhập mã OTP 6 số được gửi đến {forgotPasswordEmail}.</Text>
            <TextInput
              placeholder="Nhập 6 số OTP"
              value={forgotPasswordOtp}
              onChangeText={setForgotPasswordOtp}
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, styles.inputOtp]}
            />
            <View style={styles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={cancelForgotPassword}>
                <Text style={styles.buttonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={handleForgotPasswordVerify}>
                {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Xác Thực</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : forgotPasswordStep === 'reset' ? (
          <View style={styles.formStack}>
            <Text style={styles.otpNotice}>Thiết lập mật khẩu mới.</Text>
            <TextInput
              placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
              value={forgotPasswordNewPass}
              onChangeText={setForgotPasswordNewPass}
              secureTextEntry
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <TextInput
              placeholder="Xác nhận mật khẩu mới"
              value={forgotPasswordConfirmPass}
              onChangeText={setForgotPasswordConfirmPass}
              secureTextEntry
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <View style={styles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={cancelForgotPassword}>
                <Text style={styles.buttonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={handleForgotPasswordReset}>
                {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Cập Nhật</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : !requiresOtp ? (
          <View style={styles.formStack}>
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              placeholder="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={submitLogin}>
              {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Đăng Nhập</Text>}
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={() => setForgotPasswordStep('request')} style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: COLORS.primary, fontSize: 14 }}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <Text style={styles.helperText}>Device ID: {deviceId || 'Đang khởi tạo...'}</Text>
          </View>
        ) : (
          <View style={styles.formStack}>
            <Text style={styles.otpNotice}>Thiết bị lạ. Nhập mã OTP được gửi đến email tài khoản.</Text>
            <TextInput
              placeholder="Nhập 6 số OTP"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, styles.inputOtp]}
            />
            <View style={styles.rowSplit}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary, styles.flex1]} onPress={resetOtpFlow}>
                <Text style={styles.buttonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary, styles.flex1]} onPress={submitOtp}>
                <Text style={styles.buttonText}>Xác Thực</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
