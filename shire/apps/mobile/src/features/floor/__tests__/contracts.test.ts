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

    expect(table.tableId).toBe('table-uuid-1');
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
    expect(message.table.tableId).toBe('table-uuid-1');
    expect(message.table.displayStatus).toBe('occupied');
  });
});
