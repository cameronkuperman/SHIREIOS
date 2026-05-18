import React, { createContext, useContext } from 'react';
import { lightColors, type Colors } from './colors';

type ThemeValue = {
  colors: Colors;
  isDark: boolean;
};

// Light-only. `isDark` is retained as `false` so existing consumers that
// destructure it still typecheck; dead dark-mode branches are cleaned up
// incrementally.
const themeValue: ThemeValue = {
  colors: lightColors,
  isDark: false,
};

const ThemeContext = createContext<ThemeValue>(themeValue);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
