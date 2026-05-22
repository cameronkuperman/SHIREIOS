import type { FloorSnapshot, FloorTableStateMode } from '@shire/shared';
import type { FloorStreamMessage, TableCommand } from '@shire/shared';
import {
  fetchFloorSnapshot,
  sendFloorCommandHttp,
  startFloorServiceDay,
  updateFloorTableStateMode,
} from './api';
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

  updateTableStateMode(
    locationId: string,
    floorId: string,
    tableStateMode: FloorTableStateMode,
  ): Promise<FloorSnapshot> {
    return updateFloorTableStateMode(locationId, floorId, tableStateMode);
  },

  startServiceDay(
    locationId: string,
    floorId: string,
  ): Promise<{
    didReset: boolean;
    serviceDate: string | null;
    snapshot: FloorSnapshot;
    messages: FloorStreamMessage[];
  }> {
    return startFloorServiceDay(locationId, floorId);
  },

  createTransport(...params: FloorRealtimeConnectionParams): FloorRealtimeTransport {
    return new FloorRealtimeTransport(...params);
  },
};
