import { create } from 'zustand';

/**
 * Session-scoped, in-memory activity log. Floor action handlers push events
 * here; the right-panel Activity feed reads them. Not persisted — a real
 * backend feed replaces this (see docs/backend-contract-insights.md).
 */
export type ActivityType = 'seat' | 'clear' | 'dirty' | 'block' | 'unblock';

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  tableLabel: string;
  partyName?: string;
  at: number;
};

type ActivityStoreState = {
  events: ActivityEvent[];
  logEvent: (event: Omit<ActivityEvent, 'id' | 'at'>) => void;
  clearAll: () => void;
};

const MAX_EVENTS = 50;

export const useActivityStore = create<ActivityStoreState>((set) => ({
  events: [],
  logEvent: (event) => {
    set((state) => ({
      events: [
        {
          ...event,
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: Date.now(),
        },
        ...state.events,
      ].slice(0, MAX_EVENTS),
    }));
  },
  clearAll: () => set({ events: [] }),
}));

/** Reverse-chronological activity events. */
export function useActivityFeed(): ActivityEvent[] {
  return useActivityStore((state) => state.events);
}
