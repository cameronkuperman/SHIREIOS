import React, { useState } from 'react';
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
import type { WaiterChipData } from '@/features/routing';

type TablePopoverProps = {
  visible: boolean;
  onClose: () => void;
  tableId: string;
  tableLabel?: string;
  status: StatusKey;
  isBlocked?: boolean;
  capacity?: number;
  server?: string;
  serverColor?: string;
  partyName?: string;
  seatedTime?: string;
  anchorLayout?: LayoutRectangle;
  onSeat?: () => void;
  onClear?: () => void;
  onBlock?: () => void;
  blockActionLabel?: string;
  servers?: WaiterChipData[];
  currentServerId?: string;
  onChangeServer?: (serverId: string) => void;
  onClearServerAssignment?: () => void;
  seatWarning?: string;
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
  tableLabel,
  status,
  isBlocked = false,
  capacity,
  server,
  serverColor,
  partyName,
  seatedTime,
  anchorLayout,
  onSeat,
  onClear,
  onBlock,
  blockActionLabel = 'Block',
  servers,
  currentServerId,
  onChangeServer,
  onClearServerAssignment,
  seatWarning,
}: TablePopoverProps) {
  const { colors, isDark } = useTheme();
  const [serverPickerOpen, setServerPickerOpen] = useState(false);

  if (!visible) return null;

  const popoverTop = anchorLayout ? anchorLayout.y + anchorLayout.height + 8 : 200;
  const popoverLeft = anchorLayout
    ? Math.max(16, anchorLayout.x + anchorLayout.width / 2 - 130)
    : 100;

  const statusColor = colors.status[status];
  const popoverBg = isDark ? 'rgba(30, 30, 34, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  const canEditServer = Boolean(servers && onChangeServer);
  const serverLabel = server ?? (canEditServer ? 'Assign waiter' : null);

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
                Table {tableLabel ?? tableId}
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
            {serverLabel && (
              <TouchableOpacity
                activeOpacity={canEditServer ? 0.7 : 1}
                disabled={!canEditServer}
                onPress={() => {
                  if (canEditServer) {
                    setServerPickerOpen(!serverPickerOpen);
                  }
                }}
                style={styles.infoRow}
              >
                {serverColor ? (
                  <View style={[styles.serverDotSmall, { backgroundColor: serverColor }]} />
                ) : (
                  <Ionicons name="person-outline" size={16} color={colors.text.muted} />
                )}
                <Text style={[styles.infoText, { color: colors.text.secondary, flex: 1 }]}>
                  {serverLabel}
                </Text>
                {canEditServer && (
                  <Ionicons
                    name={serverPickerOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.text.muted}
                  />
                )}
              </TouchableOpacity>
            )}
            {serverPickerOpen && servers && onChangeServer && (
              <View style={[styles.serverPickerList, { borderTopColor: colors.border.subtle }]}>
                {onClearServerAssignment && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      onClearServerAssignment();
                      setServerPickerOpen(false);
                    }}
                    style={[
                      styles.serverPickerRow,
                      {
                        backgroundColor:
                          currentServerId == null
                            ? isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.03)'
                            : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons name="swap-horizontal-outline" size={16} color={colors.text.muted} />
                    <Text
                      style={[
                        styles.infoText,
                        { color: colors.text.secondary, flex: 1 },
                        currentServerId == null && {
                          color: colors.text.primary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      Auto Assign
                    </Text>
                    {currentServerId == null && (
                      <Ionicons name="checkmark" size={16} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                )}
                {servers.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      onChangeServer(s.id);
                      setServerPickerOpen(false);
                    }}
                    style={[
                      styles.serverPickerRow,
                      {
                        backgroundColor: s.id === currentServerId
                          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)')
                          : 'transparent',
                      },
                    ]}
                  >
                    <View style={[styles.serverDotSmall, { backgroundColor: s.color }]} />
                    <Text
                      style={[
                        styles.infoText,
                        { color: colors.text.secondary, flex: 1 },
                        s.id === currentServerId && { color: colors.text.primary, fontWeight: '600' },
                      ]}
                    >
                      {s.name}
                    </Text>
                    {s.id === currentServerId && (
                      <Ionicons name="checkmark" size={16} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                ))}
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

            {/* Seating preference warning */}
            {seatWarning && (
              <View style={[styles.warningRow, { backgroundColor: colors.status.reserved.fill }]}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.status.reserved.text} />
                <Text style={[styles.warningText, { color: colors.status.reserved.text }]}>
                  {seatWarning}
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
              {status === 'reserved' && !isBlocked && onSeat && (
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
                    {blockActionLabel}
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
  serverDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serverPickerList: {
    borderTopWidth: 1,
    paddingTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  serverPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  warningText: {
    ...textStyles.tiny,
    fontWeight: '500',
    flex: 1,
  },
});
