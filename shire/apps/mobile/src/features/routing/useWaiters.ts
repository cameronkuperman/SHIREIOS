import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/api/queryKeys';
import { createWaiter, deleteWaiter, fetchWaiters, updateWaiter, type RosterWaiter } from './api';

export function useWaiters(locationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const enabled = Boolean(locationId);

  const query = useQuery({
    queryKey: locationId ? queryKeys.waiters.list(locationId) : queryKeys.waiters.all,
    queryFn: () => fetchWaiters(locationId as string),
    enabled,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; role?: string }) => {
      if (!locationId) {
        throw new Error('No location selected.');
      }
      return createWaiter(locationId, input);
    },
    onSuccess: (waiter) => {
      if (!locationId) {
        return;
      }
      queryClient.setQueryData<RosterWaiter[]>(queryKeys.waiters.list(locationId), (prev) => {
        const next = prev ? [...prev] : [];
        if (next.some((existing) => existing.id === waiter.id)) {
          return next;
        }
        next.push(waiter);
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { waiterId: string; name: string; role?: string }) => {
      if (!locationId) {
        throw new Error('No location selected.');
      }
      return updateWaiter(locationId, input.waiterId, { name: input.name, role: input.role });
    },
    onSuccess: (waiter) => {
      if (!locationId) {
        return;
      }
      queryClient.setQueryData<RosterWaiter[]>(queryKeys.waiters.list(locationId), (prev) => {
        const next = (prev ?? []).map((existing) =>
          existing.id === waiter.id ? waiter : existing,
        );
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.routing.location(locationId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (waiterId: string) => {
      if (!locationId) {
        throw new Error('No location selected.');
      }
      return deleteWaiter(locationId, waiterId);
    },
    onSuccess: (waiter) => {
      if (!locationId) {
        return;
      }
      queryClient.setQueryData<RosterWaiter[]>(queryKeys.waiters.list(locationId), (prev) =>
        (prev ?? []).filter((existing) => existing.id !== waiter.id),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.routing.location(locationId) });
    },
  });

  const addWaiter = useCallback(
    (input: { name: string; role?: string }) => createMutation.mutateAsync(input),
    [createMutation],
  );
  const editWaiter = useCallback(
    (input: { waiterId: string; name: string; role?: string }) =>
      updateMutation.mutateAsync(input),
    [updateMutation],
  );
  const removeWaiter = useCallback(
    (waiterId: string) => deleteMutation.mutateAsync(waiterId),
    [deleteMutation],
  );

  return {
    waiters: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
    addWaiter,
    editWaiter,
    removeWaiter,
    isAdding: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export type UseWaitersResult = ReturnType<typeof useWaiters>;
