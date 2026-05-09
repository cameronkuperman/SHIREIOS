import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';
import type { HostSidebarParty } from '@/features/host/hooks';
import { seatingPrefIcon, seatingPrefLabel } from './SeatingPreferencePicker';

function formatRelativeWait(joinedAt: string, now: number): string {
  const elapsed = Math.max(0, Math.floor((now - new Date(joinedAt).getTime()) / 60_000));
  if (elapsed < 1) return '<1m';
  if (elapsed < 60) return `${elapsed}m`;
  const h = Math.floor(elapsed / 60);
  const m = elapsed % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type WaitlistCardProps = {
  party: HostSidebarParty;
  index: number;
  onPress?: () => void;
  isSelected?: boolean;
};

export function WaitlistCard({ party, index, onPress, isSelected }: WaitlistCardProps) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const statusColor =
    party.status === 'Arrived' || party.status === 'Checked In'
      ? colors.accent
      : colors.status.reserved.text;

  const liveWait =
    party.source === 'waitlist' && party.joinedAt
      ? formatRelativeWait(party.joinedAt, now)
      : party.waitLabel;
  const showPref = party.seatingPreference !== 'none';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface.level1,
          borderColor: colors.glass.border,
        },
        isSelected && {
          borderColor: colors.accent,
          backgroundColor: colors.accentLight,
        },
      ]}
    >
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text.primary }]}>
            {index + 1}. {party.name}
          </Text>
          <Text style={[styles.sourcePill, { color: colors.text.muted }]}>{party.sourceLabel}</Text>
        </View>
        <View style={styles.detailsRow}>
          <Text style={[styles.details, { color: colors.text.secondary }]}>
            {liveWait} · Party of {party.size}
          </Text>
          {showPref && (
            <View style={[styles.prefChip, { backgroundColor: colors.surface.level3 }]}>
              <Ionicons
                name={seatingPrefIcon(party.seatingPreference)}
                size={11}
                color={colors.text.muted}
              />
              <Text style={[styles.prefText, { color: colors.text.muted }]}>
                {seatingPrefLabel(party.seatingPreference)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.statusContainer}>
        <Text style={[styles.status, { color: statusColor }]}>{party.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    ...shadows.subtle,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    ...textStyles.label,
  },
  sourcePill: {
    ...textStyles.tiny,
    textTransform: 'uppercase',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  details: {
    ...textStyles.caption,
  },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: borderRadius.pill,
  },
  prefText: {
    fontSize: 10,
    fontWeight: '500',
  },
  statusContainer: {
    paddingLeft: spacing.md,
  },
  status: {
    ...textStyles.captionMedium,
  },
});
