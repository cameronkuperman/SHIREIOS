import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

type PollingOptions = {
  foregroundMs: number;
  backgroundMs: number;
  enabled?: boolean;
  backgroundStopAfterMs?: number;
};

type PollingResult = {
  refetchInterval: number | false;
  refetchOnReconnect: boolean;
  refetchOnWindowFocus: boolean;
};

const DEFAULT_BACKGROUND_STOP_AFTER_MS = 5 * 60_000;

function isActiveState(state: AppStateStatus): boolean {
  return state === 'active';
}

export function usePolling(
  refetch: () => void | Promise<unknown>,
  {
    foregroundMs,
    backgroundMs,
    enabled = true,
    backgroundStopAfterMs = DEFAULT_BACKGROUND_STOP_AFTER_MS,
  }: PollingOptions,
): PollingResult {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isFocused, setIsFocused] = useState(false);
  const [backgroundedAt, setBackgroundedAt] = useState<number | null>(
    isActiveState(AppState.currentState) ? null : Date.now(),
  );
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = !isActiveState(appState);
      setAppState(nextState);

      if (isActiveState(nextState)) {
        setBackgroundedAt(null);
        if (enabled && wasBackgrounded) {
          void refetchRef.current();
        }
        return;
      }

      setBackgroundedAt((current) => current ?? Date.now());
    });

    return () => subscription.remove();
  }, [appState, enabled]);

  return useMemo(() => {
    if (!enabled || !isFocused) {
      return {
        refetchInterval: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      };
    }

    if (isActiveState(appState)) {
      return {
        refetchInterval: foregroundMs,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      };
    }

    if (backgroundedAt != null && Date.now() - backgroundedAt >= backgroundStopAfterMs) {
      return {
        refetchInterval: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      };
    }

    return {
      refetchInterval: backgroundMs,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    };
  }, [
    appState,
    backgroundMs,
    backgroundStopAfterMs,
    backgroundedAt,
    enabled,
    foregroundMs,
    isFocused,
  ]);
}
