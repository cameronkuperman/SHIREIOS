/**
 * Query key factory for type-safe, consistent cache invalidation.
 *
 * Usage:
 *   queryKeys.tables.all        → ['tables']
 *   queryKeys.tables.list()     → ['tables', 'list']
 *   queryKeys.tables.detail(id) → ['tables', 'detail', id]
 */
export const queryKeys = {
  tables: {
    all: ['tables'] as const,
    list: () => [...queryKeys.tables.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.tables.all, 'detail', id] as const,
  },
  staff: {
    all: ['staff'] as const,
    waiters: () => [...queryKeys.staff.all, 'waiters'] as const,
    cleaners: () => [...queryKeys.staff.all, 'cleaners'] as const,
    hosts: () => [...queryKeys.staff.all, 'hosts'] as const,
  },
  parties: {
    all: ['parties'] as const,
    list: () => [...queryKeys.parties.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.parties.all, 'detail', id] as const,
  },
  routes: {
    all: ['routes'] as const,
    detail: (id: string) => [...queryKeys.routes.all, 'detail', id] as const,
  },
} as const;
