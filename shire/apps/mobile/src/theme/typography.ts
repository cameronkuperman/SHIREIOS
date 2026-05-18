// Shire Design System — Typography
// Ported from SHIRE-FRONTEND: Inter Tight (body/UI), Instrument Serif
// (display/headings), Geist Mono (data/numbers). RN does not resolve
// fontWeight to font files — every style names its family explicitly.

export const fontFamily = {
  sans: 'InterTight_400Regular',
  sansMedium: 'InterTight_500Medium',
  sansSemibold: 'InterTight_600SemiBold',
  sansBold: 'InterTight_700Bold',
  display: 'InstrumentSerif_400Regular',
  // legacy aliases — kept so existing imports resolve
  serif: 'InstrumentSerif_400Regular',
  serifRegular: 'InstrumentSerif_400Regular',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const letterSpacing = {
  tight: -0.3,
  normal: 0,
  wide: 0.3,
  caps: 0.5,
} as const;

// Pre-composed text styles
export const textStyles = {
  // Instrument Serif display headings
  display: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    letterSpacing: letterSpacing.tight,
  },
  headline: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
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
  // Geist Mono uppercase micro-label (.label-mono)
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: letterSpacing.caps,
    textTransform: 'uppercase' as const,
  },
  tableId: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
  // Geist Mono data / stats
  stat: {
    fontFamily: fontFamily.monoMedium,
    fontSize: fontSize.xl,
    letterSpacing: letterSpacing.tight,
    fontVariant: ['tabular-nums' as const],
  },
  data: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontVariant: ['tabular-nums' as const],
  },
  wordmark: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    letterSpacing: letterSpacing.tight,
  },
  tableNumber: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
} as const;
