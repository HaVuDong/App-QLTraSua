import { useState } from 'react';
import { ActivityIndicator, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { ScreenBackdrop } from '../../components/common/ScreenBackdrop';
import { styles } from '../../styles/appStyles';
import { COLORS } from '../../theme';

export function ChangePasswordScreen() {
  const { handleChangePassword, handlePasswordChangeCancel, error, loading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const onSubmit = () => {
    setLocalError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setLocalError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp');
      return;
    }

    void handleChangePassword(currentPassword, newPassword);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScreenBackdrop />
      <View style={[styles.glassCard, styles.authCard]}>
        <View style={styles.authHeader}>
          <Text style={styles.brandTitle}>ĐỔI MẬT KHẨU</Text>
          <Text style={styles.brandSubtitle}>Bạn cần đổi mật khẩu trước khi tiếp tục</Text>
        </View>

        {error || localError ? <Text style={styles.errorText}>{localError || error}</Text> : null}

        <View style={styles.formStack}>
          <TextInput
            placeholder="Mật khẩu hiện tại"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          <TextInput
            placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          <TextInput
            placeholder="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />

          <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonPrimary]} onPress={onSubmit}>
            {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.buttonText}>Xác Nhận Đổi Mật Khẩu</Text>}
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} style={[styles.buttonBase, styles.buttonSecondary]} onPress={() => void handlePasswordChangeCancel()}>
            <Text style={styles.buttonText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
