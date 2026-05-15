import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateBlackoutRequest, UpdateBlackoutRequest } from '@shire/shared';
import { useAuth } from '@/features/auth';
import { queryKeys } from '@/services/api/queryKeys';
import {
  archiveBlackout,
  createBlackout,
  fetchBlackouts,
  restoreBlackout,
  updateBlackout,
} from './api';

function useLocationId(): string | null {
  const { currentLocation } = useAuth();
  return currentLocation?.id ?? null;
}

export function useBlackouts(includeArchived = false) {
  const locationId = useLocationId();
  return useQuery({
    queryKey: locationId
      ? queryKeys.blackouts.list(locationId, includeArchived)
      : ['blackouts', 'disabled'],
    queryFn: () => fetchBlackouts(locationId!, includeArchived),
    enabled: !!locationId,
  });
}

function invalidateBlackouts(queryClient: ReturnType<typeof useQueryClient>, locationId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.blackouts.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.location(locationId) });
}

export function useCreateBlackout() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlackoutRequest) => createBlackout(locationId!, input),
    onSuccess: () => {
      if (locationId) invalidateBlackouts(queryClient, locationId);
    },
  });
}

export function useUpdateBlackout() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blackoutId, input }: { blackoutId: string; input: UpdateBlackoutRequest }) =>
      updateBlackout(locationId!, blackoutId, input),
    onSuccess: () => {
      if (locationId) invalidateBlackouts(queryClient, locationId);
    },
  });
}

export function useArchiveBlackout() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blackoutId, reason }: { blackoutId: string; reason?: string }) =>
      archiveBlackout(locationId!, blackoutId, { reason }),
    onSuccess: () => {
      if (locationId) invalidateBlackouts(queryClient, locationId);
    },
  });
}

export function useRestoreBlackout() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blackoutId: string) => restoreBlackout(locationId!, blackoutId),
    onSuccess: () => {
      if (locationId) invalidateBlackouts(queryClient, locationId);
    },
  });
}
