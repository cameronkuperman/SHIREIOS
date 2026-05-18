import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, spacing, textStyles, useTheme } from '@/theme';

type StatCardProps = {
  label: string;
  value: string;
  /** Optional small trailing note (e.g. a delta). */
  note?: string;
  tone?: 'default' | 'good' | 'warn';
};

/** A labelled stat — Geist Mono value, mono uppercase label. */
export function StatCard({ label, value, note, tone = 'default' }: StatCardProps) {
  const { colors } = useTheme();
  const valueColor =
    tone === 'good' ? '#3C8150' : tone === 'warn' ? colors.needsServer.text : colors.text.primary;
  return (
    <View style={styles.base}>
      <Text style={[styles.label, { color: colors.text.muted }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        {note != null && <Text style={[styles.note, { color: colors.text.muted }]}>{note}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm,
  },
  label: {
    ...textStyles.sectionLabel,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  value: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  note: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
});
