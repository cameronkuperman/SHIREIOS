import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReservationEditor } from '@/components/ReservationEditor';
import { fireHostMutation } from '@/features/host/backgroundMutation';
import { useReservationMutations } from '@/features/host/hooks';

export default function NewReservationModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { createReservation, isSaving } = useReservationMutations();

  return (
    <ReservationEditor
      mode="create"
      initialDate={typeof params.date === 'string' ? params.date : null}
      isSaving={isSaving}
      onClose={() => router.back()}
      onSave={async (values) => {
        // The mutation's onMutate inserts the reservation optimistically, so
        // close immediately and reconcile in the background instead of making
        // the host wait on the round-trip.
        fireHostMutation(
          createReservation(values),
          'Unable to Save Reservation',
          'The reservation could not be saved.',
        );
        router.back();
      }}
    />
  );
}
