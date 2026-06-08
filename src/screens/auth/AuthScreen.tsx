import { useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';

export function AuthScreen() {
  const { handleLogin, handleVerifyDevice, error, loading, requiresOtp, deviceId, resetOtpFlow } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

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

        {!requiresOtp ? (
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
