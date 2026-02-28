import axios from 'axios';
import { env } from '@/config/env';
import { storage } from '@/lib/storage';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use((config) => {
  const token = storage.getString(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 with token refresh queue
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void): void {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(newToken: string): void {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken: string) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = storage.getString(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post<{ token: string; refreshToken: string }>(
        `${env.API_URL}/auth/refresh`,
        { refreshToken },
      );

      const { token, refreshToken: newRefreshToken } = response.data;
      storage.set(TOKEN_KEY, token);
      storage.set(REFRESH_TOKEN_KEY, newRefreshToken);

      onTokenRefreshed(token);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      storage.delete(TOKEN_KEY);
      storage.delete(REFRESH_TOKEN_KEY);
      refreshSubscribers = [];
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
