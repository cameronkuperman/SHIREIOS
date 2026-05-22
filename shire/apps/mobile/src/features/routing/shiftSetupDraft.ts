import type { WaiterRoutingState } from '@shire/shared';

export type LastShiftSetupMode = 'rotation_sections' | 'sections_now' | 'rotation_only';

export type ShiftSetupDraftSnapshot = {
  routing: WaiterRoutingState;
  setupMode: LastShiftSetupMode;
  selectedSectionPlanId: string | null;
  targetWaiterCountText: string;
};

export const SHIFT_SETUP_DRAFT_PREFIX = 'shire-shift-setup-draft';

export function getShiftSetupDraftKey(locationId: string | null, serviceDate: string): string {
  return `${SHIFT_SETUP_DRAFT_PREFIX}:${locationId ?? 'unknown'}:${serviceDate}`;
}

export function hasUsableLastShift(routing: WaiterRoutingState | null): boolean {
  if (!routing) return false;
  return (
    routing.activeWaiterIds.length > 0 ||
    routing.rotationOrder.length > 0 ||
    Object.keys(routing.sectionAssignments).length > 0 ||
    Object.keys(routing.tableAssignments).length > 0 ||
    (routing.shiftStartGroups?.length ?? 0) > 0 ||
    Boolean(routing.setupApproval ?? routing.setupApprovedAt)
  );
}

export function inferSetupModeFromRouting(routing: WaiterRoutingState | null): LastShiftSetupMode {
  if (!routing) return 'rotation_sections';
  if (routing.mode === 'section' || routing.setupStartingMode === 'section') {
    return 'sections_now';
  }
  if (routing.setupPlannedMode === 'manual_rotation' && !routing.setupSectionPlanId) {
    return 'rotation_only';
  }
  return 'rotation_sections';
}

export function buildBeginningShiftRouting(
  routing: WaiterRoutingState,
  updatedAt = new Date().toISOString(),
): WaiterRoutingState {
  return {
    ...routing,
    mode: 'manual_rotation',
    waiters: routing.waiters.map((waiter) => ({
      ...waiter,
      isActive: false,
      status: 'on_break',
      assignedSectionIds: [],
      assignedTableIds: [],
      currentTableIds: [],
      servedTableIds: [],
      liveTables: 0,
    })),
    activeWaiterIds: [],
    sectionAssignments: {},
    tableAssignments: {},
    rotationOrder: [],
    nextWaiterId: null,
    nextUpQueue: [],
    nextUpByTable: {},
    nextUpBySection: {},
    shiftStartGroups: [],
    gratRotationState: { rotationOrder: [] },
    nextGratWaiterId: null,
    nextGratByTable: {},
    nextGratBySection: {},
    updatedAt,
  };
}

export function summarizeShiftSetup(
  routing: WaiterRoutingState | null,
  setupMode: LastShiftSetupMode,
  sectionCount: number,
): string {
  if (!routing) return 'Routing is loading';
  const modeLabel =
    setupMode === 'sections_now'
      ? 'Sections now'
      : setupMode === 'rotation_only'
        ? 'Rotation only'
        : 'Rotation now';
  const waiterCount = `${routing.activeWaiterIds.length} waiter${
    routing.activeWaiterIds.length === 1 ? '' : 's'
  }`;
  const startGroupCount = `${routing.shiftStartGroups?.length ?? 0} start group${
    (routing.shiftStartGroups?.length ?? 0) === 1 ? '' : 's'
  }`;
  const sections =
    setupMode === 'rotation_only'
      ? 'sections skipped'
      : `${sectionCount} section${sectionCount === 1 ? '' : 's'}`;
  return `${modeLabel} · ${waiterCount} · ${startGroupCount} · ${sections}`;
}
