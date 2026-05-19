import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  type LayoutRectangle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, shadows, borderRadius } from '@/theme';
import { useTheme } from '@/theme';
import type { StatusKey } from '@/theme';
import type { WaiterChipData } from '@/features/routing';

type PillKey = 'available' | 'occupied' | 'dirty' | 'blocked';

type TablePopoverProps = {
  visible: boolean;
  presentation?: 'floating' | 'panel';
  onClose: () => void;
  tableId: string;
  tableLabel?: string;
  status: StatusKey;
  isBlocked?: boolean;
  capacity?: number;
  sectionLabel?: string;
  server?: string;
  serverColor?: string;
  partyName?: string;
  currentPartySize?: number | null;
  seatedTime?: string;
  anchorLayout?: LayoutRectangle;
  initialWalkInMode?: boolean;
  selectedPartyName?: string | null;
  nextUpServer?: { name: string; color?: string } | null;
  autoAssignmentLabel?: string | null;
  routingModeLabel?: string;
  onMarkSeated?: () => void;
  onSeatWalkIn?: (size: number, name: string) => void;
  onMarkAvailable?: () => void;
  onMarkDirty?: () => void;
  onBlock?: () => void;
  servers?: WaiterChipData[];
  currentServerId?: string;
  serverOverrideActive?: boolean;
  onChangeServer?: (serverId: string) => void;
  onClearServerAssignment?: () => void;
  seatWarning?: string;
};

const PILLS: { key: PillKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'available', label: 'Open', icon: 'checkmark-circle-outline' },
  { key: 'occupied', label: 'Seated', icon: 'people-outline' },
  { key: 'dirty', label: 'Dirty', icon: 'sparkles-outline' },
  { key: 'blocked', label: 'Block', icon: 'close-circle-outline' },
];

function currentPill(status: StatusKey, isBlocked: boolean): PillKey {
  if (isBlocked) return 'blocked';
  if (status === 'available') return 'available';
  if (status === 'occupied') return 'occupied';
  if (status === 'dirty') return 'dirty';
  return 'available';
}

export function TablePopover({
  visible,
  presentation = 'floating',
  onClose,
  tableId,
  tableLabel,
  status,
  isBlocked = false,
  capacity,
  sectionLabel,
  server,
  serverColor,
  partyName,
  currentPartySize,
  seatedTime,
  anchorLayout,
  initialWalkInMode = false,
  selectedPartyName,
  nextUpServer,
  autoAssignmentLabel,
  routingModeLabel,
  onMarkSeated,
  onSeatWalkIn,
  onMarkAvailable,
  onMarkDirty,
  onBlock,
  servers,
  currentServerId,
  serverOverrideActive = false,
  onChangeServer,
  onClearServerAssignment,
  seatWarning,
}: TablePopoverProps) {
  const { colors, isDark } = useTheme();
  const [serverPickerOpen, setServerPickerOpen] = useState(false);
  const [walkInMode, setWalkInMode] = useState(false);
  const [walkInSize, setWalkInSize] = useState<number | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInCustomOpen, setWalkInCustomOpen] = useState(false);
  const [walkInCustomText, setWalkInCustomText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setWalkInMode(initialWalkInMode);
    setWalkInSize(null);
    setWalkInName('');
    setWalkInCustomOpen(false);
    setWalkInCustomText('');
    setServerPickerOpen(false);
  }, [initialWalkInMode, tableId, visible]);

  const activePill = currentPill(status, isBlocked);

  if (!visible) return null;

  const popoverTop = anchorLayout ? anchorLayout.y + anchorLayout.height + 8 : 200;
  const popoverLeft = anchorLayout
    ? Math.max(16, anchorLayout.x + anchorLayout.width / 2 - 160)
    : 100;

  const popoverBg = isDark ? 'rgba(30, 30, 34, 0.94)' : 'rgba(255, 255, 255, 0.94)';
  const canEditServer = Boolean(servers && onChangeServer);
  const serverLabel = server ?? (canEditServer ? 'Assign waiter' : null);

  const isAvailable = activePill === 'available';
  const isOccupied = activePill === 'occupied';
  const isDirty = activePill === 'dirty';
  const isBlockedActive = activePill === 'blocked';

  const handlePillPress = (target: PillKey) => {
    if (target === activePill) return;

    if (target === 'blocked') {
      onBlock?.();
      return;
    }

    if (isBlockedActive) {
      if (target === 'available') {
        onBlock?.();
      }
      return;
    }

    if (target === 'occupied') {
      if (!isAvailable) return;
      if (selectedPartyName && onMarkSeated) {
        onMarkSeated();
        return;
      }
      if (onSeatWalkIn) {
        setWalkInMode(true);
        setWalkInSize(null);
        setWalkInName('');
        setWalkInCustomOpen(false);
        setWalkInCustomText('');
      }
      return;
    }

    if (target === 'dirty') {
      if (!isAvailable && !isOccupied) return;
      onMarkDirty?.();
      return;
    }

    if (target === 'available') {
      if (isOccupied || isDirty) {
        onMarkAvailable?.();
      }
      return;
    }
  };

  const pillEnabled = (target: PillKey): boolean => {
    if (target === activePill) return false;
    if (isBlockedActive) return target === 'available';
    if (target === 'blocked') return !isOccupied;
    if (target === 'occupied') return isAvailable;
    if (target === 'dirty') return isAvailable || isOccupied;
    if (target === 'available') return isOccupied || isDirty;
    return false;
  };

  const handleSubmitWalkIn = () => {
    const size = walkInCustomOpen ? parseInt(walkInCustomText, 10) : walkInSize;
    if (!size || size < 1) return;
    onSeatWalkIn?.(size, walkInName.trim());
  };

  const walkInSubmitSize = walkInCustomOpen ? parseInt(walkInCustomText, 10) : walkInSize;
  const canSubmitWalkIn = Boolean(walkInSubmitSize && walkInSubmitSize >= 1);
  const isPanel = presentation === 'panel';

  const handleQuickseatCancel = () => {
    if (isPanel) {
      onClose();
      return;
    }
    setWalkInMode(false);
    setWalkInSize(null);
    setWalkInName('');
    setWalkInCustomOpen(false);
    setWalkInCustomText('');
  };
  const popoverCard = (
    <View
      style={[
        styles.popover,
        isPanel
          ? styles.panelPopover
          : {
              top: popoverTop,
              left: popoverLeft,
            },
        {
          borderColor: colors.glass.border,
        },
      ]}
      onStartShouldSetResponder={() => true}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: popoverBg }]} />
      <View style={styles.content}>
        {!isPanel && (
          <View
            style={[
              styles.arrow,
              {
                left: anchorLayout
                  ? anchorLayout.width / 2 + (anchorLayout.x - popoverLeft) - 8
                  : 152,
                backgroundColor: isDark ? '#1E1E22' : colors.surface.level1,
                borderColor: colors.glass.border,
              },
            ]}
          />
        )}

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {isPanel ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Back to waitlist and reservations"
                    onPress={onClose}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.headerBackBtn}
                  >
                    <Ionicons name="chevron-back" size={22} color={colors.text.secondary} />
                  </TouchableOpacity>
                ) : null}
                <Text style={[styles.title, { color: colors.text.primary }]}>
                  Table {tableLabel ?? tableId}
                </Text>
                {sectionLabel && (
                  <View
                    style={[
                      styles.sectionBadge,
                      {
                        backgroundColor: colors.surface.level2,
                        borderColor: colors.border.subtle,
                      },
                    ]}
                  >
                    <Text style={[styles.sectionBadgeText, { color: colors.text.secondary }]}>
                      {sectionLabel}
                    </Text>
                  </View>
                )}
              </View>
              {selectedPartyName && isAvailable && onMarkSeated && !walkInMode && (
                <TouchableOpacity
                  style={[styles.headerCta, { backgroundColor: colors.accent }]}
                  activeOpacity={0.85}
                  onPress={onMarkSeated}
                >
                  <Text style={styles.headerCtaText} numberOfLines={1}>
                    Seat {selectedPartyName}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.white} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.statusStrip}>
              {PILLS.map((pill) => {
                const isActive = pill.key === activePill;
                const enabled = pillEnabled(pill.key);
                const pillColor =
                  pill.key === 'available'
                    ? colors.status.available
                    : pill.key === 'occupied'
                      ? colors.status.occupied
                      : pill.key === 'dirty'
                        ? colors.status.dirty
                        : colors.status.reserved;
                return (
                  <TouchableOpacity
                    key={pill.key}
                    activeOpacity={enabled ? 0.7 : 1}
                    disabled={!enabled && !isActive}
                    onPress={() => handlePillPress(pill.key)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isActive ? pillColor.fill : 'transparent',
                        borderColor: isActive ? pillColor.border : colors.border.subtle,
                        opacity: enabled || isActive ? 1 : 0.35,
                      },
                    ]}
                  >
                    <Ionicons
                      name={pill.icon}
                      size={16}
                      color={isActive ? pillColor.text : colors.text.secondary}
                    />
                    <Text
                      style={[
                        styles.pillText,
                        { color: isActive ? pillColor.text : colors.text.secondary },
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {walkInMode ? (
              <View style={styles.walkInPanel}>
                <Text style={[styles.walkInTitle, { color: colors.text.primary }]}>
                  Add quickseat party
                </Text>
                {autoAssignmentLabel && (
                  <View
                    style={[
                      styles.autoRouteRow,
                      {
                        backgroundColor: colors.surface.level2,
                        borderColor: colors.border.subtle,
                      },
                    ]}
                  >
                    <Ionicons name="git-branch-outline" size={14} color={colors.text.muted} />
                    <Text style={[styles.autoRouteText, { color: colors.text.secondary }]}>
                      {autoAssignmentLabel}
                    </Text>
                  </View>
                )}
                <View style={styles.sizeGrid}>
                  {[1, 2, 3, 4].map((n) => {
                    const isSel = !walkInCustomOpen && walkInSize === n;
                    return (
                      <TouchableOpacity
                        key={n}
                        activeOpacity={0.8}
                        onPress={() => {
                          setWalkInSize(n);
                          setWalkInCustomOpen(false);
                          setWalkInCustomText('');
                        }}
                        style={[
                          styles.sizeTile,
                          {
                            backgroundColor: isSel ? colors.accent : colors.surface.level2,
                            borderColor: isSel ? colors.accent : colors.border.subtle,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sizeTileText,
                            { color: isSel ? colors.white : colors.text.primary },
                          ]}
                        >
                          {n}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setWalkInCustomOpen(true);
                      setWalkInSize(null);
                    }}
                    style={[
                      styles.sizeTile,
                      {
                        backgroundColor: walkInCustomOpen ? colors.accent : colors.surface.level2,
                        borderColor: walkInCustomOpen ? colors.accent : colors.border.subtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sizeTileText,
                        { color: walkInCustomOpen ? colors.white : colors.text.primary },
                      ]}
                    >
                      5+
                    </Text>
                  </TouchableOpacity>
                </View>

                {walkInCustomOpen && (
                  <View
                    style={[
                      styles.walkInCustomRow,
                      {
                        backgroundColor: colors.surface.level2,
                        borderColor: colors.border.subtle,
                      },
                    ]}
                  >
                    <Ionicons name="people-outline" size={16} color={colors.text.muted} />
                    <TextInput
                      style={[styles.walkInCustomInput, { color: colors.text.primary }]}
                      placeholder="Party size"
                      placeholderTextColor={colors.text.muted}
                      keyboardType="number-pad"
                      value={walkInCustomText}
                      onChangeText={setWalkInCustomText}
                      autoFocus
                    />
                  </View>
                )}

                <View
                  style={[
                    styles.walkInNameRow,
                    {
                      backgroundColor: colors.surface.level2,
                      borderColor: colors.border.subtle,
                    },
                  ]}
                >
                  <Ionicons name="person-outline" size={16} color={colors.text.muted} />
                  <TextInput
                    style={[styles.walkInNameInput, { color: colors.text.primary }]}
                    placeholder="Name (optional)"
                    placeholderTextColor={colors.text.muted}
                    value={walkInName}
                    onChangeText={setWalkInName}
                  />
                </View>

                {canEditServer && servers && (
                  <View
                    style={[
                      styles.walkInServerPanel,
                      {
                        borderColor: colors.border.subtle,
                        backgroundColor: colors.surface.level2,
                      },
                    ]}
                  >
                    <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
                      WAITER
                    </Text>
                    {onClearServerAssignment && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={onClearServerAssignment}
                        style={[
                          styles.serverPickerRow,
                          {
                            backgroundColor: !serverOverrideActive
                              ? isDark
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(0,0,0,0.03)'
                              : 'transparent',
                          },
                        ]}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={16}
                          color={!serverOverrideActive ? colors.accent : colors.text.muted}
                        />
                        <Text
                          style={[
                            styles.infoText,
                            { color: colors.text.secondary, flex: 1 },
                            !serverOverrideActive && {
                              color: colors.text.primary,
                              fontWeight: '600',
                            },
                          ]}
                        >
                          Auto route
                        </Text>
                        {!serverOverrideActive && (
                          <Ionicons name="checkmark" size={16} color={colors.accent} />
                        )}
                      </TouchableOpacity>
                    )}
                    {servers.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        activeOpacity={0.7}
                        onPress={() => onChangeServer?.(s.id)}
                        style={[
                          styles.serverPickerRow,
                          {
                            backgroundColor:
                              serverOverrideActive && s.id === currentServerId
                                ? isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.03)'
                                : 'transparent',
                          },
                        ]}
                      >
                        <View style={[styles.serverDotSmall, { backgroundColor: s.color }]} />
                        <Text
                          style={[
                            styles.infoText,
                            { color: colors.text.secondary, flex: 1 },
                            serverOverrideActive && s.id === currentServerId && {
                              color: colors.text.primary,
                              fontWeight: '600',
                            },
                          ]}
                        >
                          {s.name}
                        </Text>
                        {serverOverrideActive && s.id === currentServerId && (
                          <Ionicons name="checkmark" size={16} color={colors.accent} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.walkInActions}>
                  <TouchableOpacity
                    style={[
                      styles.walkInBtn,
                      {
                        backgroundColor: colors.surface.level3,
                        borderColor: colors.border.default,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={handleQuickseatCancel}
                  >
                    <Text style={[styles.walkInBtnText, { color: colors.text.secondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.walkInBtn,
                      {
                        backgroundColor: canSubmitWalkIn ? colors.accent : colors.surface.level3,
                        opacity: canSubmitWalkIn ? 1 : 0.5,
                      },
                    ]}
                    disabled={!canSubmitWalkIn}
                    onPress={handleSubmitWalkIn}
                  >
                    <Text style={[styles.walkInBtnText, { color: colors.white }]}>
                      Seat {walkInSubmitSize ?? ''}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {isAvailable && nextUpServer && (
                  <View style={styles.infoRow}>
                    <Ionicons name="flash-outline" size={14} color={colors.text.muted} />
                    <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                      Next up:
                    </Text>
                    {nextUpServer.color && (
                      <View
                        style={[styles.serverDotSmall, { backgroundColor: nextUpServer.color }]}
                      />
                    )}
                    <Text
                      style={[styles.infoText, { color: colors.text.primary, fontWeight: '600' }]}
                    >
                      {nextUpServer.name}
                    </Text>
                    {routingModeLabel && (
                      <Text style={[styles.infoText, { color: colors.text.muted }]}>
                        ({routingModeLabel})
                      </Text>
                    )}
                  </View>
                )}

                {capacity != null && (
                  <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={14} color={colors.text.muted} />
                    <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                      Seats {capacity}
                    </Text>
                  </View>
                )}

                {(isOccupied || partyName) && (
                  <View
                    style={[
                      styles.guestRow,
                      { borderTopColor: colors.border.subtle },
                    ]}
                  >
                    <View
                      style={[
                        styles.guestAvatar,
                        {
                          backgroundColor: colors.status.occupied.fill,
                          borderColor: colors.status.occupied.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.guestAvatarText, { color: colors.status.occupied.text }]}
                      >
                        {currentPartySize ?? '·'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.guestName, { color: colors.text.primary }]}>
                        {partyName ?? 'Guest'}
                      </Text>
                      {seatedTime && (
                        <Text style={[styles.guestMeta, { color: colors.text.muted }]}>
                          {seatedTime}
                        </Text>
                      )}
                    </View>
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
                    style={[
                      styles.serverRow,
                      { borderTopColor: colors.border.subtle },
                    ]}
                  >
                    <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
                      SERVER
                    </Text>
                    <View style={styles.serverRowInner}>
                      {serverColor ? (
                        <View style={[styles.serverDotSmall, { backgroundColor: serverColor }]} />
                      ) : (
                        <Ionicons name="person-outline" size={16} color={colors.text.muted} />
                      )}
                      <Text
                        style={[styles.infoText, { color: colors.text.primary, flex: 1 }]}
                      >
                        {serverLabel}
                      </Text>
                      {canEditServer && (
                        <Ionicons
                          name={serverPickerOpen ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={colors.text.muted}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                )}

                {serverPickerOpen && servers && onChangeServer && (
                  <View
                    style={[styles.serverPickerList, { borderTopColor: colors.border.subtle }]}
                  >
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
                        <Ionicons
                          name="swap-horizontal-outline"
                          size={16}
                          color={colors.text.muted}
                        />
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
                            backgroundColor:
                              s.id === currentServerId
                                ? isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.03)'
                                : 'transparent',
                          },
                        ]}
                      >
                        <View style={[styles.serverDotSmall, { backgroundColor: s.color }]} />
                        <Text
                          style={[
                            styles.infoText,
                            { color: colors.text.secondary, flex: 1 },
                            s.id === currentServerId && {
                              color: colors.text.primary,
                              fontWeight: '600',
                            },
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

                {seatWarning && (
                  <View
                    style={[
                      styles.warningRow,
                      { backgroundColor: colors.status.reserved.fill },
                    ]}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={14}
                      color={colors.status.reserved.text}
                    />
                    <Text
                      style={[styles.warningText, { color: colors.status.reserved.text }]}
                    >
                      {seatWarning}
                    </Text>
                  </View>
                )}
              </>
            )}
      </View>
    </View>
  );

  if (isPanel) return popoverCard;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {popoverCard}
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
    width: 320,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.elevated,
  },
  panelPopover: {
    position: 'relative',
    width: '100%',
    borderRadius: borderRadius.md,
    shadowOpacity: 0,
    elevation: 0,
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
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    flexShrink: 1,
  },
  headerBackBtn: {
    marginLeft: -4,
    marginRight: -2,
  },
  title: {
    ...textStyles.subtitle,
  },
  sectionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  sectionBadgeText: {
    ...textStyles.tiny,
    fontWeight: '600',
  },
  headerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    maxWidth: 170,
  },
  headerCtaText: {
    ...textStyles.captionMedium,
    color: '#FFFFFF',
    flexShrink: 1,
  },
  statusStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md,
  },
  pill: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  pillText: {
    ...textStyles.tiny,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...textStyles.caption,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
  },
  guestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  guestAvatarText: {
    ...textStyles.subtitle,
    fontWeight: '700',
  },
  guestName: {
    ...textStyles.body,
    fontWeight: '600',
  },
  guestMeta: {
    ...textStyles.tiny,
    marginTop: 2,
  },
  serverRow: {
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
  },
  serverRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...textStyles.tiny,
    letterSpacing: 1,
    fontWeight: '600',
  },
  serverDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serverPickerList: {
    borderTopWidth: 1,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
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
    marginTop: spacing.sm,
  },
  warningText: {
    ...textStyles.tiny,
    fontWeight: '500',
    flex: 1,
  },
  walkInPanel: {
    gap: spacing.sm,
  },
  walkInTitle: {
    ...textStyles.label,
    marginBottom: 2,
  },
  autoRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
  },
  autoRouteText: {
    ...textStyles.tiny,
    flex: 1,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeTile: {
    width: '18%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  sizeTileText: {
    fontSize: 20,
    fontWeight: '700',
  },
  sizeTileMore: {
    ...textStyles.tiny,
    fontWeight: '600',
    marginTop: 2,
  },
  walkInCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  walkInCustomInput: {
    flex: 1,
    ...textStyles.body,
    padding: 0,
  },
  walkInNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  walkInNameInput: {
    flex: 1,
    ...textStyles.body,
    padding: 0,
  },
  walkInServerPanel: {
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  walkInActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  walkInBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  walkInBtnText: {
    ...textStyles.captionMedium,
  },
});
