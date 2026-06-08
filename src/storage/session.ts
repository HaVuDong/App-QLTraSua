import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'trasua_access_token';
const DEVICE_ID_KEY = 'trasua_device_id';
const webFallbackStore = new Map<string, string>();
const OTP_BYPASS_FLAG = process.env.EXPO_PUBLIC_ENABLE_OTP_BYPASS === 'true';
const OTP_BYPASS_DEVICE_ID = (process.env.EXPO_PUBLIC_OTP_BYPASS_DEVICE_ID || '').trim();

function isWebPlatform() {
  return Platform.OS === 'web';
}

function isDevelopmentEnvironment() {
  return typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production';
}

function isOtpBypassEnabled() {
  // Local development only: bypass must be explicitly enabled.
  // If flags are missing, default behavior remains secure (OTP/device verification is enforced).
  return isWebPlatform() && isDevelopmentEnvironment() && OTP_BYPASS_FLAG && OTP_BYPASS_DEVICE_ID.length > 0;
}

function getWebStorage() {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return globalThis.localStorage;
    }
  } catch {
    // Ignore access errors (privacy mode/restricted environments)
  }
  return null;
}

async function writeValue(key: string, value: string) {
  if (isWebPlatform()) {
    const storage = getWebStorage();
    if (storage) {
      storage.setItem(key, value);
      return;
    }
    webFallbackStore.set(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Last-resort fallback for environments where secure store is unavailable.
    webFallbackStore.set(key, value);
  }
}

async function readValue(key: string) {
  if (isWebPlatform()) {
    const storage = getWebStorage();
    if (storage) {
      return storage.getItem(key);
    }
    return webFallbackStore.get(key) ?? null;
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return webFallbackStore.get(key) ?? null;
  }
}

async function removeValue(key: string) {
  if (isWebPlatform()) {
    const storage = getWebStorage();
    if (storage) {
      storage.removeItem(key);
      return;
    }
    webFallbackStore.delete(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    webFallbackStore.delete(key);
  }
}

function buildDeviceId() {
  return `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveAccessToken(token: string) {
  await writeValue(ACCESS_TOKEN_KEY, token);
}

export async function loadAccessToken() {
  return readValue(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken() {
  await removeValue(ACCESS_TOKEN_KEY);
}

export async function getOrCreateDeviceId() {
  if (isOtpBypassEnabled()) {
    await writeValue(DEVICE_ID_KEY, OTP_BYPASS_DEVICE_ID);
    return OTP_BYPASS_DEVICE_ID;
  }

  const existingId = await readValue(DEVICE_ID_KEY);
  if (existingId) return existingId;

  const nextDeviceId = buildDeviceId();
  await writeValue(DEVICE_ID_KEY, nextDeviceId);
  return nextDeviceId;
}
