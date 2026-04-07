/**
 * Query key factory for type-safe, consistent cache invalidation.
 *
 * Usage:
 *   queryKeys.tables.all        → ['tables']
 *   queryKeys.tables.list()     → ['tables', 'list']
 *   queryKeys.tables.detail(id) → ['tables', 'detail', id]
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
    locations: () => [...queryKeys.auth.all, 'locations'] as const,
  },
  bootstrap: {
    all: ['bootstrap'] as const,
    location: (locationId: string) => [...queryKeys.bootstrap.all, 'location', locationId] as const,
  },
  floor: {
    all: ['floor'] as const,
    snapshot: (locationId: string, floorId: string) =>
      [...queryKeys.floor.all, 'snapshot', locationId, floorId] as const,
  },
  reservations: {
    all: ['reservations'] as const,
    location: (locationId: string) => [...queryKeys.reservations.all, 'location', locationId] as const,
    list: (locationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.reservations.location(locationId), 'list', filters ?? {}] as const,
    detail: (locationId: string, id: string) =>
      [...queryKeys.reservations.location(locationId), 'detail', id] as const,
    availability: (locationId: string, params: Record<string, unknown>) =>
      [...queryKeys.reservations.location(locationId), 'availability', params] as const,
    settings: (locationId: string) =>
      [...queryKeys.reservations.location(locationId), 'settings'] as const,
  },
  waitlist: {
    all: ['waitlist'] as const,
    list: (locationId: string) => [...queryKeys.waitlist.all, 'list', locationId] as const,
    detail: (locationId: string, id: string) =>
      [...queryKeys.waitlist.all, 'detail', locationId, id] as const,
  },
  floorMap: {
    all: ['floorMap'] as const,
    layout: (locationId: string, floorId: string) =>
      [...queryKeys.floorMap.all, 'layout', locationId, floorId] as const,
  },
  routing: {
    all: ['routing'] as const,
    location: (locationId: string) => [...queryKeys.routing.all, 'location', locationId] as const,
  },
} as const;
