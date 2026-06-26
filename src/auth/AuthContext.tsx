import React from "react";
import type { SessionUser } from "../types/auth";

export type AuthContextValue = {
  token: string;
  user: SessionUser | null;
  deviceId: string;
  socketReady: boolean;
  socketRef: React.MutableRefObject<any>;
  loading: boolean;
  error: string;
  requiresOtp: boolean;
  requiresPasswordChange: boolean;
  tempToken: string;
  handleLogin: (email: string, pass: string) => Promise<void>;
  handleVerifyDevice: (otpCode: string) => Promise<void>;
  handleChangePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  handlePasswordChangeCancel: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  handleLogout: () => Promise<void>;
  resetOtpFlow: () => void;
};

export const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthContext.Provider");
  }
  return context;
}
