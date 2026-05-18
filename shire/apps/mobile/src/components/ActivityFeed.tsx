import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, textStyles, useTheme } from '@/theme';
import { useActivityFeed, type ActivityEvent, type ActivityType } from '@/features/host/insights';

const ICON: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
  seat: 'people-outline',
  clear: 'checkmark-circle-outline',
  dirty: 'alert-circle-outline',
  block: 'lock-closed-outline',
  unblock: 'lock-open-outline',
};

function relativeTime(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) {
    return 'Just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  return `${Math.round(mins / 60)}h ago`;
}

function describe(event: ActivityEvent): string {
  switch (event.type) {
    case 'seat':
      return `${event.partyName ?? 'Party'} seated at ${event.tableLabel}`;
    case 'clear':
      return `${event.tableLabel} cleared`;
    case 'dirty':
      return `${event.tableLabel} marked dirty`;
    case 'block':
      return `${event.tableLabel} blocked`;
    case 'unblock':
      return `${event.tableLabel} unblocked`;
    default:
      return event.tableLabel;
  }
}

/** Right-panel reverse-chronological activity feed. */
export function ActivityFeed() {
  const { colors } = useTheme();
  const events = useActivityFeed();

  return (
    <View>
      <Text style={[styles.heading, { color: colors.text.muted }]}>Activity</Text>
      {events.length === 0 ? (
        <Text style={[styles.empty, { color: colors.text.muted }]}>
          Floor activity will appear here.
        </Text>
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: colors.surface.level4 }]}>
              <Ionicons name={ICON[event.type]} size={15} color={colors.text.secondary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.message, { color: colors.text.primary }]} numberOfLines={2}>
                {describe(event)}
              </Text>
              <Text style={[styles.time, { color: colors.text.muted }]}>
                {relativeTime(event.at)}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...textStyles.sectionLabel,
    marginBottom: spacing.sm,
  },
  empty: {
    ...textStyles.caption,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  message: {
    ...textStyles.captionMedium,
  },
  time: {
    ...textStyles.tiny,
    marginTop: 1,
  },
});
