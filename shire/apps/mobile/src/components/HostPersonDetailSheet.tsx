import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import type { Reservation, ReservationAction, WaitlistEntry } from '@shire/shared';
import type {
  ReservationActionInput,
  UpdateReservationInput,
  UpdateWaitlistInput,
  WaitlistAction,
} from '@/features/host/api';
import { getReservationSourceLabel } from '@/features/host/source';
import { useFloorActions, useTableDetails } from '@/features/floor';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';
import { HostTextField } from './HostTextField';
import { SeatingPreferencePicker, type SeatingPref } from './SeatingPreferencePicker';

type HostPersonDetailSheetProps = {
  visible: boolean;
  waitlistEntry?: WaitlistEntry | null;
  reservation?: Reservation | null;
  isSaving?: boolean;
  onClose: () => void;
  onSaveWaitlist?: (waitlistEntryId: string, input: UpdateWaitlistInput) => Promise<void>;
  onRunWaitlistAction?: (waitlistEntryId: string, action: WaitlistAction) => Promise<void>;
  onSaveReservation?: (reservationId: string, input: UpdateReservationInput) => Promise<void>;
  onRunReservationAction?: (
    reservationId: string,
    action: ReservationAction,
    input?: ReservationActionInput,
  ) => Promise<void>;
  onOpenReservation?: () => void;
  onSelectForSeating?: () => void;
  isSelectedForSeating?: boolean;
};

type TimelineItem = {
  key: string;
  label: string;
  value: string;
};

function formatTimestamp(value: string): string {
  try {
    return format(parseISO(value), 'MMM d, h:mm a');
  } catch {
    return value;
  }
}

function formatReservationTime(slot: string): string {
  const [hoursRaw = '0', minutesRaw = '00'] = slot.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

function formatPhoneForCall(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function reservationActions(status: Reservation['status']): ReservationAction[] {
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

function waitlistActions(status: WaitlistEntry['status']): WaitlistAction[] {
  switch (status) {
    case 'waiting':
      return ['arrive', 'mark_no_show', 'remove'];
    case 'arrived':
      return ['mark_no_show', 'remove'];
    default:
      return [];
  }
}

function reservationActionLabel(action: ReservationAction): string {
  switch (action) {
    case 'confirm':
      return 'Confirm';
    case 'arrive':
      return 'Arrive';
    case 'check_in':
      return 'Check In';
    case 'seat':
      return 'Seat';
    case 'complete':
      return 'Complete';
    case 'cancel':
      return 'Cancel';
    case 'mark_no_show':
      return 'No Show';
    default:
      return action;
  }
}

function waitlistActionLabel(action: WaitlistAction): string {
  switch (action) {
    case 'arrive':
      return 'Arrived';
    case 'mark_no_show':
      return 'No Show';
    case 'remove':
      return 'Remove';
    case 'seat':
      return 'Seat';
    default:
      return action;
  }
}

function buildWaitlistTimeline(waitlistEntry: WaitlistEntry): TimelineItem[] {
  return [
    { key: 'joined', label: 'Joined', value: waitlistEntry.joinedAt },
    ...(waitlistEntry.arrivedAt
      ? [{ key: 'arrived', label: 'Arrived', value: waitlistEntry.arrivedAt }]
      : []),
    ...(waitlistEntry.seatedAt
      ? [{ key: 'seated', label: 'Seated', value: waitlistEntry.seatedAt }]
      : []),
    ...(waitlistEntry.noShowAt
      ? [{ key: 'no-show', label: 'No Show', value: waitlistEntry.noShowAt }]
      : []),
    ...(waitlistEntry.removedAt
      ? [{ key: 'removed', label: 'Removed', value: waitlistEntry.removedAt }]
      : []),
    { key: 'updated', label: 'Updated', value: waitlistEntry.updatedAt },
  ];
}

function buildReservationTimeline(reservation: Reservation): TimelineItem[] {
  return [
    { key: 'created', label: 'Booked', value: reservation.createdAt },
    ...(reservation.confirmedAt
      ? [{ key: 'confirmed', label: 'Confirmed', value: reservation.confirmedAt }]
      : []),
    ...(reservation.checkedInAt
      ? [{ key: 'checked-in', label: 'Checked In', value: reservation.checkedInAt }]
      : []),
    ...(reservation.seatedAt
      ? [{ key: 'seated', label: 'Seated', value: reservation.seatedAt }]
      : []),
    ...(reservation.completedAt
      ? [{ key: 'completed', label: 'Completed', value: reservation.completedAt }]
      : []),
    ...(reservation.noShowAt
      ? [{ key: 'no-show', label: 'No Show', value: reservation.noShowAt }]
      : []),
    ...(reservation.canceledAt
      ? [{ key: 'canceled', label: 'Canceled', value: reservation.canceledAt }]
      : []),
    { key: 'updated', label: 'Updated', value: reservation.updatedAt },
  ];
}

function actionTone(colors: ReturnType<typeof useTheme>['colors'], destructive?: boolean) {
  return destructive
    ? {
        backgroundColor: colors.status.dirty.fill,
        color: colors.status.dirty.text,
      }
    : {
        backgroundColor: colors.surface.level2,
        color: colors.text.primary,
      };
}

function isReservationDirty(
  reservation: Reservation,
  values: {
    guestName: string;
    guestPhone: string;
    partySize: string;
    specialRequests: string;
    internalNotes: string;
    seatingPreference: SeatingPref;
  },
): boolean {
  return (
    reservation.guestName !== values.guestName.trim() ||
    reservation.guestPhone !== values.guestPhone.trim() ||
    reservation.partySize !== Math.max(1, parseInt(values.partySize, 10) || 1) ||
    reservation.specialRequests !== values.specialRequests.trim() ||
    reservation.internalNotes !== values.internalNotes.trim() ||
    reservation.seatingPreference !== values.seatingPreference
  );
}

function isWaitlistDirty(
  waitlistEntry: WaitlistEntry,
  values: {
    partySize: string;
    quotedWaitMinutes: string;
    notes: string;
    seatingPreference: SeatingPref;
  },
): boolean {
  const parsedQuote = parseInt(values.quotedWaitMinutes, 10);
  const nextQuote = Number.isFinite(parsedQuote) && parsedQuote > 0 ? parsedQuote : null;

  return (
    waitlistEntry.partySize !== Math.max(1, parseInt(values.partySize, 10) || 1) ||
    waitlistEntry.quotedWaitMinutes !== nextQuote ||
    waitlistEntry.notes !== values.notes.trim() ||
    waitlistEntry.seatingPreference !== values.seatingPreference
  );
}

export function HostPersonDetailSheet({
  visible,
  waitlistEntry,
  reservation,
  isSaving = false,
  onClose,
  onSaveWaitlist,
  onRunWaitlistAction,
  onSaveReservation,
  onRunReservationAction,
  onOpenReservation,
  onSelectForSeating,
  isSelectedForSeating = false,
}: HostPersonDetailSheetProps) {
  const { colors, isDark } = useTheme();
  const [waitlistPartySize, setWaitlistPartySize] = useState('2');
  const [waitlistQuoteMinutes, setWaitlistQuoteMinutes] = useState('');
  const [waitlistNotes, setWaitlistNotes] = useState('');
  const [waitlistPreference, setWaitlistPreference] = useState<SeatingPref>('none');
  const [reservationGuestName, setReservationGuestName] = useState('');
  const [reservationGuestPhone, setReservationGuestPhone] = useState('');
  const [reservationPartySize, setReservationPartySize] = useState('2');
  const [reservationSpecialRequests, setReservationSpecialRequests] = useState('');
  const [reservationInternalNotes, setReservationInternalNotes] = useState('');
  const [reservationPreference, setReservationPreference] = useState<SeatingPref>('none');

  useEffect(() => {
    if (!waitlistEntry) {
      return;
    }

    setWaitlistPartySize(String(waitlistEntry.partySize));
    setWaitlistQuoteMinutes(
      waitlistEntry.quotedWaitMinutes != null ? String(waitlistEntry.quotedWaitMinutes) : '',
    );
    setWaitlistNotes(waitlistEntry.notes);
    setWaitlistPreference(waitlistEntry.seatingPreference);
  }, [waitlistEntry]);

  useEffect(() => {
    if (!reservation) {
      return;
    }

    setReservationGuestName(reservation.guestName);
    setReservationGuestPhone(reservation.guestPhone);
    setReservationPartySize(String(reservation.partySize));
    setReservationSpecialRequests(reservation.specialRequests);
    setReservationInternalNotes(reservation.internalNotes);
    setReservationPreference(reservation.seatingPreference);
  }, [reservation]);

  const { blockTable, unblockTable } = useFloorActions();
  const suggestedTableId = reservation?.suggestedTableId ?? null;
  const suggestedTable = useTableDetails(suggestedTableId);

  const detail = reservation ?? waitlistEntry ?? null;
  const isReservation = Boolean(reservation);
  const phone = reservation?.guestPhone ?? waitlistEntry?.guest.phone ?? '';
  const canCall = phone.trim().length > 0;
  const sourceLabel = reservation
    ? (getReservationSourceLabel(reservation.source) ?? 'Reservation')
    : waitlistEntry
      ? 'Waitlist'
      : '';
  const timeline = useMemo(
    () =>
      reservation
        ? buildReservationTimeline(reservation)
        : waitlistEntry
          ? buildWaitlistTimeline(waitlistEntry)
          : [],
    [reservation, waitlistEntry],
  );
  const waitlistIsDirty = waitlistEntry
    ? isWaitlistDirty(waitlistEntry, {
        partySize: waitlistPartySize,
          quotedWaitMinutes: waitlistQuoteMinutes,
        notes: waitlistNotes,
        seatingPreference: waitlistPreference,
      })
    : false;
  const reservationIsDirty = reservation
    ? isReservationDirty(reservation, {
        guestName: reservationGuestName,
        guestPhone: reservationGuestPhone,
        partySize: reservationPartySize,
        specialRequests: reservationSpecialRequests,
        internalNotes: reservationInternalNotes,
        seatingPreference: reservationPreference,
      })
    : false;

  if (!detail) {
    return null;
  }

  const modalBackground = isDark ? 'rgba(15, 16, 20, 0.72)' : 'rgba(17, 24, 39, 0.36)';
  const sheetBackground = isDark ? 'rgba(24, 24, 29, 0.98)' : 'rgba(255, 255, 255, 0.98)';

  const handleCall = async () => {
    if (!canCall) {
      return;
    }

    try {
      await Linking.openURL(`tel:${formatPhoneForCall(phone)}`);
    } catch {
      Alert.alert('Call Unavailable', 'This device could not start a phone call.');
    }
  };

  const handleToggleSuggestedBlock = () => {
    if (!suggestedTable) {
      return;
    }

    const result = suggestedTable.isBlocked
      ? unblockTable(suggestedTable.id)
      : blockTable(suggestedTable.id);

    if (!result.ok) {
      Alert.alert(
        'Table Update Failed',
        'The table could not be updated. Try again from the floor plan.',
      );
    }
  };

  const handleWaitlistSave = async () => {
    if (!waitlistEntry || !onSaveWaitlist || !waitlistIsDirty) {
      return;
    }
    const parsedQuote = parseInt(waitlistQuoteMinutes, 10);

    try {
      await onSaveWaitlist(waitlistEntry.id, {
        partySize: Math.max(1, parseInt(waitlistPartySize, 10) || 1),
        quotedWaitMinutes:
          Number.isFinite(parsedQuote) && parsedQuote > 0 ? parsedQuote : null,
        notes: waitlistNotes.trim(),
        seatingPreference: waitlistPreference,
      });
    } catch (error) {
      Alert.alert(
        'Unable to Save Party',
        error instanceof Error ? error.message : 'The waitlist entry could not be updated.',
      );
    }
  };

  const handleReservationSave = async () => {
    if (!reservation || !onSaveReservation || !reservationIsDirty) {
      return;
    }

    try {
      await onSaveReservation(reservation.id, {
        guestName: reservationGuestName.trim(),
        guestPhone: reservationGuestPhone.trim(),
        partySize: Math.max(1, parseInt(reservationPartySize, 10) || 1),
        specialRequests: reservationSpecialRequests.trim(),
        internalNotes: reservationInternalNotes.trim(),
        seatingPreference: reservationPreference,
      });
    } catch (error) {
      Alert.alert(
        'Unable to Save Reservation',
        error instanceof Error ? error.message : 'The reservation could not be updated.',
      );
    }
  };

  const handleReservationAction = async (action: ReservationAction) => {
    if (!reservation || !onRunReservationAction) {
      return;
    }

    try {
      await onRunReservationAction(reservation.id, action);
    } catch (error) {
      Alert.alert(
        `Unable to ${reservationActionLabel(action)}`,
        error instanceof Error ? error.message : 'The reservation could not be updated.',
      );
    }
  };

  const handleWaitlistAction = async (action: WaitlistAction) => {
    if (!waitlistEntry || !onRunWaitlistAction) {
      return;
    }

    try {
      await onRunWaitlistAction(waitlistEntry.id, action);
    } catch (error) {
      Alert.alert(
        'Unable to Update Waitlist',
        error instanceof Error ? error.message : 'The waitlist entry could not be updated.',
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: modalBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBackground,
              borderColor: colors.glass.border,
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {reservation?.guestName ?? waitlistEntry?.guest.name ?? 'Guest'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.text.muted }]}>
                {isReservation
                  ? `${formatReservationTime(reservation!.timeSlot)} · ${sourceLabel}`
                  : `${waitlistEntry!.status.replace('_', ' ')} · ${sourceLabel}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.primaryActionRow}>
              {canCall && (
                <TouchableOpacity
                  style={[styles.primaryAction, { backgroundColor: colors.surface.level2 }]}
                  onPress={() => {
                    void handleCall();
                  }}
                >
                  <Ionicons name="call-outline" size={16} color={colors.text.primary} />
                  <Text style={[styles.primaryActionText, { color: colors.text.primary }]}>
                    Call
                  </Text>
                </TouchableOpacity>
              )}
              {onSelectForSeating && (
                <TouchableOpacity
                  style={[
                    styles.primaryAction,
                    {
                      backgroundColor: isSelectedForSeating
                        ? colors.accentLight
                        : colors.surface.level2,
                    },
                  ]}
                  onPress={onSelectForSeating}
                >
                  <Ionicons
                    name={isSelectedForSeating ? 'checkmark-circle-outline' : 'restaurant-outline'}
                    size={16}
                    color={isSelectedForSeating ? colors.accent : colors.text.primary}
                  />
                  <Text
                    style={[
                      styles.primaryActionText,
                      { color: isSelectedForSeating ? colors.accent : colors.text.primary },
                    ]}
                  >
                    {isSelectedForSeating ? 'Selected For Seating' : 'Select For Seating'}
                  </Text>
                </TouchableOpacity>
              )}
              {reservation && onOpenReservation && (
                <TouchableOpacity
                  style={[styles.primaryAction, { backgroundColor: colors.surface.level2 }]}
                  onPress={onOpenReservation}
                >
                  <Ionicons name="create-outline" size={16} color={colors.text.primary} />
                  <Text style={[styles.primaryActionText, { color: colors.text.primary }]}>
                    Open Reservation
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View
              style={[
                styles.section,
                { backgroundColor: colors.surface.level1, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Current Details
              </Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.text.muted }]}>Phone</Text>
                  <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                    {phone || 'Not provided'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.text.muted }]}>Party Size</Text>
                  <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                    {reservation?.partySize ?? waitlistEntry?.partySize ?? 0}
                  </Text>
                </View>
                {waitlistEntry && (
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: colors.text.muted }]}>
                      Quoted Wait
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                      {waitlistEntry.quotedWaitMinutes != null
                        ? `${waitlistEntry.quotedWaitMinutes} min`
                        : 'TBD'}
                    </Text>
                  </View>
                )}
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.text.muted }]}>Source</Text>
                  <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                    {sourceLabel}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.text.muted }]}>Status</Text>
                  <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                    {reservation
                      ? reservation.status.replace('_', ' ')
                      : waitlistEntry?.status.replace('_', ' ')}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.text.muted }]}>
                    {reservation ? 'Service Date' : 'Joined'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                    {reservation
                      ? reservation.date
                      : waitlistEntry
                        ? formatTimestamp(waitlistEntry.joinedAt)
                        : ''}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, { color: colors.text.muted }]}>
                    {reservation ? 'Assigned Table' : 'Table'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                    {reservation?.assignedTableId ??
                      waitlistEntry?.assignedTableId ??
                      'Not assigned'}
                  </Text>
                </View>
              </View>
            </View>

            {reservation && suggestedTable && (
              <View
                style={[
                  styles.section,
                  {
                    backgroundColor: colors.surface.level1,
                    borderColor: colors.glass.borderSubtle,
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  Suggested Table
                </Text>
                <View style={styles.suggestedRow}>
                  <View style={styles.suggestedInfo}>
                    <Ionicons name="restaurant-outline" size={18} color={colors.text.secondary} />
                    <Text style={[styles.suggestedText, { color: colors.text.primary }]}>
                      Table {suggestedTable.label} · {suggestedTable.capacity}p
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.suggestedButton,
                      {
                        backgroundColor: suggestedTable.isBlocked
                          ? colors.surface.level2
                          : colors.accent,
                      },
                    ]}
                    onPress={handleToggleSuggestedBlock}
                  >
                    <Ionicons
                      name={suggestedTable.isBlocked ? 'lock-open-outline' : 'lock-closed-outline'}
                      size={15}
                      color={suggestedTable.isBlocked ? colors.text.primary : colors.white}
                    />
                    <Text
                      style={[
                        styles.suggestedButtonText,
                        { color: suggestedTable.isBlocked ? colors.text.primary : colors.white },
                      ]}
                    >
                      {suggestedTable.isBlocked ? 'Unblock' : 'Block off'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.suggestedMeta, { color: colors.text.muted }]}>
                  {suggestedTable.isBlocked
                    ? 'Held for this reservation. Unblock to free it up.'
                    : 'Block this table to hold it until the party arrives.'}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.section,
                { backgroundColor: colors.surface.level1, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Actions</Text>
              <View style={styles.actionWrap}>
                {reservation &&
                  reservationActions(reservation.status).map((action) => {
                    const tone = actionTone(
                      colors,
                      action === 'cancel' || action === 'mark_no_show',
                    );
                    return (
                      <TouchableOpacity
                        key={action}
                        style={[styles.actionButton, { backgroundColor: tone.backgroundColor }]}
                        onPress={() => {
                          void handleReservationAction(action);
                        }}
                        disabled={isSaving}
                      >
                        <Text style={[styles.actionButtonText, { color: tone.color }]}>
                          {reservationActionLabel(action)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                {waitlistEntry &&
                  waitlistActions(waitlistEntry.status).map((action) => {
                    const tone = actionTone(
                      colors,
                      action === 'remove' || action === 'mark_no_show',
                    );
                    return (
                      <TouchableOpacity
                        key={action}
                        style={[styles.actionButton, { backgroundColor: tone.backgroundColor }]}
                        onPress={() => {
                          void handleWaitlistAction(action);
                        }}
                        disabled={isSaving}
                      >
                        <Text style={[styles.actionButtonText, { color: tone.color }]}>
                          {waitlistActionLabel(action)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>

            <View
              style={[
                styles.section,
                { backgroundColor: colors.surface.level1, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Quick Edit</Text>

              {reservation ? (
                <>
                  <HostTextField
                    iconName="person-outline"
                    placeholder="Guest name"
                    value={reservationGuestName}
                    onChangeText={setReservationGuestName}
                  />
                  <HostTextField
                    iconName="call-outline"
                    placeholder="Phone"
                    keyboardType="phone-pad"
                    value={reservationGuestPhone}
                    onChangeText={setReservationGuestPhone}
                  />
                  <HostTextField
                    iconName="people-outline"
                    placeholder="Party size"
                    keyboardType="number-pad"
                    value={reservationPartySize}
                    onChangeText={setReservationPartySize}
                  />
                  <SeatingPreferencePicker
                    value={reservationPreference}
                    onChange={setReservationPreference}
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
                    placeholder="Special requests"
                    placeholderTextColor={colors.text.muted}
                    multiline
                    value={reservationSpecialRequests}
                    onChangeText={setReservationSpecialRequests}
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
                    placeholder="Internal notes"
                    placeholderTextColor={colors.text.muted}
                    multiline
                    value={reservationInternalNotes}
                    onChangeText={setReservationInternalNotes}
                  />
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      { backgroundColor: colors.accent },
                      (!reservationIsDirty || isSaving) && styles.disabledButton,
                    ]}
                    disabled={!reservationIsDirty || isSaving}
                    onPress={() => {
                      void handleReservationSave();
                    }}
                  >
                    <Text style={styles.saveButtonText}>Save Quick Edits</Text>
                  </TouchableOpacity>
                </>
              ) : waitlistEntry ? (
                <>
                  <View
                    style={[
                      styles.readOnlyCard,
                      {
                        backgroundColor: colors.surface.level2,
                        borderColor: colors.glass.borderSubtle,
                      },
                    ]}
                  >
                    <View style={styles.readOnlyRow}>
                      <Ionicons name="person-outline" size={16} color={colors.text.muted} />
                      <Text style={[styles.readOnlyLabel, { color: colors.text.muted }]}>
                        Guest
                      </Text>
                    </View>
                    <Text style={[styles.readOnlyValue, { color: colors.text.primary }]}>
                      {waitlistEntry.guest.name}
                    </Text>
                    <Text style={[styles.readOnlyMeta, { color: colors.text.muted }]}>
                      Name and phone edits still need backend support.
                    </Text>
                  </View>
                  <HostTextField
                    iconName="people-outline"
                    placeholder="Party size"
                    keyboardType="number-pad"
                    value={waitlistPartySize}
                    onChangeText={setWaitlistPartySize}
                  />
                  <HostTextField
                    iconName="timer-outline"
                    placeholder="Quoted wait minutes"
                    keyboardType="number-pad"
                    value={waitlistQuoteMinutes}
                    onChangeText={setWaitlistQuoteMinutes}
                  />
                  <SeatingPreferencePicker
                    value={waitlistPreference}
                    onChange={setWaitlistPreference}
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
                    placeholder="Notes"
                    placeholderTextColor={colors.text.muted}
                    multiline
                    value={waitlistNotes}
                    onChangeText={setWaitlistNotes}
                  />
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      { backgroundColor: colors.accent },
                      (!waitlistIsDirty || isSaving) && styles.disabledButton,
                    ]}
                    disabled={!waitlistIsDirty || isSaving}
                    onPress={() => {
                      void handleWaitlistSave();
                    }}
                  >
                    <Text style={styles.saveButtonText}>Save Quick Edits</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            <View
              style={[
                styles.section,
                { backgroundColor: colors.surface.level1, borderColor: colors.glass.borderSubtle },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Timeline</Text>
              {timeline.map((item) => (
                <View key={item.key} style={styles.timelineRow}>
                  <Text style={[styles.timelineLabel, { color: colors.text.muted }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.timelineValue, { color: colors.text.primary }]}>
                    {formatTimestamp(item.value)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border.subtle }]}>
            {isSaving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <TouchableOpacity
                style={[styles.footerButton, { backgroundColor: colors.surface.level2 }]}
                onPress={onClose}
              >
                <Text style={[styles.footerButtonText, { color: colors.text.primary }]}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
    maxHeight: '92%',
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    ...textStyles.subtitle,
  },
  subtitle: {
    ...textStyles.caption,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  primaryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  primaryActionText: {
    ...textStyles.captionMedium,
  },
  section: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...textStyles.label,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    columnGap: spacing.lg,
  },
  infoItem: {
    width: '47%',
    gap: spacing.xs,
  },
  infoLabel: {
    ...textStyles.tiny,
    textTransform: 'uppercase',
  },
  infoValue: {
    ...textStyles.captionMedium,
    textTransform: 'capitalize',
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  suggestedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  suggestedText: {
    ...textStyles.captionMedium,
    fontWeight: '700',
  },
  suggestedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  suggestedButtonText: {
    ...textStyles.captionMedium,
    fontWeight: '700',
  },
  suggestedMeta: {
    ...textStyles.caption,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionButtonText: {
    ...textStyles.captionMedium,
  },
  textArea: {
    minHeight: 96,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    ...textStyles.body,
  },
  readOnlyCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  readOnlyLabel: {
    ...textStyles.tiny,
    textTransform: 'uppercase',
  },
  readOnlyValue: {
    ...textStyles.body,
  },
  readOnlyMeta: {
    ...textStyles.caption,
  },
  saveButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.45,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  timelineLabel: {
    ...textStyles.caption,
  },
  timelineValue: {
    ...textStyles.captionMedium,
    textAlign: 'right',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  footerButton: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  footerButtonText: {
    ...textStyles.label,
  },
});
