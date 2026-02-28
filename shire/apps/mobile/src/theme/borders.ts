// Shire Design System — Border Radius + Border Styles
import { type ViewStyle } from 'react-native';

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  pill: 999,
} as const;

export const borderStyles: Record<string, ViewStyle> = {
  glass: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  glassSubtle: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
} as const;
