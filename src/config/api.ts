import { Platform } from 'react-native';

function getDefaultBaseUrl() {
  if (Platform.OS === 'android') {
    // Android emulator localhost mapping.
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

function getDefaultCustomerAppBaseUrl() {
  return 'http://localhost:5173';
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim() || getDefaultBaseUrl();
export const CUSTOMER_APP_BASE_URL = trimTrailingSlash(
  (process.env.EXPO_PUBLIC_CUSTOMER_APP_BASE_URL || '').trim() || getDefaultCustomerAppBaseUrl(),
);
