import type { TableCommand, TableParty } from '@shire/shared';
import { useFloorStore } from './store';
import { getActiveFloorTransport } from './transport';

export type DispatchResult =
  | { ok: true; commandId: string }
  | { ok: false; commandId: string };

function createCommandId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dispatchTableCommand(command: TableCommand): DispatchResult {
  const transport = getActiveFloorTransport();
  const floorStore = useFloorStore.getState();

  if (!transport || !transport.isConnected()) {
    floorStore.setSyncError('Floor connection unavailable. Reconnect before changing tables.');
    return { ok: false, commandId: command.commandId };
  }

  floorStore.queuePendingCommand(command);

  try {
    transport.sendCommand(command);
    return { ok: true, commandId: command.commandId };
  } catch (error) {
    floorStore.rejectPendingCommand(
      command.commandId,
      command.tableId,
      error instanceof Error ? error.message : 'Failed to send table command.',
    );
    return { ok: false, commandId: command.commandId };
  }
}

export function useFloorActions() {
  const floorId = useFloorStore((state) => state.floorId);

  return {
    seatParty: (tableId: string, party: TableParty, waiterId?: string) =>
      dispatchTableCommand({
        type: 'seat_party',
        commandId: createCommandId('seat-party'),
        floorId,
        tableId,
        requestedAt: new Date().toISOString(),
        party,
        ...(waiterId ? { waiterId } : {}),
      }),
    seatWalkIn: (tableId: string, name: string, size: number, waiterId?: string) =>
      dispatchTableCommand({
        type: 'seat_walk_in',
        commandId: createCommandId('seat-walk-in'),
        floorId,
        tableId,
        requestedAt: new Date().toISOString(),
        party: {
          id: createCommandId('walk-in-party'),
          name: name.trim() || `Walk-in (${size})`,
          size,
          source: 'walk_in',
        },
        ...(waiterId ? { waiterId } : {}),
      }),
    clearTable: (tableId: string) =>
      dispatchTableCommand({
        type: 'clear_table',
        commandId: createCommandId('clear-table'),
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
