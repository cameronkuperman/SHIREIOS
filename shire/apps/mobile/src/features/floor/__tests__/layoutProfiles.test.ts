import type { FloorMap } from '@shire/shared';
import { applyFloorLayoutToMap, extractFloorLayoutFromMap } from '../layoutProfiles';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/lib/device', () => ({
  getOrCreateDeviceId: () => 'device-1',
}));

jest.mock('@/services/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(),
      upsert: jest.fn(),
    })),
  },
}));

const floorMap: FloorMap = {
  floorId: 'floor-1',
  mapVersion: 'v1',
  rooms: [
    {
      roomId: 'main',
      label: 'MAIN',
      filterLabel: 'Main',
      rows: [['1']],
      layoutMode: 'freeform',
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
      x: 0.25,
      y: 0.5,
      width: 88,
      height: 72,
    },
  },
};

describe('floor layout profiles', () => {
  it('extracts table geometry separately from canonical floor facts', () => {
    const layout = extractFloorLayoutFromMap(floorMap);

    expect(layout['1']).toEqual({
      tableId: '1',
      x: 0.25,
      y: 0.5,
      rotation: undefined,
      width: 88,
      height: 72,
    });
  });

  it('applies a device layout without changing table facts', () => {
    const resolved = applyFloorLayoutToMap(floorMap, {
      id: 'layout-1',
      locationId: 'location-1',
      floorId: 'floor-1',
      surface: 'host',
      profileKey: 'ios-tablet-landscape',
      deviceId: 'device-1',
      deviceLabel: 'Host iPad',
      isProfileDefault: false,
      tables: {
        '1': {
          tableId: '1',
          x: 0.8,
          y: 0.2,
          rotation: 15,
          width: 104,
          height: 80,
        },
      },
      updatedAt: '2026-05-31T00:00:00.000Z',
    });

    expect(resolved.tables['1']).toMatchObject({
      tableId: '1',
      tableNumber: '1',
      roomId: 'main',
      section: 'A',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      x: 0.8,
      y: 0.2,
      rotation: 15,
      width: 104,
      height: 80,
    });
  });
});
