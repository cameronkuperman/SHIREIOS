import { create } from 'zustand';
import { format, addDays } from 'date-fns';
import type { Reservation, ReservationStatus } from '@shire/shared';

type ReservationStore = {
  reservations: Reservation[];
  addReservation: (
    data: Omit<
      Reservation,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'assignedTableId'
      | 'guestId'
      | 'guest'
      | 'pacingOverrideApplied'
      | 'confirmedAt'
      | 'checkedInAt'
      | 'seatedAt'
      | 'completedAt'
      | 'canceledAt'
      | 'noShowAt'
    >,
  ) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  updateStatus: (id: string, status: ReservationStatus) => void;
  removeReservation: (id: string) => void;
  getReservationsForDate: (date: string) => Reservation[];
  getDatesWithBookings: () => Set<string>;
};

function makeId(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const now = new Date();
const today = format(now, 'yyyy-MM-dd');

function d(offset: number): string {
  return format(addDays(now, offset), 'yyyy-MM-dd');
}

function makeReservation(
  id: string,
  guestName: string,
  guestPhone: string,
  partySize: number,
  date: string,
  timeSlot: string,
  status: ReservationStatus,
  seatingPreference: Reservation['seatingPreference'],
  notes: string,
): Reservation {
  return {
    id,
    guestId: null,
    guest: null,
    guestName,
    guestPhone,
    partySize,
    date,
    timeSlot,
    seatingPreference,
    status,
    notes,
    specialRequests: notes,
    internalNotes: '',
    source: 'manual',
    assignedTableId: null,
    pacingOverrideApplied: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    confirmedAt: status === 'confirmed' ? now.toISOString() : null,
    checkedInAt: status === 'checked_in' ? now.toISOString() : null,
    seatedAt: status === 'seated' ? now.toISOString() : null,
    completedAt: status === 'completed' ? now.toISOString() : null,
    canceledAt: status === 'canceled' ? now.toISOString() : null,
    noShowAt: status === 'no_show' ? now.toISOString() : null,
    messageDelivery: null,
  };
}

const MOCK_RESERVATIONS: Reservation[] = [
  makeReservation('res-1', 'Williams', '555-0101', 4, today, '18:30', 'confirmed', 'window', 'Anniversary dinner'),
  makeReservation('res-2', 'Thompson', '555-0102', 2, today, '19:00', 'confirmed', 'bar', ''),
  makeReservation('res-3', 'Garcia', '555-0103', 6, today, '19:30', 'booked', 'booth', 'May be late 10 min'),
  makeReservation('res-4', 'Chen', '555-0104', 8, d(1), '18:00', 'confirmed', 'booth', 'Birthday party'),
  makeReservation('res-5', 'Patel', '555-0105', 3, d(1), '19:30', 'confirmed', 'patio', ''),
  makeReservation('res-6', 'Johnson', '555-0106', 2, d(2), '12:00', 'confirmed', 'window', 'Business lunch'),
  makeReservation('res-7', 'Kim', '555-0107', 4, d(3), '19:00', 'booked', 'none', ''),
  makeReservation('res-8', 'Anderson', '555-0108', 5, d(3), '20:00', 'confirmed', 'booth', ''),
  makeReservation('res-9', 'Martinez', '555-0109', 2, d(5), '18:30', 'confirmed', 'patio', 'Shellfish allergy'),
  makeReservation('res-10', 'Brown', '555-0110', 10, d(7), '19:00', 'confirmed', 'booth', 'Large party'),
  makeReservation('res-11', 'Lee', '555-0111', 4, d(7), '20:30', 'booked', 'window', ''),
  makeReservation('res-12', 'Taylor', '555-0112', 2, d(10), '12:30', 'confirmed', 'bar', ''),
  makeReservation('res-13', 'Davis', '555-0113', 6, d(14), '19:00', 'confirmed', 'patio', 'Outdoor preferred'),
  makeReservation('res-14', 'Wilson', '555-0114', 4, d(14), '19:30', 'booked', 'window', ''),
  makeReservation('res-15', 'Moore', '555-0115', 3, d(18), '18:00', 'confirmed', 'none', 'Regular guest'),
];

export const useReservationStore = create<ReservationStore>((set, get) => ({
  reservations: MOCK_RESERVATIONS,

  addReservation: (data) => {
    const newRes: Reservation = {
      ...data,
      id: makeId(),
      guestId: null,
      guest: null,
      assignedTableId: null,
      pacingOverrideApplied: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedAt: null,
      checkedInAt: null,
      seatedAt: null,
      completedAt: null,
      canceledAt: null,
      noShowAt: null,
    };
    set((state) => ({ reservations: [...state.reservations, newRes] }));
  },

  updateReservation: (id, updates) => {
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r,
      ),
    }));
  },

  updateStatus: (id, status) => {
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r,
      ),
    }));
  },

  removeReservation: (id) => {
    set((state) => ({
      reservations: state.reservations.filter((r) => r.id !== id),
    }));
  },

  getReservationsForDate: (date) => {
    return get().reservations.filter((r) => r.date === date && r.status !== 'canceled');
  },

  getDatesWithBookings: () => {
    const dates = new Set<string>();
    for (const r of get().reservations) {
      if (r.status !== 'canceled') {
        dates.add(r.date);
      }
    }
    return dates;
  },
}));
