import type { BackendFloorSnapshotDto, FloorSnapshot } from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { adaptFloorSnapshot } from './contracts';

export async function fetchFloorSnapshot(
  locationId: string,
  floorId: string,
): Promise<FloorSnapshot> {
  const response = await apiClient.get<BackendFloorSnapshotDto>(
    `/locations/${locationId}/floors/${floorId}/snapshot`,
  );
  return adaptFloorSnapshot(response.data);
}
