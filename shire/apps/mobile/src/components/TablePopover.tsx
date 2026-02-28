import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  type LayoutRectangle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, shadows, borderRadius } from '@/theme';
import { useTheme } from '@/theme';
import type { StatusKey } from '@/theme';

type TablePopoverProps = {
  visible: boolean;
  onClose: () => void;
  tableId: string;
  status: StatusKey;
  capacity?: number;
  server?: string;
  partyName?: string;
  seatedTime?: string;
  anchorLayout?: LayoutRectangle;
  onSeat?: () => void;
  onClear?: () => void;
  onBlock?: () => void;
};

const STATUS_LABELS: Record<StatusKey, string> = {
  available: 'Available',
  occupied: 'Occupied',
  dirty: 'Needs Cleaning',
  reserved: 'Reserved',
};

export function TablePopover({
  visible,
  onClose,
  tableId,
  status,
  capacity,
  server,
  partyName,
  seatedTime,
  anchorLayout,
  onSeat,
  onClear,
  onBlock,
}: TablePopoverProps) {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  const popoverTop = anchorLayout ? anchorLayout.y + anchorLayout.height + 8 : 200;
  const popoverLeft = anchorLayout
    ? Math.max(16, anchorLayout.x + anchorLayout.width / 2 - 130)
    : 100;

  const statusColor = colors.status[status];
  const popoverBg = isDark ? 'rgba(30, 30, 34, 0.92)' : 'rgba(255, 255, 255, 0.92)';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.popover,
            {
              top: popoverTop,
              left: popoverLeft,
              borderColor: colors.glass.border,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Translucent background (replaces BlurView) */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: popoverBg }]} />
          <View style={styles.content}>
            {/* Arrow indicator */}
            <View
              style={[
                styles.arrow,
                {
                  left: anchorLayout
                    ? anchorLayout.width / 2 + (anchorLayout.x - popoverLeft) - 8
                    : 122,
                  backgroundColor: isDark ? '#1E1E22' : colors.surface.level1,
                  borderColor: colors.glass.border,
                },
              ]}
            />

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text.primary }]}>
                Table {tableId}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor.fill, borderColor: statusColor.border },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColor.text }]}>
                  {STATUS_LABELS[status]}
                </Text>
              </View>
            </View>

            {/* Info rows */}
            {capacity != null && (
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={16} color={colors.text.muted} />
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                  Seats {capacity}
                </Text>
              </View>
            )}
            {server && (
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={16} color={colors.text.muted} />
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                  {server}
                </Text>
              </View>
            )}
            {partyName && (
              <View style={styles.infoRow}>
                <Ionicons name="restaurant-outline" size={16} color={colors.text.muted} />
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                  {partyName}
                </Text>
              </View>
            )}
            {seatedTime && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.text.muted} />
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                  {seatedTime}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={[styles.actions, { borderTopColor: colors.border.subtle }]}>
              {status === 'available' && onSeat && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                  onPress={onSeat}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.actionPrimaryText}>Seat</Text>
                </TouchableOpacity>
              )}
              {status === 'occupied' && onClear && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                  onPress={onClear}
                >
                  <Ionicons name="checkmark-done-outline" size={18} color={colors.white} />
                  <Text style={styles.actionPrimaryText}>Clear</Text>
                </TouchableOpacity>
              )}
              {status === 'dirty' && onClear && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                  onPress={onClear}
                >
                  <Ionicons name="sparkles-outline" size={18} color={colors.white} />
                  <Text style={styles.actionPrimaryText}>Mark Clean</Text>
                </TouchableOpacity>
              )}
              {status === 'reserved' && onSeat && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                  onPress={onSeat}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                  <Text style={styles.actionPrimaryText}>Seat</Text>
                </TouchableOpacity>
              )}
              {onBlock && (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: colors.surface.level3,
                      borderWidth: 1,
                      borderColor: colors.border.default,
                    },
                  ]}
                  onPress={onBlock}
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.text.secondary} />
                  <Text style={[styles.actionSecondaryText, { color: colors.text.secondary }]}>
                    Block
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  popover: {
    position: 'absolute',
    width: 260,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.elevated,
  },
  content: {
    padding: spacing.lg,
  },
  arrow: {
    position: 'absolute',
    top: -8,
    width: 16,
    height: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...textStyles.subtitle,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  statusText: {
    ...textStyles.tiny,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...textStyles.caption,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionPrimaryText: {
    ...textStyles.captionMedium,
    color: '#FFFFFF',
  },
  actionSecondaryText: {
    ...textStyles.captionMedium,
  },
});
