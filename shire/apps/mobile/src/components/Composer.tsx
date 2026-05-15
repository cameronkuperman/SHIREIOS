import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type ComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onOpenTemplates?: () => void;
  isSending?: boolean;
  placeholder?: string;
};

export function Composer({
  value,
  onChangeText,
  onSend,
  onOpenTemplates,
  isSending = false,
  placeholder = 'Message guest',
}: ComposerProps) {
  const { colors } = useTheme();
  const canSend = value.trim().length > 0 && !isSending;

  return (
    <View style={[styles.container, { borderTopColor: colors.border.subtle }]}>
      {onOpenTemplates && (
        <TouchableOpacity style={styles.iconButton} onPress={onOpenTemplates}>
          <Ionicons name="document-text-outline" size={22} color={colors.text.secondary} />
        </TouchableOpacity>
      )}
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text.primary,
            backgroundColor: colors.surface.level2,
            borderColor: colors.glass.borderSubtle,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        multiline
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          { backgroundColor: canSend ? colors.accent : colors.surface.level3 },
        ]}
        disabled={!canSend}
        onPress={onSend}
      >
        {isSending ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Ionicons name="send" size={18} color={colors.white} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...textStyles.body,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
