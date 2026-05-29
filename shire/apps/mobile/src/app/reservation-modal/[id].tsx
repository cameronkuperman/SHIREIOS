import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ReservationEditor } from '@/components/ReservationEditor';
import { fireHostMutation } from '@/features/host/backgroundMutation';
import { useReservationDetail, useReservationMutations } from '@/features/host/hooks';
import { textStyles, useTheme } from '@/theme';

export default function ReservationDetailModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const { colors } = useTheme();
  const reservationId = typeof params.id === 'string' ? params.id : null;
  const date = typeof params.date === 'string' ? params.date : undefined;
  const reservation = useReservationDetail(reservationId, date);
  const {
    updateReservation,
    runReservationAction,
    archiveReservation,
    restoreReservation,
    removeDuplicateReservation,
    isSaving,
  } = useReservationMutations();

  if (!reservationId) {
    return (
      <SafeAreaView style={[styles.state, { backgroundColor: colors.background }]}>
        <Text style={[styles.stateText, { color: colors.text.muted }]}>Reservation not found.</Text>
      </SafeAreaView>
    );
  }

  if (!reservation) {
    return (
      <SafeAreaView style={[styles.state, { backgroundColor: colors.background }]}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.stateText, { color: colors.text.muted }]}>Loading reservation…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ReservationEditor
      mode="edit"
      reservation={reservation}
      isSaving={isSaving}
      onClose={() => router.back()}
      onSave={async (values) => {
        fireHostMutation(
          updateReservation({ reservationId: reservation.id, input: values }),
          'Unable to Save Reservation',
          'The reservation could not be updated.',
        );
        router.back();
      }}
      onRunAction={async (action) => {
        await runReservationAction({ reservationId: reservation.id, action });
      }}
      onOpenFloor={() => router.replace('/(host)')}
      onMessageGuest={() =>
        router.push({
          pathname: '/(host)/inbox/new',
          params: {
            reservationId: reservation.id,
            guestId: reservation.guestId ?? undefined,
            guestName: reservation.guestName,
            phone: reservation.guestPhone,
          },
        } as Href)
      }
      onArchive={async () => {
        fireHostMutation(
          archiveReservation({ reservationId: reservation.id }),
          'Unable to Archive Reservation',
          'The reservation could not be archived.',
        );
        router.back();
      }}
      onRestore={async () => {
        fireHostMutation(
          restoreReservation({ reservationId: reservation.id }),
          'Unable to Restore Reservation',
          'The reservation could not be restored.',
        );
        router.back();
      }}
      onRemoveDuplicate={async () => {
        fireHostMutation(
          removeDuplicateReservation({ reservationId: reservation.id }),
          'Unable to Remove Reservation',
          'The reservation could not be removed.',
        );
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
  },
  stateText: {
    ...textStyles.body,
  },
});
