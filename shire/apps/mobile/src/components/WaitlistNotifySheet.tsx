import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MessageTemplate } from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';
import { renderPreview } from '@/features/messaging/templateRenderer';

type WaitlistNotifySheetProps = {
  visible: boolean;
  resetKey?: string | null;
  templates: MessageTemplate[];
  partyName: string;
  partySize: number;
  isSending?: boolean;
  onClose: () => void;
  onSend: (input: { templateId?: string; messageBody?: string; notes?: string }) => Promise<void>;
};

export function WaitlistNotifySheet({
  visible,
  resetKey,
  templates,
  partyName,
  partySize,
  isSending = false,
  onClose,
  onSend,
}: WaitlistNotifySheetProps) {
  const { colors, isDark } = useTheme();
  const waitlistTemplates = templates.filter(
    (template) => template.active && template.category === 'waitlist',
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    waitlistTemplates[0]?.id ?? null,
  );
  const [body, setBody] = useState('');
  const [notes, setNotes] = useState('');
  const selectedTemplate = waitlistTemplates.find((template) => template.id === selectedTemplateId);
  const firstTemplateId = waitlistTemplates[0]?.id ?? null;

  useEffect(() => {
    if (!visible) {
      return;
    }

    setBody('');
    setNotes('');
    setSelectedTemplateId(null);
  }, [resetKey, visible]);

  useEffect(() => {
    if (!selectedTemplateId && firstTemplateId) {
      setSelectedTemplateId(firstTemplateId);
    }
  }, [firstTemplateId, selectedTemplateId]);
  const preview = useMemo(
    () =>
      selectedTemplate
        ? renderPreview(selectedTemplate, {
            restaurantName: 'Shire',
            partySize,
            messageBody: body,
          })
        : body,
    [body, partySize, selectedTemplate],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(17,24,39,0.36)' },
        ]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.glass.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.text.primary }]}>Notify {partyName}</Text>
          <View style={styles.templateWrap}>
            {waitlistTemplates.map((template) => {
              const selected = selectedTemplateId === template.id;
              return (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateChip,
                    {
                      backgroundColor: selected ? colors.accentLight : colors.surface.level2,
                      borderColor: selected ? colors.accent : colors.glass.borderSubtle,
                    },
                  ]}
                  onPress={() => setSelectedTemplateId(template.id)}
                >
                  <Text
                    style={[
                      styles.templateLabel,
                      { color: selected ? colors.accent : colors.text.secondary },
                    ]}
                  >
                    {template.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={[
              styles.textArea,
              { color: colors.text.primary, borderColor: colors.glass.border },
            ]}
            placeholder="Optional custom message"
            placeholderTextColor={colors.text.muted}
            value={body}
            onChangeText={setBody}
            multiline
          />
          <View
            style={[
              styles.preview,
              { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
            ]}
          >
            <Text style={[styles.previewLabel, { color: colors.text.muted }]}>Preview</Text>
            <Text style={[styles.previewText, { color: colors.text.primary }]}>
              {preview || 'The backend will use the default waitlist notify template.'}
            </Text>
          </View>
          <TextInput
            style={[styles.input, { color: colors.text.primary, borderColor: colors.glass.border }]}
            placeholder="Internal note"
            placeholderTextColor={colors.text.muted}
            value={notes}
            onChangeText={setNotes}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.accent }]}
            disabled={isSending}
            onPress={() =>
              onSend({
                ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
                ...(body.trim() ? { messageBody: body.trim() } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              })
            }
          >
            {isSending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.sendText}>Send Notify</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...textStyles.subtitle,
  },
  templateWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  templateChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  templateLabel: {
    ...textStyles.captionMedium,
  },
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    textAlignVertical: 'top',
    ...textStyles.body,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...textStyles.body,
  },
  preview: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  previewLabel: {
    ...textStyles.tiny,
    textTransform: 'uppercase',
  },
  previewText: {
    ...textStyles.caption,
  },
  sendButton: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sendText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
});
