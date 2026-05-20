import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  FloorMap,
  RoutingWaiter,
  ShiftStartGroup,
  WaiterRoutingMode,
  WaiterRoutingState,
} from '@shire/shared';
import { create } from 'zustand';
import { queryKeys } from '@/services/api/queryKeys';
import { toWaiterRoutingUpdatePayload, updateWaiterRouting } from './api';

export const WAITER_COLORS = [
  '#B63A3A',
  '#C96F1A',
  '#B8A133',
  '#4F8A6B',
  '#2F6FAF',
  '#8A5A44',
  '#6E7F31',
  '#0F766E',
] as const;

export interface WaiterChipData {
  id: string;
  name: string;
  color: string;
  tableCount: number;
  isNext: boolean;
  isActive: boolean;
  isTemporary: boolean;
}

export interface WaiterCardData extends WaiterChipData {
  status: RoutingWaiter['status'];
  sectionIds: string[];
  assignedTableIds: string[];
  currentTableIds: string[];
  servedTableIds: string[];
  servedSeatingCount: number;
  lastAssignedAt: string | null;
}

export type RoutingModeSwitchWarning = {
  code: 'active_waiters_without_sections' | 'sections_without_waiters' | 'no_floor_sections';
  message: string;
  names: string[];
};

type WaiterRoutingStoreState = {
  locationId: string | null;
  routing: WaiterRoutingState | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  setLocationContext: (locationId: string | null) => void;
  applyRouting: (locationId: string, routing: WaiterRoutingState) => void;
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSectionLabel(section: string | null | undefined): string {
  return (section ?? '').trim().replace(/\s+/g, ' ');
}

export function getFloorSectionLabels(floorMap: FloorMap): string[] {
  const activePlan =
    floorMap.activeSectionPlanId && floorMap.sectionPlans
      ? floorMap.sectionPlans.find((plan) => plan.planId === floorMap.activeSectionPlanId)
      : null;
  const planSections = activePlan?.sections
    .map((section) => normalizeSectionLabel(section.sectionId))
    .filter(Boolean);

  if (planSections && planSections.length > 0) {
    return planSections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  return dedupe(
    Object.values(floorMap.tables).map((table) => normalizeSectionLabel(table.section)),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function getRoutingModeSwitchWarnings(
  routing: WaiterRoutingState,
  floorMap: FloorMap,
  nextMode: WaiterRoutingMode,
): RoutingModeSwitchWarning[] {
  if (nextMode !== 'section') {
    return [];
  }

  const warnings: RoutingModeSwitchWarning[] = [];
  const sectionLabels = getFloorSectionLabels(floorMap);
  if (sectionLabels.length === 0) {
    warnings.push({
      code: 'no_floor_sections',
      message: 'No floor sections are configured yet.',
      names: [],
    });
  }

  const activeWaiterIdSet = new Set(routing.activeWaiterIds);
  const activeSectionSet = new Set(sectionLabels);
  const assignedSectionByWaiter = new Map<string, string[]>();
  for (const [sectionId, waiterId] of Object.entries(routing.sectionAssignments)) {
    if (!activeWaiterIdSet.has(waiterId)) continue;
    if (activeSectionSet.size > 0 && !activeSectionSet.has(sectionId)) continue;
    assignedSectionByWaiter.set(waiterId, [
      ...(assignedSectionByWaiter.get(waiterId) ?? []),
      sectionId,
    ]);
  }

  const waitersWithoutSections = routing.waiters
    .filter((waiter) => activeWaiterIdSet.has(waiter.id) && !assignedSectionByWaiter.has(waiter.id))
    .map((waiter) => waiter.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (waitersWithoutSections.length > 0) {
    warnings.push({
      code: 'active_waiters_without_sections',
      message: 'Some active waiters do not own a section.',
      names: waitersWithoutSections,
    });
  }

  const unassignedSections = sectionLabels.filter((sectionId) => {
    const waiterId = routing.sectionAssignments[sectionId];
    return !waiterId || !activeWaiterIdSet.has(waiterId);
  });
  if (unassignedSections.length > 0) {
    warnings.push({
      code: 'sections_without_waiters',
      message: 'Some floor sections do not have an active waiter.',
      names: unassignedSections,
    });
  }

  return warnings;
}

function pruneAssignments(
  assignments: Record<string, string>,
  validWaiterIds: Set<string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(assignments).filter(([, waiterId]) => validWaiterIds.has(waiterId)),
  );
}

function buildCoverage(
  routing: WaiterRoutingState,
): Map<string, Pick<RoutingWaiter, 'assignedSectionIds' | 'assignedTableIds'>> {
  const coverage = new Map<
    string,
    Pick<RoutingWaiter, 'assignedSectionIds' | 'assignedTableIds'>
  >();

  for (const waiter of routing.waiters) {
    coverage.set(waiter.id, {
      assignedSectionIds: [],
      assignedTableIds: [],
    });
  }

  for (const [sectionId, waiterId] of Object.entries(routing.sectionAssignments)) {
    coverage.get(waiterId)?.assignedSectionIds.push(sectionId);
  }

  for (const [tableId, waiterId] of Object.entries(routing.tableAssignments)) {
    coverage.get(waiterId)?.assignedTableIds.push(tableId);
  }

  return coverage;
}

function sanitizeRoutingState(routing: WaiterRoutingState): WaiterRoutingState {
  const validWaiterIds = new Set(routing.waiters.map((waiter) => waiter.id));
  const activeWaiterIds = dedupe(
    routing.activeWaiterIds.filter((waiterId) => validWaiterIds.has(waiterId)),
  );
  const activeWaiterIdSet = new Set(activeWaiterIds);
  const sectionAssignments = pruneAssignments(routing.sectionAssignments, validWaiterIds);
  const tableAssignments = pruneAssignments(routing.tableAssignments, validWaiterIds);
  const nextUpByTable = pruneAssignments(routing.nextUpByTable ?? {}, validWaiterIds);
  const nextUpBySection = pruneAssignments(routing.nextUpBySection ?? {}, validWaiterIds);
  const nextGratByTable = pruneAssignments(routing.nextGratByTable ?? {}, validWaiterIds);
  const nextGratBySection = pruneAssignments(routing.nextGratBySection ?? {}, validWaiterIds);
  const baseRotationOrder = routing.rotationOrder.filter((waiterId) =>
    activeWaiterIdSet.has(waiterId),
  );
  const rotationOrder = dedupe([
    ...baseRotationOrder,
    ...activeWaiterIds.filter((waiterId) => !baseRotationOrder.includes(waiterId)),
  ]);
  const nextWaiterId =
    routing.nextWaiterId && activeWaiterIdSet.has(routing.nextWaiterId)
      ? routing.nextWaiterId
      : (rotationOrder[0] ?? activeWaiterIds[0] ?? null);
  const shiftStartGroups = (routing.shiftStartGroups ?? []).map((group) => ({
    ...group,
    waiterIds: group.waiterIds.filter((waiterId) => activeWaiterIdSet.has(waiterId)),
  }));
  const gratRotationOrder = (routing.gratRotationState?.rotationOrder ?? []).filter((waiterId) =>
    activeWaiterIdSet.has(waiterId),
  );
  const coverage = buildCoverage({
    ...routing,
    activeWaiterIds,
    sectionAssignments,
    tableAssignments,
    rotationOrder,
    nextWaiterId,
  });

  return {
    ...routing,
    activeWaiterIds,
    sectionAssignments,
    tableAssignments,
    nextUpByTable,
    nextUpBySection,
    nextGratByTable,
    nextGratBySection,
    shiftStartGroups,
    gratThreshold: Math.max(1, Math.min(20, routing.gratThreshold ?? 6)),
    gratRotationState: { rotationOrder: dedupe([...gratRotationOrder, ...activeWaiterIds]) },
    nextGratWaiterId:
      routing.nextGratWaiterId && activeWaiterIdSet.has(routing.nextGratWaiterId)
        ? routing.nextGratWaiterId
        : null,
    rotationOrder,
    nextWaiterId,
    waiters: routing.waiters.map((waiter) => {
      const waiterCoverage = coverage.get(waiter.id);
      const currentTableIds = dedupe(waiter.currentTableIds ?? []);
      return {
        ...waiter,
        isActive: activeWaiterIdSet.has(waiter.id),
        assignedSectionIds: waiterCoverage?.assignedSectionIds ?? [],
        assignedTableIds: waiterCoverage?.assignedTableIds ?? [],
        currentTableIds,
        liveTables: currentTableIds.length,
        servedTableIds: dedupe(waiter.servedTableIds ?? []),
        servedSeatingCount: waiter.servedSeatingCount ?? waiter.servedTableIds?.length ?? 0,
      };
    }),
  };
}

function nextTemporaryWaiter(name: string): RoutingWaiter {
  const trimmedName = name.trim();
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    isTemporary: true,
    status: 'available',
    isActive: true,
    assignedSectionIds: [],
    assignedTableIds: [],
    currentTableIds: [],
    servedTableIds: [],
    liveTables: 0,
    servedSeatingCount: 0,
    recentHourCovers: 0,
    shiftClockIn: null,
    gratCountToday: 0,
    lastGratAt: null,
    lastAssignedAt: null,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to save waiter routing.';
}

export function getWaiterColor(waiterId: string, waiters: Pick<RoutingWaiter, 'id'>[]): string {
  const waiterIndex = waiters.findIndex((waiter) => waiter.id === waiterId);
  if (waiterIndex < 0) {
    return WAITER_COLORS[0];
  }

  return WAITER_COLORS[waiterIndex % WAITER_COLORS.length] ?? WAITER_COLORS[0];
}

export function getWaiterById(
  routing: WaiterRoutingState | null,
  waiterId: string | null | undefined,
): RoutingWaiter | null {
  if (!routing || !waiterId) {
    return null;
  }

  return routing.waiters.find((waiter) => waiter.id === waiterId) ?? null;
}

export function resolveWaiterIdForTable(
  routing: WaiterRoutingState | null,
  tableId: string,
  sectionId: string | null | undefined,
  backendTableId?: string | null,
  partySize?: number | null,
): string | null {
  if (!routing) {
    return null;
  }

  const activeWaiterIds = new Set(routing.activeWaiterIds);
  const byTable = (assignments: Record<string, string> | undefined): string | null => {
    const waiterId =
      (backendTableId ? assignments?.[backendTableId] : undefined) ?? assignments?.[tableId];
    return waiterId && activeWaiterIds.has(waiterId) ? waiterId : null;
  };
  const bySection = (assignments: Record<string, string> | undefined): string | null => {
    const waiterId = sectionId ? assignments?.[sectionId] : undefined;
    return waiterId && activeWaiterIds.has(waiterId) ? waiterId : null;
  };
  const nextWaiterId =
    routing.nextWaiterId && activeWaiterIds.has(routing.nextWaiterId) ? routing.nextWaiterId : null;

  if (routing.mode === 'section') {
    return (
      byTable(routing.tableAssignments) ??
      bySection(routing.sectionAssignments) ??
      byTable(routing.nextUpByTable) ??
      bySection(routing.nextUpBySection) ??
      nextWaiterId
    );
  }

  const threshold = routing.gratThreshold ?? 6;
  if (partySize != null && partySize >= threshold) {
    const gratWaiterId =
      byTable(routing.nextGratByTable) ??
      bySection(routing.nextGratBySection) ??
      (routing.nextGratWaiterId && activeWaiterIds.has(routing.nextGratWaiterId)
        ? routing.nextGratWaiterId
        : null);
    if (gratWaiterId) {
      return gratWaiterId;
    }
  }

  return byTable(routing.nextUpByTable) ?? bySection(routing.nextUpBySection) ?? nextWaiterId;
}

export function resolveWaiterForTable(
  routing: WaiterRoutingState | null,
  tableId: string,
  sectionId: string | null | undefined,
  backendTableId?: string | null,
  partySize?: number | null,
): RoutingWaiter | null {
  return getWaiterById(
    routing,
    resolveWaiterIdForTable(routing, tableId, sectionId, backendTableId, partySize),
  );
}

export const useWaiterRoutingStore = create<WaiterRoutingStoreState>()((set) => ({
  locationId: null,
  routing: null,
  isLoading: false,
  isSaving: false,
  error: null,
  setLocationContext: (locationId) => {
    set((state) => {
      if (state.locationId === locationId) {
        return state;
      }

      return {
        locationId,
        routing: null,
        isLoading: Boolean(locationId),
        isSaving: false,
        error: null,
      };
    });
  },
  applyRouting: (locationId, routing) => {
    set({
      locationId,
      routing: sanitizeRoutingState(routing),
      isLoading: false,
      error: null,
    });
  },
  setLoading: (isLoading) => {
    set({ isLoading });
  },
  setSaving: (isSaving) => {
    set({ isSaving });
  },
  setError: (error) => {
    set({ error });
  },
  reset: () => {
    set({
      locationId: null,
      routing: null,
      isLoading: false,
      isSaving: false,
      error: null,
    });
  },
}));

export function useWaiterRoutingState() {
  const locationId = useWaiterRoutingStore((state) => state.locationId);
  const routing = useWaiterRoutingStore((state) => state.routing);
  const isLoading = useWaiterRoutingStore((state) => state.isLoading);
  const isSaving = useWaiterRoutingStore((state) => state.isSaving);
  const error = useWaiterRoutingStore((state) => state.error);
  const activeWaiterIds = routing?.activeWaiterIds ?? [];

  return useMemo(
    () => ({
      locationId,
      routing,
      waiters: routing?.waiters ?? [],
      activeWaiterIds: routing?.activeWaiterIds ?? [],
      isLoading,
      isSaving,
      error,
    }),
    [activeWaiterIds, error, isLoading, isSaving, locationId, routing],
  );
}

export function useWaiterChips(): WaiterChipData[] {
  const routing = useWaiterRoutingStore((state) => state.routing);

  return useMemo(() => {
    if (!routing) {
      return [];
    }

    return routing.waiters.map((waiter) => ({
      id: waiter.id,
      name: waiter.name,
      color: getWaiterColor(waiter.id, routing.waiters),
      tableCount: waiter.liveTables,
      isNext: waiter.id === routing.nextWaiterId,
      isActive: routing.activeWaiterIds.includes(waiter.id),
      isTemporary: waiter.isTemporary,
    }));
  }, [routing]);
}

export function useWaiterCards(): WaiterCardData[] {
  const routing = useWaiterRoutingStore((state) => state.routing);

  return useMemo(() => {
    if (!routing) {
      return [];
    }

    return routing.waiters.map((waiter) => ({
      id: waiter.id,
      name: waiter.name,
      color: getWaiterColor(waiter.id, routing.waiters),
      tableCount: waiter.liveTables,
      isNext: waiter.id === routing.nextWaiterId,
      isActive: routing.activeWaiterIds.includes(waiter.id),
      isTemporary: waiter.isTemporary,
      status: waiter.status,
      sectionIds: waiter.assignedSectionIds,
      assignedTableIds: waiter.assignedTableIds,
      currentTableIds: waiter.currentTableIds,
      servedTableIds: waiter.servedTableIds,
      servedSeatingCount: waiter.servedSeatingCount,
      lastAssignedAt: waiter.lastAssignedAt,
    }));
  }, [routing]);
}

export function useWaiterColorMap(): Record<string, string> {
  const routing = useWaiterRoutingStore((state) => state.routing);

  return useMemo(() => {
    if (!routing) {
      return {};
    }

    return Object.fromEntries(
      routing.waiters.map((waiter) => [waiter.id, getWaiterColor(waiter.id, routing.waiters)]),
    );
  }, [routing]);
}

export function useWaiterRoutingActions() {
  const queryClient = useQueryClient();

  const persistRouting = useCallback(
    async (
      updater: (current: WaiterRoutingState) => WaiterRoutingState,
    ): Promise<WaiterRoutingState> => {
      const store = useWaiterRoutingStore.getState();
      const { locationId, routing } = store;

      if (!locationId || !routing) {
        throw new Error('Waiter routing is unavailable for the current location.');
      }

      const previous = routing;
      const optimistic = sanitizeRoutingState({
        ...updater(previous),
        updatedAt: new Date().toISOString(),
      });

      store.setError(null);
      store.setSaving(true);
      store.applyRouting(locationId, optimistic);

      try {
        const canonical = await updateWaiterRouting(
          locationId,
          toWaiterRoutingUpdatePayload(optimistic),
        );
        store.applyRouting(locationId, canonical);
        queryClient.setQueryData(queryKeys.routing.location(locationId), canonical);
        return canonical;
      } catch (error) {
        store.applyRouting(locationId, previous);
        store.setError(toErrorMessage(error));
        throw error;
      } finally {
        store.setSaving(false);
      }
    },
    [queryClient],
  );

  const assignSection = useCallback(
    async (sectionId: string, waiterId: string | null) =>
      persistRouting((current) => {
        const nextSectionAssignments = { ...current.sectionAssignments };
        if (waiterId) {
          nextSectionAssignments[sectionId] = waiterId;
        } else {
          delete nextSectionAssignments[sectionId];
        }

        return {
          ...current,
          sectionAssignments: nextSectionAssignments,
        };
      }),
    [persistRouting],
  );

  const assignTable = useCallback(
    async (tableId: string, waiterId: string | null) =>
      persistRouting((current) => {
        const nextTableAssignments = { ...current.tableAssignments };
        if (waiterId) {
          nextTableAssignments[tableId] = waiterId;
        } else {
          delete nextTableAssignments[tableId];
        }

        return {
          ...current,
          tableAssignments: nextTableAssignments,
        };
      }),
    [persistRouting],
  );

  const setWaiterActive = useCallback(
    async (waiterId: string, isActive: boolean) =>
      persistRouting((current) => {
        const activeWaiterIds = isActive
          ? dedupe([...current.activeWaiterIds, waiterId])
          : current.activeWaiterIds.filter((id) => id !== waiterId);
        const rotationOrder = isActive
          ? dedupe([...current.rotationOrder, waiterId])
          : current.rotationOrder.filter((id) => id !== waiterId);

        return {
          ...current,
          activeWaiterIds,
          rotationOrder,
          nextWaiterId:
            current.nextWaiterId === waiterId && !isActive
              ? (rotationOrder[0] ?? activeWaiterIds[0] ?? null)
              : current.nextWaiterId,
          waiters: current.waiters.map((waiter) =>
            waiter.id === waiterId
              ? {
                  ...waiter,
                  isActive,
                  status: isActive
                    ? waiter.status === 'on_break'
                      ? 'available'
                      : waiter.status
                    : 'on_break',
                }
              : waiter,
          ),
        };
      }),
    [persistRouting],
  );

  const clearShiftAssignments = useCallback(
    async () =>
      persistRouting((current) => ({
        ...current,
        waiters: current.waiters.filter((waiter) => !waiter.isTemporary),
        activeWaiterIds: [],
        rotationOrder: [],
        sectionAssignments: {},
        tableAssignments: {},
        shiftStartGroups: [],
        nextUpQueue: [],
        nextUpByTable: {},
        nextUpBySection: {},
        nextGratWaiterId: null,
        nextGratByTable: {},
        nextGratBySection: {},
        gratRotationState: { rotationOrder: [] },
        nextWaiterId: null,
      })),
    [persistRouting],
  );

  const setNextWaiter = useCallback(
    async (waiterId: string | null) =>
      persistRouting((current) => ({
        ...current,
        nextWaiterId: waiterId,
      })),
    [persistRouting],
  );

  const setRoutingMode = useCallback(
    async (mode: WaiterRoutingMode) =>
      persistRouting((current) => ({
        ...current,
        mode,
      })),
    [persistRouting],
  );

  const moveWaiter = useCallback(
    async (waiterId: string, direction: 'up' | 'down') =>
      persistRouting((current) => {
        const currentIndex = current.rotationOrder.indexOf(waiterId);
        if (currentIndex < 0) {
          return current;
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= current.rotationOrder.length) {
          return current;
        }

        const nextRotationOrder = [...current.rotationOrder];
        const [waiter] = nextRotationOrder.splice(currentIndex, 1);
        if (!waiter) {
          return current;
        }
        nextRotationOrder.splice(targetIndex, 0, waiter);

        return {
          ...current,
          rotationOrder: nextRotationOrder,
        };
      }),
    [persistRouting],
  );

  const setShiftStartGroups = useCallback(
    async (shiftStartGroups: ShiftStartGroup[]) =>
      persistRouting((current) => ({
        ...current,
        shiftStartGroups,
      })),
    [persistRouting],
  );

  const setGratThreshold = useCallback(
    async (gratThreshold: number) =>
      persistRouting((current) => ({
        ...current,
        gratThreshold: Math.max(1, Math.min(20, Math.round(gratThreshold))),
      })),
    [persistRouting],
  );

  const addTemporaryWaiter = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error('Enter a waiter name first.');
      }

      return persistRouting((current) => {
        const waiter = nextTemporaryWaiter(trimmedName);
        return {
          ...current,
          waiters: [...current.waiters, waiter],
          activeWaiterIds: [...current.activeWaiterIds, waiter.id],
          rotationOrder: [...current.rotationOrder, waiter.id],
          nextWaiterId: current.nextWaiterId ?? waiter.id,
        };
      });
    },
    [persistRouting],
  );

  const removeTemporaryWaiter = useCallback(
    async (waiterId: string) =>
      persistRouting((current) => {
        const waiter = current.waiters.find((item) => item.id === waiterId);
        if (!waiter?.isTemporary) {
          return current;
        }

        const nextTableAssignments = Object.fromEntries(
          Object.entries(current.tableAssignments).filter(([, assignedWaiterId]) => {
            return assignedWaiterId !== waiterId;
          }),
        );
        const nextSectionAssignments = Object.fromEntries(
          Object.entries(current.sectionAssignments).filter(([, assignedWaiterId]) => {
            return assignedWaiterId !== waiterId;
          }),
        );
        const activeWaiterIds = current.activeWaiterIds.filter((id) => id !== waiterId);
        const rotationOrder = current.rotationOrder.filter((id) => id !== waiterId);

        return {
          ...current,
          waiters: current.waiters.filter((item) => item.id !== waiterId),
          activeWaiterIds,
          sectionAssignments: nextSectionAssignments,
          tableAssignments: nextTableAssignments,
          rotationOrder,
          nextWaiterId:
            current.nextWaiterId === waiterId
              ? (rotationOrder[0] ?? activeWaiterIds[0] ?? null)
              : current.nextWaiterId,
        };
      }),
    [persistRouting],
  );

  return {
    persistRouting,
    assignSection,
    assignTable,
    setWaiterActive,
    clearShiftAssignments,
    setNextWaiter,
    setRoutingMode,
    moveWaiter,
    setShiftStartGroups,
    setGratThreshold,
    addTemporaryWaiter,
    removeTemporaryWaiter,
  };
}
