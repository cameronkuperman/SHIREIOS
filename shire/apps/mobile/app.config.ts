import type { ConfigContext, ExpoConfig } from 'expo/config';

import packageJson from './package.json';

const EAS_PROJECT_ID = '1677c008-860a-4fac-aaad-886d99e001a0';

export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = { ...(config.extra ?? {}) } as Record<string, unknown>;
  const easProjectId = process.env.EXPO_EAS_PROJECT_ID ?? EAS_PROJECT_ID;

  if (easProjectId) {
    extra.eas = {
      projectId: easProjectId,
    };
  }

  return {
    ...config,
    name: 'Shire',
    slug: 'shire',
    version: packageJson.version,
    orientation: 'landscape',
    icon: './src/assets/icon.png',
    scheme: 'shire',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      requireFullScreen: true,
      bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? 'com.shire.mobile',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      ...(process.env.EXPO_APPLE_TEAM_ID
        ? { appleTeamId: process.env.EXPO_APPLE_TEAM_ID }
        : {}),
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#EBEBE9',
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
          backgroundColor: '#EBEBE9',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
      baseUrl: '',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: `https://u.expo.dev/${easProjectId}`,
    },
    extra,
  };
};
