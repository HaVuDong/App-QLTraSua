import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StatusBar, View } from 'react-native';
import { io } from 'socket.io-client';
import { LoadingView } from '../components/StateViews';
import { ScreenBackdrop } from '../components/common/ScreenBackdrop';
import { API_BASE_URL } from '../config/api';
import { api, attachApiInterceptors, setApiToken } from '../services/api';
import { clearAccessToken, getOrCreateDeviceId, loadAccessToken, saveAccessToken } from '../storage/session';
import { styles } from '../styles/appStyles';
import type { SessionUser } from '../types/auth';
import { isTokenExpired, parseJwt, userFromTokenPayload } from '../utils/jwt';
import { VALID_ROLES } from '../constants/roles';
import { AuthContext, type AuthContextValue } from './AuthContext';

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [deviceId, setDeviceId] = useState('');

  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [verifyUserId, setVerifyUserId] = useState('');
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [socketReady, setSocketReady] = useState(false);

  const socketRef = useRef<any>(null);
  const unauthorizedHandledRef = useRef(false);

  const resetOtpFlow = useCallback(() => {
    setRequiresOtp(false);
    setVerifyUserId('');
    setError('');
  }, []);

  const cleanSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketReady(false);
  }, []);

  const resetAuthState = useCallback(() => {
    setToken('');
    setUser(null);
    setRequiresOtp(false);
    setVerifyUserId('');
    setRequiresPasswordChange(false);
    setTempToken('');
    setError('');
    setApiToken('');
    setSocketReady(false);
  }, []);

  const handleLogout = useCallback(async () => {
    cleanSocket();
    resetAuthState();
    unauthorizedHandledRef.current = false;
    await clearAccessToken();
  }, [cleanSocket, resetAuthState]);

  const applyAccessToken = useCallback(async (nextToken: string, persist: boolean) => {
    const payload = parseJwt(nextToken);
    if (!payload || isTokenExpired(payload)) {
      throw new Error('Token không hợp lệ hoặc đã hết hạn');
    }

    const nextUser = userFromTokenPayload(payload);
    if (!nextUser || !VALID_ROLES.includes(nextUser.role)) {
      throw new Error('Role không hợp lệ');
    }

    setToken(nextToken);
    setUser(nextUser);
    setApiToken(nextToken);

    if (persist) {
      await saveAccessToken(nextToken);
    }
  }, []);

  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) return;
    unauthorizedHandledRef.current = true;

    void (async () => {
      await handleLogout();
      Alert.alert('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.');
    })();
  }, [handleLogout]);

  useEffect(() => {
    const detach = attachApiInterceptors(handleUnauthorized);
    return detach;
  }, [handleUnauthorized]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [savedToken, nextDeviceId] = await Promise.all([loadAccessToken(), getOrCreateDeviceId()]);
        if (!mounted) return;

        setDeviceId(nextDeviceId);

        if (!savedToken) {
          setBootstrapping(false);
          return;
        }

        const payload = parseJwt(savedToken);
        const restoredUser = payload ? userFromTokenPayload(payload) : null;
        if (!payload || isTokenExpired(payload) || !restoredUser) {
          await clearAccessToken();
          setBootstrapping(false);
          return;
        }

        setToken(savedToken);
        setUser(restoredUser);
        setApiToken(savedToken);
      } catch {
        await clearAccessToken();
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !user) {
      cleanSocket();
      return;
    }

    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    setSocketReady(true);

    socket.on('connect', () => {
      if (user.tenantId) {
        socket.emit('register', { tenantId: user.tenantId, userId: user.userId });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [token, user, cleanSocket]);

  const handleLogin = useCallback(
    async (email: string, pass: string) => {
      if (!deviceId) {
        setError('Đang khởi tạo thiết bị. Vui lòng thử lại.');
        return;
      }

      setError('');
      setLoading(true);

      try {
        const res = await api.post('/auth/login', {
          email: email || undefined,
          password: pass,
          deviceId,
        });

        if (res.data.requiresDeviceVerification) {
          setRequiresOtp(true);
          setVerifyUserId(res.data.userId);
          setError(res.data.devOtp ? `Thiết bị mới. Dev OTP: ${res.data.devOtp}` : 'Thiết bị mới. Vui lòng kiểm tra email để lấy mã OTP.');
          return;
        }

        if (res.data.requiresPasswordChange) {
          setRequiresPasswordChange(true);
          setTempToken(res.data.tempToken || '');
          return;
        }

        if (!res.data.access_token) {
          throw new Error('Không nhận được access token');
        }

        await applyAccessToken(res.data.access_token, true);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Đăng nhập thất bại.');
      } finally {
        setLoading(false);
      }
    },
    [applyAccessToken, deviceId],
  );

  const handleVerifyDevice = useCallback(
    async (otpCode: string) => {
      if (!verifyUserId) {
        setError('Không tìm thấy thông tin xác thực thiết bị.');
        return;
      }

      setError('');
      setLoading(true);

      try {
        const res = await api.post('/auth/verify-device', { userId: verifyUserId, otpCode, deviceId });

        if (res.data.requiresPasswordChange) {
          setRequiresPasswordChange(true);
          setTempToken(res.data.tempToken || '');
          resetOtpFlow();
          return;
        }

        if (!res.data.access_token) {
          throw new Error('Không nhận được access token');
        }

        await applyAccessToken(res.data.access_token, true);
        resetOtpFlow();
      } catch (err: any) {
        setError(err.response?.data?.message || 'OTP không hợp lệ.');
      } finally {
        setLoading(false);
      }
    },
    [verifyUserId, deviceId, applyAccessToken, resetOtpFlow],
  );

  const handleChangePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!tempToken) {
        setError('Phiên đổi mật khẩu đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }

      setError('');
      setLoading(true);

      try {
        const res = await api.post(
          '/auth/change-password',
          { currentPassword, newPassword },
          { headers: { Authorization: `Bearer ${tempToken}` } },
        );

        setRequiresPasswordChange(false);
        setTempToken('');

        if (!res.data.access_token) {
          throw new Error('Không nhận được access token mới');
        }

        await applyAccessToken(res.data.access_token, true);
        Alert.alert('Thành công', 'Đổi mật khẩu thành công');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Đổi mật khẩu thất bại.');
      } finally {
        setLoading(false);
      }
    },
    [tempToken, applyAccessToken],
  );

  const handlePasswordChangeCancel = useCallback(async () => {
    await handleLogout();
  }, [handleLogout]);

  const authContextValue: AuthContextValue = {
    token,
    user,
    deviceId,
    socketReady,
    socketRef,
    loading,
    error,
    requiresOtp,
    requiresPasswordChange,
    tempToken,
    handleLogin,
    handleVerifyDevice,
    handleChangePassword,
    handlePasswordChangeCancel,
    handleLogout,
    resetOtpFlow,
  };

  if (bootstrapping) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScreenBackdrop />
        <LoadingView />
      </View>
    );
  }

  return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>;
}
