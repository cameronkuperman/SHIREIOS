import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

export type RoomOption = {
  id: string;
  label: string;
  tableCount?: number;
};

type RoomPickerProps = {
  rooms: RoomOption[];
  activeRoomId: string;
  onSelect: (roomId: string) => void;
  onManagePress: () => void;
};

export function RoomPicker({ rooms, activeRoomId, onSelect, onManagePress }: RoomPickerProps) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? 'rgba(40, 40, 44, 0.92)' : 'rgba(255,255,255,0.95)',
          borderColor: colors.glass.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.manageButton}
        onPress={onManagePress}
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityLabel="Manage rooms"
      >
        <Ionicons name="settings-outline" size={18} color={colors.text.secondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.selector}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectorLabel, { color: colors.text.primary }]} numberOfLines={1}>
          {activeRoom?.label ?? 'Select room'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.text.secondary} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark ? 'rgba(30, 30, 34, 0.98)' : 'rgba(255,255,255,0.98)',
                borderColor: colors.glass.border,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.sheetTitle, { color: colors.text.muted }]}>ROOMS</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {rooms.map((room) => {
                const isActive = room.id === activeRoomId;
                return (
                  <TouchableOpacity
                    key={room.id}
                    style={[
                      styles.option,
                      isActive && { backgroundColor: colors.accentLight },
                    ]}
                    onPress={() => {
                      onSelect(room.id);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
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
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    ...shadows.subtle,
  },
  manageButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 140,
  },
  selectorLabel: {
    ...textStyles.label,
    fontWeight: '600',
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing['2xl'],
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing['3xl'],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.elevated,
  },
  sheetTitle: {
    ...textStyles.sectionLabel,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
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
