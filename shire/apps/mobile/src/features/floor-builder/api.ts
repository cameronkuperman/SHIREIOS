import type { FloorMap } from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { supabase } from '@/services/supabase/client';

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
  floorId: string,
): Promise<FloorMap | null> {
  const { data, error } = await supabase
    .from('floor_maps')
    .select('map_data')
    .eq('location_id', locationId)
    .eq('floor_id', floorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch floor map: ${error.message}`);
  }

  return (data?.map_data as FloorMap) ?? null;
}

export async function saveFloorMapLayout(
  locationId: string,
  floorId: string,
  floorMap: FloorMap,
): Promise<void> {
  const { error } = await supabase
    .from('floor_maps')
    .upsert(
      {
        location_id: locationId,
        floor_id: floorId,
        map_version: floorMap.mapVersion,
        map_data: floorMap,
      },
      { onConflict: 'location_id,floor_id' },
    );

  if (error) {
    throw new Error(`Failed to save floor map: ${error.message}`);
  }
}
