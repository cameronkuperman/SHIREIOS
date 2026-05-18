import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/api/queryKeys';
import { createWaiter, fetchWaiters, type RosterWaiter } from './api';

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

  const addWaiter = useCallback(
    (input: { name: string; role?: string }) => createMutation.mutateAsync(input),
    [createMutation],
  );

  return {
    waiters: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
    addWaiter,
    isAdding: createMutation.isPending,
  };
}

export type UseWaitersResult = ReturnType<typeof useWaiters>;
