import type { FloorSnapshot } from '@shire/shared';
import { fetchFloorSnapshot } from './api';
import { FloorRealtimeTransport } from './transport';

export type FloorRealtimeConnectionParams = ConstructorParameters<typeof FloorRealtimeTransport>;

export const floorRealtimeRepository = {
  fetchSnapshot(locationId: string, floorId: string): Promise<FloorSnapshot> {
    return fetchFloorSnapshot(locationId, floorId);
  },

  createTransport(...params: FloorRealtimeConnectionParams): FloorRealtimeTransport {
    return new FloorRealtimeTransport(...params);
  },
};
