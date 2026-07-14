import React, { createContext, useContext, useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useAuth } from '@/features/auth';
import { lightColors, type Colors } from './colors';

type ThemeValue = {
  colors: Colors;
  isDark: boolean;
  componentStyle: (componentId?: string) => ViewStyle;
  componentTextStyle: (componentId?: string) => TextStyle;
};

// Light-only. `isDark` is retained as `false` so existing consumers that
// destructure it still typecheck; dead dark-mode branches are cleaned up
// incrementally.
const defaultThemeValue: ThemeValue = {
  colors: lightColors,
  isDark: false,
  componentStyle: () => ({}),
  componentTextStyle: () => ({}),
};

const ThemeContext = createContext<ThemeValue>(defaultThemeValue);

function applyThemeTokens(base: Colors, tokens?: Record<string, string>): Colors {
  const next = JSON.parse(JSON.stringify(base)) as Colors;
  for (const [path, value] of Object.entries(tokens ?? {})) {
    const parts = path.split('.');
    let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (!part) break;
      const child = target[part];
      if (!child || typeof child !== 'object' || Array.isArray(child)) {
        target = {};
        break;
      }
      target = child as Record<string, unknown>;
    }
    const leaf = parts.at(-1);
    if (leaf && typeof target[leaf] === 'string' && typeof value === 'string') {
      target[leaf] = value;
    }
  }
  return next;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { bootstrap } = useAuth();
  const value = useMemo<ThemeValue>(
    () => {
      const overrides = bootstrap?.uiComponentOverrides ?? {};
      return {
        colors: applyThemeTokens(lightColors, bootstrap?.uiTheme),
        isDark: false,
        componentStyle: (componentId?: string) => {
          const value = componentId ? overrides[componentId] ?? {} : {};
          return { backgroundColor: value.backgroundColor, borderColor: value.borderColor };
        },
        componentTextStyle: (componentId?: string) => {
          const value = componentId ? overrides[componentId] ?? {} : {};
          return { color: value.color };
        },
      };
    },
    [bootstrap?.uiComponentOverrides, bootstrap?.uiTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
