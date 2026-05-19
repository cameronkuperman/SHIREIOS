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
    currentCovers: waiter.currentCovers ?? 0,
    recentHourCovers: waiter.recentHourCovers ?? 0,
    shiftClockIn: waiter.shiftClockIn ?? null,
    gratCountToday: waiter.gratCountToday ?? 0,
    lastGratAt: waiter.lastGratAt ?? null,
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
    nextUpByTable: state?.nextUpByTable ?? {},
    nextUpBySection: state?.nextUpBySection ?? {},
    shiftStartGroups: state?.shiftStartGroups ?? [],
    gratThreshold: state?.gratThreshold ?? 6,
    gratRotationState: state?.gratRotationState ?? {},
    nextGratWaiterId: state?.nextGratWaiterId ?? null,
    nextGratByTable: state?.nextGratByTable ?? {},
    nextGratBySection: state?.nextGratBySection ?? {},
    updatedAt: state?.updatedAt ?? new Date().toISOString(),
  };
}
