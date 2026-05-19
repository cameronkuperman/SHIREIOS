import { apiClient } from '@/services/api/client';
import { sendFloorCommandHttp, startFloorServiceDay, updateFloorTableStateMode } from './api';

jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

const snapshotDto = {
  floorId: 'floor-1',
  mapVersion: 3,
  snapshotAt: '2026-05-19T12:00:00.000Z',
  sequence: 7,
  tableStateMode: 'manual',
  tablesById: {
    'table-1': {
      id: 'table-1',
      tableNumber: '1',
      capacity: 4,
      tableType: 'square',
      location: 'inside',
      state: 'clean',
      updatedAt: '2026-05-19T12:00:00.000Z',
    },
  },
};

describe('floor API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('persists table state mode through the backend endpoint', async () => {
    mockedApiClient.patch.mockResolvedValue({
      data: { tableStateMode: 'manual', snapshot: snapshotDto },
    });

    await expect(updateFloorTableStateMode('location-1', 'floor-1', 'manual')).resolves.toEqual(
      expect.objectContaining({ tableStateMode: 'manual', floorId: 'floor-1' }),
    );

    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/locations/location-1/floors/floor-1/table-state-mode',
      { tableStateMode: 'manual' },
    );
  });

  it('starts the service day before entering the floor', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        didReset: true,
        snapshot: snapshotDto,
        messages: [
          {
            type: 'table.batch_updated',
            floorId: 'floor-1',
            sequence: 8,
            source: 'host',
            tableStateMode: 'manual',
            tables: Object.values(snapshotDto.tablesById),
          },
        ],
      },
    });

    const result = await startFloorServiceDay('location-1', 'floor-1');

    expect(result.didReset).toBe(true);
    expect(result.snapshot.tableStateMode).toBe('manual');
    expect(result.messages).toHaveLength(1);
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/locations/location-1/floors/floor-1/service-day/start',
    );
  });

  it('adapts routing updates returned by command fallback responses', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        messages: [
          {
            type: 'table.updated',
            floorId: 'floor-1',
            sequence: 8,
            commandId: 'seat-1',
            source: 'host',
            emittedAt: '2026-05-19T12:00:01.000Z',
            tableStateMode: 'manual',
            table: Object.values(snapshotDto.tablesById)[0],
          },
          {
            type: 'routing.updated',
            locationId: 'location-1',
            emittedAt: '2026-05-19T12:00:01.000Z',
            routing: {
              mode: 'manual_rotation',
              waiters: [],
              activeWaiterIds: [],
              sectionAssignments: {},
              tableAssignments: {},
              rotationOrder: [],
              nextWaiterId: null,
              nextUpQueue: [],
              updatedAt: '2026-05-19T12:00:01.000Z',
            },
          },
        ],
      },
    });

    const messages = await sendFloorCommandHttp('location-1', 'floor-1', {
      type: 'seat_walk_in',
      commandId: 'seat-1',
      floorId: 'floor-1',
      tableId: '1',
      requestedAt: '2026-05-19T12:00:00.000Z',
      party: { id: 'party-1', name: 'Walk-in', size: 2, source: 'walk_in' },
    });

    expect(messages.map((message) => message.type)).toEqual(['table.updated', 'routing.updated']);
  });
});
