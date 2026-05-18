import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { textStyles, spacing, borderRadius, useTheme } from '@/theme';

export type ShiftHourSlot = {
  time: string; // "HH:MM"
  parties: number;
  covers: number;
};

type ShiftHourGridProps = {
  slots: ShiftHourSlot[];
};

export function ShiftHourGrid({ slots }: ShiftHourGridProps) {
  const { colors } = useTheme();

  const peak = slots.reduce((max, slot) => Math.max(max, slot.covers), 0) || 1;

  if (slots.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.text.muted }]}>
        No projected covers for today yet.
      </Text>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {slots.map((slot) => {
        const intensity = slot.covers / peak;
        const filled = slot.covers > 0;
        return (
          <View key={slot.time} style={styles.cell}>
            <View
              style={[
                styles.bar,
                {
                  backgroundColor: filled ? colors.accent : colors.surface.level2,
                  opacity: filled ? 0.35 + intensity * 0.65 : 1,
                  borderColor: colors.border.subtle,
                },
              ]}
            >
              <Text style={[styles.covers, { color: filled ? colors.white : colors.text.muted }]}>
                {slot.covers}
              </Text>
            </View>
            <Text style={[styles.time, { color: colors.text.muted }]}>{slot.time}</Text>
            <Text style={[styles.parties, { color: colors.text.secondary }]}>{slot.parties}p</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  cell: {
    alignItems: 'center',
    gap: 3,
    width: 46,
  },
  bar: {
    width: 40,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  covers: {
    ...textStyles.label,
    fontWeight: '800',
    fontVariant: ['tabular-nums' as const],
  },
  time: {
    ...textStyles.tiny,
    fontWeight: '700',
    fontVariant: ['tabular-nums' as const],
  },
  parties: {
    ...textStyles.tiny,
    fontWeight: '600',
  },
  empty: {
    ...textStyles.caption,
    paddingVertical: spacing.sm,
  },
});
