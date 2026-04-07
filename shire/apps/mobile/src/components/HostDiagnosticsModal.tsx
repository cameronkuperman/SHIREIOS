import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

type DiagnosticItem = {
  label: string;
  value: string;
};

type HostDiagnosticsModalProps = {
  visible: boolean;
  onClose: () => void;
  items: DiagnosticItem[];
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export function HostDiagnosticsModal({
  visible,
  onClose,
  items,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: HostDiagnosticsModalProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(30, 30, 34, 0.96)' : 'rgba(255,255,255,0.96)',
              borderColor: colors.glass.border,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
            <Text style={[styles.title, { color: colors.text.primary }]}>Diagnostics</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            {items.map((item) => (
              <View key={item.label} style={styles.row}>
                <Text style={[styles.label, { color: colors.text.muted }]}>{item.label}</Text>
                <Text style={[styles.value, { color: colors.text.primary }]}>{item.value}</Text>
              </View>
            ))}
            {secondaryActionLabel && onSecondaryAction ? (
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: colors.accent, backgroundColor: colors.accentLight }]}
                onPress={onSecondaryAction}
              >
                <Text style={[styles.actionText, { color: colors.accent }]}>
                  {secondaryActionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
            {actionLabel && onAction ? (
              <TouchableOpacity
                style={[styles.actionButton, { borderColor: colors.border.default }]}
                onPress={onAction}
              >
                <Text style={[styles.actionText, { color: colors.text.primary }]}>
                  {actionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.elevated,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  title: {
    ...textStyles.subtitle,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  label: {
    ...textStyles.captionMedium,
    textTransform: 'uppercase',
  },
  value: {
    ...textStyles.body,
  },
  actionButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionText: {
    ...textStyles.label,
  },
});
