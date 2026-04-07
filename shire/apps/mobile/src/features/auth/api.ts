import type { HostBootstrap, Location, UserSession } from '@shire/shared';
import { apiClient } from '@/services/api/client';

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
    typeof value.floorId === 'string'
  );
}

function normalizeLocation(location: Location): Location {
  return {
    ...location,
    permissions: location.permissions ?? [],
  };
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
  const response = await apiClient.get<UserSession>('/me');
  console.log(LOG_TAG, 'fetchCurrentSession: success');
  return response.data;
}

/**
 * Fetches locations assigned to the current user from the backend.
 */
export async function fetchLocations(): Promise<Location[]> {
  console.log(LOG_TAG, 'fetchLocations: starting');
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
}

export async function fetchHostBootstrap(locationId: string): Promise<HostBootstrap> {
  console.log(LOG_TAG, 'fetchHostBootstrap: locationId=', locationId);
  const response = await apiClient.get<HostBootstrap>(`/locations/${locationId}/bootstrap`);
  return response.data;
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
