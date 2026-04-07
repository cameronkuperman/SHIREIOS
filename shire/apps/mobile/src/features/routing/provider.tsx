import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const { currentLocation, isAuthenticated } = useAuth();
  const locationId = currentLocation?.id ?? null;
  const setLocationContext = useWaiterRoutingStore((state) => state.setLocationContext);
  const applyRouting = useWaiterRoutingStore((state) => state.applyRouting);
  const setLoading = useWaiterRoutingStore((state) => state.setLoading);
  const setError = useWaiterRoutingStore((state) => state.setError);
  const reset = useWaiterRoutingStore((state) => state.reset);

  const routingQuery = useQuery({
    queryKey: locationId ? queryKeys.routing.location(locationId) : ['routing', 'disabled'],
    queryFn: () => fetchWaiterRouting(locationId!),
    enabled: isAuthenticated && !!locationId,
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
    setLoading(routingQuery.isPending && !routingQuery.data);
  }, [routingQuery.data, routingQuery.isPending, setLoading]);

  useEffect(() => {
    if (!locationId || !routingQuery.data) {
      return;
    }

    applyRouting(locationId, routingQuery.data);
  }, [applyRouting, locationId, routingQuery.data]);

  useEffect(() => {
    if (routingQuery.isError) {
      setError(toErrorMessage(routingQuery.error));
      return;
    }

    if (routingQuery.data) {
      setError(null);
    }
  }, [routingQuery.data, routingQuery.error, routingQuery.isError, setError]);

  return children;
}
