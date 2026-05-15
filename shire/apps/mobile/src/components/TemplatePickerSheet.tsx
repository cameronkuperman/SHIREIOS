import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MessageTemplate } from '@shire/shared';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';
import { renderPreview, type TemplatePreviewContext } from '@/features/messaging/templateRenderer';

type TemplatePickerSheetProps = {
  visible: boolean;
  templates: MessageTemplate[];
  context: TemplatePreviewContext;
  onClose: () => void;
  onSelect: (template: MessageTemplate, preview: string) => void;
  category?: MessageTemplate['category'];
};

export function TemplatePickerSheet({
  visible,
  templates,
  context,
  onClose,
  onSelect,
  category,
}: TemplatePickerSheetProps) {
  const { colors, isDark } = useTheme();
  const filteredTemplates = templates.filter(
    (template) => template.active && (!category || template.category === category),
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
          <Text style={[styles.title, { color: colors.text.primary }]}>Templates</Text>
          <ScrollView contentContainerStyle={styles.list}>
            {filteredTemplates.map((template) => {
              const preview = renderPreview(template, context);
              return (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.row,
                    { backgroundColor: colors.surface.level1, borderColor: colors.glass.border },
                  ]}
                  onPress={() => onSelect(template, preview)}
                >
                  <Text style={[styles.name, { color: colors.text.primary }]}>{template.name}</Text>
                  <Text style={[styles.preview, { color: colors.text.secondary }]}>{preview}</Text>
                </TouchableOpacity>
              );
            })}
            {filteredTemplates.length === 0 && (
              <Text style={[styles.empty, { color: colors.text.muted }]}>No active templates</Text>
            )}
          </ScrollView>
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
    maxHeight: '70%',
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    borderWidth: 1,
    padding: spacing.xl,
  },
  title: {
    ...textStyles.subtitle,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing['2xl'],
  },
  row: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  name: {
    ...textStyles.label,
    marginBottom: spacing.xs,
  },
  preview: {
    ...textStyles.caption,
  },
  empty: {
    ...textStyles.body,
    textAlign: 'center',
    paddingVertical: spacing['2xl'],
  },
});
