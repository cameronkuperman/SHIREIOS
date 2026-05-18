import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FloorTableViewModel } from '@/features/floor';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

type FloorStatusBarProps = {
  tables: FloorTableViewModel[];
};

export function FloorStatusBar({ tables }: FloorStatusBarProps) {
  const { colors, isDark } = useTheme();

  const counts = useMemo(() => {
    let open = 0;
    let seated = 0;
    let dirty = 0;
    let blocked = 0;
    for (const table of tables) {
      if (table.isBlocked) {
        blocked += 1;
        continue;
      }
      if (table.status === 'available') open += 1;
      else if (table.status === 'occupied') seated += 1;
      else if (table.status === 'dirty') dirty += 1;
      else if (table.status === 'reserved') blocked += 1;
    }
    return { open, seated, dirty, blocked };
  }, [tables]);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? 'rgba(30, 30, 34, 0.92)' : 'rgba(255,255,255,0.95)',
          borderColor: colors.glass.border,
        },
      ]}
    >
      <Chip count={counts.open} label="Open" color={colors.status.available.text} />
      <Chip count={counts.seated} label="Seated" color={colors.status.occupied.text} />
      <Chip count={counts.dirty} label="Dirty" color={colors.status.dirty.text} />
      <Chip count={counts.blocked} label="Blocked" color={colors.status.reserved.text} />
    </View>
  );
}

function Chip({ count, label, color }: { count: number; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.count, { color: colors.text.primary }]}>{count}</Text>
      <Text style={[styles.label, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    ...shadows.subtle,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  count: {
    ...textStyles.label,
    fontWeight: '700',
  },
  label: {
    ...textStyles.caption,
  },
});
