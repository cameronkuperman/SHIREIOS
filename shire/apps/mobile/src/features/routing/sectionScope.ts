import type { FloorMap, WaiterRoutingState } from '@shire/shared';

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeSectionLabel(section: string | null | undefined): string {
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

/** Sections in the active floor plan for tonight; null means no plan filter (all sections). */
export function getOpenSectionIds(floorMap?: FloorMap | null): Set<string> | null {
  if (!floorMap) {
    return null;
  }

  const labels = getFloorSectionLabels(floorMap);
  if (labels.length === 0) {
    return null;
  }

  return new Set(labels.map((section) => normalizeSectionLabel(section)));
}

export function isOpenSection(
  sectionId: string | null | undefined,
  openSectionIds: Set<string> | null,
): boolean {
  const normalized = normalizeSectionLabel(sectionId);
  if (!normalized) {
    return false;
  }

  if (!openSectionIds || openSectionIds.size === 0) {
    return true;
  }

  return openSectionIds.has(normalized);
}

export function waiterOwnsOpenSection(
  routing: WaiterRoutingState,
  waiterId: string,
  openSectionIds: Set<string> | null,
): boolean {
  if (!openSectionIds || openSectionIds.size === 0) {
    return true;
  }

  let ownsAnySection = false;
  for (const [sectionId, assignedWaiterId] of Object.entries(routing.sectionAssignments)) {
    if (assignedWaiterId !== waiterId) {
      continue;
    }

    ownsAnySection = true;
    if (isOpenSection(sectionId, openSectionIds)) {
      return true;
    }
  }

  return !ownsAnySection;
}

export function resolveEligibleWaiterId(
  routing: WaiterRoutingState,
  waiterId: string | null | undefined,
  activeWaiterIds: Set<string>,
  openSectionIds: Set<string> | null,
): string | null {
  if (!waiterId || !activeWaiterIds.has(waiterId)) {
    return null;
  }

  return waiterOwnsOpenSection(routing, waiterId, openSectionIds) ? waiterId : null;
}

export function firstEligibleWaiterFromOrder(
  routing: WaiterRoutingState,
  orderedIds: string[],
  activeWaiterIds: Set<string>,
  openSectionIds: Set<string> | null,
): string | null {
  for (const waiterId of orderedIds) {
    const eligible = resolveEligibleWaiterId(routing, waiterId, activeWaiterIds, openSectionIds);
    if (eligible) {
      return eligible;
    }
  }

  return null;
}
