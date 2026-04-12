import { normalizeFloorMap } from '../mapContract';

describe('normalizeFloorMap', () => {
  it('unwraps Supabase-style floor map rows', () => {
    const normalized = normalizeFloorMap({
      floor_id: 'db-floor',
      map_version: 'db-version',
      map_data: {
        floorId: 'inner-floor',
        mapVersion: 'inner-version',
        rooms: [
          {
            roomId: 'main',
            label: 'MAIN',
            filterLabel: 'Main',
            rows: [['1']],
          },
        ],
        tables: {
          '1': {
            tableId: '1',
            tableNumber: '1',
            roomId: 'main',
            section: 'A',
            capacity: 4,
            shape: 'circle',
            type: 'regular',
          },
        },
      },
    });

    expect(normalized.floorId).toBe('inner-floor');
    expect(normalized.mapVersion).toBe('inner-version');
    expect(normalized.rooms).toHaveLength(1);
    expect(normalized.tables['1']?.roomId).toBe('main');
  });

  it('derives freeform rooms when tables exist but rooms are missing', () => {
    const normalized = normalizeFloorMap({
      floorId: 'missing-rooms',
      mapVersion: 'v1',
      tables: {
        '10': {
          tableId: '10',
          tableNumber: '10',
          roomId: 'patio',
          section: 'P',
          capacity: 2,
          shape: 'square',
          type: 'outdoor',
        },
      },
    });

    expect(normalized.rooms).toHaveLength(1);
    expect(normalized.rooms[0]?.roomId).toBe('patio');
    expect(normalized.rooms[0]?.layoutMode).toBe('freeform');
    expect(normalized.tables['10']?.roomId).toBe('patio');
  });

  it('canonicalizes saved table identity to tableNumber and remaps room rows', () => {
    const normalized = normalizeFloorMap({
      floorId: 'builder-floor',
      mapVersion: 'v2',
      rooms: [
        {
          roomId: 'main',
          label: 'MAIN',
          filterLabel: 'Main',
          rows: [['draft-table-101']],
          layoutMode: 'freeform',
        },
      ],
      tables: {
        'draft-table-101': {
          tableId: 'draft-table-101',
          tableNumber: '12',
          roomId: 'main',
          section: 'A',
          capacity: 4,
          shape: 'circle',
          type: 'regular',
        },
      },
    });

    expect(normalized.tables['draft-table-101']).toBeUndefined();
    expect(normalized.tables['12']?.tableId).toBe('12');
    expect(normalized.tables['12']?.tableNumber).toBe('12');
    expect(normalized.rooms[0]?.rows[0]?.[0]).toBe('12');
  });
});
