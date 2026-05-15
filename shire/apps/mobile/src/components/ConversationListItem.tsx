import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Conversation } from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type ConversationListItemProps = {
  conversation: Conversation;
  selected?: boolean;
  onPress: () => void;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ConversationListItem({
  conversation,
  selected = false,
  onPress,
}: ConversationListItemProps) {
  const { colors } = useTheme();
  const displayName =
    conversation.displayName && conversation.displayName !== 'Unknown'
      ? conversation.displayName
      : `Unknown ${conversation.phoneLast4 ? `(${conversation.phoneLast4})` : ''}`;

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: selected ? colors.accentLight : colors.surface.level1,
          borderColor: selected ? colors.accent : colors.glass.border,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surface.level3 }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text.secondary} />
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.time, { color: colors.text.muted }]}>
            {formatTime(conversation.lastMessageAt)}
          </Text>
        </View>
        <Text style={[styles.preview, { color: colors.text.secondary }]} numberOfLines={1}>
          {conversation.lastMessagePreview || conversation.phoneE164}
        </Text>
        <View style={styles.metaRow}>
          {conversation.activeWaitlistId && (
            <Text style={[styles.metaPill, { color: colors.status.reserved.text }]}>Waitlist</Text>
          )}
          {conversation.activeReservationId && (
            <Text style={[styles.metaPill, { color: colors.status.occupied.text }]}>
              Reservation
            </Text>
          )}
          {conversation.archivedAt && (
            <Text style={[styles.metaPill, { color: colors.text.muted }]}>Archived</Text>
          )}
        </View>
      </View>
      {conversation.unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...textStyles.label,
    flex: 1,
  },
  time: {
    ...textStyles.tiny,
  },
  preview: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaPill: {
    ...textStyles.tiny,
    textTransform: 'uppercase',
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    ...textStyles.tiny,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
