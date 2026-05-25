import type { FloorMap, WaiterRoutingState } from '@shire/shared';
import {
  firstEligibleWaiterFromOrder,
  getOpenSectionIds,
  isOpenSection,
  normalizeSectionLabel,
  resolveEligibleWaiterId,
} from './sectionScope';

export function resolveWaiterIdForTable(
  routing: WaiterRoutingState | null,
  tableId: string,
  sectionId: string | null | undefined,
  backendTableId?: string | null,
  partySize?: number | null,
  floorMap?: FloorMap | null,
): string | null {
  if (!routing) {
    return null;
  }

  const openSectionIds = getOpenSectionIds(floorMap);
  const activeWaiterIds = new Set(routing.activeWaiterIds);
  const normalizedSectionId = normalizeSectionLabel(sectionId);
  const activeWaiterId = (waiterId: string | null | undefined): string | null => {
    if (!waiterId || !activeWaiterIds.has(waiterId)) {
      return null;
    }

    return waiterId;
  };
  const sectionAssignment = (assignments: Record<string, string> | undefined): string | null => {
    if (!normalizedSectionId || !assignments) {
      return null;
    }

    return (
      assignments[sectionId ?? ''] ??
      assignments[normalizedSectionId] ??
      Object.entries(assignments).find(
        ([assignmentSection]) => normalizeSectionLabel(assignmentSection) === normalizedSectionId,
      )?.[1] ??
      null
    );
  };
  const byTable = (assignments: Record<string, string> | undefined): string | null => {
    const waiterId =
      (backendTableId ? assignments?.[backendTableId] : undefined) ?? assignments?.[tableId];
    return resolveEligibleWaiterId(routing, waiterId, activeWaiterIds, openSectionIds);
  };
  const byTableActive = (assignments: Record<string, string> | undefined): string | null => {
    const waiterId =
      (backendTableId ? assignments?.[backendTableId] : undefined) ?? assignments?.[tableId];
    return activeWaiterId(waiterId);
  };
  const bySection = (assignments: Record<string, string> | undefined): string | null => {
    if (!isOpenSection(sectionId, openSectionIds)) {
      return null;
    }

    const waiterId = sectionAssignment(assignments);
    return resolveEligibleWaiterId(routing, waiterId, activeWaiterIds, openSectionIds);
  };
  const resolveSectionFallback = (): string | null => {
    const orderedIds = [
      ...(routing.nextWaiterId ? [routing.nextWaiterId] : []),
      ...routing.rotationOrder,
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    return firstEligibleWaiterFromOrder(routing, orderedIds, activeWaiterIds, openSectionIds);
  };
  const resolveRotationFallback = (): string | null => {
    const orderedIds = [
      ...(routing.nextWaiterId ? [routing.nextWaiterId] : []),
      ...routing.rotationOrder,
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    for (const waiterId of orderedIds) {
      const eligible = activeWaiterId(waiterId);
      if (eligible) {
        return eligible;
      }
    }

    return null;
  };
  const resolveSectionGratFallback = (): string | null => {
    const orderedIds = [
      ...(routing.nextGratWaiterId ? [routing.nextGratWaiterId] : []),
      ...(routing.gratRotationState?.rotationOrder ?? []),
      ...routing.rotationOrder,
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    return firstEligibleWaiterFromOrder(routing, orderedIds, activeWaiterIds, openSectionIds);
  };
  const resolveRotationGratFallback = (): string | null => {
    const orderedIds = [
      ...(routing.nextGratWaiterId ? [routing.nextGratWaiterId] : []),
      ...(routing.gratRotationState?.rotationOrder ?? []),
      ...routing.rotationOrder,
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    for (const waiterId of orderedIds) {
      const eligible = activeWaiterId(waiterId);
      if (eligible) {
        return eligible;
      }
    }

    return null;
  };

  const resolveGratWaiterId = (): string | null => {
    const threshold = routing.gratThreshold ?? 6;
    if (partySize == null || partySize < threshold) {
      return null;
    }

    const hasGratRoutingConfigured =
      Boolean(routing.nextGratWaiterId) ||
      Object.keys(routing.nextGratByTable ?? {}).length > 0 ||
      Object.keys(routing.nextGratBySection ?? {}).length > 0 ||
      (routing.gratRotationState?.rotationOrder ?? []).length > 0;

    if (routing.mode === 'section') {
      const assignedSectionWaiterId = sectionAssignment(routing.sectionAssignments);
      const byTableForCurrentSection = (
        assignments: Record<string, string> | undefined,
      ): string | null => {
        const waiterId = byTable(assignments);
        if (assignedSectionWaiterId && waiterId !== assignedSectionWaiterId) {
          return null;
        }

        return waiterId;
      };
      return (
        byTableForCurrentSection(routing.nextGratByTable) ??
        bySection(routing.nextGratBySection) ??
        bySection(routing.sectionAssignments) ??
        (assignedSectionWaiterId
          ? null
          : resolveEligibleWaiterId(
              routing,
              routing.nextGratWaiterId,
              activeWaiterIds,
              openSectionIds,
            )) ??
        (hasGratRoutingConfigured && !assignedSectionWaiterId ? resolveSectionGratFallback() : null)
      );
    }

    return (
      byTableActive(routing.nextGratByTable) ??
      bySection(routing.nextGratBySection) ??
      activeWaiterId(routing.nextGratWaiterId) ??
      (hasGratRoutingConfigured ? resolveRotationGratFallback() : null)
    );
  };

  const gratWaiterId = resolveGratWaiterId();
  if (gratWaiterId) {
    return gratWaiterId;
  }

  if (routing.mode === 'section') {
    return (
      byTable(routing.tableAssignments) ??
      bySection(routing.sectionAssignments) ??
      byTable(routing.nextUpByTable) ??
      bySection(routing.nextUpBySection) ??
      resolveSectionFallback()
    );
  }

  return byTableActive(routing.nextUpByTable) ?? resolveRotationFallback();
}
