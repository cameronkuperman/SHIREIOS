import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, useTheme } from '@/theme';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple';
export type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
};

const SIZES: Record<BadgeSize, { padH: number; padV: number; font: number }> = {
  sm: { padH: 8, padV: 2, font: 10 },
  md: { padH: 10, padV: 4, font: 11 },
};

/** Pill badge — uppercase, semibold, tinted. */
export function Badge({ label, variant = 'default', size = 'sm' }: BadgeProps) {
  const { colors } = useTheme();
  const s = SIZES[size];

  const VARIANTS: Record<BadgeVariant, { bg: string; fg: string }> = {
    default: { bg: colors.surface.level4, fg: colors.text.muted },
    success: { bg: 'rgba(75, 160, 90, 0.18)', fg: '#3C8150' },
    warning: { bg: colors.needsServer.fill, fg: colors.needsServer.text },
    danger: { bg: 'rgba(190, 85, 85, 0.18)', fg: '#A04A4A' },
    info: { bg: colors.status.occupied.fill, fg: colors.status.occupied.text },
    purple: { bg: colors.status.reserved.fill, fg: colors.status.reserved.text },
  };
  const v = VARIANTS[variant];

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: v.bg, paddingHorizontal: s.padH, paddingVertical: s.padV },
      ]}
    >
      <Text style={[styles.label, { color: v.fg, fontSize: s.font }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 999,
  },
  label: {
    fontFamily: fontFamily.sansSemibold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
