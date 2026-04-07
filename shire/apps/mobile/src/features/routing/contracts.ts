import type { RoutingWaiter, WaiterRoutingState } from '@shire/shared';

function normalizeWaiter(waiter: RoutingWaiter): RoutingWaiter {
  return {
    ...waiter,
    status: waiter.status ?? 'available',
    isActive: Boolean(waiter.isActive),
    assignedSectionIds: waiter.assignedSectionIds ?? [],
    assignedTableIds: waiter.assignedTableIds ?? [],
    currentTableIds: waiter.currentTableIds ?? [],
    servedTableIds: waiter.servedTableIds ?? [],
    liveTables: waiter.liveTables ?? waiter.currentTableIds?.length ?? 0,
    servedSeatingCount:
      waiter.servedSeatingCount ?? waiter.servedTableIds?.length ?? waiter.liveTables ?? 0,
    lastAssignedAt: waiter.lastAssignedAt ?? null,
  };
}

export function normalizeWaiterRoutingState(
  state: Partial<WaiterRoutingState> | null | undefined,
): WaiterRoutingState {
  return {
    mode: state?.mode ?? 'manual_rotation',
    waiters: (state?.waiters ?? []).map(normalizeWaiter),
    activeWaiterIds: state?.activeWaiterIds ?? [],
    sectionAssignments: state?.sectionAssignments ?? {},
    tableAssignments: state?.tableAssignments ?? {},
    rotationOrder: state?.rotationOrder ?? [],
    nextWaiterId: state?.nextWaiterId ?? null,
    updatedAt: state?.updatedAt ?? new Date().toISOString(),
  };
}
