// Shire Design System — Typography Scale

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  caps: 1.5,
} as const;

// Pre-composed text styles
export const textStyles = {
  headline: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  subtitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  bodyMedium: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  captionMedium: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  tiny: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.caps,
    textTransform: 'uppercase' as const,
  },
  tableId: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  stat: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    fontVariant: ['tabular-nums' as const],
  },
} as const;
