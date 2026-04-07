import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReservationEditor } from '@/components/ReservationEditor';
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
        await createReservation(values);
        router.back();
      }}
    />
  );
}
