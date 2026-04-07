import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthChangeEvent, AuthError, AuthSession } from '@supabase/supabase-js';
import type { HostBootstrap, Location, UserSession } from '@shire/shared';
import { queryKeys } from '@/services/api/queryKeys';
import { supabase } from '@/services/supabase/client';
import { useWorkdayStore } from '@/features/workday';
import { createLocationApi, fetchCurrentSession, fetchHostBootstrap, fetchLocations } from './api';
import { useAuthStore } from './store';

type SignInResult = {
  error: AuthError | null;
};

type AuthContextValue = {
  session: AuthSession | null;
  userSession: UserSession | null;
  locations: Location[];
  currentLocation: Location | null;
  bootstrap: HostBootstrap | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  locationsLoading: boolean;
  locationsError: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  selectLocation: (locationId: string) => void;
  refetchLocations: () => void;
  createLocation: (name: string, timezone: string) => Promise<Location>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function useSessionQueries(
  session: AuthSession | null,
  currentLocationId: string | null,
  isWorkdayActive: boolean,
) {
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: fetchCurrentSession,
    enabled: !!session,
    staleTime: 60_000,
  });

  const locationsQuery = useQuery({
    queryKey: queryKeys.auth.locations(),
    queryFn: fetchLocations,
    enabled: !!session,
    staleTime: 60_000,
  });

  const bootstrapQuery = useQuery({
    queryKey: currentLocationId
      ? queryKeys.bootstrap.location(currentLocationId)
      : ['bootstrap', 'disabled'],
    queryFn: () => fetchHostBootstrap(currentLocationId!),
    enabled: !!session && !!currentLocationId && isWorkdayActive,
    staleTime: 30_000,
  });

  return {
    sessionQuery,
    locationsQuery,
    bootstrapQuery,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const currentLocationId = useAuthStore((state) => state.currentLocationId);
  const isSessionHydrated = useAuthStore((state) => state.isSessionHydrated);
  const setSession = useAuthStore((state) => state.setSession);
  const setCurrentLocationId = useAuthStore((state) => state.setCurrentLocationId);
  const setSessionHydrated = useAuthStore((state) => state.setSessionHydrated);
  const reset = useAuthStore((state) => state.reset);
  const activeWorkdayLocationId = useWorkdayStore((state) => state.activeLocationId);
  const endWorkday = useWorkdayStore((state) => state.endWorkday);
  const resetWorkday = useWorkdayStore((state) => state.reset);
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent | null>(null);
  const isWorkdayActive =
    !!currentLocationId && activeWorkdayLocationId === currentLocationId;

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) {
          return;
        }

        setSession(data.session);
        setSessionHydrated(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSession(null);
        setSessionHydrated(true);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setAuthEvent(event);
      setSession(nextSession);

      if (event === 'SIGNED_OUT') {
        reset();
        resetWorkday();
        void queryClient.invalidateQueries();
      }
    });

    if (Platform.OS !== 'web') {
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void supabase.auth.startAutoRefresh();
          return;
        }

        void supabase.auth.stopAutoRefresh();
      });

      return () => {
        isMounted = false;
        subscription.remove();
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [queryClient, reset, resetWorkday, setSession, setSessionHydrated]);

  const { sessionQuery, locationsQuery, bootstrapQuery } = useSessionQueries(
    session,
    currentLocationId,
    isWorkdayActive,
  );

  useEffect(() => {
    const locations = locationsQuery.data ?? [];
    if (!session || locations.length === 0) {
      return;
    }

    if (currentLocationId && locations.some((location) => location.id === currentLocationId)) {
      return;
    }

    if (!currentLocationId && locations.length > 1) {
      return;
    }

    const preferredLocation =
      locations.find((location) => location.isDefault) ?? locations[0] ?? null;
    if (preferredLocation) {
      setCurrentLocationId(preferredLocation.id);
    }
  }, [currentLocationId, locationsQuery.data, session, setCurrentLocationId]);

  useEffect(() => {
    if (authEvent !== 'SIGNED_IN') {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
  }, [authEvent, queryClient]);

  useEffect(() => {
    if (!activeWorkdayLocationId) {
      return;
    }

    if (activeWorkdayLocationId !== currentLocationId) {
      endWorkday();
    }
  }, [activeWorkdayLocationId, currentLocationId, endWorkday]);

  const value = useMemo<AuthContextValue>(() => {
    const locations = locationsQuery.data ?? [];
    const currentLocation =
      locations.find((location) => location.id === currentLocationId) ?? null;

    return {
      session,
      userSession: sessionQuery.data ?? null,
      locations,
      currentLocation,
      bootstrap: isWorkdayActive ? bootstrapQuery.data ?? null : null,
      isInitializing:
        !isSessionHydrated ||
        (!!session &&
          (sessionQuery.isLoading ||
            locationsQuery.isLoading ||
            (!!currentLocationId && isWorkdayActive && bootstrapQuery.isLoading))),
      isAuthenticated: !!session,
      locationsLoading: locationsQuery.isLoading,
      locationsError: locationsQuery.isError,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        resetWorkday();
        queryClient.clear();
      },
      selectLocation: (locationId) => {
        if (locationId !== currentLocationId) {
          endWorkday();
        }
        setCurrentLocationId(locationId);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.bootstrap.location(locationId),
        });
      },
      refetchLocations: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.locations() });
      },
      createLocation: async (name: string, timezone: string) => {
        const location = await createLocationApi(name, timezone);
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.locations() });
        return location;
      },
    };
  }, [
    bootstrapQuery.data,
    bootstrapQuery.isLoading,
    currentLocationId,
    endWorkday,
    isWorkdayActive,
    isSessionHydrated,
    locationsQuery.data,
    locationsQuery.isError,
    locationsQuery.isLoading,
    queryClient,
    resetWorkday,
    session,
    sessionQuery.data,
    sessionQuery.isLoading,
    setCurrentLocationId,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
