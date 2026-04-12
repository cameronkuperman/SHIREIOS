import { useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { queryKeys } from '@/services/api/queryKeys';
import { fetchWaiterRouting } from './api';
import { useWaiterRoutingStore } from './store';

type WaiterRoutingProviderProps = {
  children: ReactNode;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load waiter routing.';
}

export function WaiterRoutingProvider({ children }: WaiterRoutingProviderProps) {
  const queryClient = useQueryClient();
  const { bootstrap, currentLocation, isAuthenticated } = useAuth();
  const locationId = currentLocation?.id ?? null;
  const setLocationContext = useWaiterRoutingStore((state) => state.setLocationContext);
  const applyRouting = useWaiterRoutingStore((state) => state.applyRouting);
  const setLoading = useWaiterRoutingStore((state) => state.setLoading);
  const setError = useWaiterRoutingStore((state) => state.setError);
  const reset = useWaiterRoutingStore((state) => state.reset);
  const hasInlineRoutingSnapshot =
    bootstrap?.location.id === locationId && Boolean(bootstrap.routingSnapshot);

  const routingQuery = useQuery({
    queryKey: locationId ? queryKeys.routing.location(locationId) : ['routing', 'disabled'],
    queryFn: () => fetchWaiterRouting(locationId!),
    enabled: isAuthenticated && !!locationId && !hasInlineRoutingSnapshot,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isAuthenticated || !locationId) {
      reset();
      return;
    }

    setLocationContext(locationId);
  }, [isAuthenticated, locationId, reset, setLocationContext]);

  useEffect(() => {
    if (!locationId || bootstrap?.location.id !== locationId || !bootstrap.routingSnapshot) {
      return;
    }

    applyRouting(locationId, bootstrap.routingSnapshot);
    queryClient.setQueryData(
      queryKeys.routing.location(locationId),
      bootstrap.routingSnapshot,
    );
    setLoading(false);
    setError(null);
  }, [applyRouting, bootstrap, locationId, queryClient, setError, setLoading]);

  useEffect(() => {
    setLoading(!hasInlineRoutingSnapshot && routingQuery.isPending && !routingQuery.data);
  }, [hasInlineRoutingSnapshot, routingQuery.data, routingQuery.isPending, setLoading]);

  useEffect(() => {
    if (!locationId || !routingQuery.data) {
      return;
    }

    applyRouting(locationId, routingQuery.data);
  }, [applyRouting, locationId, routingQuery.data]);

  useEffect(() => {
    if (hasInlineRoutingSnapshot) {
      setError(null);
      return;
    }

    if (routingQuery.isError) {
      setError(toErrorMessage(routingQuery.error));
      return;
    }

    if (routingQuery.data) {
      setError(null);
    }
  }, [hasInlineRoutingSnapshot, routingQuery.data, routingQuery.error, routingQuery.isError, setError]);

  return children;
}
