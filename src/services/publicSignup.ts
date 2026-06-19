import { api } from './api';

export interface SaasPlan {
  id: 'BASIC' | 'PRO' | 'ENTERPRISE';
  name: string;
  priceMonthly: number;
  currency: 'VND';
  billingCycle: 'MONTHLY';
  maxTables: number;
  maxStaff: number;
  features: string[];
}

export interface StartSignupPayload {
  storeName: string;
  subdomain?: string;
  address?: string;
  phone: string;
  plan: string;
  admin: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  };
}

export interface StartSignupResponse {
  signupId: string;
  otpExpiresAt: string;
  delivered: boolean;
  devOtp?: string;
}

export async function getPublicSaasPlans() {
  const res = await api.get('/public/saas/plans');
  return Array.isArray(res.data) ? (res.data as SaasPlan[]) : [];
}

export async function startPublicSignup(payload: StartSignupPayload) {
  const res = await api.post('/public/signup/start', payload);
  return res.data as StartSignupResponse;
}

export async function resendPublicSignupOtp(signupId: string) {
  const res = await api.post('/public/signup/resend-otp', { signupId });
  return res.data as StartSignupResponse;
}

export async function verifyPublicSignup(signupId: string, otpCode: string) {
  const res = await api.post('/public/signup/verify', { signupId, otpCode });
  return res.data as {
    tenant: { _id: string; name: string };
    admin: { _id: string; email?: string; name?: string };
    trialEndsAt: string;
  };
}
