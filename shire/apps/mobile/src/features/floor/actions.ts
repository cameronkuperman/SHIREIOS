import type { TableCommand, TableParty } from '@shire/shared';
import { useAuthStore } from '@/features/auth';
import { useFloorStore } from './store';
import { getActiveFloorTransport } from './transport';
import { createCommandId, createSeatPartyCommand, createSeatWalkInCommand } from './commands';
import { floorRealtimeRepository } from './repository';

export type DispatchResult =
  | { ok: true; commandId: string }
  | { ok: false; commandId: string };

function dispatchTableCommand(command: TableCommand): DispatchResult {
  const transport = getActiveFloorTransport();
  const floorStore = useFloorStore.getState();

  floorStore.queuePendingCommand(command);

  if (transport?.isConnected()) {
    try {
      transport.sendCommand(command);
      return { ok: true, commandId: command.commandId };
    } catch {
      // Fall through to the HTTP path. The optimistic command stays pending
      // until the backend emits table.updated or command.rejected.
    }
  }

  void sendCommandOverHttp(command);
  return { ok: true, commandId: command.commandId };
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
      useFloorStore.getState().applyStreamMessage(message);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Backend command fallback failed.';
    useFloorStore
      .getState()
      .setSyncError(`Table update is queued and will retry when the floor socket reconnects. ${reason}`);
  }
}

export function useFloorActions() {
  const floorId = useFloorStore((state) => state.floorId);

  return {
    seatParty: (tableId: string, party: TableParty, waiterId?: string) =>
      dispatchTableCommand(createSeatPartyCommand(floorId, tableId, party, waiterId)),
    seatWalkIn: (tableId: string, name: string, size: number, waiterId?: string) =>
      dispatchTableCommand(createSeatWalkInCommand(floorId, tableId, name, size, waiterId)),
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
