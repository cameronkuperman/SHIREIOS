import type { ConfigContext, ExpoConfig } from 'expo/config';

import packageJson from './package.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = { ...(config.extra ?? {}) } as Record<string, unknown>;

  if (process.env.EXPO_EAS_PROJECT_ID) {
    extra.eas = {
      projectId: process.env.EXPO_EAS_PROJECT_ID,
    };
  }

  return {
    ...config,
    name: 'Shire',
    slug: 'shire',
    version: packageJson.version,
    orientation: 'portrait',
    icon: './src/assets/icon.png',
    scheme: 'shire',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? 'com.shire.mobile',
      buildNumber: process.env.EXPO_IOS_BUILD_NUMBER ?? '1',
      ...(process.env.EXPO_APPLE_TEAM_ID
        ? { appleTeamId: process.env.EXPO_APPLE_TEAM_ID }
        : {}),
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#1a1a2e',
      },
      package: 'com.shire.mobile',
      edgeToEdgeEnabled: true,
    },
    web: {
      output: 'static',
      bundler: 'metro',
    },
    plugins: [
      ['expo-router', { root: './src/app' }],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#1a1a2e',
          dark: {
            backgroundColor: '#1a1a2e',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
      baseUrl: '',
    },
    extra,
  };
};
