import axios from 'axios';
import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/store';
import { supabase } from '@/services/supabase/client';

const SESSION_LOOKUP_TIMEOUT_MS = 8_000;

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function isSessionFresh(session: ReturnType<typeof useAuthStore.getState>['session']): boolean {
  if (!session?.access_token) {
    return false;
  }

  if (!session.expires_at) {
    return true;
  }

  return session.expires_at * 1000 > Date.now() + 30_000;
}

async function getFallbackSession() {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timed out while reading the auth session.'));
        }, SESSION_LOOKUP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('shirePreview') === '1') {
    return config;
  }
  let session = useAuthStore.getState().session;

  if (!isSessionFresh(session)) {
    const result = await getFallbackSession();
    session = result.data.session;
    useAuthStore.getState().setSession(session);
  }

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
