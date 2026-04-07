import { create } from 'zustand';
import type { PartySource } from '@shire/shared';

type PendingSeatEntry = {
  entityId: string;
  tableId: string;
  source: Extract<PartySource, 'waitlist' | 'reservations'>;
};

type PendingSeatStoreState = {
  pendingSeats: Record<string, PendingSeatEntry>;
  markPendingSeat: (commandId: string, entry: PendingSeatEntry) => void;
  confirmPendingSeat: (commandId: string) => void;
  rollbackPendingSeat: (commandId: string) => void;
  clearAll: () => void;
};

export const usePendingSeatStore = create<PendingSeatStoreState>((set) => ({
  pendingSeats: {},
  markPendingSeat: (commandId, entry) => {
    set((state) => ({
      pendingSeats: {
        ...state.pendingSeats,
        [commandId]: entry,
      },
    }));
  },
  confirmPendingSeat: (commandId) => {
    set((state) => {
      const nextPendingSeats = { ...state.pendingSeats };
      delete nextPendingSeats[commandId];
      return { pendingSeats: nextPendingSeats };
    });
  },
  rollbackPendingSeat: (commandId) => {
    set((state) => {
      const nextPendingSeats = { ...state.pendingSeats };
      delete nextPendingSeats[commandId];
      return { pendingSeats: nextPendingSeats };
    });
  },
  clearAll: () => {
    set({ pendingSeats: {} });
  },
}));
