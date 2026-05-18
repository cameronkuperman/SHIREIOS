// Shire Design System — Shadows
// Ported from SHIRE-FRONTEND `.light` shadow scale (warm #1E1C18, very subtle).
// RN takes one shadow per style — these are single-shadow approximations of
// the web's layered box-shadows.
import { type ViewStyle } from 'react-native';

const SHADOW_COLOR = '#1E1C18';

export const shadows: Record<string, ViewStyle> = {
  // --shadow-xs / --shadow-sm
  subtle: {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  // --shadow-card
  medium: {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
  },
  // --shadow-elevated
  elevated: {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 28,
    elevation: 8,
  },
  glass: {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;
