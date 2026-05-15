import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type {
  CreateBlackoutRequest,
  ReservationBlackout,
  UpdateBlackoutRequest,
} from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type BlackoutFormProps = {
  blackout?: ReservationBlackout | null;
  isSaving?: boolean;
  onSubmit: (values: CreateBlackoutRequest | UpdateBlackoutRequest) => Promise<void> | void;
};

export function BlackoutForm({ blackout, isSaving = false, onSubmit }: BlackoutFormProps) {
  const { colors } = useTheme();
  const [name, setName] = useState(blackout?.name ?? '');
  const [startsAt, setStartsAt] = useState(blackout?.startsAt ?? new Date().toISOString());
  const [endsAt, setEndsAt] = useState(
    blackout?.endsAt ?? new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
  );
  const [reason, setReason] = useState(blackout?.reason ?? '');
  const [allDay, setAllDay] = useState(blackout?.allDay ?? false);
  const [active, setActive] = useState(blackout?.active ?? true);
  const canSubmit =
    name.trim().length > 0 && startsAt.trim().length > 0 && endsAt.trim().length > 0;

  const submit = () => {
    if (new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
      Alert.alert('Invalid Range', 'The start time must be before the end time.');
      return;
    }
    onSubmit({
      name: name.trim(),
      startsAt: startsAt.trim(),
      endsAt: endsAt.trim(),
      allDay,
      active,
      reason: reason.trim() || undefined,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text.primary }]}>Name</Text>
      <TextInput
        style={[styles.input, { color: colors.text.primary, borderColor: colors.glass.border }]}
        value={name}
        onChangeText={setName}
        placeholder="Private event"
        placeholderTextColor={colors.text.muted}
      />
      <Text style={[styles.label, { color: colors.text.primary }]}>Starts At</Text>
      <TextInput
        style={[styles.input, { color: colors.text.primary, borderColor: colors.glass.border }]}
        value={startsAt}
        onChangeText={setStartsAt}
        placeholder="2026-05-20T17:00:00Z"
        placeholderTextColor={colors.text.muted}
      />
      <Text style={[styles.label, { color: colors.text.primary }]}>Ends At</Text>
      <TextInput
        style={[styles.input, { color: colors.text.primary, borderColor: colors.glass.border }]}
        value={endsAt}
        onChangeText={setEndsAt}
        placeholder="2026-05-20T22:00:00Z"
        placeholderTextColor={colors.text.muted}
      />
      <Text style={[styles.label, { color: colors.text.primary }]}>Reason</Text>
      <TextInput
        style={[styles.input, { color: colors.text.primary, borderColor: colors.glass.border }]}
        value={reason}
        onChangeText={setReason}
        placeholder="Internal note"
        placeholderTextColor={colors.text.muted}
      />
      <TouchableOpacity style={styles.toggleRow} onPress={() => setAllDay((current) => !current)}>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: allDay ? colors.accent : colors.surface.level2,
              borderColor: colors.glass.border,
            },
          ]}
        />
        <Text style={[styles.toggleText, { color: colors.text.primary }]}>All day</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toggleRow} onPress={() => setActive((current) => !current)}>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: active ? colors.accent : colors.surface.level2,
              borderColor: colors.glass.border,
            },
          ]}
        />
        <Text style={[styles.toggleText, { color: colors.text.primary }]}>Active</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.submit,
          { backgroundColor: colors.accent },
          (!canSubmit || isSaving) && styles.disabled,
        ]}
        disabled={!canSubmit || isSaving}
        onPress={submit}
      >
        <Text style={styles.submitText}>{blackout ? 'Save Blackout' : 'Create Blackout'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  label: { ...textStyles.captionMedium },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...textStyles.body,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
  },
  toggleText: { ...textStyles.body },
  submit: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  submitText: { ...textStyles.label, color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
