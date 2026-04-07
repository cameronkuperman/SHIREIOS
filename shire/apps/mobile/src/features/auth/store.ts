import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthSession } from '@supabase/supabase-js';
import { zustandStorage } from '@/lib/storage';

type AuthStoreState = {
  session: AuthSession | null;
  currentLocationId: string | null;
  isSessionHydrated: boolean;
  setSession: (session: AuthSession | null) => void;
  setCurrentLocationId: (locationId: string | null) => void;
  setSessionHydrated: (isSessionHydrated: boolean) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      session: null,
      currentLocationId: null,
      isSessionHydrated: false,
      setSession: (session) => {
        set({ session });
      },
      setCurrentLocationId: (currentLocationId) => {
        set({ currentLocationId });
      },
      setSessionHydrated: (isSessionHydrated) => {
        set({ isSessionHydrated });
      },
      reset: () => {
        set({
          session: null,
          currentLocationId: null,
          isSessionHydrated: true,
        });
      },
    }),
    {
      name: 'shire-auth-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        currentLocationId: state.currentLocationId,
      }),
    },
  ),
);
