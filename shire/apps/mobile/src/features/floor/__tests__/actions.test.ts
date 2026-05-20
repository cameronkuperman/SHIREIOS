import { createSeatPartyCommand, createSeatWalkInCommand } from '../commands';

describe('floor action command builders', () => {
  it('omits waiterId for walk-ins when the frontend has no assignment', () => {
    const command = createSeatWalkInCommand('floor-1', 'table-1', 'Taylor', 2);

    expect(command).toMatchObject({
      type: 'seat_walk_in',
      floorId: 'floor-1',
      tableId: 'table-1',
    });
    expect(command).not.toHaveProperty('waiterId');
  });

  it('omits waiterId for host seating when no waiter is resolved', () => {
    const command = createSeatPartyCommand('floor-1', 'table-2', {
      id: 'waitlist-1',
      name: 'Morgan',
      size: 4,
      source: 'waitlist',
    });

    expect(command).toMatchObject({
      type: 'seat_party',
      floorId: 'floor-1',
      tableId: 'table-2',
    });
    expect(command).not.toHaveProperty('waiterId');
  });

  it('includes resolved waiter and backend table ids for host seating', () => {
    const command = createSeatPartyCommand(
      'floor-1',
      'T2',
      {
        id: 'waitlist-1',
        name: 'Morgan',
        size: 4,
        source: 'waitlist',
      },
      'waiter-1',
      'backend-table-2',
    );

    expect(command).toMatchObject({
      type: 'seat_party',
      floorId: 'floor-1',
      tableId: 'T2',
      backendTableId: 'backend-table-2',
      waiterId: 'waiter-1',
    });
  });

  it('includes resolved waiter and backend table ids for walk-ins', () => {
    const command = createSeatWalkInCommand(
      'floor-1',
      'T1',
      'Taylor',
      6,
      'waiter-2',
      'backend-table-1',
    );

    expect(command).toMatchObject({
      type: 'seat_walk_in',
      floorId: 'floor-1',
      tableId: 'T1',
      backendTableId: 'backend-table-1',
      waiterId: 'waiter-2',
    });
  });
});
