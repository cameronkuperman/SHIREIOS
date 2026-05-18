import type {
  BusinessRuleError,
  FloorMap,
  FloorSnapshot,
  FloorStreamMessage,
  RoutingWaiter,
  TableCommand,
  TableDisplayStatus,
  TableLiveState,
  TableOverride,
  TableShape,
  TableType,
  TableUpdateSource,
  WaiterRoutingState,
} from '@shire/shared';

const EMPTY_CLEAN = 'empty_clean';
const OCCUPIED = 'occupied';
const EMPTY_DIRTY = 'empty_dirty';
export const ML_TABLE_STALE_MS = 3 * 60 * 1000;

export interface PendingCommandEntry {
  command: TableCommand;
  tableId: string;
  previousTable: TableLiveState | null;
}

export interface FloorStoreData {
  floorId: string;
  mapVersion: string;
  tablesById: Record<string, TableLiveState>;
  lastSnapshotAt: string | null;
  lastAppliedSequence: number;
  pendingCommands: Record<string, PendingCommandEntry>;
  syncError: string | null;
}

export interface FloorTableViewModel {
  id: string;
  label: string;
  roomId: string;
  status: TableDisplayStatus;
  shape: TableShape;
  type: TableType;
  capacity: number;
  server?: string;
  serverId?: string | null;
  partyName?: string;
  seatedTime?: string;
  isBlocked: boolean;
  isPending: boolean;
  hasExplicitServerAssignment: boolean;
  isStale: boolean;
  stateConfidence: number;
  lastUpdateSource?: TableUpdateSource | null;
  lastUpdatedAt?: string | null;
  x?: number;
  y?: number;
  rotation?: number;
}

export interface FloorRoomViewModel {
  roomId: string;
  label: string;
  filterLabel: string;
  flex: number;
  variant: 'default' | 'patio';
  rows: FloorTableViewModel[][];
  layoutMode: 'grid' | 'freeform';
  tables: FloorTableViewModel[]; // flat list for freeform mode
}

export interface QuickSeatSuggestion {
  tableId: string;
  tableLabel: string;
  tableType: 'Round' | 'Square' | 'Booth' | 'Bar';
  capacity: number;
  server?: string;
  serverId?: string | null;
  label?: string;
}

export interface TableDetailsViewModel extends FloorTableViewModel {
  section: string;
  override: TableOverride | null;
  currentWaiterId: string | null;
  currentWaiterName: string | null;
  currentPartySize: number | null;
}

const COMMAND_REJECTED_MESSAGES: Partial<Record<BusinessRuleError['code'], string>> = {
  TABLE_UNAVAILABLE: 'That table is no longer available.',
  TABLE_OCCUPIED: 'That table is already occupied.',
  TABLE_BLOCKED: 'That table is currently blocked.',
  TABLE_CAPACITY_EXCEEDED: 'That party is too large for the selected table.',
  PERMISSION_DENIED: 'You do not have permission to do that.',
  STALE_COMMAND: 'That update was out of date. Try again with the latest floor state.',
  NOT_FOUND: 'That item could not be found.',
  VALIDATION_ERROR: 'That request could not be completed. Check the details and try again.',
};

function nowIso(): string {
  return new Date().toISOString();
}

export function formatCommandRejectedMessage(
  error?: BusinessRuleError | null,
  reason?: string,
): string {
  if (error?.code && COMMAND_REJECTED_MESSAGES[error.code]) {
    return COMMAND_REJECTED_MESSAGES[error.code]!;
  }

  if (error?.message?.trim()) {
    return error.message.trim();
  }

  if (reason?.trim()) {
    return reason.trim();
  }

  return 'Unable to complete the requested table action.';
}

function deriveDisplayStatus(
  sensedState: TableLiveState['sensedState'],
  isBlocked: boolean,
): TableDisplayStatus {
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

function clonePendingCommands(
  pendingCommands: Record<string, PendingCommandEntry>,
): Record<string, PendingCommandEntry> {
  return { ...pendingCommands };
}

function removePendingCommandsForTable(
  pendingCommands: Record<string, PendingCommandEntry>,
  tableId: string,
): Record<string, PendingCommandEntry> {
  const nextPendingCommands = clonePendingCommands(pendingCommands);

  for (const [commandId, pendingCommand] of Object.entries(nextPendingCommands)) {
    if (pendingCommand.tableId === tableId) {
      delete nextPendingCommands[commandId];
    }
  }

  return nextPendingCommands;
}

function fallbackTableState(
  floorMap: FloorMap,
  tableId: string,
  timestamp = nowIso(),
): TableLiveState | null {
  const mapTable = floorMap.tables[tableId];
  if (!mapTable) {
    return null;
  }

  return {
    tableId,
    tableNumber: mapTable.tableNumber,
    displayStatus: 'available',
    sensedState: EMPTY_CLEAN,
    stateConfidence: 0,
    lastStateChange: timestamp,
    updatedAt: timestamp,
    sequence: 0,
    isBlocked: false,
    override: null,
    party: null,
    seatedAt: null,
    assignedServer: mapTable.assignedServer ?? null,
    currentWaiterId: null,
    currentWaiterName: mapTable.assignedServer ?? null,
    currentWaitlistEntryId: null,
    currentPartySize: null,
    lastUpdateSource: null,
    emittedAt: null,
  };
}

export function buildDefaultTablesById(floorMap: FloorMap): Record<string, TableLiveState> {
  return Object.keys(floorMap.tables).reduce<Record<string, TableLiveState>>(
    (tablesById, tableId) => {
      const table = fallbackTableState(floorMap, tableId);
      if (table) {
        tablesById[tableId] = table;
      }
      return tablesById;
    },
    {},
  );
}

function tablesArrayToRecord(tables: TableLiveState[]): Record<string, TableLiveState> {
  return tables.reduce<Record<string, TableLiveState>>((tablesById, table) => {
    tablesById[table.tableId] = table;
    return tablesById;
  }, {});
}

function optimisticOverride(command: TableCommand): TableOverride {
  return {
    source: 'host',
    commandType: command.type,
    createdAt: command.requestedAt,
    active: true,
  };
}

function applyOptimisticCommandToTable(
  table: TableLiveState,
  command: TableCommand,
): TableLiveState {
  const baseTable = {
    ...table,
    updatedAt: command.requestedAt,
    override: optimisticOverride(command),
    lastUpdateSource: 'host' as const,
    emittedAt: command.requestedAt,
  };

  switch (command.type) {
    case 'seat_party':
    case 'seat_walk_in':
      return {
        ...baseTable,
        displayStatus: 'occupied',
        sensedState: OCCUPIED,
        party: command.party,
        seatedAt: command.requestedAt,
        isBlocked: false,
        currentPartySize: command.party.size,
        currentWaitlistEntryId: command.party.source === 'waitlist' ? command.party.id : null,
      };
    case 'clear_table':
      return {
        ...baseTable,
        displayStatus: 'dirty',
        sensedState: EMPTY_DIRTY,
        party: null,
        seatedAt: null,
        isBlocked: false,
        currentPartySize: null,
        currentWaitlistEntryId: null,
      };
    case 'mark_clean':
      return {
        ...baseTable,
        displayStatus: 'available',
        sensedState: EMPTY_CLEAN,
        party: null,
        seatedAt: null,
        isBlocked: false,
        currentPartySize: null,
        currentWaitlistEntryId: null,
      };
    case 'block_table':
      return {
        ...baseTable,
        displayStatus: 'reserved',
        party: null,
        seatedAt: null,
        isBlocked: true,
        currentPartySize: null,
        currentWaitlistEntryId: null,
      };
    case 'unblock_table':
      return {
        ...baseTable,
        displayStatus: deriveDisplayStatus(baseTable.sensedState, false),
        isBlocked: false,
        override: null,
      };
    default:
      return baseTable;
  }
}

export function applyFloorSnapshotState(
  state: FloorStoreData,
  snapshot: FloorSnapshot,
): Partial<FloorStoreData> {
  if (snapshot.floorId !== state.floorId || snapshot.sequence < state.lastAppliedSequence) {
    return state;
  }

  return {
    floorId: snapshot.floorId,
    mapVersion: snapshot.mapVersion,
    tablesById: tablesArrayToRecord(snapshot.tables),
    lastSnapshotAt: snapshot.generatedAt,
    lastAppliedSequence: snapshot.sequence,
    pendingCommands: {},
    syncError: null,
  };
}

export function acknowledgePendingCommandState(
  state: FloorStoreData,
  commandId: string,
): Partial<FloorStoreData> {
  if (!state.pendingCommands[commandId]) {
    return state;
  }

  const nextPendingCommands = { ...state.pendingCommands };
  delete nextPendingCommands[commandId];

  return {
    pendingCommands: nextPendingCommands,
  };
}

export function rejectPendingCommandState(
  state: FloorStoreData,
  commandId: string,
  tableId: string,
  reason: string,
): Partial<FloorStoreData> {
  const pendingCommand = state.pendingCommands[commandId];
  const nextPendingCommands = { ...state.pendingCommands };
  delete nextPendingCommands[commandId];

  if (!pendingCommand) {
    return {
      pendingCommands: nextPendingCommands,
      syncError: reason,
    };
  }

  const nextTablesById = { ...state.tablesById };
  if (pendingCommand.previousTable) {
    nextTablesById[tableId] = pendingCommand.previousTable;
  }

  return {
    tablesById: nextTablesById,
    pendingCommands: nextPendingCommands,
    syncError: reason,
  };
}

export function queuePendingCommandState(
  state: FloorStoreData,
  command: TableCommand,
): Partial<FloorStoreData> {
  const previousTable = state.tablesById[command.tableId] ?? null;
  const nextPendingCommands = {
    ...state.pendingCommands,
    [command.commandId]: {
      command,
      tableId: command.tableId,
      previousTable,
    },
  };

  if (!previousTable) {
    return {
      pendingCommands: nextPendingCommands,
      syncError: null,
    };
  }

  return {
    tablesById: {
      ...state.tablesById,
      [command.tableId]: applyOptimisticCommandToTable(previousTable, command),
    },
    pendingCommands: nextPendingCommands,
    syncError: null,
  };
}

export function applyFloorStreamMessageState(
  state: FloorStoreData,
  message: FloorStreamMessage,
): Partial<FloorStoreData> {
  switch (message.type) {
    case 'floor.snapshot':
      return applyFloorSnapshotState(state, message.snapshot);
    case 'table.updated': {
      if (message.floorId !== state.floorId || message.sequence <= state.lastAppliedSequence) {
        return state;
      }

      if (
        message.source === 'ml' &&
        hasPendingCommandForTable(state.pendingCommands, message.table.tableId)
      ) {
        return {
          lastAppliedSequence: message.sequence,
          syncError: null,
        };
      }

      const nextPendingCommands =
        message.source === 'ml'
          ? state.pendingCommands
          : removePendingCommandsForTable(state.pendingCommands, message.table.tableId);

      return {
        tablesById: {
          ...state.tablesById,
          [message.table.tableId]: message.table,
        },
        lastAppliedSequence: message.sequence,
        pendingCommands: nextPendingCommands,
        syncError: null,
      };
    }
    case 'table.batch_updated': {
      if (message.floorId !== state.floorId || message.sequence <= state.lastAppliedSequence) {
        return state;
      }

      const nextTablesById = { ...state.tablesById };
      let nextPendingCommands =
        message.source === 'ml' ? state.pendingCommands : { ...state.pendingCommands };

      for (const table of message.tables) {
        if (
          message.source === 'ml' &&
          hasPendingCommandForTable(state.pendingCommands, table.tableId)
        ) {
          continue;
        }

        nextTablesById[table.tableId] = table;
        if (message.source !== 'ml') {
          nextPendingCommands = removePendingCommandsForTable(nextPendingCommands, table.tableId);
        }
      }

      return {
        tablesById: nextTablesById,
        lastAppliedSequence: message.sequence,
        pendingCommands: nextPendingCommands,
        syncError: null,
      };
    }
    case 'command.rejected':
      if (message.floorId !== state.floorId || message.sequence < state.lastAppliedSequence) {
        return state;
      }

      const canonicalRejectedTableId =
        state.pendingCommands[message.commandId]?.tableId ?? message.tableId;

      return {
        ...rejectPendingCommandState(
          state,
          message.commandId,
          canonicalRejectedTableId,
          formatCommandRejectedMessage(message.error, message.reason),
        ),
        lastAppliedSequence: message.sequence,
      };
    case 'command.ack': {
      if (message.floorId && message.floorId !== state.floorId) {
        return state;
      }
      return acknowledgePendingCommandState(state, message.commandId);
    }
    case 'cursor.expired':
      // Provider triggers a snapshot refetch; reducer is a no-op so the
      // current optimistic + canonical state stays visible until the
      // fresh snapshot arrives.
      return state;
    case 'waitlist.updated':
      if (message.floorId !== state.floorId || message.sequence <= state.lastAppliedSequence) {
        return state;
      }

      return {
        lastAppliedSequence: message.sequence,
      };
    case 'connection.ping':
    case 'connection.pong':
      return state;
    default:
      return state;
  }
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) {
    return '0m';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

function formatSeatedTime(seatedAt: string | null, now = Date.now()): string | undefined {
  if (!seatedAt) {
    return undefined;
  }

  const seatedAtMs = new Date(seatedAt).getTime();
  if (Number.isNaN(seatedAtMs)) {
    return undefined;
  }

  return formatMinutes(Math.max(0, Math.floor((now - seatedAtMs) / 60_000)));
}

function isTablePending(
  pendingCommands: Record<string, PendingCommandEntry>,
  tableId: string,
): boolean {
  return Object.values(pendingCommands).some(
    (pendingCommand) => pendingCommand.tableId === tableId,
  );
}

function hasPendingCommandForTable(
  pendingCommands: Record<string, PendingCommandEntry>,
  tableId: string,
): boolean {
  return Object.values(pendingCommands).some(
    (pendingCommand) => pendingCommand.tableId === tableId,
  );
}

function isMlTableStale(table: TableLiveState, now: number): boolean {
  if (table.lastUpdateSource !== 'ml') {
    return false;
  }

  const updatedAtMs = new Date(table.updatedAt).getTime();
  if (Number.isNaN(updatedAtMs)) {
    return false;
  }

  return now - updatedAtMs > ML_TABLE_STALE_MS;
}

function toQuickSeatType(type: TableType, shape: TableShape): QuickSeatSuggestion['tableType'] {
  if (type === 'booth') {
    return 'Booth';
  }

  if (type === 'bar' || type === 'counter') {
    return 'Bar';
  }

  if (shape === 'square') {
    return 'Square';
  }

  return 'Round';
}

function getWaiterById(
  routing: WaiterRoutingState | null | undefined,
  waiterId: string | null | undefined,
): RoutingWaiter | null {
  if (!routing || !waiterId) {
    return null;
  }

  return routing.waiters.find((waiter) => waiter.id === waiterId) ?? null;
}

function resolveRoutingWaiter(
  routing: WaiterRoutingState | null | undefined,
  tableId: string,
  sectionId: string,
): RoutingWaiter | null {
  if (!routing) {
    return null;
  }

  const explicitWaiterId = routing.tableAssignments[tableId];
  if (explicitWaiterId) {
    return getWaiterById(routing, explicitWaiterId);
  }

  const sectionWaiterId = routing.sectionAssignments[sectionId];
  if (sectionWaiterId) {
    return getWaiterById(routing, sectionWaiterId);
  }

  return getWaiterById(routing, routing.nextWaiterId);
}

function toTableViewModel(
  floorMap: FloorMap,
  tableId: string,
  tablesById: Record<string, TableLiveState>,
  pendingCommands: Record<string, PendingCommandEntry>,
  routing: WaiterRoutingState | null,
  now = Date.now(),
): FloorTableViewModel | null {
  const mapTable = floorMap.tables[tableId];
  const liveTable = tablesById[tableId] ?? fallbackTableState(floorMap, tableId);
  if (!mapTable || !liveTable) {
    return null;
  }

  const currentWaiter = getWaiterById(routing, liveTable.currentWaiterId);
  const routedWaiter = resolveRoutingWaiter(routing, tableId, mapTable.section);
  const displayServerName =
    liveTable.currentWaiterName ??
    currentWaiter?.name ??
    routedWaiter?.name ??
    liveTable.assignedServer ??
    mapTable.assignedServer ??
    undefined;
  const displayServerId =
    liveTable.currentWaiterId ?? currentWaiter?.id ?? routedWaiter?.id ?? null;

  return {
    id: tableId,
    label: liveTable.tableNumber ?? mapTable.tableNumber ?? tableId,
    roomId: mapTable.roomId,
    status: liveTable.displayStatus,
    shape: mapTable.shape,
    type: mapTable.type,
    capacity: mapTable.capacity,
    server: displayServerName,
    serverId: displayServerId,
    partyName: liveTable.party?.name,
    seatedTime: formatSeatedTime(liveTable.seatedAt, now),
    isBlocked: liveTable.isBlocked,
    isPending: isTablePending(pendingCommands, tableId),
    hasExplicitServerAssignment: Boolean(routing?.tableAssignments[tableId]),
    isStale: isMlTableStale(liveTable, now),
    stateConfidence: liveTable.stateConfidence,
    lastUpdateSource: liveTable.lastUpdateSource ?? null,
    lastUpdatedAt: liveTable.updatedAt,
    x: mapTable.x,
    y: mapTable.y,
    rotation: mapTable.rotation,
  };
}

export function selectTablesByRoom(
  floorMap: FloorMap,
  tablesById: Record<string, TableLiveState>,
  pendingCommands: Record<string, PendingCommandEntry>,
  routing: WaiterRoutingState | null,
  now = Date.now(),
): FloorRoomViewModel[] {
  return floorMap.rooms.map((room) => {
    const layoutMode = room.layoutMode ?? 'grid';
    const rows = room.rows.map((row) =>
      row
        .map((tableId) =>
          toTableViewModel(floorMap, tableId, tablesById, pendingCommands, routing, now),
        )
        .filter((table): table is FloorTableViewModel => table != null),
    );

    // For freeform mode, build a flat list of all tables in this room
    const tables: FloorTableViewModel[] =
      layoutMode === 'freeform'
        ? Object.values(floorMap.tables)
            .filter((t) => t.roomId === room.roomId)
            .map((t) =>
              toTableViewModel(floorMap, t.tableId, tablesById, pendingCommands, routing, now),
            )
            .filter((t): t is FloorTableViewModel => t != null)
        : rows.flat();

    return {
      roomId: room.roomId,
      label: room.label,
      filterLabel: room.filterLabel,
      flex: room.flex ?? 1,
      variant: room.variant ?? 'default',
      rows,
      layoutMode,
      tables,
    };
  });
}

function orderedTableIds(floorMap: FloorMap): string[] {
  return floorMap.rooms.flatMap((room) => {
    if (room.layoutMode === 'freeform') {
      return Object.values(floorMap.tables)
        .filter((t) => t.roomId === room.roomId)
        .map((t) => t.tableId);
    }
    return room.rows.flatMap((row) => row);
  });
}

export function selectAvailableTables(
  floorMap: FloorMap,
  tablesById: Record<string, TableLiveState>,
  pendingCommands: Record<string, PendingCommandEntry>,
  routing: WaiterRoutingState | null,
  now = Date.now(),
): FloorTableViewModel[] {
  return orderedTableIds(floorMap)
    .map((tableId) =>
      toTableViewModel(floorMap, tableId, tablesById, pendingCommands, routing, now),
    )
    .filter((table): table is FloorTableViewModel => table != null)
    .filter((table) => table.status === 'available' && !table.isBlocked);
}

export function selectQuickSeatSuggestions(
  floorMap: FloorMap,
  tablesById: Record<string, TableLiveState>,
  pendingCommands: Record<string, PendingCommandEntry>,
  routing: WaiterRoutingState | null,
  now = Date.now(),
): QuickSeatSuggestion[] {
  return selectAvailableTables(floorMap, tablesById, pendingCommands, routing, now)
    .slice(0, 5)
    .map((table, index) => ({
      tableId: table.id,
      tableLabel: table.label,
      tableType: toQuickSeatType(table.type, table.shape),
      capacity: table.capacity,
      server: table.server,
      serverId: table.serverId,
      ...(index === 0 ? { label: 'Best Match' } : {}),
    }));
}

export function selectTableDetails(
  floorMap: FloorMap,
  tablesById: Record<string, TableLiveState>,
  pendingCommands: Record<string, PendingCommandEntry>,
  routing: WaiterRoutingState | null,
  tableId: string | null,
  now = Date.now(),
): TableDetailsViewModel | null {
  if (!tableId) {
    return null;
  }

  const mapTable = floorMap.tables[tableId];
  const liveTable = tablesById[tableId] ?? fallbackTableState(floorMap, tableId);
  const tableViewModel = toTableViewModel(
    floorMap,
    tableId,
    tablesById,
    pendingCommands,
    routing,
    now,
  );
  if (!mapTable || !liveTable || !tableViewModel) {
    return null;
  }

  return {
    ...tableViewModel,
    section: mapTable.section,
    override: liveTable.override,
    currentWaiterId: liveTable.currentWaiterId ?? null,
    currentWaiterName: liveTable.currentWaiterName ?? null,
    currentPartySize: liveTable.currentPartySize ?? null,
  };
}
