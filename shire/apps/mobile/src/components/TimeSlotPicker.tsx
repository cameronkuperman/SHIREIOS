import React from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
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
              styles.chip,
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
                opacity: isUnavailable && !isActive ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: isActive ? colors.accent : colors.text.secondary },
              ]}
            >
              {slot.label ?? formatSlotLabel(slot.value)}
              {isUnavailable ? ' · Full' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...textStyles.captionMedium,
  },
});
