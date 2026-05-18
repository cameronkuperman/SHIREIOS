import axios from 'axios';
import type { HostBootstrap, Location, UserSession } from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { resolveFloorId } from '@/features/floor/floorId';

const LOG_TAG = '[AuthAPI]';

type CreateLocationResponse =
  | Location
  | HostBootstrap
  | {
      location: Location;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isLocation(value: unknown): value is Location {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.organizationId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.timezone === 'string' &&
    (value.floorId === null ||
      value.floorId === undefined ||
      typeof value.floorId === 'string')
  );
}

function normalizeLocation(location: Location): Location {
  const rawFloorId = location?.floorId;
  const trimmed = typeof rawFloorId === 'string' ? rawFloorId.trim() : '';
  return {
    ...location,
    floorId: trimmed.length > 0 ? trimmed : null,
    permissions: location.permissions ?? [],
  };
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.message, record.error, record.detail];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function formatRequestError(action: string, error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const responseMessage = extractErrorMessage(error.response?.data);

    if (status) {
      return new Error(
        `${action} failed (${status})${responseMessage ? `: ${responseMessage}` : ''}`,
      );
    }

    return new Error(
      `${action} failed${error.message ? `: ${error.message}` : ': network request failed'}`,
    );
  }

  if (error instanceof Error) {
    return new Error(`${action} failed: ${error.message}`);
  }

  return new Error(`${action} failed.`);
}

function unwrapCreateLocationResponse(response: CreateLocationResponse): Location {
  if (isRecord(response) && 'location' in response && isLocation(response.location)) {
    return normalizeLocation(response.location);
  }

  if (isLocation(response)) {
    return normalizeLocation(response);
  }

  throw new Error('Backend returned an invalid create-location payload.');
}

/**
 * Fetches the current user session from the backend.
 */
export async function fetchCurrentSession(): Promise<UserSession> {
  console.log(LOG_TAG, 'fetchCurrentSession: starting');
  try {
    const response = await apiClient.get<UserSession>('/me');
    console.log(LOG_TAG, 'fetchCurrentSession: success');
    return response.data;
  } catch (error) {
    const formattedError = formatRequestError('fetchCurrentSession', error);
    console.error(LOG_TAG, formattedError.message);
    throw formattedError;
  }
}

/**
 * Fetches locations assigned to the current user from the backend.
 */
export async function fetchLocations(): Promise<Location[]> {
  console.log(LOG_TAG, 'fetchLocations: starting');
  try {
    const response = await apiClient.get<Location[] | { locations: Location[] }>('/me/locations');
    const rawLocations = Array.isArray(response.data) ? response.data : response.data.locations ?? [];
    const locations = rawLocations.map(normalizeLocation);

    console.log(
      LOG_TAG,
      'fetchLocations: returning',
      locations.length,
      'location(s):',
      locations.map((l) => `${l.name} (${l.id})`).join(', '),
    );

    return locations;
  } catch (error) {
    const formattedError = formatRequestError('fetchLocations', error);
    console.error(LOG_TAG, formattedError.message);
    throw formattedError;
  }
}

export async function fetchHostBootstrap(locationId: string): Promise<HostBootstrap> {
  console.log(LOG_TAG, 'fetchHostBootstrap: locationId=', locationId);
  const response = await apiClient.get<HostBootstrap>(`/locations/${locationId}/bootstrap`);
  const floorId = resolveFloorId(
    response.data?.floorId,
    response.data?.location?.floorId,
    response.data?.floorMap?.floorId,
  );

  return {
    ...response.data,
    floorId,
    floorMap: {
      ...response.data.floorMap,
      floorId,
    },
  };
}

/**
 * Creates a new location and the backend-managed host resources it depends on.
 */
export async function createLocationApi(name: string, timezone: string): Promise<Location> {
  console.log(LOG_TAG, 'createLocation: name=', name, 'timezone=', timezone);
  const response = await apiClient.post<CreateLocationResponse>('/locations', {
    name,
    timezone,
  });
  const location = unwrapCreateLocationResponse(response.data);
  console.log(LOG_TAG, 'createLocation: success', location.id, location.name);
  return location;
}
