import { api } from './api';
import type { SaasPlan } from './publicSignup';

export interface BillingInfo {
  tenant: {
    _id: string;
    name: string;
    status: string;
  };
  subscription?: {
    plan?: string;
    status?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED';
    startDate?: string;
    endDate?: string;
    trialEndsAt?: string;
    amount?: number;
    currency?: string;
    billingCycle?: string;
    lastPaymentAt?: string;
  };
  plan: SaasPlan;
  daysRemaining: number;
  payments: SaasPayment[];
}

export interface SaasPayment {
  paymentId: string;
  provider: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  orderCode: number;
  amount: number;
  plan: string;
  months: number;
  description: string;
  checkoutUrl?: string;
  qrCode?: string;
  paidAt?: string;
  createdAt?: string;
}

export async function getBillingInfo() {
  const res = await api.get('/billing/me');
  return res.data as BillingInfo;
}

export async function createSaasPayosPayment(months = 1) {
  const res = await api.post('/billing/payos/create', { months });
  return res.data as SaasPayment;
}

export async function getSaasPaymentStatus(paymentId: string) {
  const res = await api.get(`/billing/payments/${paymentId}/status`);
  return res.data as SaasPayment;
}
