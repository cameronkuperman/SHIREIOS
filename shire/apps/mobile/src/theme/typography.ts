// Shire Design System — Typography
// Fraunces (serif) is reserved for the SHIRE wordmark, the sidebar "S" mark,
// and big table numbers. Inter carries everything else. RN does not resolve
// fontWeight to font files — every style names its family explicitly.

export const fontFamily = {
  serif: 'Fraunces_600SemiBold',
  serifRegular: 'Fraunces_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

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
  tight: 0,
  normal: 0,
  wide: 0.5,
  caps: 1.5,
} as const;

// Pre-composed text styles
export const textStyles = {
  headline: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  title: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  subtitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  bodyMedium: {
    fontFamily: fontFamily.sansMedium,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  label: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  captionMedium: {
    fontFamily: fontFamily.sansMedium,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.normal,
  },
  tiny: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.regular,
    letterSpacing: letterSpacing.normal,
  },
  sectionLabel: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.caps,
    textTransform: 'uppercase' as const,
  },
  tableId: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
  },
  stat: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    fontVariant: ['tabular-nums' as const],
  },
  // Serif — reserved usages only.
  wordmark: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    letterSpacing: 1,
  },
  tableNumber: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.xl,
    letterSpacing: letterSpacing.tight,
    fontVariant: ['tabular-nums' as const],
  },
} as const;
