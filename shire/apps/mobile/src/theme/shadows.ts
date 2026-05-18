// Shire Design System — Shadow Definitions
import { type ViewStyle } from 'react-native';

export const shadows: Record<string, ViewStyle> = {
  subtle: {
    shadowColor: '#152333',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  medium: {
    shadowColor: '#152333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#152333',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 8,
  },
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
} as const;
