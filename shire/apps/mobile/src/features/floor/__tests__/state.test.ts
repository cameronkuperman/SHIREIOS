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

function createBaseState(): FloorStoreData {
  return {
    floorId: DEFAULT_FLOOR_ID,
    mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
    tablesById: buildDefaultTablesById(DEFAULT_FLOOR_MAP),
    lastSnapshotAt: null,
    lastAppliedSequence: 0,
    pendingCommands: {},
    syncError: null,
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
