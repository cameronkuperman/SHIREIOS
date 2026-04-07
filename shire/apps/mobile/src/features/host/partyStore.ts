import { create } from 'zustand';
import type { SeatingPref } from '@/components/SeatingPreferencePicker';

export type WaitlistPartyStatus = 'Waiting' | 'Next' | 'Notified' | 'Seated';
export type HostPartySource = 'waitlist' | 'reservations';

export interface WaitlistParty {
  id: string;
  name: string;
  size: number;
  wait: string; // kept for backward compat display
  status: WaitlistPartyStatus;
  seatingPreference: SeatingPref;
  joinedAt: string; // ISO 8601
  notifiedAt: string | null;
  phone: string;
}

type PendingSeatEntry = {
  party: WaitlistParty;
  source: HostPartySource;
  index: number;
};

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

const INITIAL_WAITLIST: WaitlistParty[] = [
  { id: 'waitlist-1', name: 'Sarah S.', size: 4, wait: '15m', status: 'Waiting', seatingPreference: 'window', joinedAt: minutesAgo(15), notifiedAt: null, phone: '' },
  { id: 'waitlist-2', name: 'David M.', size: 6, wait: '20m', status: 'Waiting', seatingPreference: 'booth', joinedAt: minutesAgo(20), notifiedAt: null, phone: '555-0201' },
  { id: 'waitlist-3', name: 'Emily L.', size: 2, wait: 'Now', status: 'Next', seatingPreference: 'none', joinedAt: minutesAgo(25), notifiedAt: null, phone: '' },
  { id: 'waitlist-4', name: 'John K.', size: 5, wait: '30m', status: 'Waiting', seatingPreference: 'patio', joinedAt: minutesAgo(30), notifiedAt: null, phone: '555-0202' },
  { id: 'waitlist-5', name: 'Anna P.', size: 8, wait: '45m', status: 'Waiting', seatingPreference: 'booth', joinedAt: minutesAgo(45), notifiedAt: null, phone: '' },
  { id: 'waitlist-6', name: 'Chris T.', size: 2, wait: '1h', status: 'Waiting', seatingPreference: 'bar', joinedAt: minutesAgo(60), notifiedAt: null, phone: '555-0203' },
];

const INITIAL_RESERVATIONS: WaitlistParty[] = [
  { id: 'reservation-1', name: 'Williams', size: 4, wait: '6:30 PM', status: 'Waiting', seatingPreference: 'window', joinedAt: new Date().toISOString(), notifiedAt: null, phone: '555-0101' },
  { id: 'reservation-2', name: 'Thompson', size: 2, wait: '7:00 PM', status: 'Waiting', seatingPreference: 'bar', joinedAt: new Date().toISOString(), notifiedAt: null, phone: '555-0102' },
  { id: 'reservation-3', name: 'Garcia', size: 6, wait: '7:15 PM', status: 'Next', seatingPreference: 'booth', joinedAt: new Date().toISOString(), notifiedAt: null, phone: '555-0103' },
  { id: 'reservation-4', name: 'Chen', size: 8, wait: '7:30 PM', status: 'Waiting', seatingPreference: 'booth', joinedAt: new Date().toISOString(), notifiedAt: null, phone: '555-0104' },
  { id: 'reservation-5', name: 'Patel', size: 3, wait: '8:00 PM', status: 'Waiting', seatingPreference: 'patio', joinedAt: new Date().toISOString(), notifiedAt: null, phone: '555-0105' },
];

type HostPartyStore = {
  waitlist: WaitlistParty[];
  reservations: WaitlistParty[];
  pendingSeats: Record<string, PendingSeatEntry>;
  markPendingSeat: (commandId: string, party: WaitlistParty, source: HostPartySource) => void;
  confirmPendingSeat: (commandId: string) => void;
  rollbackPendingSeat: (commandId: string) => void;
  addToWaitlist: (data: { name: string; size: number; phone: string; seatingPreference: SeatingPref }) => void;
  escalateParty: (id: string) => void;
  notifyParty: (id: string) => void;
  removeParty: (id: string) => void;
  updateWaitlist: (updater: (parties: WaitlistParty[]) => WaitlistParty[]) => void;
  reset: () => void;
};

export const useHostPartyStore = create<HostPartyStore>((set) => ({
  waitlist: INITIAL_WAITLIST,
  reservations: INITIAL_RESERVATIONS,
  pendingSeats: {},

  markPendingSeat: (commandId, party, source) => {
    set((state) => {
      const items = source === 'waitlist' ? state.waitlist : state.reservations;
      const index = items.findIndex((item) => item.id === party.id);
      if (index < 0) return state;
      return {
        waitlist: source === 'waitlist' ? state.waitlist.filter((item) => item.id !== party.id) : state.waitlist,
        reservations: source === 'reservations' ? state.reservations.filter((item) => item.id !== party.id) : state.reservations,
        pendingSeats: { ...state.pendingSeats, [commandId]: { party, source, index } },
      };
    });
  },

  confirmPendingSeat: (commandId) => {
    set((state) => {
      if (!state.pendingSeats[commandId]) return state;
      const nextPendingSeats = { ...state.pendingSeats };
      delete nextPendingSeats[commandId];
      return { pendingSeats: nextPendingSeats };
    });
  },

  rollbackPendingSeat: (commandId) => {
    set((state) => {
      const pendingSeat = state.pendingSeats[commandId];
      if (!pendingSeat) return state;
      const nextPendingSeats = { ...state.pendingSeats };
      delete nextPendingSeats[commandId];
      const targetList = pendingSeat.source === 'waitlist' ? state.waitlist : state.reservations;
      const nextList = [...targetList];
      nextList.splice(pendingSeat.index, 0, pendingSeat.party);
      return {
        waitlist: pendingSeat.source === 'waitlist' ? nextList : state.waitlist,
        reservations: pendingSeat.source === 'reservations' ? nextList : state.reservations,
        pendingSeats: nextPendingSeats,
      };
    });
  },

  addToWaitlist: (data) => {
    const newParty: WaitlistParty = {
      id: `waitlist-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: data.name,
      size: data.size,
      wait: '0m',
      status: 'Waiting',
      seatingPreference: data.seatingPreference,
      joinedAt: new Date().toISOString(),
      notifiedAt: null,
      phone: data.phone,
    };
    set((state) => ({ waitlist: [...state.waitlist, newParty] }));
  },

  escalateParty: (id) => {
    set((state) => ({
      waitlist: state.waitlist.map((p) =>
        p.id === id ? { ...p, status: 'Next' as const, wait: 'Now' } : p,
      ),
    }));
  },

  notifyParty: (id) => {
    set((state) => ({
      waitlist: state.waitlist.map((p) =>
        p.id === id ? { ...p, status: 'Notified' as const, notifiedAt: new Date().toISOString() } : p,
      ),
    }));
  },

  removeParty: (id) => {
    set((state) => ({
      waitlist: state.waitlist.filter((p) => p.id !== id),
    }));
  },

  updateWaitlist: (updater) => {
    set((state) => ({ waitlist: updater(state.waitlist) }));
  },

  reset: () => {
    set({
      waitlist: INITIAL_WAITLIST,
      reservations: INITIAL_RESERVATIONS,
      pendingSeats: {},
    });
  },
}));
