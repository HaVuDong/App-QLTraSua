import type { JwtPayload, SessionUser } from '../types/auth';
import { isUserRole } from '../constants/roles';

function decodeBase64(base64Value: string) {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(base64Value);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64Value, 'base64').toString('utf8');
  }
  throw new Error('No base64 decoder available');
}

function decodeBase64Url(base64Url: string) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  return decodeBase64(base64 + '='.repeat(padLength));
}

export function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = decodeBase64Url(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: JwtPayload, skewSeconds = 30) {
  if (!payload.exp) return false;
  const expiresAtMs = payload.exp * 1000;
  return expiresAtMs <= Date.now() + skewSeconds * 1000;
}

export function userFromTokenPayload(payload: JwtPayload): SessionUser | null {
  if (!payload.sub || !isUserRole(payload.role)) return null;
  return {
    userId: payload.sub,
    email: payload.email,
    phone: payload.phone,
    role: payload.role,
    tenantId: payload.tenantId ?? null,
  };
}

