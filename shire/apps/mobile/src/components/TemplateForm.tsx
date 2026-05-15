import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type {
  CreateMessageTemplateRequest,
  MessageTemplate,
  MessageTemplateCategory,
  UpdateMessageTemplateRequest,
} from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';
import { renderPreview } from '@/features/messaging/templateRenderer';

const CATEGORIES: MessageTemplateCategory[] = ['waitlist', 'reservation', 'host'];

type TemplateFormProps = {
  template?: MessageTemplate | null;
  isSaving?: boolean;
  onSubmit: (
    values: CreateMessageTemplateRequest | UpdateMessageTemplateRequest,
  ) => Promise<void> | void;
};

export function TemplateForm({ template, isSaving = false, onSubmit }: TemplateFormProps) {
  const { colors } = useTheme();
  const [name, setName] = useState(template?.name ?? '');
  const [key, setKey] = useState(template?.key ?? '');
  const [category, setCategory] = useState<MessageTemplateCategory>(template?.category ?? 'host');
  const [body, setBody] = useState(template?.body ?? '');
  const [active, setActive] = useState(template?.active ?? true);
  const canSubmit = name.trim().length > 0 && key.trim().length > 0 && body.trim().length > 0;
  const preview = useMemo(
    () =>
      renderPreview(body, {
        restaurantName: 'Shire',
        partySize: 4,
        reservationLabel: 'tonight at 7:30 PM',
        messageBody: 'Your table is ready.',
      }),
    [body],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text.primary }]}>Name</Text>
      <TextInput
        style={[styles.input, { color: colors.text.primary, borderColor: colors.glass.border }]}
        value={name}
        onChangeText={setName}
        placeholder="Template name"
        placeholderTextColor={colors.text.muted}
      />
      <Text style={[styles.label, { color: colors.text.primary }]}>Key</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text.primary,
            borderColor: colors.glass.border,
            opacity: template ? 0.6 : 1,
          },
        ]}
        value={key}
        onChangeText={setKey}
        editable={!template}
        placeholder="custom_key"
        placeholderTextColor={colors.text.muted}
      />
      <View style={styles.categoryRow}>
        {CATEGORIES.map((option) => {
          const selected = option === category;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selected ? colors.accentLight : colors.surface.level2,
                  borderColor: selected ? colors.accent : colors.glass.borderSubtle,
                },
              ]}
              onPress={() => setCategory(option)}
            >
              <Text
                style={[
                  styles.categoryLabel,
                  { color: selected ? colors.accent : colors.text.secondary },
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.label, { color: colors.text.primary }]}>Body</Text>
      <TextInput
        style={[styles.textArea, { color: colors.text.primary, borderColor: colors.glass.border }]}
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="SMS body"
        placeholderTextColor={colors.text.muted}
      />
      <TouchableOpacity style={styles.toggleRow} onPress={() => setActive((current) => !current)}>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: active ? colors.accent : colors.surface.level2,
              borderColor: active ? colors.accent : colors.glass.border,
            },
          ]}
        />
        <Text style={[styles.toggleText, { color: colors.text.primary }]}>Active</Text>
      </TouchableOpacity>
      <View
        style={[
          styles.previewBox,
          { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
        ]}
      >
        <Text style={[styles.previewLabel, { color: colors.text.muted }]}>Preview</Text>
        <Text style={[styles.preview, { color: colors.text.primary }]}>{preview}</Text>
      </View>
      <TouchableOpacity
        style={[
          styles.submit,
          { backgroundColor: colors.accent },
          (!canSubmit || isSaving) && styles.disabled,
        ]}
        disabled={!canSubmit || isSaving}
        onPress={() =>
          onSubmit(
            template
              ? { name: name.trim(), category, body: body.trim(), active }
              : {
                  key: key.trim(),
                  name: name.trim(),
                  category,
                  body: body.trim(),
                  active,
                  channel: 'sms',
                },
          )
        }
      >
        <Text style={styles.submitText}>{template ? 'Save Template' : 'Create Template'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  label: {
    ...textStyles.captionMedium,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...textStyles.body,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    ...textStyles.body,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryLabel: {
    ...textStyles.captionMedium,
    textTransform: 'capitalize',
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
  toggleText: {
    ...textStyles.body,
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  previewLabel: {
    ...textStyles.tiny,
    textTransform: 'uppercase',
  },
  preview: {
    ...textStyles.body,
  },
  submit: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  submitText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
});
