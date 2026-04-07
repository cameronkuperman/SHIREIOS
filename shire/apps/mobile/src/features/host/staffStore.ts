import { useMemo } from 'react';
import { useWaiterCards, useWaiterRoutingActions } from '@/features/routing';
import type { ServerData, ServerStatus } from '@/components/ServerCard';

type StaffStore = {
  servers: ServerData[];
  setServerStatus: (id: string, status: ServerStatus) => Promise<void>;
  reassignSection: (sectionId: string, serverId: string) => Promise<void>;
};

export function useStaffStore(): StaffStore {
  const waiters = useWaiterCards();
  const { assignSection, setWaiterActive } = useWaiterRoutingActions();

  return useMemo(
    () => ({
      servers: waiters.map((waiter) => ({
        id: waiter.id,
        name: waiter.name,
        status: waiter.status,
        sections: waiter.sectionIds,
        liveTables: waiter.tableCount,
        servedSeatingCount: waiter.servedSeatingCount,
        skills: waiter.isTemporary ? ['Temp'] : [],
      })),
      setServerStatus: async (id, status) => {
        await setWaiterActive(id, status !== 'on_break');
      },
      reassignSection: async (sectionId, serverId) => {
        await assignSection(sectionId, serverId);
      },
    }),
    [assignSection, setWaiterActive, waiters],
  );
}
