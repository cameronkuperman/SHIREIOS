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
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { TimeWheelField } from './TimeWheelField';
import { findNearbyOpenSlots } from './findNearbyOpenSlots';
import {
  formatSlotLabel,
  roundUpToInterval,
  toMinutes,
} from './reservationTimeSlots';

export type ReservationFormValues = CreateReservationInput;

/** RN Web needs explicit overflow + bounded flex height for trackpad / mouse wheel scrolling. */
const WEB_SCROLL_VIEW_STYLE: ViewStyle =
  Platform.OS === 'web' ? ({ overflow: 'scroll', height: '100%' } as ViewStyle) : {};

type ReservationEditorProps = {
  mode: 'create' | 'edit';
  reservation?: Reservation | null;
  initialDate?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ReservationFormValues) => Promise<void>;
  onRunAction?: (action: ReservationAction) => Promise<void>;
  onOpenFloor?: () => void;
  onArchive?: () => Promise<void>;
  onRestore?: () => Promise<void>;
  onMessageGuest?: () => void;
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
  onArchive,
  onRestore,
  onMessageGuest,
}: ReservationEditorProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useReservationSettings();
  const [footerHeight, setFooterHeight] = useState(96);
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
  const [hasAutoDefaultedTime, setHasAutoDefaultedTime] = useState(mode === 'edit');

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
      setHasAutoDefaultedTime(false);
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
    setHasAutoDefaultedTime(true);
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

  const selectedSlot = useMemo(
    () => availability?.slots.find((slot) => slot.timeSlot === timeSlot) ?? null,
    [availability?.slots, timeSlot],
  );
  const editableSource = toStaffReservationSource(source);
  const sourceLabel = getReservationSourceLabel(source) ?? 'Host';
  const nearby = useMemo(
    () => findNearbyOpenSlots(availability?.slots, timeSlot, 2),
    [availability?.slots, timeSlot],
  );
  const statusLine = useMemo<
    { kind: 'open' | 'closed'; text: string } | null
  >(() => {
    if (!selectedSlot) return null;
    const size = parseInt(partySize, 10) || 1;
    if (selectedSlot.available) {
      const parts: string[] = [`Open for ${size}`];
      if (selectedSlot.servicePeriodName) parts.push(selectedSlot.servicePeriodName);
      if (selectedSlot.reason) parts.push(selectedSlot.reason);
      return { kind: 'open', text: parts.join(' · ') };
    }
    const closest = nearby.earlier[nearby.earlier.length - 1] ?? nearby.later[0] ?? null;
    const parts: string[] = [`Full for ${size}`];
    if (selectedSlot.reason) parts.push(selectedSlot.reason);
    if (closest && timeSlot) {
      const delta = toMinutes(closest.timeSlot) - toMinutes(timeSlot);
      const direction = delta < 0 ? 'earlier' : 'later';
      parts.push(
        `Closest open: ${formatSlotLabel(closest.timeSlot)} (${Math.abs(delta)} min ${direction})`,
      );
    }
    return { kind: 'closed', text: parts.join(' · ') };
  }, [selectedSlot, nearby, partySize, timeSlot]);

  useEffect(() => {
    if (hasAutoDefaultedTime) return;
    if (timeSlot) return;
    const slots = availability?.slots ?? [];
    if (slots.length === 0) return;

    const isToday = format(new Date(), 'yyyy-MM-dd') === selectedDate;
    const target = isToday ? roundUpToInterval(new Date(), 15) : '18:00';

    const open = slots.filter((s) => s.available);
    const pool = open.length > 0 ? open : slots;
    const candidate = pool
      .map((s) => ({ s, d: Math.abs(toMinutes(s.timeSlot) - toMinutes(target)) }))
      .sort((a, b) => a.d - b.d)[0]?.s;

    if (candidate) {
      setTimeSlot(candidate.timeSlot);
      setHasAutoDefaultedTime(true);
    }
  }, [hasAutoDefaultedTime, timeSlot, availability?.slots, selectedDate]);

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
  const canArchive =
    reservation != null &&
    reservation.archivedAt == null &&
    ['completed', 'canceled', 'no_show'].includes(reservation.status);

  const scrollBottomInset = footerHeight + spacing.lg;
  const isWeb = Platform.OS === 'web';

  const formBody = (
        <View style={styles.body}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {mode === 'create' ? 'New Reservation' : (reservation?.guestName ?? 'Reservation')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.text.muted }]}>
                {formatDisplayDate(selectedDate)}
              </Text>
            </View>
            {isSaving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>

          <ScrollView
            style={[styles.scroll, WEB_SCROLL_VIEW_STYLE]}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomInset }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={isWeb ? undefined : 'on-drag'}
            canCancelContentTouches
            nestedScrollEnabled
            showsVerticalScrollIndicator={isWeb}
            alwaysBounceVertical={!isWeb}
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
                {reservation && onMessageGuest && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.surface.level2 }]}
                    onPress={onMessageGuest}
                  >
                    <Text style={[styles.actionText, { color: colors.text.primary }]}>
                      Message Guest
                    </Text>
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
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Booking Origin
            </Text>
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

            <TimeWheelField
              value={timeSlot}
              onChange={setTimeSlot}
              partySize={parseInt(partySize, 10) || 1}
              minuteInterval={15}
            />

            {statusLine && (
              <View style={styles.statusLineRow}>
                <Ionicons
                  name={statusLine.kind === 'open' ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={
                    statusLine.kind === 'open'
                      ? colors.status.available.text
                      : colors.status.dirty.text
                  }
                />
                <Text
                  style={[
                    styles.statusLineText,
                    {
                      color:
                        statusLine.kind === 'open'
                          ? colors.status.available.text
                          : colors.status.dirty.text,
                    },
                  ]}
                >
                  {statusLine.text}
                </Text>
              </View>
            )}

            {selectedSlot && !selectedSlot.available && (
              <View
                style={[
                  styles.availabilityCallout,
                  {
                    backgroundColor: colors.surface.level2,
                    borderColor: colors.glass.borderSubtle,
                  },
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
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight > 0 && nextHeight !== footerHeight) {
                setFooterHeight(nextHeight);
              }
            }}
            style={[
              styles.footer,
              {
                backgroundColor: colors.surface.level1,
                borderTopColor: colors.border.subtle,
                paddingBottom: Math.max(insets.bottom, spacing.xl),
              },
            ]}
          >
          {reservation?.archivedAt && onRestore && (
            <TouchableOpacity
              style={[styles.secondaryFooterButton, { borderColor: colors.glass.border }]}
              onPress={() => void onRestore()}
              disabled={isSaving}
            >
              <Text style={[styles.secondaryFooterText, { color: colors.text.primary }]}>
                Restore
              </Text>
            </TouchableOpacity>
          )}
          {canArchive && onArchive && (
            <TouchableOpacity
              style={[styles.secondaryFooterButton, { borderColor: colors.glass.border }]}
              onPress={() => void onArchive()}
              disabled={isSaving}
            >
              <Text style={[styles.secondaryFooterText, { color: colors.text.primary }]}>
                Archive
              </Text>
            </TouchableOpacity>
          )}
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
        </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={styles.container}
          behavior="padding"
          keyboardVerticalOffset={insets.top}
        >
          {formBody}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.container}>{formBody}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
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
    flexShrink: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
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
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  secondaryFooterButton: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryFooterText: {
    ...textStyles.label,
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
  statusLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusLineText: {
    ...textStyles.caption,
    flex: 1,
  },
});
