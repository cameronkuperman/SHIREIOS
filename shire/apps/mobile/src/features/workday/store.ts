import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

type WorkdayStoreState = {
  activeLocationId: string | null;
  serviceDate: string | null;
  setupApprovedAt: string | null;
  // True once the host explicitly ends the workday. The server still holds today's
  // approved setup, so without this flag the /workday auto-resume effect would
  // immediately re-approve and bounce the host back to the floor. Cleared the next
  // time a shift is approved (or the workday is reset).
  manuallyEnded: boolean;
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
      manuallyEnded: false,
      startWorkday: (locationId, options = {}) => {
        // Leave manuallyEnded as-is: starting only opens the setup flow; the flag
        // clears once setup is actually approved so the sheet isn't auto-skipped.
        set({
          activeLocationId: locationId,
          serviceDate: options.serviceDate ?? null,
          setupApprovedAt: options.setupApprovedAt ?? null,
        });
      },
      approveSetup: (locationId, serviceDate, setupApprovedAt) => {
        set({ activeLocationId: locationId, serviceDate, setupApprovedAt, manuallyEnded: false });
      },
      endWorkday: () => {
        set({
          activeLocationId: null,
          serviceDate: null,
          setupApprovedAt: null,
          manuallyEnded: true,
        });
      },
      reset: () => {
        set({
          activeLocationId: null,
          serviceDate: null,
          setupApprovedAt: null,
          manuallyEnded: false,
        });
      },
    }),
    {
      name: 'shire-workday-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        activeLocationId: state.activeLocationId,
        serviceDate: state.serviceDate,
        setupApprovedAt: state.setupApprovedAt,
        manuallyEnded: state.manuallyEnded,
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
