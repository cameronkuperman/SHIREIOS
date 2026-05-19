import React, { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type LayoutRectangle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

export type FloorRoomOption = {
  id: string;
  label: string;
  tableCount?: number;
};

type FloorRoomPillProps = {
  rooms: FloorRoomOption[];
  activeRoomId: string;
  onSelect: (roomId: string) => void;
  onManagePress?: () => void;
};

const SHEET_WIDTH = 292;
const SHEET_GAP = spacing.sm;

/** Room menu anchors to the pill via measureInWindow; backdrop is a sibling Pressable (not wrapping the sheet). */

export function FloorRoomPill({
  rooms,
  activeRoomId,
  onSelect,
  onManagePress,
}: FloorRoomPillProps) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const pillRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];

  const surface = isDark ? 'rgba(30, 30, 34, 0.98)' : 'rgba(255,255,255,0.98)';

  const closeMenu = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openMenu = useCallback(() => {
    pillRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const sheetWidth = Math.min(SHEET_WIDTH, windowWidth - spacing.lg * 2);
  const sheetLeft = anchor
    ? Math.min(Math.max(spacing.md, anchor.x), windowWidth - sheetWidth - spacing.md)
    : spacing.lg;
  const sheetBottom = anchor ? Math.max(spacing.md, windowHeight - anchor.y + SHEET_GAP) : spacing['3xl'];

  return (
    <View style={styles.root} ref={pillRef} collapsable={false}>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeMenu}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeMenu}
            accessibilityLabel="Close room menu"
          />
          {anchor ? (
            <View
              style={[
                styles.sheet,
                {
                  left: sheetLeft,
                  bottom: sheetBottom,
                  width: sheetWidth,
                  backgroundColor: surface,
                  borderColor: colors.glass.border,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.dropdownHeader}>
                <Text style={[styles.dropdownTitle, { color: colors.text.muted }]}>ROOMS</Text>
                {onManagePress && (
                  <TouchableOpacity
                    onPress={() => {
                      closeMenu();
                      onManagePress();
                    }}
                    hitSlop={8}
                    accessibilityLabel="Manage floor map"
                  >
                    <Ionicons name="settings-outline" size={16} color={colors.text.secondary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                {rooms.map((room) => {
                  const isActive = room.id === activeRoomId;
                  return (
                    <TouchableOpacity
                      key={room.id}
                      style={[styles.option, isActive && { backgroundColor: colors.accentLight }]}
                      onPress={() => {
                        onSelect(room.id);
                        closeMenu();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionText}>
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: isActive ? colors.accent : colors.text.primary },
                          ]}
                        >
                          {room.label}
                        </Text>
                        {room.tableCount != null && (
                          <Text style={[styles.optionMeta, { color: colors.text.muted }]}>
                            {room.tableCount} table{room.tableCount === 1 ? '' : 's'}
                          </Text>
                        )}
                      </View>
                      {isActive && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      <TouchableOpacity
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? 'rgba(30, 30, 34, 0.92)' : 'rgba(255,255,255,0.95)',
            borderColor: open ? colors.accent : colors.glass.border,
          },
        ]}
        activeOpacity={0.7}
        hitSlop={12}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Switch room. Current: ${activeRoom?.label ?? 'None'}`}
      >
        <Ionicons name="layers-outline" size={16} color={colors.text.secondary} />
        <Text style={[styles.label, { color: colors.text.primary }]} numberOfLines={1}>
          {activeRoom?.label ?? 'Select room'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.text.secondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    minWidth: 140,
    ...shadows.subtle,
  },
  label: {
    ...textStyles.label,
    fontWeight: '600',
    flexShrink: 1,
    flexGrow: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  sheet: {
    position: 'absolute',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    maxHeight: 320,
    ...shadows.elevated,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dropdownTitle: {
    ...textStyles.sectionLabel,
  },
  dropdownScroll: {
    maxHeight: 260,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    ...textStyles.body,
    fontWeight: '500',
  },
  optionMeta: {
    ...textStyles.caption,
    marginTop: 2,
  },
});
