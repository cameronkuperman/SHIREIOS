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

  it('keeps pending commands when an ML update arrives for the same table', () => {
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
    expect(nextState.tablesById['2']?.displayStatus).toBe('dirty');
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

  it('clears the pending command without mutating tables on command.ack', () => {
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

    expect(Object.keys(nextState.pendingCommands)).not.toContain('command-ack-1');
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
});
