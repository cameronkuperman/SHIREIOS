import type {
  BackendFloorSnapshotDto,
  BackendFloorSnapshotMessage,
  BackendLiveTable,
  BackendTableUpdatedMessage,
  CommandRejectedMessage,
  TableCommand,
  TableLiveState,
  TableUpdateSource,
} from '@shire/shared';
import { DEFAULT_FLOOR_ID, DEFAULT_FLOOR_MAP } from '@shire/shared';

const EMPTY_CLEAN = 'empty_clean';
const OCCUPIED = 'occupied';
const EMPTY_DIRTY = 'empty_dirty';

export interface MockFloorRuntime {
  floorId: string;
  mapVersion: string;
  sequence: number;
  scenarioIndex: number;
  randomIndex: number;
  tablesById: Record<string, TableLiveState>;
}

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function minutesAgo(minutes: number, timestamp: string): string {
  return new Date(new Date(timestamp).getTime() - minutes * 60_000).toISOString();
}

function deriveDisplayStatus(
  sensedState: TableLiveState['sensedState'],
  isBlocked: boolean,
): TableLiveState['displayStatus'] {
  if (isBlocked) {
    return 'reserved';
  }

  if (sensedState === OCCUPIED) {
    return 'occupied';
  }

  if (sensedState === EMPTY_DIRTY) {
    return 'dirty';
  }

  return 'available';
}

function toBackendState(table: TableLiveState): BackendLiveTable['state'] {
  switch (table.sensedState) {
    case OCCUPIED:
      return 'occupied';
    case EMPTY_DIRTY:
      return 'dirty';
    default:
      return 'available';
  }
}

function toBackendTable(table: TableLiveState): BackendLiveTable {
  const mapTable = DEFAULT_FLOOR_MAP.tables[table.tableId];

  return {
    id: table.tableId,
    tableNumber: table.tableNumber ?? mapTable?.tableNumber ?? table.tableId,
    capacity: mapTable?.capacity ?? 0,
    state: toBackendState(table),
    stateConfidence: table.stateConfidence,
    updatedAt: table.updatedAt,
    stateChangedAt: table.lastStateChange,
    seatedAt: table.seatedAt,
    sectionId: mapTable?.section ?? null,
    sectionName: mapTable?.section ?? null,
    currentVisitId: table.party?.id ?? null,
    currentPartyName: table.party?.name ?? null,
    currentPartySize: table.party?.size ?? null,
    currentWaitlistEntryId: table.party?.source === 'waitlist' ? table.party.id : null,
    currentWaiterId: table.currentWaiterId ?? null,
    currentWaiterName: table.currentWaiterName ?? table.assignedServer ?? null,
    isBlocked: table.isBlocked,
    block: table.isBlocked ? { reason: 'manual' } : null,
  };
}

function baseTable(
  tableId: string,
  sequence: number,
  timestamp: string,
  overrides: Partial<TableLiveState> = {},
): TableLiveState {
  const mapTable = DEFAULT_FLOOR_MAP.tables[tableId];
  const assignedServer = mapTable?.assignedServer ?? null;

  return {
    tableId,
    tableNumber: mapTable?.tableNumber ?? tableId,
    displayStatus: 'available',
    sensedState: EMPTY_CLEAN,
    stateConfidence: 0.98,
    lastStateChange: timestamp,
    updatedAt: timestamp,
    sequence,
    isBlocked: false,
    override: null,
    party: null,
    seatedAt: null,
    assignedServer,
    currentWaiterId: null,
    currentWaiterName: assignedServer,
    currentWaitlistEntryId: null,
    currentPartySize: null,
    lastUpdateSource: null,
    emittedAt: null,
    ...overrides,
  };
}

function createInitialTables(timestamp: string): Record<string, TableLiveState> {
  return {
    '1': baseTable('1', 1, timestamp, {
      displayStatus: 'occupied',
      sensedState: OCCUPIED,
      party: { id: 'party-1', name: 'Johnson', size: 4, source: 'manual' },
      seatedAt: minutesAgo(42, timestamp),
      lastStateChange: minutesAgo(42, timestamp),
      currentPartySize: 4,
    }),
    '2': baseTable('2', 1, timestamp),
    '3': baseTable('3', 1, timestamp, {
      displayStatus: 'reserved',
      isBlocked: true,
      override: {
        source: 'host',
        commandType: 'block_table',
        createdAt: minutesAgo(10, timestamp),
        active: true,
      },
    }),
    '4': baseTable('4', 1, timestamp, {
      displayStatus: 'dirty',
      sensedState: EMPTY_DIRTY,
      lastStateChange: minutesAgo(5, timestamp),
    }),
    '5': baseTable('5', 1, timestamp),
    '6': baseTable('6', 1, timestamp, {
      displayStatus: 'occupied',
      sensedState: OCCUPIED,
      party: { id: 'party-6', name: 'Lee', size: 4, source: 'manual' },
      seatedAt: minutesAgo(18, timestamp),
      lastStateChange: minutesAgo(18, timestamp),
      currentPartySize: 4,
    }),
    '7': baseTable('7', 1, timestamp),
    '8': baseTable('8', 1, timestamp, {
      displayStatus: 'occupied',
      sensedState: OCCUPIED,
      party: { id: 'party-8', name: 'Kim', size: 4, source: 'manual' },
      seatedAt: minutesAgo(55, timestamp),
      lastStateChange: minutesAgo(55, timestamp),
      currentPartySize: 4,
    }),
    '9': baseTable('9', 1, timestamp, {
      displayStatus: 'occupied',
      sensedState: OCCUPIED,
      party: { id: 'party-9', name: 'Martinez', size: 8, source: 'manual' },
      seatedAt: minutesAgo(25, timestamp),
      lastStateChange: minutesAgo(25, timestamp),
      currentPartySize: 8,
    }),
    '10': baseTable('10', 1, timestamp, {
      displayStatus: 'reserved',
      isBlocked: true,
      override: {
        source: 'host',
        commandType: 'block_table',
        createdAt: minutesAgo(12, timestamp),
        active: true,
      },
    }),
    '11': baseTable('11', 1, timestamp),
    P1: baseTable('P1', 1, timestamp),
    P2: baseTable('P2', 1, timestamp),
    P3: baseTable('P3', 1, timestamp, {
      displayStatus: 'occupied',
      sensedState: OCCUPIED,
      party: { id: 'party-p3', name: 'Davis', size: 4, source: 'manual' },
      seatedAt: minutesAgo(10, timestamp),
      lastStateChange: minutesAgo(10, timestamp),
      currentPartySize: 4,
    }),
    P4: baseTable('P4', 1, timestamp),
  };
}

export function createRuntime(now?: string): MockFloorRuntime {
  const timestamp = nowIso(now);

  return {
    floorId: DEFAULT_FLOOR_ID,
    mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
    sequence: 1,
    scenarioIndex: 0,
    randomIndex: 0,
    tablesById: createInitialTables(timestamp),
  };
}

export function createSnapshot(runtime: MockFloorRuntime, now?: string): BackendFloorSnapshotDto {
  return {
    floorId: runtime.floorId,
    mapVersion: runtime.mapVersion,
    snapshotAt: nowIso(now),
    sequence: runtime.sequence,
    tablesById: Object.values(runtime.tablesById).reduce<Record<string, BackendLiveTable>>(
      (tablesById, table) => {
        tablesById[table.tableId] = toBackendTable(table);
        return tablesById;
      },
      {},
    ),
  };
}

export function createSnapshotMessage(
  runtime: MockFloorRuntime,
  now?: string,
): BackendFloorSnapshotMessage {
  const timestamp = nowIso(now);

  return {
    type: 'floor.snapshot',
    floorId: runtime.floorId,
    sequence: runtime.sequence,
    snapshot: createSnapshot(runtime, timestamp),
    emittedAt: timestamp,
  };
}

function updateTable(
  runtime: MockFloorRuntime,
  tableId: string,
  updates: Partial<TableLiveState>,
  now?: string,
  source: TableUpdateSource | null = null,
): { runtime: MockFloorRuntime; table: TableLiveState; timestamp: string } {
  const timestamp = nowIso(now);
  const previousTable = runtime.tablesById[tableId];
  if (!previousTable) {
    throw new Error(`Unknown table ${tableId}`);
  }

  const nextSequence = runtime.sequence + 1;
  const nextTable: TableLiveState = {
    ...previousTable,
    ...updates,
    updatedAt: timestamp,
    lastStateChange: updates.lastStateChange ?? timestamp,
    sequence: nextSequence,
    currentWaitlistEntryId:
      updates.currentWaitlistEntryId ?? previousTable.currentWaitlistEntryId ?? null,
    currentPartySize: updates.currentPartySize ?? previousTable.currentPartySize ?? null,
    lastUpdateSource: source,
    emittedAt: timestamp,
  };

  return {
    runtime: {
      ...runtime,
      sequence: nextSequence,
      tablesById: {
        ...runtime.tablesById,
        [tableId]: nextTable,
      },
    },
    table: nextTable,
    timestamp,
  };
}

function updateTableMessage(
  runtime: MockFloorRuntime,
  tableId: string,
  updates: Partial<TableLiveState>,
  now?: string,
  source: TableUpdateSource = 'host',
  commandId: string | null = null,
): { runtime: MockFloorRuntime; message: BackendTableUpdatedMessage } {
  const updated = updateTable(runtime, tableId, updates, now, source);

  return {
    runtime: updated.runtime,
    message: {
      type: 'table.updated',
      floorId: updated.runtime.floorId,
      sequence: updated.runtime.sequence,
      table: toBackendTable(updated.table),
      commandId,
      source,
      emittedAt: updated.timestamp,
    },
  };
}

function rejectCommand(
  runtime: MockFloorRuntime,
  command: TableCommand,
  reason: string,
): {
  runtime: MockFloorRuntime;
  message: CommandRejectedMessage;
} {
  const timestamp = nowIso();
  const nextSequence = runtime.sequence + 1;

  return {
    runtime: {
      ...runtime,
      sequence: nextSequence,
    },
    message: {
      type: 'command.rejected',
      floorId: runtime.floorId,
      sequence: nextSequence,
      commandId: command.commandId,
      tableId: command.tableId,
      reason,
      emittedAt: timestamp,
    },
  };
}

export function applyTableCommand(
  runtime: MockFloorRuntime,
  command: TableCommand,
  now?: string,
): {
  runtime: MockFloorRuntime;
  message: BackendTableUpdatedMessage | CommandRejectedMessage;
} {
  const currentTable = runtime.tablesById[command.tableId];
  if (!currentTable) {
    return rejectCommand(runtime, command, `Unknown table ${command.tableId}`);
  }

  if ((command.type === 'seat_party' || command.type === 'seat_walk_in') && currentTable.isBlocked) {
    return rejectCommand(runtime, command, 'Blocked tables cannot be seated.');
  }

  if (command.type === 'clear_table' && currentTable.displayStatus !== 'occupied') {
    return rejectCommand(runtime, command, 'Only occupied tables can be cleared.');
  }

  if (command.type === 'mark_clean' && currentTable.displayStatus !== 'dirty') {
    return rejectCommand(runtime, command, 'Only dirty tables can be marked clean.');
  }

  if (command.type === 'block_table' && currentTable.displayStatus === 'occupied') {
    return rejectCommand(runtime, command, 'Occupied tables cannot be blocked.');
  }

  if (command.type === 'unblock_table' && !currentTable.isBlocked) {
    return rejectCommand(runtime, command, 'Table is not currently blocked.');
  }

  switch (command.type) {
    case 'seat_party':
    case 'seat_walk_in':
      return updateTableMessage(
        runtime,
        command.tableId,
        {
          displayStatus: 'occupied',
          sensedState: OCCUPIED,
          party: command.party,
          seatedAt: command.requestedAt,
          isBlocked: false,
          override: null,
          assignedServer: currentTable.assignedServer,
          currentWaiterId: command.waiterId ?? currentTable.currentWaiterId ?? null,
          currentWaiterName:
            command.waiterId != null
              ? `Waiter ${command.waiterId}`
              : currentTable.currentWaiterName ?? currentTable.assignedServer ?? null,
          currentPartySize: command.party.size,
          currentWaitlistEntryId: command.party.source === 'waitlist' ? command.party.id : null,
        },
        now,
        'host',
        command.commandId,
      );
    case 'clear_table':
      return updateTableMessage(
        runtime,
        command.tableId,
        {
          displayStatus: 'dirty',
          sensedState: EMPTY_DIRTY,
          party: null,
          seatedAt: null,
          isBlocked: false,
          override: null,
          currentPartySize: null,
          currentWaitlistEntryId: null,
        },
        now,
        'host',
        command.commandId,
      );
    case 'mark_clean':
      return updateTableMessage(
        runtime,
        command.tableId,
        {
          displayStatus: 'available',
          sensedState: EMPTY_CLEAN,
          party: null,
          seatedAt: null,
          isBlocked: false,
          override: null,
          currentPartySize: null,
          currentWaitlistEntryId: null,
        },
        now,
        'host',
        command.commandId,
      );
    case 'block_table':
      return updateTableMessage(
        runtime,
        command.tableId,
        {
          displayStatus: 'reserved',
          isBlocked: true,
          party: null,
          seatedAt: null,
          override: {
            source: 'host',
            commandType: 'block_table',
            createdAt: command.requestedAt,
            active: true,
          },
          currentPartySize: null,
          currentWaitlistEntryId: null,
        },
        now,
        'host',
        command.commandId,
      );
    case 'unblock_table':
      return updateTableMessage(
        runtime,
        command.tableId,
        {
          displayStatus: deriveDisplayStatus(currentTable.sensedState, false),
          isBlocked: false,
          override: null,
        },
        now,
        'host',
        command.commandId,
      );
    default:
      return rejectCommand(runtime, command, 'Unsupported command.');
  }
}

const deterministicSteps: Array<{
  tableId: string;
  buildUpdates: (timestamp: string) => Partial<TableLiveState>;
}> = [
  {
    tableId: '2',
    buildUpdates: (timestamp) => ({
      displayStatus: 'occupied',
      sensedState: OCCUPIED,
      party: {
        id: 'scenario-party-2',
        name: 'Miller',
        size: 2,
        source: 'manual',
      },
      seatedAt: timestamp,
      isBlocked: false,
      override: null,
      currentPartySize: 2,
      currentWaitlistEntryId: null,
    }),
  },
  {
    tableId: '2',
    buildUpdates: () => ({
      displayStatus: 'dirty',
      sensedState: EMPTY_DIRTY,
      party: null,
      seatedAt: null,
      isBlocked: false,
      override: null,
      currentPartySize: null,
      currentWaitlistEntryId: null,
    }),
  },
  {
    tableId: '2',
    buildUpdates: () => ({
      displayStatus: 'available',
      sensedState: EMPTY_CLEAN,
      party: null,
      seatedAt: null,
      isBlocked: false,
      override: null,
      currentPartySize: null,
      currentWaitlistEntryId: null,
    }),
  },
  {
    tableId: '4',
    buildUpdates: () => ({
      displayStatus: 'dirty',
      sensedState: EMPTY_DIRTY,
      party: null,
      seatedAt: null,
      isBlocked: false,
      override: null,
      currentPartySize: null,
      currentWaitlistEntryId: null,
    }),
  },
  {
    tableId: '4',
    buildUpdates: () => ({
      displayStatus: 'available',
      sensedState: EMPTY_CLEAN,
      party: null,
      seatedAt: null,
      isBlocked: false,
      override: null,
      currentPartySize: null,
      currentWaitlistEntryId: null,
    }),
  },
  {
    tableId: 'P2',
    buildUpdates: (timestamp) => ({
      displayStatus: 'reserved',
      isBlocked: true,
      override: {
        source: 'host',
        commandType: 'block_table',
        createdAt: timestamp,
        active: true,
      },
    }),
  },
  {
    tableId: 'P2',
    buildUpdates: () => ({
      displayStatus: 'available',
      isBlocked: false,
      override: null,
      sensedState: EMPTY_CLEAN,
    }),
  },
];

export function runDeterministicScenarioStep(
  runtime: MockFloorRuntime,
  now?: string,
): { runtime: MockFloorRuntime; message: BackendTableUpdatedMessage } {
  const timestamp = nowIso(now);
  const step = deterministicSteps[runtime.scenarioIndex % deterministicSteps.length];
  if (!step) {
    throw new Error('No deterministic scenario step available.');
  }
  const updated = updateTableMessage(
    runtime,
    step.tableId,
    step.buildUpdates(timestamp),
    timestamp,
    'host',
    null,
  );

  return {
    runtime: {
      ...updated.runtime,
      scenarioIndex: runtime.scenarioIndex + 1,
    },
    message: updated.message,
  };
}

const randomTargets = ['5', '11', 'P4'] as const;

export function runRandomAiStep(
  runtime: MockFloorRuntime,
  now?: string,
): { runtime: MockFloorRuntime; message: BackendTableUpdatedMessage } {
  const tableId = randomTargets[runtime.randomIndex % randomTargets.length] ?? randomTargets[0];
  const currentTable = runtime.tablesById[tableId];
  if (!currentTable) {
    throw new Error(`Unknown random target table ${tableId}`);
  }
  const timestamp = nowIso(now);

  let nextState: Partial<TableLiveState>;
  if (currentTable.displayStatus === 'available') {
    nextState = {
      displayStatus: 'dirty',
      sensedState: EMPTY_DIRTY,
      party: null,
      seatedAt: null,
      isBlocked: false,
      override: null,
      stateConfidence: 0.84,
      currentPartySize: null,
      currentWaitlistEntryId: null,
    };
  } else {
    nextState = {
      displayStatus: 'available',
      sensedState: EMPTY_CLEAN,
      party: null,
      seatedAt: null,
      isBlocked: false,
      override: null,
      stateConfidence: 0.92,
      currentPartySize: null,
      currentWaitlistEntryId: null,
    };
  }

  const updated = updateTableMessage(runtime, tableId, nextState, timestamp, 'ml', null);
  return {
    runtime: {
      ...updated.runtime,
      randomIndex: runtime.randomIndex + 1,
    },
    message: updated.message,
  };
}
