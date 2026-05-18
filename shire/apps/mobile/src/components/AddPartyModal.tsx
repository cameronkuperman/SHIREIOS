import React, { useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, borderRadius, shadows, useTheme } from '@/theme';
import { SeatingPreferencePicker, type SeatingPref } from './SeatingPreferencePicker';

type AddPartyModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    size: number;
    phone: string;
    seatingPreference: SeatingPref;
  }) => Promise<void> | void;
  presentation?: 'modal' | 'inline';
};

export function AddPartyModal({
  visible,
  onClose,
  onAdd,
  presentation = 'modal',
}: AddPartyModalProps) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [size, setSize] = useState('2');
  const [phone, setPhone] = useState('');
  const [preference, setPreference] = useState<SeatingPref>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isInline = presentation === 'inline';

  const handleAdd = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onAdd({
        name: name.trim(),
        size: parseInt(size, 10) || 2,
        phone: phone.trim(),
        seatingPreference: preference,
      });
      setName('');
      setSize('2');
      setPhone('');
      setPreference('none');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const bgColor = isDark ? 'rgba(30, 30, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const form = (
    <View
      style={[
        styles.sheet,
        isInline && styles.inlinePanel,
        {
          backgroundColor: isInline ? colors.surface.level1 : bgColor,
          borderColor: isInline ? colors.border.subtle : colors.glass.border,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          isInline && styles.inlineHeader,
          { borderBottomColor: colors.border.subtle },
        ]}
      >
        <Text style={[styles.title, { color: colors.text.primary }]}>Add to Waitlist</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={isInline ? 20 : 24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        scrollEnabled={!isInline}
        contentContainerStyle={[styles.content, isInline && styles.inlineContent]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Guest Name</Text>
        <View
          style={[
            styles.inputWrapper,
            isInline && styles.inlineInputWrapper,
            { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
          ]}
        >
          <Ionicons name="person-outline" size={18} color={colors.text.muted} />
          <TextInput
            style={[styles.input, { color: colors.text.primary }]}
            placeholder="Name"
            placeholderTextColor={colors.text.muted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={[styles.row, isInline && styles.inlineRow]}>
          <View style={styles.halfInput}>
            <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Party Size</Text>
            <View
              style={[
                styles.inputWrapper,
                isInline && styles.inlineInputWrapper,
                { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Ionicons name="people-outline" size={18} color={colors.text.muted} />
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="2"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                value={size}
                onChangeText={setSize}
              />
            </View>
          </View>
          <View style={styles.halfInput}>
            <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Phone</Text>
            <View
              style={[
                styles.inputWrapper,
                isInline && styles.inlineInputWrapper,
                { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Ionicons name="call-outline" size={18} color={colors.text.muted} />
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="555-0100"
                placeholderTextColor={colors.text.muted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
        </View>

        <Text
          style={[
            styles.inputLabel,
            { color: colors.text.muted, marginTop: isInline ? spacing.sm : spacing.lg },
          ]}
        >
          Seating Preference
        </Text>
        <SeatingPreferencePicker value={preference} onChange={setPreference} />

        <TouchableOpacity
          style={[
            styles.addBtn,
            isInline && styles.inlineAddBtn,
            { backgroundColor: colors.accent },
            (!name.trim() || isSubmitting) && styles.disabled,
          ]}
          activeOpacity={0.8}
          disabled={!name.trim() || isSubmitting}
          onPress={() => void handleAdd()}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="add-circle" size={22} color={colors.white} />
              <Text style={styles.addBtnText}>Add to Waitlist</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (isInline) {
    return visible ? form : null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {form}
      </KeyboardAvoidingView>
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
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  inlinePanel: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomWidth: 1,
    maxHeight: undefined,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
    borderBottomWidth: 1,
  },
  inlineHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...textStyles.subtitle,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing['3xl'] + 20,
  },
  inlineContent: {
    padding: spacing.lg,
    paddingBottom: spacing.lg,
  },
  inputLabel: {
    ...textStyles.caption,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  inlineInputWrapper: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  inlineRow: {
    flexDirection: 'column',
    gap: 0,
  },
  halfInput: {
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing['2xl'],
    ...shadows.medium,
  },
  inlineAddBtn: {
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  addBtnText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.4,
  },
});
