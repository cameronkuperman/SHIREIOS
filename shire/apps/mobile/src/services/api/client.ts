import axios from 'axios';
import { env } from '@/config/env';
import { supabase } from '@/services/supabase/client';

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const {
      data: { session },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshError || !session?.access_token) {
      await supabase.auth.signOut();
      return Promise.reject(refreshError ?? error);
    }

    originalRequest.headers = {
      ...(originalRequest.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    };

    return apiClient(originalRequest);
  },
);
