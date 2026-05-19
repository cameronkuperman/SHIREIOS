import {
  applyFloorSnapshotState,
  applyFloorStreamMessageState,
  buildDefaultTablesById,
  queuePendingCommandState,
  rejectPendingCommandState,
  selectAvailableTables,
  selectQuickSeatSuggestions,
  selectTableDetails,
  selectTablesByRoom,
  type FloorStoreData,
} from '../state';
import { DEFAULT_FLOOR_ID, DEFAULT_FLOOR_MAP } from '../floorMap';
import type { RoutingWaiter, WaiterRoutingState } from '@shire/shared';

function createBaseState(overrides: Partial<FloorStoreData> = {}): FloorStoreData {
  return {
    floorId: DEFAULT_FLOOR_ID,
    mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
    tablesById: buildDefaultTablesById(DEFAULT_FLOOR_MAP),
    lastSnapshotAt: null,
    lastAppliedSequence: 0,
    pendingCommands: {},
    syncError: null,
    cctvSyncEnabled: true,
    tableStateMode: 'hybrid',
    ...overrides,
  };
}

function makeRoutingWaiter(id: string, name: string): RoutingWaiter {
  return {
    id,
    name,
    isTemporary: false,
    status: 'available',
    isActive: true,
    assignedSectionIds: [],
    assignedTableIds: [],
    currentTableIds: [],
    servedTableIds: [],
    liveTables: 0,
    servedSeatingCount: 0,
    lastAssignedAt: null,
  };
}

function makeRoutingState(overrides: Partial<WaiterRoutingState> = {}): WaiterRoutingState {
  const waiters = [
    makeRoutingWaiter('section-waiter', 'Section Server'),
    makeRoutingWaiter('table-waiter', 'Table Server'),
    makeRoutingWaiter('live-waiter', 'Live Server'),
  ];

  return {
    mode: 'section',
    waiters,
    activeWaiterIds: waiters.map((waiter) => waiter.id),
    sectionAssignments: { A1: 'section-waiter' },
    tableAssignments: {},
    rotationOrder: waiters.map((waiter) => waiter.id),
    nextWaiterId: 'section-waiter',
    updatedAt: '2026-05-19T12:00:00.000Z',
    ...overrides,
  };
}

describe('floor state reducers', () => {
  it('hydrates a snapshot into the store state', () => {
    const state = createBaseState();
    const updatedTable = {
      ...state.tablesById['2']!,
      displayStatus: 'occupied' as const,
      sensedState: 'occupied' as const,
      party: {
        id: 'party-2',
        name: 'Taylor',
        size: 2,
        source: 'walk_in' as const,
      },
      seatedAt: '2026-03-07T12:00:00.000Z',
      sequence: 10,
      updatedAt: '2026-03-07T12:00:00.000Z',
      lastStateChange: '2026-03-07T12:00:00.000Z',
    };
    const snapshot = {
      floorId: DEFAULT_FLOOR_ID,
      mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
      generatedAt: '2026-03-07T12:01:00.000Z',
      sequence: 10,
      tables: Object.values({
        ...state.tablesById,
        '2': updatedTable,
      }),
    };

    const nextState = {
      ...state,
      ...applyFloorSnapshotState(state, snapshot),
    };

    expect(nextState.lastAppliedSequence).toBe(10);
    expect(nextState.tablesById['2']?.displayStatus).toBe('occupied');
    expect(nextState.tablesById['2']?.party?.name).toBe('Taylor');
  });

  it('hydrates backend manual mode as CCTV off', () => {
    const state = createBaseState({ cctvSyncEnabled: true, tableStateMode: 'hybrid' });
    const nextState = {
      ...state,
      ...applyFloorSnapshotState(state, {
        floorId: DEFAULT_FLOOR_ID,
        mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
        generatedAt: '2026-03-07T12:01:00.000Z',
        sequence: 10,
        tables: Object.values(state.tablesById),
        tableStateMode: 'manual',
      }),
    };

    expect(nextState.tableStateMode).toBe('manual');
    expect(nextState.cctvSyncEnabled).toBe(false);
  });

  it('resolves routing waiter defaults by backend table id', () => {
    const state = createBaseState({
      tablesById: {
        ...buildDefaultTablesById(DEFAULT_FLOOR_MAP),
        '2': {
          ...buildDefaultTablesById(DEFAULT_FLOOR_MAP)['2']!,
          backendTableId: 'backend-table-2',
        },
      },
    });
    const rooms = selectTablesByRoom(
      DEFAULT_FLOOR_MAP,
      state.tablesById,
      {},
      makeRoutingState({
        nextWaiterId: null,
        nextUpByTable: { 'backend-table-2': 'table-waiter' },
      }),
    );

    const table = rooms.flatMap((room) => room.tables).find((item) => item.id === '2');

    expect(table?.serverId).toBe('table-waiter');
    expect(table?.server).toBe('Table Server');
  });

  it('ignores stale websocket updates', () => {
    const state = createBaseState();
    const updatedState = {
      ...state,
      lastAppliedSequence: 12,
    };

    const nextState = {
      ...updatedState,
      ...applyFloorStreamMessageState(updatedState, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 11,
        table: {
          ...updatedState.tablesById['2']!,
          displayStatus: 'occupied',
          sensedState: 'occupied',
        },
      }),
    };

    expect(nextState.lastAppliedSequence).toBe(12);
    expect(nextState.tablesById['2']?.displayStatus).toBe('available');
  });

  it('clears pending commands when a canonical update arrives', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'seat_walk_in',
        commandId: 'command-1',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '2',
        requestedAt: '2026-03-07T12:00:00.000Z',
        party: {
          id: 'party-2',
          name: 'Taylor',
          size: 2,
          source: 'walk_in',
        },
      }),
    };

    const nextState = {
      ...optimisticState,
      ...applyFloorStreamMessageState(optimisticState, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 1,
        commandId: 'command-1',
        source: 'host',
        table: {
          ...optimisticState.tablesById['2']!,
          displayStatus: 'occupied',
          sensedState: 'occupied',
          party: {
            id: 'party-2',
            name: 'Taylor',
            size: 2,
            source: 'walk_in',
          },
          sequence: 1,
        },
      }),
    };

    expect(Object.keys(nextState.pendingCommands)).toHaveLength(0);
    expect(nextState.tablesById['2']?.displayStatus).toBe('occupied');
  });

  it('keeps reservation and waiter identity in optimistic seating state', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'seat_party',
        commandId: 'reservation-seat-1',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '2',
        requestedAt: '2026-03-07T12:00:00.000Z',
        waiterId: 'waiter-1',
        party: {
          id: 'reservation-1',
          name: 'Morgan',
          size: 4,
          source: 'reservations',
        },
      }),
    };

    expect(optimisticState.tablesById['2']?.displayStatus).toBe('occupied');
    expect(optimisticState.tablesById['2']?.party?.name).toBe('Morgan');
    expect(optimisticState.tablesById['2']?.currentReservationId).toBe('reservation-1');
    expect(optimisticState.tablesById['2']?.currentWaiterId).toBe('waiter-1');
  });

  it('keeps the optimistic host table state when an ML update arrives for the same table', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'seat_walk_in',
        commandId: 'command-ml-check',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '2',
        requestedAt: '2026-03-07T12:00:00.000Z',
        party: {
          id: 'party-2',
          name: 'Taylor',
          size: 2,
          source: 'walk_in',
        },
      }),
    };

    const nextState = {
      ...optimisticState,
      ...applyFloorStreamMessageState(optimisticState, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 2,
        commandId: null,
        source: 'ml',
        table: {
          ...optimisticState.tablesById['2']!,
          displayStatus: 'dirty',
          sensedState: 'empty_dirty',
          party: null,
          currentPartySize: null,
          currentWaitlistEntryId: null,
          lastUpdateSource: 'ml',
          sequence: 2,
        },
      }),
    };

    expect(Object.keys(nextState.pendingCommands)).toContain('command-ml-check');
    expect(nextState.tablesById['2']?.displayStatus).toBe('occupied');
    expect(nextState.tablesById['2']?.lastUpdateSource).toBe('host');
  });

  it('keeps pending host seating when a stale clean snapshot arrives', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'seat_walk_in',
        commandId: 'command-snapshot-check',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '2',
        requestedAt: '2026-03-07T12:00:00.000Z',
        party: {
          id: 'party-2',
          name: 'Taylor',
          size: 2,
          source: 'walk_in',
        },
      }),
    };

    const nextState = {
      ...optimisticState,
      ...applyFloorSnapshotState(optimisticState, {
        floorId: DEFAULT_FLOOR_ID,
        mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
        generatedAt: '2026-03-07T12:00:02.000Z',
        sequence: 2,
        tables: Object.values({
          ...optimisticState.tablesById,
          '2': {
            ...state.tablesById['2']!,
            displayStatus: 'available',
            sensedState: 'empty_clean',
            sequence: 2,
          },
        }),
      }),
    };

    expect(Object.keys(nextState.pendingCommands)).toContain('command-snapshot-check');
    expect(nextState.tablesById['2']?.displayStatus).toBe('occupied');
    expect(nextState.tablesById['2']?.party?.name).toBe('Taylor');
    expect(nextState.tablesById['2']?.mlSuppressedReason).toContain('snapshot_conflict');
  });

  it('lets ML update other tables while one table has pending host intent', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'seat_walk_in',
        commandId: 'command-other-table',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '2',
        requestedAt: '2026-03-07T12:00:00.000Z',
        party: {
          id: 'party-2',
          name: 'Taylor',
          size: 2,
          source: 'walk_in',
        },
      }),
    };

    const nextState = {
      ...optimisticState,
      ...applyFloorStreamMessageState(optimisticState, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 2,
        commandId: null,
        source: 'ml',
        table: {
          ...optimisticState.tablesById['3']!,
          displayStatus: 'dirty',
          sensedState: 'empty_dirty',
          lastUpdateSource: 'ml',
          sequence: 2,
        },
      }),
    };

    expect(nextState.tablesById['2']?.displayStatus).toBe('occupied');
    expect(nextState.tablesById['3']?.displayStatus).toBe('dirty');
  });

  it('keeps recent host intent visible across devices when ML contradicts it', () => {
    const state = createBaseState();
    const hostIntentUntil = new Date(Date.now() + 60_000).toISOString();
    const hostState = {
      ...state,
      tablesById: {
        ...state.tablesById,
        '2': {
          ...state.tablesById['2']!,
          displayStatus: 'occupied' as const,
          sensedState: 'occupied' as const,
          hostIntentState: 'occupied' as const,
          hostIntentUntil,
          hostIntentCommandId: 'seat-from-ipad-a',
          lastUpdateSource: 'host' as const,
        },
      },
      lastAppliedSequence: 1,
    };

    const nextState = {
      ...hostState,
      ...applyFloorStreamMessageState(hostState, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 2,
        commandId: null,
        source: 'ml',
        table: {
          ...state.tablesById['2']!,
          displayStatus: 'available',
          sensedState: 'empty_clean',
          lastUpdateSource: 'ml',
          sequence: 2,
        },
      }),
    };

    expect(nextState.tablesById['2']?.displayStatus).toBe('occupied');
    expect(nextState.tablesById['2']?.hostIntentCommandId).toBe('seat-from-ipad-a');
    expect(nextState.tablesById['2']?.mlSuppressedReason).toContain('ml_conflict');
  });

  it('allows agreeing ML to refresh a table during host intent', () => {
    const state = createBaseState();
    const hostIntentUntil = new Date(Date.now() + 60_000).toISOString();
    const hostState = {
      ...state,
      tablesById: {
        ...state.tablesById,
        '2': {
          ...state.tablesById['2']!,
          displayStatus: 'occupied' as const,
          sensedState: 'occupied' as const,
          hostIntentState: 'occupied' as const,
          hostIntentUntil,
          hostIntentCommandId: 'seat-from-ipad-a',
          lastUpdateSource: 'host' as const,
        },
      },
      lastAppliedSequence: 1,
    };

    const nextState = {
      ...hostState,
      ...applyFloorStreamMessageState(hostState, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 2,
        commandId: null,
        source: 'ml',
        table: {
          ...state.tablesById['2']!,
          displayStatus: 'occupied',
          sensedState: 'occupied',
          currentWaiterName: 'Jamie',
          lastUpdateSource: 'ml',
          sequence: 2,
        },
      }),
    };

    expect(nextState.tablesById['2']?.displayStatus).toBe('occupied');
    expect(nextState.tablesById['2']?.currentWaiterName).toBe('Jamie');
    expect(nextState.tablesById['2']?.hostIntentCommandId).toBe('seat-from-ipad-a');
    expect(nextState.tablesById['2']?.mlSuppressedReason).toBeNull();
  });

  it('allows ML to update after host intent expires', () => {
    const state = createBaseState();
    const hostState = {
      ...state,
      tablesById: {
        ...state.tablesById,
        '2': {
          ...state.tablesById['2']!,
          displayStatus: 'occupied' as const,
          sensedState: 'occupied' as const,
          hostIntentState: 'occupied' as const,
          hostIntentUntil: new Date(Date.now() - 1_000).toISOString(),
          hostIntentCommandId: 'seat-from-ipad-a',
          lastUpdateSource: 'host' as const,
        },
      },
      lastAppliedSequence: 1,
    };

    const nextState = {
      ...hostState,
      ...applyFloorStreamMessageState(hostState, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 2,
        commandId: null,
        source: 'ml',
        table: {
          ...state.tablesById['2']!,
          displayStatus: 'available',
          sensedState: 'empty_clean',
          lastUpdateSource: 'ml',
          sequence: 2,
        },
      }),
    };

    expect(nextState.tablesById['2']?.displayStatus).toBe('available');
    expect(nextState.tablesById['2']?.lastUpdateSource).toBe('ml');
  });

  it('ignores ML updates when CCTV sync is disabled', () => {
    const state = createBaseState({ cctvSyncEnabled: false });
    const nextState = {
      ...state,
      ...applyFloorStreamMessageState(state, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 2,
        commandId: null,
        source: 'ml',
        table: {
          ...state.tablesById['2']!,
          displayStatus: 'dirty',
          sensedState: 'empty_dirty',
          party: null,
          currentPartySize: null,
          currentWaitlistEntryId: null,
          lastUpdateSource: 'ml',
          sequence: 2,
        },
      }),
    };

    expect(nextState.lastAppliedSequence).toBe(2);
    expect(nextState.tablesById['2']?.displayStatus).toBe('available');
  });

  it('ignores ML operational state in manual mode', () => {
    const state = createBaseState({ tableStateMode: 'manual' });
    const nextState = {
      ...state,
      ...applyFloorStreamMessageState(state, {
        type: 'table.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 2,
        commandId: null,
        source: 'ml',
        table: {
          ...state.tablesById['2']!,
          displayStatus: 'dirty',
          sensedState: 'empty_dirty',
          lastUpdateSource: 'ml',
          sequence: 2,
        },
      }),
    };

    expect(nextState.lastAppliedSequence).toBe(2);
    expect(nextState.tablesById['2']?.displayStatus).toBe('available');
    expect(nextState.tableStateMode).toBe('manual');
  });

  it('optimistically marks an open table dirty for manual spill overrides', () => {
    const state = createBaseState();
    const nextState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'mark_dirty',
        commandId: 'command-spill',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '2',
        requestedAt: '2026-03-07T12:00:00.000Z',
      }),
    };

    expect(nextState.tablesById['2']?.displayStatus).toBe('dirty');
    expect(nextState.tablesById['2']?.sensedState).toBe('empty_dirty');
    expect(nextState.tablesById['2']?.override?.commandType).toBe('mark_dirty');
    expect(Object.keys(nextState.pendingCommands)).toContain('command-spill');
  });

  it('rolls back optimistic state when a command is rejected', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'block_table',
        commandId: 'command-2',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '5',
        requestedAt: '2026-03-07T12:00:00.000Z',
      }),
    };

    const nextState = {
      ...optimisticState,
      ...rejectPendingCommandState(optimisticState, 'command-2', '5', 'Cannot block this table.'),
    };

    expect(nextState.tablesById['5']?.displayStatus).toBe('available');
    expect(nextState.syncError).toBe('Cannot block this table.');
  });

  it('maps stable rejection codes to friendlier host-facing copy', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'seat_party',
        commandId: 'command-3',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '2',
        requestedAt: '2026-03-07T12:00:00.000Z',
        party: {
          id: 'waitlist-2',
          name: 'Jordan',
          size: 6,
          source: 'waitlist',
        },
      }),
    };

    const nextState = {
      ...optimisticState,
      ...applyFloorStreamMessageState(optimisticState, {
        type: 'command.rejected',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 3,
        commandId: 'command-3',
        tableId: '2',
        error: {
          code: 'TABLE_CAPACITY_EXCEEDED',
          message: 'Party exceeds capacity.',
          retryable: false,
        },
        reason: 'Raw backend reason',
      }),
    };

    expect(nextState.syncError).toBe('That party is too large for the selected table.');
    expect(nextState.tablesById['2']?.displayStatus).toBe('available');
  });

  it('rolls back the pending local table even if backend rejection uses a different table id', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'block_table',
        commandId: 'command-uuid-mismatch',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '5',
        requestedAt: '2026-03-07T12:00:00.000Z',
      }),
    };

    const nextState = {
      ...optimisticState,
      ...applyFloorStreamMessageState(optimisticState, {
        type: 'command.rejected',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 4,
        commandId: 'command-uuid-mismatch',
        tableId: 'table-uuid-5',
        reason: 'Backend still sent a UUID.',
      }),
    };

    expect(nextState.tablesById['5']?.displayStatus).toBe('available');
    expect(nextState.syncError).toBe('Backend still sent a UUID.');
  });

  it('keeps the pending command on command.ack until canonical table update arrives', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'mark_clean',
        commandId: 'command-ack-1',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '4',
        requestedAt: '2026-03-07T12:00:00.000Z',
      }),
    };

    const optimisticTable = optimisticState.tablesById['4'];

    const nextState = {
      ...optimisticState,
      ...applyFloorStreamMessageState(optimisticState, {
        type: 'command.ack',
        commandId: 'command-ack-1',
        floorId: DEFAULT_FLOOR_ID,
      }),
    };

    expect(Object.keys(nextState.pendingCommands)).toContain('command-ack-1');
    expect(nextState.tablesById['4']).toEqual(optimisticTable);
  });

  it('ignores command.ack for a different floor', () => {
    const state = createBaseState();
    const optimisticState = {
      ...state,
      ...queuePendingCommandState(state, {
        type: 'mark_clean',
        commandId: 'command-ack-2',
        floorId: DEFAULT_FLOOR_ID,
        tableId: '4',
        requestedAt: '2026-03-07T12:00:00.000Z',
      }),
    };

    const nextState = {
      ...optimisticState,
      ...applyFloorStreamMessageState(optimisticState, {
        type: 'command.ack',
        commandId: 'command-ack-2',
        floorId: 'other-floor',
      }),
    };

    expect(Object.keys(nextState.pendingCommands)).toContain('command-ack-2');
  });

  it('treats cursor.expired as a no-op at the reducer level', () => {
    const state = createBaseState();

    const nextState = {
      ...state,
      ...applyFloorStreamMessageState(state, {
        type: 'cursor.expired',
        floorId: DEFAULT_FLOOR_ID,
        reason: 'too far behind',
      }),
    };

    expect(nextState.tablesById).toEqual(state.tablesById);
    expect(nextState.lastAppliedSequence).toBe(state.lastAppliedSequence);
    expect(nextState.pendingCommands).toEqual(state.pendingCommands);
    expect(nextState.syncError).toBe(state.syncError);
  });

  it('advances floor sequence on waitlist updates without mutating table state', () => {
    const state = createBaseState();
    const previousTable = state.tablesById['2'];

    const nextState = {
      ...state,
      ...applyFloorStreamMessageState(state, {
        type: 'waitlist.updated',
        floorId: DEFAULT_FLOOR_ID,
        sequence: 7,
        commandId: 'waitlist-seat-7',
        source: 'host',
        emittedAt: '2026-04-13T12:34:56.000Z',
        entry: {
          id: 'waitlist-2',
          guest: { id: 'guest-2', name: 'Jordan', phone: '555-0102' },
          partySize: 2,
          seatingPreference: 'none',
          status: 'seated',
          notes: '',
          source: 'manual',
          joinedAt: '2026-04-13T12:20:00.000Z',
          quotedWaitMinutes: 10,
          arrivedAt: '2026-04-13T12:25:00.000Z',
          seatedAt: '2026-04-13T12:34:56.000Z',
          removedAt: null,
          noShowAt: null,
          assignedTableId: '2',
          createdAt: '2026-04-13T12:20:00.000Z',
          updatedAt: '2026-04-13T12:34:56.000Z',
        },
      }),
    };

    expect(nextState.lastAppliedSequence).toBe(7);
    expect(nextState.tablesById['2']).toEqual(previousTable);
  });
});

describe('floor selectors', () => {
  it('keeps room grouping and excludes blocked tables from availability', () => {
    const state = createBaseState();
    const tablesById = {
      ...state.tablesById,
      '3': {
        ...state.tablesById['3']!,
        displayStatus: 'reserved' as const,
        isBlocked: true,
      },
      '2': {
        ...state.tablesById['2']!,
        displayStatus: 'occupied' as const,
        sensedState: 'occupied' as const,
        seatedAt: '2026-03-07T12:00:00.000Z',
        lastStateChange: '2026-03-07T12:00:00.000Z',
        updatedAt: '2026-03-07T12:00:00.000Z',
      },
    };

    const rooms = selectTablesByRoom(
      DEFAULT_FLOOR_MAP,
      tablesById,
      {},
      null,
      new Date('2026-03-07T12:15:00.000Z').getTime(),
    );
    const availableTables = selectAvailableTables(DEFAULT_FLOOR_MAP, tablesById, {}, null);
    const quickSeats = selectQuickSeatSuggestions(DEFAULT_FLOOR_MAP, tablesById, {}, null);
    const tableDetails = selectTableDetails(
      DEFAULT_FLOOR_MAP,
      tablesById,
      {},
      null,
      '2',
      new Date('2026-03-07T12:15:00.000Z').getTime(),
    );

    expect(rooms).toHaveLength(2);
    expect(rooms[0]?.rows[0]?.[0]?.id).toBe('1');
    expect(rooms[0]?.rows[0]?.[0]?.label).toBe('1');
    expect(availableTables.find((table) => table.id === '3')).toBeUndefined();
    expect(quickSeats[0]?.tableId).toBe('1');
    expect(quickSeats[0]?.tableLabel).toBe('1');
    expect(tableDetails?.seatedTime).toBe('15m');
  });

  it('shows section waiter badges on available tables without changing table state', () => {
    const state = createBaseState();
    const rooms = selectTablesByRoom(DEFAULT_FLOOR_MAP, state.tablesById, {}, makeRoutingState());

    const table = rooms[0]?.rows[0]?.[0];

    expect(table?.status).toBe('available');
    expect(table?.server).toBe('Section Server');
    expect(table?.serverId).toBe('section-waiter');
  });

  it('prefers live and table-level waiter ownership before section defaults', () => {
    const state = createBaseState();
    const routing = makeRoutingState({
      tableAssignments: { '2': 'table-waiter' },
    });
    const tablesById = {
      ...state.tablesById,
      '3': {
        ...state.tablesById['3']!,
        currentWaiterId: 'live-waiter',
        currentWaiterName: 'Live Server Override',
      },
    };

    const rooms = selectTablesByRoom(DEFAULT_FLOOR_MAP, tablesById, {}, routing);
    const mainRoomTables = rooms[0]?.rows.flat() ?? [];
    const tableAssigned = mainRoomTables.find((table) => table.id === '2');
    const liveAssigned = mainRoomTables.find((table) => table.id === '3');

    expect(tableAssigned?.server).toBe('Table Server');
    expect(tableAssigned?.serverId).toBe('table-waiter');
    expect(liveAssigned?.server).toBe('Live Server Override');
    expect(liveAssigned?.serverId).toBe('live-waiter');
  });
});
