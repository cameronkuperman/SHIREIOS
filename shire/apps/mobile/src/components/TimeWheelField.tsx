import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { borderRadius, fontFamily, spacing, textStyles, useTheme } from '@/theme';
import { formatSlotLabel, roundUpToInterval } from './reservationTimeSlots';

type MinuteInterval = 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;

type TimeWheelFieldProps = {
  value: string | null;
  onChange: (value: string) => void;
  partySize?: number;
  minuteInterval?: MinuteInterval;
  disabled?: boolean;
  testID?: string;
  variant?: 'default' | 'compact';
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
  variant = 'default',
}: TimeWheelFieldProps) {
  const { colors, isDark } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [draft, setDraft] = useState(() => toAnchorDate(value, minuteInterval));
  const isCompact = variant === 'compact';

  const label = useMemo(() => {
    if (!value) {
      return isCompact ? '--:--' : 'Select a time';
    }
    return isCompact ? value : formatSlotLabel(value);
  }, [isCompact, value]);

  const commit = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      onChange(format(date, 'HH:mm'));
    },
    [onChange],
  );

  const openPicker = useCallback(() => {
    setDraft(toAnchorDate(value, minuteInterval));
    setPickerVisible(true);
  }, [value, minuteInterval]);

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
    openPicker();
  }, [disabled, handleAndroidPress, openPicker]);

  const handleDraftChange = useCallback((_event: DateTimePickerEvent, date?: Date) => {
    if (date) setDraft(date);
  }, []);

  const handleConfirm = useCallback(() => {
    commit(draft);
    setPickerVisible(false);
  }, [commit, draft]);

  const handleCancel = useCallback(() => {
    setPickerVisible(false);
  }, []);

  const accessibilityLabel =
    `Time, ${value ? formatSlotLabel(value) : 'unset'}` +
    (partySize ? `, party of ${partySize}` : '');

  return (
    <View testID={testID}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={disabled}
        style={[
          isCompact ? styles.compactField : styles.field,
          {
            backgroundColor: colors.surface.level2,
            borderColor: isCompact ? colors.border.subtle : colors.glass.borderSubtle,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {!isCompact && <Ionicons name="time-outline" size={18} color={colors.text.muted} />}
        <Text
          style={[
            isCompact ? styles.compactLabel : styles.fieldLabel,
            { color: value ? colors.text.primary : colors.text.muted },
          ]}
        >
          {label}
        </Text>
        {!isCompact && <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />}
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={handleCancel}
        >
          <Pressable style={styles.modalBackdrop} onPress={handleCancel}>
            <Pressable
              style={[styles.modalSheet, { backgroundColor: colors.surface.level1 }]}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.border.subtle }]}>
                <TouchableOpacity onPress={handleCancel} hitSlop={8}>
                  <Text style={[styles.modalAction, { color: colors.text.secondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Time</Text>
                <TouchableOpacity onPress={handleConfirm} hitSlop={8}>
                  <Text style={[styles.modalAction, { color: colors.accent }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                mode="time"
                display="spinner"
                themeVariant={isDark ? 'dark' : 'light'}
                value={draft}
                minuteInterval={minuteInterval}
                onChange={handleDraftChange}
              />
            </Pressable>
          </Pressable>
        </Modal>
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
  compactField: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compactLabel: {
    ...textStyles.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    fontWeight: '600',
  },
  modalAction: {
    ...textStyles.body,
    minWidth: 56,
  },
});
