import { useMemo } from 'react';
import {
  WAITER_COLORS as SECTION_COLORS,
  getWaiterColor as getServerColor,
  resolveWaiterIdForTable,
  useWaiterChips,
  useWaiterRoutingState,
} from '@/features/routing';
import { useFloorStore } from './store';

export type ServerData = {
  id: string;
  name: string;
  colorIndex: number;
};

export type ServerChipData = ReturnType<typeof useServerChips>[number];

export function useServerStore() {
  const { routing } = useWaiterRoutingState();

  return useMemo(
    () => ({
      servers:
        routing?.waiters.map((waiter, index) => ({
          id: waiter.id,
          name: waiter.name,
          colorIndex: index,
        })) ?? [],
      sectionAssignments: routing?.tableAssignments ?? {},
      rotationOrder: routing?.rotationOrder ?? [],
      nextServerIndex: routing?.nextWaiterId
        ? Math.max(0, (routing.rotationOrder ?? []).indexOf(routing.nextWaiterId))
        : 0,
    }),
    [routing],
  );
}

export function useServerChips() {
  return useWaiterChips();
}

export function useNextServer() {
  const chips = useServerChips();
  return useMemo(() => chips.find((chip) => chip.isNext) ?? null, [chips]);
}

export function useTableSectionColor(tableId: string): string | undefined {
  const floorMap = useFloorStore((state) => state.floorMap);
  const { routing } = useWaiterRoutingState();

  return useMemo(() => {
    const sectionId = floorMap.tables[tableId]?.section ?? null;
    const waiterId = resolveWaiterIdForTable(routing, tableId, sectionId);
    return waiterId ? getServerColor(waiterId, routing?.waiters ?? []) : undefined;
  }, [floorMap.tables, routing, tableId]);
}

export function useServerForTable(tableId: string): string | undefined {
  const floorMap = useFloorStore((state) => state.floorMap);
  const { routing } = useWaiterRoutingState();

  return useMemo(() => {
    const sectionId = floorMap.tables[tableId]?.section ?? null;
    const waiterId = resolveWaiterIdForTable(routing, tableId, sectionId);
    return routing?.waiters.find((waiter) => waiter.id === waiterId)?.name;
  }, [floorMap.tables, routing, tableId]);
}
