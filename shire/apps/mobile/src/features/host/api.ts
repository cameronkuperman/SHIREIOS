import type {
  Reservation,
  ReservationAction,
  ReservationAvailability,
  ReservationSettings,
  WaitlistEntry,
} from '@shire/shared';
import { apiClient } from '@/services/api/client';
import {
  adaptReservation,
  adaptReservationAvailability,
  adaptReservationSettings,
  adaptWaitlistEntry,
  type ReservationAvailabilityDto,
  type ReservationDto,
  type ReservationSettingsDto,
  type WaitlistEntryDto,
} from './contracts';

export type WaitlistAction = 'arrive' | 'remove' | 'mark_no_show' | 'seat';
export type ReservationListFilters = {
  date?: string;
  status?: Reservation['status'] | 'all';
  search?: string;
};

export type CreateWaitlistInput = Pick<
  WaitlistEntry,
  'partySize' | 'seatingPreference' | 'notes' | 'source'
> & {
  guestName: string;
  guestPhone: string;
};

export type UpdateWaitlistInput = Partial<
  Pick<WaitlistEntry, 'partySize' | 'seatingPreference' | 'notes'>
>;

export type CreateReservationInput = {
  guestName: string;
  guestPhone: string;
  partySize: number;
  date: string;
  timeSlot: string;
  seatingPreference: Reservation['seatingPreference'];
  source: Reservation['source'];
  notes?: string;
  specialRequests?: string;
  internalNotes?: string;
  pacingOverride?: boolean;
};

export type UpdateReservationInput = Partial<
  Pick<
    Reservation,
    'guestName' | 'guestPhone' | 'partySize' | 'date' | 'timeSlot' | 'seatingPreference' | 'source'
  >
> & {
  notes?: string;
  specialRequests?: string;
  internalNotes?: string;
  pacingOverride?: boolean;
};

export type ReservationAvailabilityInput = {
  date: string;
  partySize: number;
  channel: Reservation['source'];
};

export async function fetchWaitlist(locationId: string): Promise<WaitlistEntry[]> {
  const response = await apiClient.get<WaitlistEntryDto[]>(`/locations/${locationId}/waitlist`);
  return response.data.map(adaptWaitlistEntry);
}

export async function createWaitlistEntry(
  locationId: string,
  input: CreateWaitlistInput,
): Promise<WaitlistEntry> {
  const response = await apiClient.post<WaitlistEntryDto>(
    `/locations/${locationId}/waitlist`,
    input,
  );
  return adaptWaitlistEntry(response.data);
}

export async function updateWaitlistEntry(
  locationId: string,
  waitlistEntryId: string,
  input: UpdateWaitlistInput,
): Promise<WaitlistEntry> {
  const response = await apiClient.patch<WaitlistEntryDto>(
    `/locations/${locationId}/waitlist/${waitlistEntryId}`,
    input,
  );
  return adaptWaitlistEntry(response.data);
}

export async function runWaitlistAction(
  locationId: string,
  waitlistEntryId: string,
  action: WaitlistAction,
): Promise<WaitlistEntry> {
  const response = await apiClient.post<WaitlistEntryDto>(
    `/locations/${locationId}/waitlist/${waitlistEntryId}/actions/${action}`,
  );
  return adaptWaitlistEntry(response.data);
}

export async function fetchReservations(
  locationId: string,
  filters: ReservationListFilters = {},
): Promise<Reservation[]> {
  const response = await apiClient.get<ReservationDto[]>(`/locations/${locationId}/reservations`, {
    params: {
      ...(filters.date ? { date: filters.date } : {}),
      ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
    },
  });
  return response.data.map(adaptReservation);
}

export async function fetchReservation(
  locationId: string,
  reservationId: string,
): Promise<Reservation> {
  const response = await apiClient.get<ReservationDto[] | ReservationDto>(
    `/locations/${locationId}/reservations`,
    {
      params: { reservationId },
    },
  );

  const payload = Array.isArray(response.data)
    ? response.data.find((reservation) => reservation.id === reservationId) ?? null
    : response.data;

  if (!payload) {
    throw new Error('Reservation not found.');
  }

  return adaptReservation(payload);
}

export async function createReservation(
  locationId: string,
  input: CreateReservationInput,
): Promise<Reservation> {
  const response = await apiClient.post<ReservationDto>(
    `/locations/${locationId}/reservations`,
    input,
  );
  return adaptReservation(response.data);
}

export async function updateReservation(
  locationId: string,
  reservationId: string,
  input: UpdateReservationInput,
): Promise<Reservation> {
  const response = await apiClient.patch<ReservationDto>(
    `/locations/${locationId}/reservations/${reservationId}`,
    input,
  );
  return adaptReservation(response.data);
}

export async function runReservationAction(
  locationId: string,
  reservationId: string,
  action: ReservationAction,
): Promise<Reservation> {
  const response = await apiClient.post<ReservationDto>(
    `/locations/${locationId}/reservations/${reservationId}/actions/${action}`,
  );
  return adaptReservation(response.data);
}

export async function fetchReservationAvailability(
  locationId: string,
  input: ReservationAvailabilityInput,
): Promise<ReservationAvailability> {
  const response = await apiClient.get<ReservationAvailabilityDto>(
    `/locations/${locationId}/availability`,
    {
      params: {
        date: input.date,
        partySize: input.partySize,
        channel: input.channel,
      },
    },
  );
  return adaptReservationAvailability(response.data);
}

export async function fetchReservationSettings(locationId: string): Promise<ReservationSettings> {
  const response = await apiClient.get<ReservationSettingsDto>(
    `/locations/${locationId}/reservation-settings`,
  );
  return adaptReservationSettings({
    ...response.data,
    locationId: response.data.locationId ?? locationId,
  });
}
