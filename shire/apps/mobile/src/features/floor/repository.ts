import type { FloorSnapshot } from '@shire/shared';
import type { FloorStreamMessage, TableCommand } from '@shire/shared';
import { fetchFloorSnapshot, sendFloorCommandHttp } from './api';
import { FloorRealtimeTransport } from './transport';

export type FloorRealtimeConnectionParams = ConstructorParameters<typeof FloorRealtimeTransport>;

export const floorRealtimeRepository = {
  fetchSnapshot(locationId: string, floorId: string): Promise<FloorSnapshot> {
    return fetchFloorSnapshot(locationId, floorId);
  },

  sendCommandHttp(
    locationId: string,
    floorId: string,
    command: TableCommand,
  ): Promise<FloorStreamMessage[]> {
    return sendFloorCommandHttp(locationId, floorId, command);
  },

  createTransport(...params: FloorRealtimeConnectionParams): FloorRealtimeTransport {
    return new FloorRealtimeTransport(...params);
  },
};
