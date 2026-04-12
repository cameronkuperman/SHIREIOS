import axios from 'axios';
import type { BackendFloorSnapshotDto, FloorSnapshot } from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { adaptFloorSnapshot } from './contracts';

export class FloorSnapshotUnavailableError extends Error {}

export async function fetchFloorSnapshot(
  locationId: string,
  floorId: string,
): Promise<FloorSnapshot> {
  try {
    const response = await apiClient.get<BackendFloorSnapshotDto>(
      `/locations/${locationId}/floors/${floorId}/snapshot`,
    );
    return adaptFloorSnapshot(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(
        '[FloorAPI] snapshot unavailable',
        JSON.stringify({ locationId, floorId, status: error.response.status }),
      );
      throw new FloorSnapshotUnavailableError(
        'Live floor sync is not provisioned for this location yet. The saved floor map will stay available.',
      );
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const suffix = status ? ` (${status})` : '';
      throw new Error(`Unable to load live floor snapshot${suffix}.`);
    }

    throw error instanceof Error ? error : new Error('Unable to load live floor snapshot.');
  }
}
