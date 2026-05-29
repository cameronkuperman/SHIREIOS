import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { Reservation, ReservationStatus } from '@shire/shared';
import { getReservationSourceLabel } from '@/features/host/source';
import { seatingPrefIcon, seatingPrefLabel } from './SeatingPreferencePicker';
import type { SeatingPref } from './SeatingPreferencePicker';

function formatTime(slot: string): string {
  const parts = slot.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

type StatusConfig = {
  bg: string;
  border: string;
  text: string;
  label: string;
};

function useStatusConfig(status: ReservationStatus): StatusConfig {
  const { colors } = useTheme();
  switch (status) {
    case 'booked':
      return {
        bg: colors.surface.level2,
        border: colors.border.default,
        text: colors.text.secondary,
        label: 'Booked',
      };
    case 'confirmed':
      return {
        bg: colors.status.available.fill,
        border: colors.status.available.border,
        text: colors.status.available.text,
        label: 'Confirmed',
      };
    case 'checked_in':
      return {
        bg: colors.status.reserved.fill,
        border: colors.status.reserved.border,
        text: colors.status.reserved.text,
        label: 'Checked In',
      };
    case 'canceled':
      return {
        bg: colors.status.dirty.fill,
        border: colors.status.dirty.border,
        text: colors.status.dirty.text,
        label: 'Cancelled',
      };
    case 'seated':
      return {
        bg: colors.status.occupied.fill,
        border: colors.status.occupied.border,
        text: colors.status.occupied.text,
        label: 'Seated',
      };
    case 'completed':
      return {
        bg: colors.status.available.fill,
        border: colors.status.available.border,
        text: colors.status.available.text,
        label: 'Completed',
      };
    case 'no_show':
      return {
        bg: colors.status.dirty.fill,
        border: colors.status.dirty.border,
        text: colors.status.dirty.text,
        label: 'No Show',
      };
    default:
      return {
        bg: colors.surface.level2,
        border: colors.border.default,
        text: colors.text.muted,
        label: status,
      };
  }
}

type ReservationCardProps = {
  reservation: Reservation;
  onPress?: () => void;
  isSelected?: boolean;
  onCall?: () => void;
  onMessage?: () => void;
};

export function ReservationCard({
  reservation,
  onPress,
  isSelected,
  onCall,
  onMessage,
}: ReservationCardProps) {
  const { colors } = useTheme();
  const statusConfig = useStatusConfig(reservation.status);
  const pref = reservation.seatingPreference as SeatingPref;
  const sourceLabel = getReservationSourceLabel(reservation.source);

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
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text.primary }]}>{reservation.guestName}</Text>
          <Text style={[styles.time, { color: colors.text.secondary }]}>
            {formatTime(reservation.timeSlot)}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: statusConfig.bg ?? statusConfig.border,
              borderColor: statusConfig.border,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: statusConfig.text }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={colors.text.muted} />
            <Text style={[styles.metaText, { color: colors.text.secondary }]}>
              {reservation.partySize}
            </Text>
          </View>
          {pref !== 'none' && (
            <View style={[styles.prefChip, { backgroundColor: colors.surface.level3 }]}>
              <Ionicons name={seatingPrefIcon(pref)} size={12} color={colors.text.muted} />
              <Text style={[styles.prefText, { color: colors.text.muted }]}>
                {seatingPrefLabel(pref)}
              </Text>
            </View>
          )}
          {sourceLabel && (
            <View style={styles.metaItem}>
              <Ionicons name="globe-outline" size={14} color={colors.text.muted} />
              <Text style={[styles.metaText, { color: colors.text.secondary }]}>{sourceLabel}</Text>
            </View>
          )}
        </View>
        {(onMessage || onCall) && (
          <View style={styles.actionRow}>
            {onMessage && (
              <TouchableOpacity
                onPress={onMessage}
                accessibilityLabel="Message guest"
                style={[styles.iconButton, { backgroundColor: colors.surface.level2 }]}
              >
                <Ionicons name="chatbubble-outline" size={15} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
            {onCall && (
              <TouchableOpacity
                onPress={onCall}
                accessibilityLabel="Call guest"
                style={[styles.iconButton, { backgroundColor: colors.surface.level2 }]}
              >
                <Ionicons name="call-outline" size={15} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    ...shadows.subtle,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  name: {
    ...textStyles.label,
  },
  time: {
    ...textStyles.caption,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  statusText: {
    ...textStyles.tiny,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...textStyles.caption,
  },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  prefText: {
    ...textStyles.tiny,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
