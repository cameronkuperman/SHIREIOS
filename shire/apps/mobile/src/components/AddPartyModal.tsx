import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, borderRadius, shadows, useTheme } from '@/theme';
import { SeatingPreferencePicker, type SeatingPref } from './SeatingPreferencePicker';

/** Modal dismiss: backdrop Pressable is a sibling of the sheet (wrapping steals X / instant-close). */

const QUOTE_OPTIONS = ['', '15', '30', '45', '60'];

function quoteOptionLabel(value: string): string {
  return value ? `${value} min` : 'Quoted Wait Time';
}

type AddPartyModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    size: number;
    phone: string;
    seatingPreference: SeatingPref;
    quotedWaitMinutes: number | null;
    notes: string;
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
  const { width: windowWidth } = useWindowDimensions();
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [phone, setPhone] = useState('');
  const [quoteMinutes, setQuoteMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [preference, setPreference] = useState<SeatingPref>('none');
  const [quoteMenuOpen, setQuoteMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isInline = presentation === 'inline';
  const modalWidth = Math.min(640, Math.max(320, windowWidth - spacing['3xl'] * 2));
  const parsedSize = parseInt(size, 10);
  const canSubmit = name.trim().length > 0 && Number.isFinite(parsedSize) && parsedSize > 0;

  const handleAdd = async () => {
    if (!canSubmit) return;
    const parsedQuote = parseInt(quoteMinutes, 10);
    setIsSubmitting(true);
    try {
      await onAdd({
        name: name.trim(),
        size: parsedSize,
        phone: phone.trim(),
        seatingPreference: preference,
        quotedWaitMinutes: Number.isFinite(parsedQuote) && parsedQuote > 0 ? parsedQuote : null,
        notes: notes.trim(),
      });
      setName('');
      setSize('');
      setPhone('');
      setQuoteMinutes('');
      setNotes('');
      setPreference('none');
      setQuoteMenuOpen(false);
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
          width: isInline ? undefined : modalWidth,
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
        <Text style={[styles.title, { color: colors.text.primary }]}>Add Party</Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close add party form"
        >
          <Ionicons name="close" size={isInline ? 20 : 24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        scrollEnabled={!isInline}
        contentContainerStyle={[styles.content, isInline && styles.inlineContent]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.segmentedControl, { borderColor: colors.glass.borderSubtle }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            style={[styles.segment, { backgroundColor: colors.surface.level2 }]}
          >
            <Text style={[styles.segmentText, { color: colors.text.primary }]}>Waitlist</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled
            style={[styles.segment, styles.segmentDisabled]}
          >
            <Text style={[styles.segmentText, { color: colors.text.muted }]}>Reservation</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Party Details</Text>

        <View style={[styles.row, isInline && styles.inlineRow]}>
          <View style={styles.halfInput}>
            <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Size</Text>
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
                placeholder="Size"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                value={size}
                onChangeText={setSize}
              />
            </View>
          </View>
          <View style={styles.halfInput}>
            <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Quoted Wait Time</Text>
            <View style={styles.selectField}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: quoteMenuOpen }}
                onPress={() => setQuoteMenuOpen((open) => !open)}
                style={[
                  styles.dropdownButton,
                  isInline && styles.inlineInputWrapper,
                  {
                    backgroundColor: colors.surface.level2,
                    borderColor: colors.glass.borderSubtle,
                  },
                ]}
              >
                <Ionicons name="time-outline" size={18} color={colors.text.muted} />
                <Text
                  style={[
                    styles.input,
                    { color: quoteMinutes ? colors.text.primary : colors.text.muted },
                  ]}
                >
                  {quoteOptionLabel(quoteMinutes)}
                </Text>
                <Ionicons
                  name={quoteMenuOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.text.muted}
                />
              </Pressable>
              {quoteMenuOpen && (
                <View
                  style={[
                    styles.quoteMenu,
                    {
                      backgroundColor: colors.surface.level1,
                      borderColor: colors.glass.borderSubtle,
                    },
                  ]}
                >
                  {QUOTE_OPTIONS.map((option) => {
                    const active = quoteMinutes === option;
                    return (
                      <Pressable
                        key={option || 'first-available'}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setQuoteMinutes(option);
                          setQuoteMenuOpen(false);
                        }}
                        style={[
                          styles.quoteOption,
                          active && { backgroundColor: colors.surface.level2 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quoteOptionText,
                            { color: active ? colors.text.primary : colors.text.secondary },
                          ]}
                        >
                          {quoteOptionLabel(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Seating Preference</Text>
        <View style={styles.preferenceRow}>
          <SeatingPreferencePicker value={preference} onChange={setPreference} />
        </View>

        <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Guest Phone</Text>
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
            placeholder="Guest Phone"
            placeholderTextColor={colors.text.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

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
            placeholder="Guest Name"
            placeholderTextColor={colors.text.muted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Visit Notes</Text>
        <View
          style={[
            styles.notesWrapper,
            { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
          ]}
        >
          <TextInput
            style={[styles.notesInput, { color: colors.text.primary }]}
            placeholder="Visit Notes"
            placeholderTextColor={colors.text.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.addBtn,
            isInline && styles.inlineAddBtn,
            { backgroundColor: colors.accent },
            (!canSubmit || isSubmitting) && styles.disabled,
          ]}
          activeOpacity={0.8}
          disabled={!canSubmit || isSubmitting}
          onPress={() => void handleAdd()}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="add-circle" size={22} color={colors.white} />
              <Text style={styles.addBtnText}>Add</Text>
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss add party form"
        />
        {form}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  sheet: {
    zIndex: 1,
    elevation: 1,
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    maxHeight: '86%',
    overflow: 'hidden',
    ...shadows.medium,
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
    paddingBottom: spacing.xl,
  },
  inlineContent: {
    padding: spacing.lg,
    paddingBottom: spacing.lg,
  },
  inputLabel: {
    ...textStyles.caption,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...textStyles.subtitle,
    marginBottom: spacing.lg,
  },
  segmentedControl: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    width: 320,
    maxWidth: '100%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  segmentDisabled: {
    opacity: 0.58,
  },
  segmentText: {
    ...textStyles.captionMedium,
    fontWeight: '800',
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
  inputSuffix: {
    ...textStyles.captionMedium,
    fontWeight: '700',
  },
  selectField: {
    marginBottom: spacing.lg,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  quoteMenu: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  quoteOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  quoteOptionText: {
    ...textStyles.body,
  },
  preferenceRow: {
    marginBottom: spacing.lg,
  },
  notesWrapper: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 104,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  notesInput: {
    flex: 1,
    ...textStyles.body,
    minHeight: 88,
    padding: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
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
