import type {
  ArchiveBlackoutRequest,
  CreateBlackoutRequest,
  ReservationBlackout,
  UpdateBlackoutRequest,
} from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { adaptBlackout, type ReservationBlackoutDto } from './contracts';

export async function fetchBlackouts(
  locationId: string,
  includeArchived = false,
): Promise<ReservationBlackout[]> {
  const response = await apiClient.get<ReservationBlackoutDto[]>(
    `/locations/${locationId}/reservation-blackouts`,
    { params: { includeArchived } },
  );
  return response.data.map(adaptBlackout);
}

export async function createBlackout(
  locationId: string,
  input: CreateBlackoutRequest,
): Promise<ReservationBlackout> {
  const response = await apiClient.post<ReservationBlackoutDto>(
    `/locations/${locationId}/reservation-blackouts`,
    input,
  );
  return adaptBlackout(response.data);
}

export async function updateBlackout(
  locationId: string,
  blackoutId: string,
  input: UpdateBlackoutRequest,
): Promise<ReservationBlackout> {
  const response = await apiClient.patch<ReservationBlackoutDto>(
    `/locations/${locationId}/reservation-blackouts/${blackoutId}`,
    input,
  );
  return adaptBlackout(response.data);
}

export async function archiveBlackout(
  locationId: string,
  blackoutId: string,
  input: ArchiveBlackoutRequest = {},
): Promise<ReservationBlackout> {
  const response = await apiClient.post<ReservationBlackoutDto>(
    `/locations/${locationId}/reservation-blackouts/${blackoutId}/archive`,
    input,
  );
  return adaptBlackout(response.data);
}

export async function restoreBlackout(
  locationId: string,
  blackoutId: string,
): Promise<ReservationBlackout> {
  const response = await apiClient.post<ReservationBlackoutDto>(
    `/locations/${locationId}/reservation-blackouts/${blackoutId}/restore`,
    {},
  );
  return adaptBlackout(response.data);
}
