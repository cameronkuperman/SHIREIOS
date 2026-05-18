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

export function FloorRoomPill({
  rooms,
  activeRoomId,
  onSelect,
  onManagePress,
}: FloorRoomPillProps) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];

  return (
    <>
      <TouchableOpacity
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? 'rgba(30, 30, 34, 0.92)' : 'rgba(255,255,255,0.95)',
            borderColor: colors.glass.border,
          },
        ]}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Switch room. Current: ${activeRoom?.label ?? 'None'}`}
      >
        <Ionicons name="layers-outline" size={16} color={colors.text.secondary} />
        <Text style={[styles.label, { color: colors.text.primary }]} numberOfLines={1}>
          {activeRoom?.label ?? 'Select room'}
        </Text>
        <Ionicons name="chevron-up" size={14} color={colors.text.secondary} />
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
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text.muted }]}>ROOMS</Text>
              {onManagePress && (
                <TouchableOpacity
                  onPress={() => {
                    setOpen(false);
                    onManagePress();
                  }}
                  hitSlop={8}
                  accessibilityLabel="Manage floor map"
                >
                  <Ionicons name="settings-outline" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {rooms.map((room) => {
                const isActive = room.id === activeRoomId;
                return (
                  <TouchableOpacity
                    key={room.id}
                    style={[styles.option, isActive && { backgroundColor: colors.accentLight }]}
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
    </>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: spacing['2xl'],
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    width: 320,
    maxWidth: '100%',
    marginBottom: spacing['3xl'],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.elevated,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    ...textStyles.sectionLabel,
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
