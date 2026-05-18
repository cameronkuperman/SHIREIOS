import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  const surface = isDark ? 'rgba(30, 30, 34, 0.98)' : 'rgba(255,255,255,0.98)';

  return (
    <View style={styles.root}>
      {open && (
        <>
          {/* Catches taps outside the dropdown to dismiss it. */}
          <Pressable
            style={styles.outsideCatcher}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close room menu"
          />
          <View
            style={[
              styles.dropdown,
              { backgroundColor: surface, borderColor: colors.glass.border },
            ]}
          >
            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownTitle, { color: colors.text.muted }]}>ROOMS</Text>
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
            <ScrollView style={styles.dropdownScroll}>
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
        </>
      )}

      <TouchableOpacity
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? 'rgba(30, 30, 34, 0.92)' : 'rgba(255,255,255,0.95)',
            borderColor: open ? colors.accent : colors.glass.border,
          },
        ]}
        activeOpacity={0.7}
        hitSlop={8}
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Switch room. Current: ${activeRoom?.label ?? 'None'}`}
      >
        <Ionicons name="layers-outline" size={16} color={colors.text.secondary} />
        <Text style={[styles.label, { color: colors.text.primary }]} numberOfLines={1}>
          {activeRoom?.label ?? 'Select room'}
        </Text>
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-up'}
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
  outsideCatcher: {
    position: 'absolute',
    left: -2000,
    right: -2000,
    top: -2000,
    bottom: -2000,
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
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: spacing.sm,
    width: 264,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
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
    maxHeight: 320,
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
