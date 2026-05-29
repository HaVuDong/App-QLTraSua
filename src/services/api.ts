import axios from 'axios';
import { API_BASE_URL } from '../config/api';

let authToken = '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export function setApiToken(token: string) {
  authToken = token;
}

export function attachApiInterceptors(onUnauthorized: () => void) {
  const requestInterceptor = api.interceptors.request.use((config) => {
    if (authToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  });

  const responseInterceptor = api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401 && !!authToken) {
        onUnauthorized();
      }
      return Promise.reject(error);
    },
  );

  return () => {
    api.interceptors.request.eject(requestInterceptor);
    api.interceptors.response.eject(responseInterceptor);
  };
}
