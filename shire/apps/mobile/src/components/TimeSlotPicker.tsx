import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { textStyles, spacing, borderRadius } from '@/theme';
import { useTheme } from '@/theme';
import { formatSlotLabel, resolveTimeSlotOptions, type TimeSlotOption } from './reservationTimeSlots';

type TimeSlotPickerProps = {
  value: string | null;
  onChange: (slot: string) => void;
  slots?: TimeSlotOption[];
  allowUnavailableSelection?: boolean;
};

export function TimeSlotPicker({
  value,
  onChange,
  slots,
  allowUnavailableSelection = false,
}: TimeSlotPickerProps) {
  const { colors } = useTheme();
  const options = resolveTimeSlotOptions(slots, value);

  return (
    <View style={styles.grid}>
      {options.map((slot) => {
        const isActive = value === slot.value;
        const isUnavailable = Boolean(slot.disabled);
        return (
          <TouchableOpacity
            key={slot.value}
            activeOpacity={0.7}
            onPress={() => {
              if (!isUnavailable || allowUnavailableSelection) {
                onChange(slot.value);
              }
            }}
            style={[
              styles.cell,
              {
                backgroundColor: isActive
                  ? colors.accentLight
                  : isUnavailable
                    ? colors.surface.level1
                    : colors.surface.level2,
                borderColor: isActive
                  ? colors.accent
                  : isUnavailable
                    ? colors.border.subtle
                    : colors.glass.borderSubtle,
                opacity: isUnavailable && !isActive ? 0.55 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.cellText,
                {
                  color: isActive
                    ? colors.accent
                    : isUnavailable
                      ? colors.text.muted
                      : colors.text.primary,
                },
              ]}
              numberOfLines={1}
            >
              {slot.label ?? formatSlotLabel(slot.value)}
            </Text>
            {isUnavailable ? (
              <Text style={[styles.fullLabel, { color: colors.text.muted }]} numberOfLines={1}>
                Full
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    width: '23%',
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 2,
  },
  cellText: {
    ...textStyles.captionMedium,
    textAlign: 'center',
  },
  fullLabel: {
    ...textStyles.caption,
    fontSize: 10,
    textAlign: 'center',
  },
});
