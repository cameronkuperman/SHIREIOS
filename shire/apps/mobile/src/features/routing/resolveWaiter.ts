import type { FloorMap, WaiterRoutingState } from '@shire/shared';
import {
  firstEligibleWaiterFromOrder,
  getOpenSectionIds,
  isOpenSection,
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
  const byTable = (assignments: Record<string, string> | undefined): string | null => {
    const waiterId =
      (backendTableId ? assignments?.[backendTableId] : undefined) ?? assignments?.[tableId];
    return resolveEligibleWaiterId(routing, waiterId, activeWaiterIds, openSectionIds);
  };
  const bySection = (assignments: Record<string, string> | undefined): string | null => {
    if (!isOpenSection(sectionId, openSectionIds)) {
      return null;
    }

    const waiterId = sectionId ? assignments?.[sectionId] : undefined;
    return resolveEligibleWaiterId(routing, waiterId, activeWaiterIds, openSectionIds);
  };
  const resolveRotationFallback = (): string | null => {
    const orderedIds = [
      ...(routing.nextWaiterId ? [routing.nextWaiterId] : []),
      ...routing.rotationOrder,
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    return firstEligibleWaiterFromOrder(routing, orderedIds, activeWaiterIds, openSectionIds);
  };
  const resolveGratRotationFallback = (): string | null => {
    const orderedIds = [
      ...(routing.nextGratWaiterId ? [routing.nextGratWaiterId] : []),
      ...(routing.gratRotationState?.rotationOrder ?? []),
      ...routing.rotationOrder,
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    return firstEligibleWaiterFromOrder(routing, orderedIds, activeWaiterIds, openSectionIds);
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

    return (
      byTable(routing.nextGratByTable) ??
      bySection(routing.nextGratBySection) ??
      resolveEligibleWaiterId(routing, routing.nextGratWaiterId, activeWaiterIds, openSectionIds) ??
      (hasGratRoutingConfigured ? resolveGratRotationFallback() : null)
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
      resolveRotationFallback()
    );
  }

  return (
    byTable(routing.nextUpByTable) ?? bySection(routing.nextUpBySection) ?? resolveRotationFallback()
  );
}
