import type {
  BackendFloorSnapshotDto,
  BackendFloorStreamMessage,
  BackendLiveTable,
  FloorSnapshot,
  FloorStreamMessage,
  TableLiveState,
  TableState,
  TableUpdateSource,
  WaiterRoutingState,
} from '@shire/shared';
import { adaptWaitlistEntry, type WaitlistEntryDto } from '@/features/host/contracts';
import { normalizeWaiterRoutingState } from '@/features/routing/contracts';

type LegacyFloorSnapshotDto = {
  floorId: string;
  mapVersion: string;
  sequence: number;
  generatedAt?: string;
  snapshotAt?: string;
  tables?: TableLiveState[];
  tablesById?: Record<string, TableLiveState>;
};

type WaitlistUpdatedMessageDto = {
  type: 'waitlist.updated';
  entry: WaitlistEntryDto;
};

type RoutingUpdatedMessageDto = {
  type: 'routing.updated';
  locationId: string;
  routing: WaiterRoutingState;
  emittedAt?: string;
};

type LegacyRealtimeMessage =
  | FloorStreamMessage
  | WaitlistUpdatedMessageDto
  | RoutingUpdatedMessageDto;
type RealtimeMessageDto = BackendFloorStreamMessage | LegacyRealtimeMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isLegacyLiveTable(value: unknown): value is TableLiveState {
  return (
    isRecord(value) &&
    typeof value.tableId === 'string' &&
    typeof value.displayStatus === 'string' &&
    typeof value.sensedState === 'string'
  );
}

function isBackendLiveTable(value: unknown): value is BackendLiveTable {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.tableNumber === 'string' &&
    typeof value.state === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function toSensedState(state: BackendLiveTable['state']): TableState {
  switch (state) {
    case 'occupied':
      return 'occupied';
    case 'dirty':
    case 'empty_dirty':
      return 'empty_dirty';
    case 'available':
    case 'clean':
    case 'empty_clean':
    default:
      return 'empty_clean';
  }
}

function toDisplayStatus(
  sensedState: TableState,
  isBlocked: boolean,
): TableLiveState['displayStatus'] {
  if (isBlocked) {
    return 'reserved';
  }

  switch (sensedState) {
    case 'occupied':
      return 'occupied';
    case 'empty_dirty':
      return 'dirty';
    default:
      return 'available';
  }
}

function toParty(table: BackendLiveTable): TableLiveState['party'] {
  if (table.state !== 'occupied') {
    return null;
  }

  const size = table.currentPartySize ?? 0;
  const name = table.currentPartyName?.trim() || (size > 0 ? `Party of ${size}` : 'Occupied');

  return {
    id: table.currentWaitlistEntryId ?? table.currentVisitId ?? `table-${table.id}-party`,
    name,
    size,
    source: table.currentWaitlistEntryId ? 'waitlist' : 'manual',
  };
}

export function adaptBackendTable(
  table: BackendLiveTable,
  sequence: number,
  source: TableUpdateSource | null = null,
  emittedAt: string | null = null,
): TableLiveState {
  const sensedState = toSensedState(table.state);

  return {
    tableId: table.id,
    tableNumber: table.tableNumber,
    displayStatus: toDisplayStatus(sensedState, table.isBlocked),
    sensedState,
    stateConfidence: table.stateConfidence ?? 0,
    lastStateChange: table.stateChangedAt ?? table.updatedAt,
    updatedAt: table.updatedAt,
    sequence,
    isBlocked: table.isBlocked,
    override: null,
    party: toParty(table),
    seatedAt: table.seatedAt ?? null,
    assignedServer: table.currentWaiterName ?? null,
    currentWaiterId: table.currentWaiterId ?? null,
    currentWaiterName: table.currentWaiterName ?? null,
    currentWaitlistEntryId: table.currentWaitlistEntryId ?? null,
    currentPartySize: table.currentPartySize ?? null,
    lastUpdateSource: source,
    emittedAt,
  };
}

function normalizeSnapshotTables(
  snapshot: LegacyFloorSnapshotDto | BackendFloorSnapshotDto,
): TableLiveState[] {
  const rawTables = snapshot.tables ?? Object.values(snapshot.tablesById ?? {});

  return rawTables.flatMap((table) => {
    if (isLegacyLiveTable(table)) {
      return [table];
    }

    if (isBackendLiveTable(table)) {
      return [
        adaptBackendTable(
          table,
          snapshot.sequence,
          null,
          snapshot.generatedAt ?? snapshot.snapshotAt ?? null,
        ),
      ];
    }

    return [];
  });
}

export function adaptFloorSnapshot(
  snapshot: LegacyFloorSnapshotDto | BackendFloorSnapshotDto,
): FloorSnapshot {
  return {
    floorId: snapshot.floorId,
    mapVersion: snapshot.mapVersion,
    generatedAt: snapshot.generatedAt ?? snapshot.snapshotAt ?? new Date().toISOString(),
    sequence: snapshot.sequence,
    tables: normalizeSnapshotTables(snapshot),
  };
}

function normalizeRealtimeTables(
  tables: unknown[],
  sequence: number,
  source: TableUpdateSource | null,
  emittedAt: string | null,
): TableLiveState[] {
  return tables.flatMap((table) => {
    if (isLegacyLiveTable(table)) {
      return [table];
    }

    if (isBackendLiveTable(table)) {
      return [adaptBackendTable(table, sequence, source, emittedAt)];
    }

    return [];
  });
}

export function adaptRealtimeMessage(value: unknown): FloorStreamMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  const message = value as RealtimeMessageDto;

  switch (message.type) {
    case 'floor.snapshot':
      return {
        ...message,
        snapshot: adaptFloorSnapshot(message.snapshot),
      };
    case 'table.updated': {
      const table = isBackendLiveTable(message.table)
        ? adaptBackendTable(message.table, message.sequence, message.source ?? null, message.emittedAt ?? null)
        : isLegacyLiveTable(message.table)
          ? message.table
          : null;

      if (!table) {
        return null;
      }

      return {
        type: 'table.updated',
        floorId: message.floorId,
        sequence: message.sequence,
        table,
        commandId: message.commandId,
        source: message.source,
        emittedAt: message.emittedAt,
      };
    }
    case 'table.batch_updated':
      return {
        type: 'table.batch_updated',
        floorId: message.floorId,
        sequence: message.sequence,
        tables: normalizeRealtimeTables(
          message.tables as unknown[],
          message.sequence,
          message.source ?? null,
          message.emittedAt ?? null,
        ),
        commandId: message.commandId,
        source: message.source,
        emittedAt: message.emittedAt,
      };
    case 'waitlist.updated':
      return {
        type: 'waitlist.updated',
        entry: adaptWaitlistEntry(message.entry),
      };
    case 'routing.updated':
      return {
        type: 'routing.updated',
        locationId: message.locationId,
        routing: normalizeWaiterRoutingState(message.routing),
        emittedAt: message.emittedAt,
      };
    case 'command.rejected':
      return {
        ...message,
        reason:
          message.reason ??
          message.error?.message ??
          'Unable to complete the requested table action.',
      };
    default:
      return message;
  }
}
