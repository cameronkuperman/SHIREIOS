import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, spacing, textStyles, useTheme } from '@/theme';
import type { HostSidebarParty } from '@/features/host/hooks';
import { seatingPrefLabel } from './SeatingPreferencePicker';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Card } from './ui/Card';

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
  onSeat?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  // legacy props — accepted for compatibility, unused
  onNotify?: () => void;
  onNotifyMore?: () => void;
  isNotifying?: boolean;
};

export function WaitlistCard({
  party,
  index,
  onPress,
  isSelected,
  onSeat,
  onCall,
  onMessage,
}: WaitlistCardProps) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const liveWait =
    party.source === 'waitlist' && party.joinedAt
      ? formatRelativeWait(party.joinedAt, now)
      : party.waitLabel;
  const showPref = party.seatingPreference !== 'none';

  return (
    <Card selected={isSelected} padded={false} style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
          {index + 1}. {party.name}
        </Text>
        <Text style={[styles.wait, { color: colors.text.muted }]}>{liveWait}</Text>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="people-outline" size={13} color={colors.text.muted} />
        <Text style={[styles.meta, { color: colors.text.secondary }]}>Party of {party.size}</Text>
        <Text style={[styles.meta, { color: colors.text.muted }]}>·</Text>
        <Text style={[styles.meta, { color: colors.text.secondary }]}>{party.status}</Text>
      </View>

      {showPref && (
        <Text style={[styles.pref, { color: colors.text.muted }]}>
          Prefers {seatingPrefLabel(party.seatingPreference).toLowerCase()}
        </Text>
      )}

      <View style={styles.actions}>
        <Button
          label="Seat"
          variant="success"
          size="sm"
          fullWidth
          onPress={onSeat ?? onPress}
          style={styles.seatBtn}
        />
        <IconButton filled onPress={onCall ?? onPress} accessibilityLabel="Call guest">
          <Ionicons name="call-outline" size={16} color={colors.text.secondary} />
        </IconButton>
        <IconButton filled onPress={onMessage ?? onPress} accessibilityLabel="Message guest">
          <Ionicons name="chatbubble-outline" size={16} color={colors.text.secondary} />
        </IconButton>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...textStyles.label,
    flex: 1,
  },
  wait: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    ...textStyles.caption,
  },
  pref: {
    ...textStyles.caption,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  seatBtn: {
    flex: 1,
  },
});
