import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, shadows, borderRadius, useTheme } from '@/theme';

type NextUpCardProps = {
  waiterId: string;
  waiterName: string;
  waiterColor?: string;
  tableLabels: string[];
  isNext?: boolean;
  badgeLabel?: string;
  tone?: 'default' | 'grat';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function NextUpCard({
  waiterName,
  waiterColor,
  tableLabels,
  isNext,
  badgeLabel,
  tone = 'default',
  onPress,
  style,
}: NextUpCardProps) {
  const { colors } = useTheme();
  const visibleLabels = tableLabels.slice(0, 5);
  const hiddenTableCount = Math.max(0, tableLabels.length - visibleLabels.length);
  const isGrat = tone === 'grat';

  return (
    <TouchableOpacity
      activeOpacity={0.74}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: isGrat
            ? colors.status.reserved.fill
            : isNext
              ? colors.accentLight
              : colors.surface.level1,
          borderColor: isGrat
            ? colors.status.reserved.border
            : isNext
              ? colors.accent
              : colors.border.subtle,
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.waiterRow}>
          <View style={[styles.colorDot, { backgroundColor: waiterColor ?? colors.accent }]} />
          <Text numberOfLines={1} style={[styles.waiterName, { color: colors.text.primary }]}>
            {waiterName}
          </Text>
        </View>
        {badgeLabel || isNext ? (
          <View
            style={[
              styles.nextBadge,
              { backgroundColor: isGrat ? colors.status.reserved.text : colors.accent },
            ]}
          >
            <Text style={styles.nextBadgeText}>{badgeLabel ?? 'NEXT'}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tableRow}>
        {visibleLabels.length === 0 ? (
          <View style={[styles.emptyPill, { borderColor: colors.border.subtle }]}>
            <Ionicons name="remove-outline" size={14} color={colors.text.muted} />
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>No tables</Text>
          </View>
        ) : (
          <>
            {visibleLabels.map((label) => (
              <View
                key={label}
                style={[styles.tablePill, { backgroundColor: colors.surface.level3 }]}
              >
                <Text style={[styles.tableText, { color: colors.text.secondary }]}>T{label}</Text>
              </View>
            ))}
            {hiddenTableCount > 0 ? (
              <View style={[styles.tablePill, { backgroundColor: colors.surface.level3 }]}>
                <Text style={[styles.tableText, { color: colors.text.secondary }]}>
                  +{hiddenTableCount}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 82,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...shadows.subtle,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  waiterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  nextBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  nextBadgeText: {
    ...textStyles.tiny,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0,
  },
  waiterName: {
    ...textStyles.label,
    fontWeight: '800',
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tablePill: {
    minWidth: 42,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tableText: {
    ...textStyles.tiny,
    fontWeight: '800',
    fontVariant: ['tabular-nums' as const],
  },
  emptyPill: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  emptyText: {
    ...textStyles.tiny,
    fontWeight: '700',
  },
});
