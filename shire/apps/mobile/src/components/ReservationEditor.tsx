import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import type { Reservation, ReservationAction, ReservationSource } from '@shire/shared';
import type { CreateReservationInput } from '@/features/host/api';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import { useReservationAvailability, useReservationSettings } from '@/features/host/hooks';
import {
  getReservationSourceLabel,
  STAFF_RESERVATION_SOURCES,
  toStaffReservationSource,
} from '@/features/host/source';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';
import { CalendarGrid } from './CalendarGrid';
import { GlassSurface } from './GlassSurface';
import { SeatingPreferencePicker, type SeatingPref } from './SeatingPreferencePicker';
import { TimeSlotPicker } from './TimeSlotPicker';

export type ReservationFormValues = CreateReservationInput;

type ReservationEditorProps = {
  mode: 'create' | 'edit';
  reservation?: Reservation | null;
  initialDate?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ReservationFormValues) => Promise<void>;
  onRunAction?: (action: ReservationAction) => Promise<void>;
  onOpenFloor?: () => void;
};

function formatDisplayDate(date: string): string {
  try {
    return format(parseISO(`${date}T12:00:00`), 'EEE, MMM d');
  } catch {
    return date;
  }
}

function actionLabel(action: ReservationAction): string {
  switch (action) {
    case 'confirm':
      return 'Confirm';
    case 'arrive':
      return 'Arrive';
    case 'check_in':
      return 'Check In';
    case 'complete':
      return 'Complete';
    case 'cancel':
      return 'Cancel';
    case 'mark_no_show':
      return 'No Show';
    case 'seat':
      return 'Seat';
    default:
      return action;
  }
}

function availableActions(status: Reservation['status']): ReservationAction[] {
  switch (status) {
    case 'booked':
      return ['confirm', 'arrive', 'cancel', 'mark_no_show'];
    case 'confirmed':
      return ['arrive', 'cancel', 'mark_no_show'];
    case 'checked_in':
      return ['cancel', 'mark_no_show'];
    case 'seated':
      return ['complete'];
    default:
      return [];
  }
}

export function ReservationEditor({
  mode,
  reservation,
  initialDate,
  isSaving,
  onClose,
  onSave,
  onRunAction,
  onOpenFloor,
}: ReservationEditorProps) {
  const { colors } = useTheme();
  const settings = useReservationSettings();
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [selectedDate, setSelectedDate] = useState(initialDate ?? format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [seatingPreference, setSeatingPreference] = useState<SeatingPref>('none');
  const [source, setSource] = useState<ReservationSource>('host_dashboard');
  const [specialRequests, setSpecialRequests] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [pacingOverride, setPacingOverride] = useState(false);

  useEffect(() => {
    if (!reservation) {
      const dateValue = initialDate ?? format(new Date(), 'yyyy-MM-dd');
      setGuestName('');
      setGuestPhone('');
      setPartySize('2');
      setSelectedDate(dateValue);
      setCurrentMonth(parseISO(`${dateValue}T12:00:00`));
      setTimeSlot(null);
      setSeatingPreference('none');
      setSource('host_dashboard');
      setSpecialRequests('');
      setInternalNotes('');
      setPacingOverride(false);
      return;
    }

    setGuestName(reservation.guestName);
    setGuestPhone(reservation.guestPhone);
    setPartySize(String(reservation.partySize));
    setSelectedDate(reservation.date);
    setCurrentMonth(parseISO(`${reservation.date}T12:00:00`));
    setTimeSlot(reservation.timeSlot);
    setSeatingPreference(reservation.seatingPreference);
    setSource(reservation.source);
    setSpecialRequests(reservation.specialRequests);
    setInternalNotes(reservation.internalNotes || reservation.notes);
    setPacingOverride(reservation.pacingOverrideApplied);
  }, [initialDate, reservation]);

  const availability = useReservationAvailability(
    selectedDate
      ? {
          date: selectedDate,
          partySize: Math.max(1, parseInt(partySize, 10) || 1),
          channel: source,
        }
      : null,
  );

  const slotOptions = useMemo(() => {
    const options =
      availability?.slots.map((slot) => ({
        value: slot.timeSlot,
        disabled: !slot.available,
        reason: slot.reason,
      })) ?? [];

    if (timeSlot && !options.find((slot) => slot.value === timeSlot)) {
      options.push({
        value: timeSlot,
        disabled: false,
        reason: null,
      });
    }

    return options.sort((left, right) => left.value.localeCompare(right.value));
  }, [availability?.slots, timeSlot]);

  const selectedSlot = useMemo(
    () => availability?.slots.find((slot) => slot.timeSlot === timeSlot) ?? null,
    [availability?.slots, timeSlot],
  );
  const editableSource = toStaffReservationSource(source);
  const sourceLabel = getReservationSourceLabel(source) ?? 'Host';
  const isUsingFallbackTimeSlots = slotOptions.length === 0;

  const canSubmit =
    guestName.trim().length > 0 &&
    selectedDate.length > 0 &&
    Boolean(timeSlot) &&
    (!selectedSlot || selectedSlot.available || pacingOverride);

  const handleSave = async () => {
    if (!canSubmit || !timeSlot) {
      Alert.alert('Reservation Incomplete', 'Fill the required fields and choose a valid time.');
      return;
    }

    try {
      await onSave({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        partySize: Math.max(1, parseInt(partySize, 10) || 1),
        date: selectedDate,
        timeSlot,
        seatingPreference,
        source,
        specialRequests: specialRequests.trim(),
        internalNotes: internalNotes.trim(),
        notes: specialRequests.trim(),
        pacingOverride,
      });
    } catch (error) {
      Alert.alert(
        'Unable to Save Reservation',
        extractHostRequestErrorMessage(error, 'The reservation could not be saved.'),
      );
    }
  };

  const handleAction = async (action: ReservationAction) => {
    if (!onRunAction) {
      return;
    }

    try {
      await onRunAction(action);
    } catch (error) {
      Alert.alert(
        `Unable to ${actionLabel(action)}`,
        extractHostRequestErrorMessage(error, 'The reservation could not be updated.'),
      );
    }
  };

  const statusActions = reservation ? availableActions(reservation.status) : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {mode === 'create' ? 'New Reservation' : reservation?.guestName ?? 'Reservation'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.muted }]}>
              {formatDisplayDate(selectedDate)}
            </Text>
          </View>
          {isSaving ? <ActivityIndicator color={colors.accent} /> : <View style={styles.headerSpacer} />}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {reservation && (
            <GlassSurface style={styles.section}>
              <View style={styles.statusHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: colors.surface.level2, borderColor: colors.glass.border },
                  ]}
                >
                  <Text style={[styles.statusText, { color: colors.text.secondary }]}>
                    {reservation.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                {statusActions.map((action) => (
                  <TouchableOpacity
                    key={action}
                    style={[styles.actionButton, { backgroundColor: colors.surface.level2 }]}
                    onPress={() => {
                      void handleAction(action);
                    }}
                  >
                    <Text style={[styles.actionText, { color: colors.text.primary }]}>
                      {actionLabel(action)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {onOpenFloor && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.accentLight }]}
                    onPress={onOpenFloor}
                  >
                    <Text style={[styles.actionText, { color: colors.accent }]}>Open Floor</Text>
                  </TouchableOpacity>
                )}
              </View>
            </GlassSurface>
          )}

          <GlassSurface style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Guest</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Ionicons name="person-outline" size={18} color={colors.text.muted} />
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="Guest name"
                placeholderTextColor={colors.text.muted}
                value={guestName}
                onChangeText={setGuestName}
              />
            </View>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Ionicons name="call-outline" size={18} color={colors.text.muted} />
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="Phone"
                placeholderTextColor={colors.text.muted}
                keyboardType="phone-pad"
                value={guestPhone}
                onChangeText={setGuestPhone}
              />
            </View>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Ionicons name="people-outline" size={18} color={colors.text.muted} />
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="Party size"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                value={partySize}
                onChangeText={setPartySize}
              />
            </View>
          </GlassSurface>

          <GlassSurface style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Booking Origin</Text>
            {mode === 'create' ? (
              <View style={styles.optionRow}>
                {STAFF_RESERVATION_SOURCES.map((option) => {
                  const isSelected = editableSource === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: isSelected ? colors.accentLight : colors.surface.level2,
                          borderColor: isSelected ? colors.accent : colors.glass.borderSubtle,
                        },
                      ]}
                      onPress={() => setSource(option)}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          { color: isSelected ? colors.accent : colors.text.secondary },
                        ]}
                      >
                        {getReservationSourceLabel(option)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <>
                <View
                  style={[
                    styles.readOnlyChip,
                    {
                      backgroundColor: colors.surface.level2,
                      borderColor: colors.glass.borderSubtle,
                    },
                  ]}
                >
                  <Text style={[styles.optionLabel, { color: colors.text.secondary }]}>
                    {sourceLabel}
                  </Text>
                </View>
                <Text style={[styles.helperText, { color: colors.text.muted }]}>
                  Booking origin comes from the backend for existing reservations.
                </Text>
              </>
            )}
          </GlassSurface>

          <GlassSurface style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Date</Text>
            <CalendarGrid
              selectedDate={parseISO(`${selectedDate}T12:00:00`)}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              onSelectDate={(date) => setSelectedDate(format(date, 'yyyy-MM-dd'))}
            />
          </GlassSurface>

          <GlassSurface style={styles.section}>
            <View style={styles.sectionHeaderInline}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Time</Text>
              {settings && (
                <Text style={[styles.policyLabel, { color: colors.text.muted }]}>
                  Horizon {settings.bookingHorizonDays}d · Grace {settings.gracePeriodMinutes}m
                </Text>
              )}
            </View>
            <TimeSlotPicker
              value={timeSlot}
              onChange={setTimeSlot}
              slots={slotOptions}
              allowUnavailableSelection
            />
            {isUsingFallbackTimeSlots && (
              <Text style={[styles.helperText, { color: colors.text.muted }]}>
                Live availability did not return any time slots, so standard service times are shown.
              </Text>
            )}
            {selectedSlot && !selectedSlot.available && (
              <View
                style={[
                  styles.availabilityCallout,
                  { backgroundColor: colors.surface.level2, borderColor: colors.glass.borderSubtle },
                ]}
              >
                <Text style={[styles.calloutText, { color: colors.text.secondary }]}>
                  {selectedSlot.reason ?? 'This time is not currently available.'}
                </Text>
                {selectedSlot.canOverridePacing && (
                  <TouchableOpacity
                    style={styles.overrideRow}
                    onPress={() => setPacingOverride((current) => !current)}
                  >
                    <Ionicons
                      name={pacingOverride ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={colors.accent}
                    />
                    <Text style={[styles.overrideText, { color: colors.text.primary }]}>
                      Override pacing for staff booking
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </GlassSurface>

          <GlassSurface style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Preference</Text>
            <SeatingPreferencePicker value={seatingPreference} onChange={setSeatingPreference} />
          </GlassSurface>

          <GlassSurface style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Notes</Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.surface.level2,
                  borderColor: colors.glass.borderSubtle,
                },
              ]}
              placeholder="Special requests"
              placeholderTextColor={colors.text.muted}
              multiline
              value={specialRequests}
              onChangeText={setSpecialRequests}
            />
            <TextInput
              style={[
                styles.textArea,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.surface.level2,
                  borderColor: colors.glass.borderSubtle,
                },
              ]}
              placeholder="Internal host notes"
              placeholderTextColor={colors.text.muted}
              multiline
              value={internalNotes}
              onChangeText={setInternalNotes}
            />
          </GlassSurface>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: colors.surface.level1, borderTopColor: colors.border.subtle },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.accent },
              (!canSubmit || isSaving) && styles.disabledButton,
            ]}
            onPress={() => void handleSave()}
            disabled={!canSubmit || isSaving}
          >
            <Text style={styles.saveButtonText}>
              {mode === 'create' ? 'Create Reservation' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerSpacer: {
    width: 24,
  },
  title: {
    ...textStyles.title,
  },
  subtitle: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...textStyles.label,
    marginBottom: spacing.md,
  },
  sectionHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  policyLabel: {
    ...textStyles.tiny,
  },
  helperText: {
    ...textStyles.caption,
    marginTop: spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    padding: 0,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readOnlyChip: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionLabel: {
    ...textStyles.captionMedium,
    textTransform: 'capitalize',
  },
  textArea: {
    minHeight: 88,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
    ...textStyles.body,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
  },
  saveButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statusBadge: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...textStyles.captionMedium,
    textTransform: 'capitalize',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionText: {
    ...textStyles.captionMedium,
  },
  availabilityCallout: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  calloutText: {
    ...textStyles.caption,
  },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overrideText: {
    ...textStyles.captionMedium,
  },
});
