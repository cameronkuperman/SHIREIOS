import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';
import { formatSlotLabel, roundUpToInterval } from './reservationTimeSlots';

type MinuteInterval = 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;

type TimeWheelFieldProps = {
  value: string | null;
  onChange: (value: string) => void;
  partySize?: number;
  minuteInterval?: MinuteInterval;
  disabled?: boolean;
  testID?: string;
};

function toAnchorDate(value: string | null, intervalMin: number): Date {
  const hhmm = value ?? roundUpToInterval(new Date(), intervalMin);
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h ?? 0, m ?? 0, 0, 0);
}

export function TimeWheelField({
  value,
  onChange,
  partySize,
  minuteInterval = 15,
  disabled = false,
  testID,
}: TimeWheelFieldProps) {
  const { colors, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const label = useMemo(
    () => (value ? formatSlotLabel(value) : 'Select a time'),
    [value],
  );

  const commit = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      onChange(format(date, 'HH:mm'));
    },
    [onChange],
  );

  const handleAndroidPress = useCallback(() => {
    DateTimePickerAndroid.open({
      value: toAnchorDate(value, minuteInterval),
      mode: 'time',
      minuteInterval,
      is24Hour: false,
      onChange: (event: DateTimePickerEvent, date?: Date) => {
        if (event.type === 'set') commit(date);
      },
    });
  }, [value, minuteInterval, commit]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      handleAndroidPress();
      return;
    }
    setIsOpen((open) => !open);
  }, [disabled, handleAndroidPress]);

  const handleSpinnerChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      commit(date);
    },
    [commit],
  );

  const accessibilityLabel =
    `Time, ${value ? formatSlotLabel(value) : 'unset'}` +
    (partySize ? `, party of ${partySize}` : '');

  return (
    <View testID={testID}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, expanded: isOpen }}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={disabled}
        style={[
          styles.field,
          {
            backgroundColor: colors.surface.level2,
            borderColor: isOpen ? colors.accent : colors.glass.borderSubtle,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons name="time-outline" size={18} color={colors.text.muted} />
        <Text
          style={[
            styles.fieldLabel,
            { color: value ? colors.text.primary : colors.text.muted },
          ]}
        >
          {label}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {isOpen && Platform.OS === 'ios' && (
        <View style={styles.wheelWrap}>
          <DateTimePicker
            mode="time"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            value={toAnchorDate(value, minuteInterval)}
            minuteInterval={minuteInterval}
            onChange={handleSpinnerChange}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fieldLabel: {
    ...textStyles.body,
    flex: 1,
  },
  wheelWrap: {
    marginTop: spacing.sm,
  },
});
