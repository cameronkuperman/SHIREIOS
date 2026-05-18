import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import type { HostSidebarParty } from '@/features/host/hooks';

// Hand-built replication of SHIRE-FRONTEND `GuestCard` — raw RN primitives,
// no shared-kit composition. Every value ported from that file + index.css.

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

const GREEN = '#4BA05A';

export function WaitlistCard({
  party,
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

  const elapsedWait =
    party.source === 'waitlist' && party.joinedAt
      ? formatRelativeWait(party.joinedAt, now)
      : party.waitLabel;

  // Status badge tint (waiting → neutral, arrived/checked-in → green,
  // booked/confirmed → blue).
  const status = party.status;
  let badgeBg = colors.surface.level4;
  let badgeFg = colors.text.muted;
  if (status === 'Arrived' || status === 'Checked In') {
    badgeBg = 'rgba(75, 160, 90, 0.18)';
    badgeFg = '#3C8150';
  } else if (status === 'Booked' || status === 'Confirmed') {
    badgeBg = 'rgba(80, 135, 190, 0.16)';
    badgeFg = '#3D6A99';
  }
  const badgeLabel = status === 'Waiting' ? `~${party.waitLabel}` : status;

  const tag = /birthday/i.test(party.notes ?? '') ? 'BIRTHDAY' : null;
  const showPref = party.seatingPreference !== 'none';

  return (
    <View
      style={[
        styles.card,
        { borderColor: isSelected ? colors.accent : colors.border.default },
        isSelected ? { backgroundColor: colors.accentLight, borderWidth: 2 } : null,
      ]}
    >
      <Pressable onPress={onPress}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
              {party.name}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="people-outline" size={12} color={colors.text.secondary} />
                <Text style={[styles.statText, { color: colors.text.secondary }]}>
                  {party.size}
                </Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="time-outline" size={12} color={colors.text.secondary} />
                <Text style={[styles.statText, { color: colors.text.secondary }]}>
                  {elapsedWait}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeFg }]}>{badgeLabel}</Text>
          </View>
        </View>

        {/* Tag */}
        {tag != null && (
          <View style={styles.tagRow}>
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          </View>
        )}

        {/* Notes / preference */}
        {party.notes ? (
          <Text style={[styles.notes, { color: colors.text.muted }]} numberOfLines={2}>
            {party.notes}
          </Text>
        ) : showPref ? (
          <Text style={[styles.notes, { color: colors.text.muted }]} numberOfLines={1}>
            Prefers {party.seatingPreference}
          </Text>
        ) : null}
      </Pressable>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onSeat ?? onPress}
          style={({ pressed }) => [
            styles.seatBtn,
            { backgroundColor: GREEN },
            pressed ? { transform: [{ scale: 0.98 }] } : null,
          ]}
        >
          <Text style={styles.seatText}>Seat</Text>
        </Pressable>
        <Pressable
          onPress={onCall ?? onPress}
          accessibilityLabel="Call guest"
          style={({ pressed }) => [styles.ghostBtn, pressed ? { opacity: 0.5 } : null]}
        >
          <Ionicons name="call-outline" size={14} color={colors.text.secondary} />
        </Pressable>
        <Pressable
          onPress={onMessage ?? onPress}
          accessibilityLabel="Message guest"
          style={({ pressed }) => [styles.ghostBtn, pressed ? { opacity: 0.5 } : null]}
        >
          <Ionicons name="chatbubble-outline" size={14} color={colors.text.secondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1E1C18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
  },
  name: {
    fontFamily: fontFamily.display,
    fontSize: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagPill: {
    backgroundColor: 'rgba(130, 105, 185, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 10,
    fontWeight: '600',
    color: '#6E5A9C',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  notes: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seatBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatText: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ghostBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
