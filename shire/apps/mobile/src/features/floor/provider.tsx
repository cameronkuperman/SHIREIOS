import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TableLiveState, WaitlistEntry } from '@shire/shared';
import { env } from '@/config/env';
import { useAuth } from '@/features/auth';
import {
  markReservationSeated,
  markWaitlistEntrySeated,
  upsertWaitlistEntry,
} from '@/features/host/contracts';
import { usePendingSeatStore } from '@/features/host/pendingSeatStore';
import { useWaiterRoutingStore } from '@/features/routing';
import { queryKeys } from '@/services/api/queryKeys';
import { useIsWorkdayActive } from '@/features/workday';
import { fetchFloorSnapshot } from './api';
import { useFloorStore } from './store';
import { FloorRealtimeTransport, setActiveFloorTransport } from './transport';

type FloorRealtimeProviderProps = {
  children: ReactNode;
};

function resolveCanonicalSeatTable(
  tables: TableLiveState[],
  tableId: string,
): TableLiveState | null {
  return tables.find((table) => table.tableId === tableId) ?? tables[0] ?? null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to sync floor state.';
}

export function FloorRealtimeProvider({ children }: FloorRealtimeProviderProps) {
  const queryClient = useQueryClient();
  const { bootstrap, currentLocation, isAuthenticated, session } = useAuth();
  const isWorkdayActive = useIsWorkdayActive(currentLocation?.id ?? null);
  const applySnapshot = useFloorStore((state) => state.applySnapshot);
  const applyStreamMessage = useFloorStore((state) => state.applyStreamMessage);
  const setConnectionState = useFloorStore((state) => state.setConnectionState);
  const setSyncError = useFloorStore((state) => state.setSyncError);
  const resetSessionState = useFloorStore((state) => state.resetSessionState);
  const setFloorMap = useFloorStore((state) => state.setFloorMap);
  const applyRouting = useWaiterRoutingStore((state) => state.applyRouting);
  const confirmPendingSeat = usePendingSeatStore((state) => state.confirmPendingSeat);
  const rollbackPendingSeat = usePendingSeatStore((state) => state.rollbackPendingSeat);
  const clearAllPendingSeats = usePendingSeatStore((state) => state.clearAll);

  useEffect(() => {
    if (!isAuthenticated || !currentLocation || !bootstrap || !isWorkdayActive) {
      setActiveFloorTransport(null);
      clearAllPendingSeats();
      resetSessionState();
      return;
    }

    let isDisposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let transport: FloorRealtimeTransport | null = null;
    let reconnectScheduled = false;

    const locationId = currentLocation.id;
    const floorId = bootstrap.floorId;
    const accessToken = session?.access_token ?? null;

    setFloorMap(bootstrap.floorMap);
    resetSessionState();

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const syncWaitlistQuery = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.list(locationId) });
    };

    const syncReservationQueries = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.location(locationId) });
    };

    const updateWaitlistQuery = (updater: (entries: WaitlistEntry[]) => WaitlistEntry[]) => {
      queryClient.setQueryData<WaitlistEntry[]>(
        queryKeys.waitlist.list(locationId),
        (currentEntries) => updater(currentEntries ?? []),
      );
    };

    const loadSnapshot = async (): Promise<void> => {
      try {
        const snapshot = await queryClient.fetchQuery({
          queryKey: queryKeys.floor.snapshot(locationId, floorId),
          queryFn: () => fetchFloorSnapshot(locationId, floorId),
          staleTime: 0,
        });

        if (!isDisposed) {
          applySnapshot(snapshot);
          setSyncError(null);
        }
      } catch (error) {
        if (!isDisposed) {
          setSyncError(toErrorMessage(error));
        }
      }
    };

    const scheduleReconnect = () => {
      if (reconnectScheduled || isDisposed) {
        return;
      }

      reconnectScheduled = true;
      clearReconnectTimer();
      reconnectAttempt += 1;
      const delay =
        Math.min(1000 * 2 ** (reconnectAttempt - 1), 15_000) + Math.round(Math.random() * 250);
      setConnectionState('reconnecting');
      reconnectTimer = setTimeout(() => {
        reconnectScheduled = false;
        void connect();
      }, delay);
    };

    const connect = async () => {
      reconnectScheduled = false;
      setConnectionState(reconnectAttempt === 0 ? 'connecting' : 'reconnecting');
      await loadSnapshot();
      if (isDisposed) {
        return;
      }

      transport?.disconnect();

      const nextTransport = new FloorRealtimeTransport(
        env.WS_URL,
        accessToken,
        locationId,
        floorId,
        {
          onOpen: () => {
            reconnectAttempt = 0;
            setConnectionState('connected');
            setSyncError(null);
            syncWaitlistQuery();
            syncReservationQueries();
          },
          onClose: () => {
            setActiveFloorTransport(null);
            if (isDisposed) {
              setConnectionState('disconnected');
              return;
            }

            scheduleReconnect();
          },
          onError: (error) => {
            setConnectionState('error');
            setSyncError(toErrorMessage(error));
            scheduleReconnect();
          },
          onMessage: (message) => {
            if (message.type === 'connection.ping') {
              nextTransport.sendPong(message.timestamp);
              return;
            }

            if (message.type === 'table.updated' && message.commandId) {
              const pendingSeat = usePendingSeatStore.getState().pendingSeats[message.commandId];
              if (pendingSeat) {
                if (pendingSeat.source === 'waitlist') {
                  updateWaitlistQuery((entries) =>
                    markWaitlistEntrySeated(
                      entries,
                      pendingSeat.entityId,
                      message.table.tableId,
                      message.table.seatedAt ?? message.table.updatedAt,
                    ),
                  );
                } else {
                  queryClient.setQueriesData(
                    { queryKey: queryKeys.reservations.location(locationId) },
                    (currentReservations: unknown) =>
                      Array.isArray(currentReservations)
                        ? markReservationSeated(
                            currentReservations,
                            pendingSeat.entityId,
                            message.table.tableId,
                            message.table.seatedAt ?? message.table.updatedAt,
                          )
                        : currentReservations,
                  );
                }
              }
              confirmPendingSeat(message.commandId);
            }

            if (message.type === 'table.batch_updated' && message.commandId) {
              const pendingSeat = usePendingSeatStore.getState().pendingSeats[message.commandId];
              const canonicalTable = pendingSeat
                ? resolveCanonicalSeatTable(message.tables, pendingSeat.tableId)
                : null;

              if (pendingSeat && canonicalTable) {
                if (pendingSeat.source === 'waitlist') {
                  updateWaitlistQuery((entries) =>
                    markWaitlistEntrySeated(
                      entries,
                      pendingSeat.entityId,
                      canonicalTable.tableId,
                      canonicalTable.seatedAt ?? canonicalTable.updatedAt,
                    ),
                  );
                } else {
                  queryClient.setQueriesData(
                    { queryKey: queryKeys.reservations.location(locationId) },
                    (currentReservations: unknown) =>
                      Array.isArray(currentReservations)
                        ? markReservationSeated(
                            currentReservations,
                            pendingSeat.entityId,
                            canonicalTable.tableId,
                            canonicalTable.seatedAt ?? canonicalTable.updatedAt,
                          )
                        : currentReservations,
                  );
                }
              }

              confirmPendingSeat(message.commandId);
            }

            if (message.type === 'waitlist.updated') {
              updateWaitlistQuery((entries) => upsertWaitlistEntry(entries, message.entry));
            }

            if (message.type === 'routing.updated') {
              applyRouting(message.locationId, message.routing);
              queryClient.setQueryData(
                queryKeys.routing.location(message.locationId),
                message.routing,
              );
            }

            if (message.type === 'command.rejected') {
              rollbackPendingSeat(message.commandId);
            }

            applyStreamMessage(message);
          },
        },
      );

      transport = nextTransport;
      setActiveFloorTransport(nextTransport);
      nextTransport.connect();
    };

    void connect();

    return () => {
      isDisposed = true;
      clearReconnectTimer();
      transport?.disconnect();
      setActiveFloorTransport(null);
      clearAllPendingSeats();
      resetSessionState();
    };
  }, [
    applySnapshot,
    applyStreamMessage,
    bootstrap,
    clearAllPendingSeats,
    confirmPendingSeat,
    currentLocation,
    isWorkdayActive,
    isAuthenticated,
    queryClient,
    resetSessionState,
    rollbackPendingSeat,
    session?.access_token,
    applyRouting,
    setConnectionState,
    setFloorMap,
    setSyncError,
  ]);

  return children;
}
