import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, spacing, textStyles, useTheme } from '@/theme';
import { useFloorStats } from '@/features/host/insights';

function StatCell({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.cell}>
      <Text style={[styles.value, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

/** Right-panel restaurant stats block. */
export function StatsPanel() {
  const { colors } = useTheme();
  const stats = useFloorStats();

  return (
    <View>
      <Text style={[styles.heading, { color: colors.text.muted }]}>Restaurant Stats</Text>
      <View style={styles.grid}>
        <StatCell label="Occupancy" value={`${stats.occupancyPct}%`} />
        <StatCell
          label="Efficiency"
          value={stats.efficiencyPct != null ? `${stats.efficiencyPct}%` : '—'}
        />
        <StatCell
          label="Tips"
          value={
            stats.tipsTotalCents != null ? `$${Math.round(stats.tipsTotalCents / 100)}` : '—'
          }
        />
        <StatCell
          label="Tables Served"
          value={stats.tablesServed != null ? String(stats.tablesServed) : '—'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...textStyles.sectionLabel,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    paddingVertical: spacing.sm,
  },
  value: {
    fontFamily: fontFamily.sansBold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...textStyles.tiny,
    marginTop: 2,
  },
});
