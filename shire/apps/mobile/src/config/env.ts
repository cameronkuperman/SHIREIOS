/**
 * Centralized environment configuration.
 * All EXPO_PUBLIC_* vars should be accessed through this module only.
 */

export const env = {
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  APP_ENV: (process.env.EXPO_PUBLIC_APP_ENV ?? 'development') as
    | 'development'
    | 'staging'
    | 'production',
} as const;

export function validateEnv(): void {
  if (env.APP_ENV === 'production' && !env.API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is required in production');
  }
}
