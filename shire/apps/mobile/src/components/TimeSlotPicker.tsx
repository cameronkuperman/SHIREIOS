import React from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { textStyles, spacing, borderRadius } from '@/theme';
import { useTheme } from '@/theme';

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 11; hour <= 21; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 22) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  slots.push('22:00');
  return slots;
}

const TIME_SLOTS = generateSlots();

function formatSlotLabel(slot: string): string {
  const parts = slot.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export type TimeSlotOption = {
  value: string;
  label?: string;
  disabled?: boolean;
  reason?: string | null;
};

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
  const options: TimeSlotOption[] = slots ?? TIME_SLOTS.map((slot) => ({ value: slot }));

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
