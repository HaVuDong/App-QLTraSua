import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, StatusBar, View } from "react-native";
import { io } from "socket.io-client";
import { LoadingView } from "../components/StateViews";
import { ScreenBackdrop } from "../components/common/ScreenBackdrop";
import { API_BASE_URL } from "../config/api";
import { api, attachApiInterceptors, setApiToken } from "../services/api";
import {
  clearAccessToken,
  getOrCreateDeviceId,
  loadAccessToken,
  saveAccessToken,
} from "../storage/session";
import { styles } from "../styles/appStyles";
import type { SessionUser, UserPermission } from "../types/auth";
import { isTokenExpired, parseJwt, userFromTokenPayload } from "../utils/jwt";
import { isUserRole, VALID_ROLES } from "../constants/roles";
import { isUserPermission } from "../utils/permissions";
import { AuthContext, type AuthContextValue } from "./AuthContext";

type AuthProviderProps = {
  children: React.ReactNode;
};

type PermissionSnapshot = {
  userId?: string;
  role?: string;
  tenantId?: string | null;
  effectivePermissions?: unknown;
  permissionVersion?: unknown;
};

function normalizePermissionSnapshot(
  currentUser: SessionUser,
  snapshot: PermissionSnapshot,
) {
  if (!snapshot || snapshot.userId !== currentUser.userId) {
    return currentUser;
  }

  let effectivePermissions: UserPermission[] | undefined;
  if (Array.isArray(snapshot.effectivePermissions)) {
    effectivePermissions =
      snapshot.effectivePermissions.filter(isUserPermission);
  }

  const nextVersion = Number(snapshot.permissionVersion);

  return {
    ...currentUser,
    role: isUserRole(snapshot.role) ? snapshot.role : currentUser.role,
    tenantId: snapshot.tenantId ?? currentUser.tenantId ?? null,
    effectivePermissions:
      effectivePermissions ?? currentUser.effectivePermissions,
    permissionVersion: Number.isFinite(nextVersion)
      ? nextVersion
      : currentUser.permissionVersion,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [deviceId, setDeviceId] = useState("");

  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [verifyUserId, setVerifyUserId] = useState("");
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [socketReady, setSocketReady] = useState(false);

  const socketRef = useRef<any>(null);
  const unauthorizedHandledRef = useRef(false);

  const resetOtpFlow = useCallback(() => {
    setRequiresOtp(false);
    setVerifyUserId("");
    setError("");
  }, []);

  const cleanSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocketReady(false);
  }, []);

  const resetAuthState = useCallback(() => {
    setToken("");
    setUser(null);
    setRequiresOtp(false);
    setVerifyUserId("");
    setRequiresPasswordChange(false);
    setTempToken("");
    setError("");
    setApiToken("");
    setSocketReady(false);
  }, []);

  const handleLogout = useCallback(async () => {
    cleanSocket();
    resetAuthState();
    unauthorizedHandledRef.current = false;
    await clearAccessToken();
  }, [cleanSocket, resetAuthState]);

  const applyAccessToken = useCallback(
    async (nextToken: string, persist: boolean) => {
      const payload = parseJwt(nextToken);
      if (!payload || isTokenExpired(payload)) {
        throw new Error("Token không hợp lệ hoặc đã hết hạn");
      }

      const nextUser = userFromTokenPayload(payload);
      if (!nextUser || !VALID_ROLES.includes(nextUser.role)) {
        throw new Error("Role không hợp lệ");
      }

      setToken(nextToken);
      setUser(nextUser);
      setApiToken(nextToken);

      if (persist) {
        await saveAccessToken(nextToken);
      }

      try {
        const res = await api.get("/auth/me/permissions", {
          headers: { Authorization: `Bearer ${nextToken}` },
        });
        setUser(normalizePermissionSnapshot(nextUser, res.data));
      } catch {
        // JWT permissions keep initial UX responsive; backend guards remain authoritative.
      }
    },
    [],
  );

  const refreshPermissions = useCallback(async () => {
    if (!token) return;
    const res = await api.get("/auth/me/permissions");
    setUser((currentUser) =>
      currentUser
        ? normalizePermissionSnapshot(currentUser, res.data)
        : currentUser,
    );
  }, [token]);

  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) return;
    unauthorizedHandledRef.current = true;

    void (async () => {
      await handleLogout();
      Alert.alert(
        "Phiên đăng nhập đã hết hạn",
        "Vui lòng đăng nhập lại để tiếp tục.",
      );
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
        const [savedToken, nextDeviceId] = await Promise.all([
          loadAccessToken(),
          getOrCreateDeviceId(),
        ]);
        if (!mounted) return;

        setDeviceId(nextDeviceId);

        if (!savedToken) {
          setBootstrapping(false);
          return;
        }

        const payload = parseJwt(savedToken);
        if (
          !payload ||
          isTokenExpired(payload) ||
          !userFromTokenPayload(payload)
        ) {
          await clearAccessToken();
          setBootstrapping(false);
          return;
        }

        await applyAccessToken(savedToken, false);
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
  }, [applyAccessToken]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshPermissions]);

  useEffect(() => {
    if (!token || !user) {
      cleanSocket();
      return;
    }

    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
      auth: { token },
    });
    socketRef.current = socket;
    setSocketReady(true);

    socket.on("connect", () => {
      if (user.tenantId) {
        socket.emit("register", {
          tenantId: user.tenantId,
          userId: user.userId,
        });
      }
    });

    const shouldShowCustomerAlerts =
      user.role === "ADMIN" || user.role === "MANAGER" || user.role === "USER";
    const getRequestLabel = (type?: string) => {
      if (type === "CALL_STAFF") return "Khách gọi nhân viên";
      if (type === "PAY_CASH") return "Khách yêu cầu thanh toán tiền mặt";
      if (type === "PAY_TRANSFER")
        return "Khách yêu cầu thanh toán chuyển khoản";
      if (type === "PRINT_BILL") return "Khách yêu cầu in hóa đơn có QR";
      return "Yêu cầu từ khách";
    };

    const handleCustomerRequest = (payload: any) => {
      if (!shouldShowCustomerAlerts) return;
      const tableName = payload?.tableName || "Bàn";
      const customerName = payload?.customerName
        ? ` - ${payload.customerName}`
        : "";
      Alert.alert(
        getRequestLabel(payload?.type),
        `${tableName}${customerName}`,
      );
    };

    const handlePaymentPaid = (payload: any) => {
      if (!shouldShowCustomerAlerts) return;
      const tableName = payload?.tableName || "Bàn";
      const amount = Number(payload?.amount || 0).toLocaleString("vi-VN");
      Alert.alert("Đã nhận thanh toán", `${tableName} - ${amount}đ`);
    };

    const handlePermissionsUpdated = () => {
      void refreshPermissions();
    };

    const handleSessionRevoked = () => {
      void (async () => {
        await handleLogout();
        Alert.alert(
          "Phien dang nhap da bi thu hoi",
          "Vui long dang nhap lai de tiep tuc.",
        );
      })();
    };

    socket.on("customerRequest", handleCustomerRequest);
    socket.on("paymentPaid", handlePaymentPaid);
    socket.on("permissionsUpdated", handlePermissionsUpdated);
    socket.on("sessionRevoked", handleSessionRevoked);

    return () => {
      socket.off("customerRequest", handleCustomerRequest);
      socket.off("paymentPaid", handlePaymentPaid);
      socket.off("permissionsUpdated", handlePermissionsUpdated);
      socket.off("sessionRevoked", handleSessionRevoked);
      socket.disconnect();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [token, user, cleanSocket, refreshPermissions, handleLogout]);

  const handleLogin = useCallback(
    async (email: string, pass: string) => {
      if (!deviceId) {
        setError("Đang khởi tạo thiết bị. Vui lòng thử lại.");
        return;
      }

      setError("");
      setLoading(true);

      try {
        const res = await api.post("/auth/login", {
          email: email || undefined,
          password: pass,
          deviceId,
        });

        if (res.data.requiresDeviceVerification) {
          setRequiresOtp(true);
          setVerifyUserId(res.data.userId);
          setError(
            res.data.devOtp
              ? `Thiết bị mới. Dev OTP: ${res.data.devOtp}`
              : "Thiết bị mới. Vui lòng kiểm tra email để lấy mã OTP.",
          );
          return;
        }

        if (res.data.requiresPasswordChange) {
          setRequiresPasswordChange(true);
          setTempToken(res.data.tempToken || "");
          return;
        }

        if (!res.data.access_token) {
          throw new Error("Không nhận được access token");
        }

        await applyAccessToken(res.data.access_token, true);
      } catch (err: any) {
        setError(
          err.response?.data?.message || err.message || "Đăng nhập thất bại.",
        );
      } finally {
        setLoading(false);
      }
    },
    [applyAccessToken, deviceId],
  );

  const handleVerifyDevice = useCallback(
    async (otpCode: string) => {
      if (!verifyUserId) {
        setError("Không tìm thấy thông tin xác thực thiết bị.");
        return;
      }

      setError("");
      setLoading(true);

      try {
        const res = await api.post("/auth/verify-device", {
          userId: verifyUserId,
          otpCode,
          deviceId,
        });

        if (res.data.requiresPasswordChange) {
          setRequiresPasswordChange(true);
          setTempToken(res.data.tempToken || "");
          resetOtpFlow();
          return;
        }

        if (!res.data.access_token) {
          throw new Error("Không nhận được access token");
        }

        await applyAccessToken(res.data.access_token, true);
        resetOtpFlow();
      } catch (err: any) {
        setError(err.response?.data?.message || "OTP không hợp lệ.");
      } finally {
        setLoading(false);
      }
    },
    [verifyUserId, deviceId, applyAccessToken, resetOtpFlow],
  );

  const handleChangePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!tempToken) {
        setError("Phiên đổi mật khẩu đã hết hạn. Vui lòng đăng nhập lại.");
        return;
      }

      setError("");
      setLoading(true);

      try {
        const res = await api.post(
          "/auth/change-password",
          { currentPassword, newPassword },
          { headers: { Authorization: `Bearer ${tempToken}` } },
        );

        setRequiresPasswordChange(false);
        setTempToken("");

        if (!res.data.access_token) {
          throw new Error("Không nhận được access token mới");
        }

        await applyAccessToken(res.data.access_token, true);
        Alert.alert("Thành công", "Đổi mật khẩu thành công");
      } catch (err: any) {
        setError(err.response?.data?.message || "Đổi mật khẩu thất bại.");
      } finally {
        setLoading(false);
      }
    },
    [tempToken, applyAccessToken],
  );

  const handlePasswordChangeCancel = useCallback(async () => {
    await handleLogout();
  }, [handleLogout]);

  const requestForgotPasswordOtp = useCallback(async (email: string) => {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password/request", { email });
      Alert.alert("Thành công", "Nếu email hợp lệ, OTP đã được gửi đến email của bạn.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Lỗi khi gửi OTP.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyForgotPasswordOtp = useCallback(async (email: string, otpCode: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-password/verify", { email, otpCode });
      return res.data.resetToken;
    } catch (err: any) {
      setError(err.response?.data?.message || "OTP không hợp lệ.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPasswordWithToken = useCallback(async (tokenToReset: string, newPassword: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-password/reset", { token: tokenToReset, newPassword });
      
      if (!res.data.access_token) {
        throw new Error("Không nhận được access token mới");
      }
      
      await applyAccessToken(res.data.access_token, true);
      Alert.alert("Thành công", "Đổi mật khẩu thành công");
    } catch (err: any) {
      setError(err.response?.data?.message || "Đổi mật khẩu thất bại.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applyAccessToken]);

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
    refreshPermissions,
    handleLogout,
    resetOtpFlow,
    requestForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPasswordWithToken,
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

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}
