import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { textStyles, spacing, shadows, borderRadius, useTheme } from '@/theme';

type NextUpCardProps = {
  waiterId: string;
  waiterName: string;
  waiterColor?: string;
  tableLabels: string[];
  isNext?: boolean;
  onPress?: () => void;
};

export function NextUpCard({
  waiterName,
  waiterColor,
  tableLabels,
  isNext,
  onPress,
}: NextUpCardProps) {
  const { colors } = useTheme();
  const subtext =
    tableLabels.length === 0
      ? 'No table queued'
      : tableLabels
          .slice(0, 3)
          .map((label) => `T${label}`)
          .join(' · ');

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <GlassSurface intensity={50} borderRadius={borderRadius.lg} style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.colorDot, { backgroundColor: waiterColor ?? colors.accent }]} />
          {isNext && (
            <View style={[styles.nextBadge, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.nextBadgeText, { color: colors.accent }]}>NEXT</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={[styles.waiterName, { color: colors.text.primary }]}>
          {waiterName}
        </Text>
        <Text numberOfLines={1} style={[styles.tables, { color: colors.text.muted }]}>
          {subtext}
        </Text>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 132,
    minHeight: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
    ...shadows.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nextBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  nextBadgeText: {
    ...textStyles.tiny,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  waiterName: {
    ...textStyles.label,
    fontWeight: '700',
  },
  tables: {
    ...textStyles.tiny,
    fontWeight: '600',
    fontVariant: ['tabular-nums' as const],
  },
});
