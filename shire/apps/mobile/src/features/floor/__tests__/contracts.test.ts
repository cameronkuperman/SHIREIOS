import { adaptBackendTable, adaptFloorSnapshot, adaptRealtimeMessage } from '../contracts';

describe('floor backend contracts', () => {
  it('adapts backend tables into the internal live table shape', () => {
    const table = adaptBackendTable(
      {
        id: 'table-uuid-1',
        tableNumber: 'T1',
        capacity: 4,
        state: 'dirty',
        stateConfidence: 0.87,
        updatedAt: '2026-03-12T14:30:00.000Z',
        stateChangedAt: '2026-03-12T14:29:00.000Z',
        sectionId: 'main-floor',
        sectionName: 'Main Floor',
        currentVisitId: null,
        currentPartySize: null,
        currentWaitlistEntryId: null,
        currentWaiterId: 'waiter-1',
        currentWaiterName: 'Alex',
        isBlocked: false,
        block: null,
      },
      42,
      'ml',
      '2026-03-12T14:30:00.000Z',
    );

    expect(table.tableId).toBe('T1');
    expect(table.tableNumber).toBe('T1');
    expect(table.displayStatus).toBe('dirty');
    expect(table.sensedState).toBe('empty_dirty');
    expect(table.currentWaiterName).toBe('Alex');
    expect(table.lastUpdateSource).toBe('ml');
  });

  it('adapts backend snapshots that use tablesById payloads', () => {
    const snapshot = adaptFloorSnapshot({
      floorId: 'floor-1',
      mapVersion: 'map-v2',
      snapshotAt: '2026-03-12T14:30:00.000Z',
      sequence: 99,
      routingSnapshot: {
        mode: 'manual_rotation',
        waiters: [
          {
            id: 'waiter-1',
            name: 'Alex',
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
          },
        ],
        activeWaiterIds: ['waiter-1'],
        sectionAssignments: {},
        tableAssignments: {},
        rotationOrder: ['waiter-1'],
        nextWaiterId: 'waiter-1',
        updatedAt: '2026-03-12T14:30:00.000Z',
      },
      tablesById: {
        'table-uuid-1': {
          id: 'table-uuid-1',
          tableNumber: 'T1',
          capacity: 4,
          state: 'available',
          stateConfidence: 0.99,
          updatedAt: '2026-03-12T14:30:00.000Z',
          isBlocked: true,
          block: null,
        },
      },
    });

    expect(snapshot.floorId).toBe('floor-1');
    expect(snapshot.sequence).toBe(99);
    expect(snapshot.tables).toHaveLength(1);
    expect(snapshot.tables[0]?.tableNumber).toBe('T1');
    expect(snapshot.tables[0]?.displayStatus).toBe('reserved');
    expect(snapshot.routingSnapshot?.nextWaiterId).toBe('waiter-1');
  });

  it('falls back safely when a snapshot payload is missing fields', () => {
    const snapshot = adaptFloorSnapshot(undefined);

    expect(snapshot.floorId).toBe('shire-main-floor');
    expect(snapshot.mapVersion).toBe('unknown');
    expect(snapshot.sequence).toBe(0);
    expect(snapshot.tables).toEqual([]);
  });

  it('adapts ML realtime updates without synthesizing command ids', () => {
    const message = adaptRealtimeMessage({
      type: 'table.updated',
      floorId: 'floor-1',
      sequence: 12,
      commandId: null,
      source: 'ml',
      emittedAt: '2026-03-12T14:30:00.000Z',
      table: {
        id: 'table-uuid-1',
        tableNumber: 'T1',
        capacity: 4,
        state: 'occupied',
        stateConfidence: 0.77,
        updatedAt: '2026-03-12T14:30:00.000Z',
        currentVisitId: 'visit-1',
        currentReservationId: 'reservation-1',
        currentPartySize: 4,
        currentWaitlistEntryId: null,
        currentWaiterId: null,
        currentWaiterName: null,
        isBlocked: false,
        block: null,
      },
    });

    expect(message?.type).toBe('table.updated');
    if (!message || message.type !== 'table.updated') {
      return;
    }

    expect(message.commandId).toBeNull();
    expect(message.source).toBe('ml');
    expect(message.table.tableId).toBe('T1');
    expect(message.table.displayStatus).toBe('occupied');
    expect(message.table.currentReservationId).toBe('reservation-1');
    expect(message.table.currentVisitId).toBe('visit-1');
    expect(message.table.party?.source).toBe('reservations');
  });

  it('falls back to backend id when a table number is unavailable', () => {
    const table = adaptBackendTable(
      {
        id: 'table-uuid-9',
        tableNumber: '   ',
        capacity: 4,
        state: 'available',
        stateConfidence: 0.9,
        updatedAt: '2026-03-12T14:30:00.000Z',
        isBlocked: false,
        block: null,
      },
      5,
    );

    expect(table.tableId).toBe('table-uuid-9');
    expect(table.tableNumber).toBe('table-uuid-9');
  });

  it('drops malformed floor.snapshot websocket messages instead of throwing', () => {
    expect(
      adaptRealtimeMessage({
        type: 'floor.snapshot',
        snapshot: undefined,
      }),
    ).toBeNull();
  });
});
