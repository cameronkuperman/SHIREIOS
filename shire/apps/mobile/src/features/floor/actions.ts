import type {
  FloorStreamMessage,
  Reservation,
  TableCommand,
  TableLiveState,
  TableParty,
  WaitlistEntry,
} from '@shire/shared';
import { useAuthStore } from '@/features/auth';
import {
  markReservationSeated,
  markWaitlistEntrySeated,
  upsertWaitlistEntry,
} from '@/features/host/contracts';
import { usePendingSeatStore } from '@/features/host/pendingSeatStore';
import { fetchWaiterRouting } from '@/features/routing/api';
import { useWaiterRoutingStore } from '@/features/routing/store';
import { queryClient } from '@/services/api/queryClient';
import { queryKeys } from '@/services/api/queryKeys';
import { useFloorStore } from './store';
import { getActiveFloorTransport } from './transport';
import { createCommandId, createSeatPartyCommand, createSeatWalkInCommand } from './commands';
import { floorRealtimeRepository } from './repository';

export type DispatchResult = { ok: true; commandId: string } | { ok: false; commandId: string };

function dispatchTableCommand(command: TableCommand): DispatchResult {
  const transport = getActiveFloorTransport();
  const floorStore = useFloorStore.getState();
  const locationId = useAuthStore.getState().currentLocationId;
  const routingUpdatedAt = useWaiterRoutingStore.getState().routing?.updatedAt ?? null;

  console.info('[FloorActions] dispatch table command', {
    commandId: command.commandId,
    type: command.type,
    tableId: command.tableId,
    backendTableId: command.backendTableId ?? null,
    partySize: 'party' in command ? command.party.size : undefined,
    waiterId: 'waiterId' in command ? (command.waiterId ?? null) : undefined,
    socketConnected: transport?.isConnected() ?? false,
  });
  floorStore.queuePendingCommand(command);

  if (transport?.isConnected()) {
    try {
      transport.sendCommand(command);
      scheduleRoutingRefresh(locationId, routingUpdatedAt);
      return { ok: true, commandId: command.commandId };
    } catch {
      // Fall through to the HTTP path. The optimistic command stays pending
      // until the backend emits table.updated or command.rejected.
    }
  }

  void sendCommandOverHttp(command);
  scheduleRoutingRefresh(locationId, routingUpdatedAt);
  return { ok: true, commandId: command.commandId };
}

function resolveCanonicalSeatTable(
  tables: TableLiveState[],
  tableId: string,
): TableLiveState | null {
  return tables.find((table) => table.tableId === tableId) ?? tables[0] ?? null;
}

function isReservationSeatConfirmed(table: TableLiveState, reservationId: string): boolean {
  return table.currentReservationId === reservationId && Boolean(table.currentVisitId);
}

function updateWaitlistQuery(
  locationId: string,
  updater: (entries: WaitlistEntry[]) => WaitlistEntry[],
) {
  queryClient.setQueryData<WaitlistEntry[]>(queryKeys.waitlist.list(locationId), (currentEntries) =>
    updater(currentEntries ?? []),
  );
}

function updateReservationQueries(
  locationId: string,
  updater: (reservations: Reservation[]) => Reservation[],
) {
  queryClient.setQueriesData<Reservation[]>(
    { queryKey: queryKeys.reservations.location(locationId) },
    (currentReservations) =>
      Array.isArray(currentReservations) ? updater(currentReservations) : currentReservations,
  );
}

function syncSeatedPartyQueryCache(message: FloorStreamMessage) {
  if (
    message.type !== 'table.updated' &&
    message.type !== 'table.batch_updated' &&
    message.type !== 'waitlist.updated'
  ) {
    return;
  }

  const locationId = useAuthStore.getState().currentLocationId;
  if (!locationId) {
    return;
  }

  if (message.type === 'waitlist.updated') {
    updateWaitlistQuery(locationId, (entries) => upsertWaitlistEntry(entries, message.entry));
    return;
  }

  if (!message.commandId) {
    return;
  }

  const pendingSeat = usePendingSeatStore.getState().pendingSeats[message.commandId];
  if (!pendingSeat) {
    return;
  }

  const canonicalTable =
    message.type === 'table.updated'
      ? message.table
      : resolveCanonicalSeatTable(message.tables, pendingSeat.tableId);
  if (!canonicalTable) {
    return;
  }

  const seatedAt = canonicalTable.seatedAt ?? canonicalTable.updatedAt;
  if (pendingSeat.source === 'waitlist') {
    updateWaitlistQuery(locationId, (entries) =>
      markWaitlistEntrySeated(entries, pendingSeat.entityId, canonicalTable.tableId, seatedAt),
    );
    return;
  }

  if (!isReservationSeatConfirmed(canonicalTable, pendingSeat.entityId)) {
    return;
  }

  updateReservationQueries(locationId, (reservations) =>
    markReservationSeated(
      reservations,
      pendingSeat.entityId,
      canonicalTable.tableId,
      seatedAt,
      canonicalTable.currentVisitId,
    ),
  );
}

function applyCommandResponseMessage(message: FloorStreamMessage, command: TableCommand) {
  console.info('[FloorActions] HTTP command message', {
    commandId: command.commandId,
    messageType: message.type,
    tableId: 'table' in message ? message.table.tableId : undefined,
    reason: 'reason' in message ? message.reason : undefined,
  });
  if (message.type === 'routing.updated') {
    useWaiterRoutingStore.getState().applyRouting(message.locationId, message.routing);
    queryClient.setQueryData(queryKeys.routing.location(message.locationId), message.routing);
    return;
  }
  syncSeatedPartyQueryCache(message);
  useFloorStore.getState().applyStreamMessage(message);
  if (message.type === 'command.rejected') {
    usePendingSeatStore.getState().rollbackPendingSeat(message.commandId);
  }
  if (
    (message.type === 'table.updated' || message.type === 'table.batch_updated') &&
    message.commandId
  ) {
    usePendingSeatStore.getState().confirmPendingSeat(message.commandId);
  }
}

function scheduleRoutingRefresh(locationId: string | null, previousUpdatedAt: string | null) {
  if (!locationId) {
    return;
  }
  setTimeout(() => {
    const routingState = useWaiterRoutingStore.getState();
    if (routingState.locationId !== locationId) {
      return;
    }
    if (routingState.routing?.updatedAt && routingState.routing.updatedAt !== previousUpdatedAt) {
      return;
    }
    void fetchWaiterRouting(locationId)
      .then((routing) => {
        useWaiterRoutingStore.getState().applyRouting(locationId, routing);
      })
      .catch((error) => {
        console.warn('[FloorActions] routing refresh after command failed', {
          locationId,
          reason: error instanceof Error ? error.message : 'Unable to refresh routing.',
        });
      });
  }, 1_200);
}

async function sendCommandOverHttp(command: TableCommand): Promise<void> {
  const locationId = useAuthStore.getState().currentLocationId;
  const floorStore = useFloorStore.getState();

  if (!locationId) {
    floorStore.setSyncError('Table update is queued and will retry when this location reconnects.');
    return;
  }

  try {
    const messages = await floorRealtimeRepository.sendCommandHttp(
      locationId,
      command.floorId,
      command,
    );
    for (const message of messages) {
      applyCommandResponseMessage(message, command);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Backend command fallback failed.';
    console.warn('[FloorActions] HTTP command failed', {
      commandId: command.commandId,
      type: command.type,
      tableId: command.tableId,
      reason,
    });
    floorStore.rejectPendingCommand(command.commandId, command.tableId, reason);
    usePendingSeatStore.getState().rollbackPendingSeat(command.commandId);
    useFloorStore
      .getState()
      .setSyncError(
        `Table update is queued and will retry when the floor socket reconnects. ${reason}`,
      );
  }
}

export function useFloorActions() {
  const floorId = useFloorStore((state) => state.floorId);

  return {
    seatParty: (
      tableId: string,
      party: TableParty,
      waiterId?: string,
      backendTableId?: string | null,
    ) =>
      dispatchTableCommand(
        createSeatPartyCommand(floorId, tableId, party, waiterId, backendTableId),
      ),
    seatWalkIn: (
      tableId: string,
      name: string,
      size: number,
      waiterId?: string,
      backendTableId?: string | null,
    ) =>
      dispatchTableCommand(
        createSeatWalkInCommand(floorId, tableId, name, size, waiterId, backendTableId),
      ),
    clearTable: (tableId: string) =>
      dispatchTableCommand({
        type: 'clear_table',
        commandId: createCommandId('clear-table'),
        floorId,
        tableId,
        requestedAt: new Date().toISOString(),
      }),
    markDirty: (tableId: string) =>
      dispatchTableCommand({
        type: 'mark_dirty',
        commandId: createCommandId('mark-dirty'),
        floorId,
        tableId,
        requestedAt: new Date().toISOString(),
      }),
    markClean: (tableId: string) =>
      dispatchTableCommand({
        type: 'mark_clean',
        commandId: createCommandId('mark-clean'),
        floorId,
        tableId,
        requestedAt: new Date().toISOString(),
      }),
    blockTable: (tableId: string) =>
      dispatchTableCommand({
        type: 'block_table',
        commandId: createCommandId('block-table'),
        floorId,
        tableId,
        requestedAt: new Date().toISOString(),
      }),
    unblockTable: (tableId: string) =>
      dispatchTableCommand({
        type: 'unblock_table',
        commandId: createCommandId('unblock-table'),
        floorId,
        tableId,
        requestedAt: new Date().toISOString(),
      }),
  };
}
