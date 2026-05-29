import type { FloorMap } from '@shire/shared';
import { apiClient } from '@/services/api/client';

export interface HostFloorMapUpsertResponse {
  locationId: string;
  floorId: string;
  mapVersion: number;
}

export async function upsertHostFloorMap(
  locationId: string,
  floorMap: FloorMap,
): Promise<HostFloorMapUpsertResponse> {
  const { data } = await apiClient.put<HostFloorMapUpsertResponse>(
    `/locations/${locationId}/floor-map`,
    { floorMap },
  );
  return data;
}

export interface FloorMapRow {
  id: string;
  location_id: string;
  floor_id: string;
  map_version: string;
  map_data: FloorMap;
  updated_at: string;
}

export async function fetchFloorMapLayout(
  locationId: string,
  _floorId: string,
): Promise<FloorMap | null> {
  const { data } = await apiClient.get<{ floorMap?: FloorMap }>(`/locations/${locationId}/bootstrap`);
  return data.floorMap ?? null;
}

export async function saveFloorMapLayout(
  _locationId: string,
  _floorId: string,
  _floorMap: FloorMap,
): Promise<void> {
  // The backend `upsertHostFloorMap` call is the canonical write. This helper is
  // kept as a compatibility no-op for the builder's existing save sequence.
}
