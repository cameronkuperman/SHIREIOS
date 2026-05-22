import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

type WorkdayStoreState = {
  activeLocationId: string | null;
  serviceDate: string | null;
  setupApprovedAt: string | null;
  startWorkday: (
    locationId: string,
    options?: { serviceDate?: string | null; setupApprovedAt?: string | null },
  ) => void;
  approveSetup: (locationId: string, serviceDate: string, setupApprovedAt: string) => void;
  endWorkday: () => void;
  reset: () => void;
};

export const useWorkdayStore = create<WorkdayStoreState>()(
  persist(
    (set) => ({
      activeLocationId: null,
      serviceDate: null,
      setupApprovedAt: null,
      startWorkday: (locationId, options = {}) => {
        set({
          activeLocationId: locationId,
          serviceDate: options.serviceDate ?? null,
          setupApprovedAt: options.setupApprovedAt ?? null,
        });
      },
      approveSetup: (locationId, serviceDate, setupApprovedAt) => {
        set({ activeLocationId: locationId, serviceDate, setupApprovedAt });
      },
      endWorkday: () => {
        set({ activeLocationId: null, serviceDate: null, setupApprovedAt: null });
      },
      reset: () => {
        set({ activeLocationId: null, serviceDate: null, setupApprovedAt: null });
      },
    }),
    {
      name: 'shire-workday-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        activeLocationId: state.activeLocationId,
        serviceDate: state.serviceDate,
        setupApprovedAt: state.setupApprovedAt,
      }),
    },
  ),
);

export function useIsWorkdayActive(locationId: string | null): boolean {
  return useWorkdayStore((state) =>
    locationId
      ? state.activeLocationId === locationId && Boolean(state.serviceDate && state.setupApprovedAt)
      : false,
  );
}
