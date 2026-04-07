import type { MessageDelivery, Guest } from './host.ts';
import type { SeatingPreference } from './party.ts';

export type ReservationSource =
  | 'manual'
  | 'phone'
  | 'web'
  | 'walk_in'
  | 'yelp'
  | 'google'
  | 'opentable'
  | 'resy'
  | 'sevenrooms'
  | 'import';

export type ReservationStatus =
  | 'booked'
  | 'confirmed'
  | 'checked_in'
  | 'seated'
  | 'completed'
  | 'canceled'
  | 'no_show';

export type ReservationAction =
  | 'confirm'
  | 'check_in'
  | 'seat'
  | 'complete'
  | 'cancel'
  | 'mark_no_show';

export interface Reservation {
  id: string;
  guestId: string | null;
  guest: Guest | null;
  guestName: string;
  guestPhone: string;
  partySize: number;
  date: string; // YYYY-MM-DD service date
  timeSlot: string; // HH:mm (24h)
  seatingPreference: SeatingPreference;
  status: ReservationStatus;
  notes: string;
  specialRequests: string;
  internalNotes: string;
  source: ReservationSource;
  assignedTableId: string | null;
  pacingOverrideApplied: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  confirmedAt: string | null;
  checkedInAt: string | null;
  seatedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  noShowAt: string | null;
  messageDelivery?: MessageDelivery | null;
}

export interface ReservationAvailabilitySlot {
  timeSlot: string;
  available: boolean;
  reason: string | null;
  servicePeriodId: string | null;
  servicePeriodName: string | null;
  canOverridePacing: boolean;
}

export interface ReservationAvailability {
  date: string;
  partySize: number;
  channel: ReservationSource;
  timezone: string | null;
  slots: ReservationAvailabilitySlot[];
}

export interface ReservationSettings {
  locationId: string;
  bookingHorizonDays: number;
  gracePeriodMinutes: number;
  leadTimeMinutes: number;
  sameDayCutoffMinutes: number | null;
  defaultChannel: ReservationSource;
  updatedAt: string | null;
}
