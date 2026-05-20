import type { TableCommand, TableParty } from '@shire/shared';

export function createCommandId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSeatPartyCommand(
  floorId: string,
  tableId: string,
  party: TableParty,
  waiterId?: string,
  backendTableId?: string | null,
): TableCommand {
  return {
    type: 'seat_party',
    commandId: createCommandId('seat-party'),
    floorId,
    tableId,
    ...(backendTableId ? { backendTableId } : {}),
    requestedAt: new Date().toISOString(),
    party,
    ...(waiterId ? { waiterId } : {}),
  };
}

export function createSeatWalkInCommand(
  floorId: string,
  tableId: string,
  name: string,
  size: number,
  waiterId?: string,
  backendTableId?: string | null,
): TableCommand {
  return {
    type: 'seat_walk_in',
    commandId: createCommandId('seat-walk-in'),
    floorId,
    tableId,
    ...(backendTableId ? { backendTableId } : {}),
    requestedAt: new Date().toISOString(),
    party: {
      id: createCommandId('walk-in-party'),
      name: name.trim() || `Walk-in (${size})`,
      size,
      source: 'walk_in',
    },
    ...(waiterId ? { waiterId } : {}),
  };
}
