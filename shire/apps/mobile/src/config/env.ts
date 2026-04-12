/**
 * Centralized environment configuration.
 * All EXPO_PUBLIC_* vars should be accessed through this module only.
 */

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');

  if (trimmed.endsWith('/api/v1')) {
    return trimmed;
  }

  return `${trimmed}/api/v1`;
}

const apiUrl = normalizeApiUrl(
  process.env.EXPO_PUBLIC_API_URL ?? 'https://web-production-5c5b4.up.railway.app/api/v1',
);
const wsUrl =
  process.env.EXPO_PUBLIC_WS_URL ?? 'wss://web-production-5c5b4.up.railway.app';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const env = {
  API_URL: apiUrl,
  WS_URL: wsUrl,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  APP_ENV: (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as
    | 'development'
    | 'staging'
    | 'production',
} as const;

export function validateEnv(): void {
  if (
    env.APP_ENV === 'production' &&
    (!env.API_URL || !env.WS_URL || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)
  ) {
    throw new Error(
      'EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WS_URL, EXPO_PUBLIC_SUPABASE_URL, and EXPO_PUBLIC_SUPABASE_ANON_KEY are required in production',
    );
  }
}
