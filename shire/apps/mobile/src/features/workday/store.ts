import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

type WorkdayStoreState = {
  activeLocationId: string | null;
  startWorkday: (locationId: string) => void;
  endWorkday: () => void;
  reset: () => void;
};

export const useWorkdayStore = create<WorkdayStoreState>()(
  persist(
    (set) => ({
      activeLocationId: null,
      startWorkday: (locationId) => {
        set({ activeLocationId: locationId });
      },
      endWorkday: () => {
        set({ activeLocationId: null });
      },
      reset: () => {
        set({ activeLocationId: null });
      },
    }),
    {
      name: 'shire-workday-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        activeLocationId: state.activeLocationId,
      }),
    },
  ),
);

export function useIsWorkdayActive(locationId: string | null): boolean {
  return useWorkdayStore((state) =>
    locationId ? state.activeLocationId === locationId : false,
  );
}
