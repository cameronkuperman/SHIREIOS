import type {
  Reservation,
  ReservationAction,
  ReservationAvailability,
  ReservationDensityResponse,
  ReservationSettings,
  WaitlistEntry,
} from '@shire/shared';
import { apiClient } from '@/services/api/client';
import {
  adaptReservation,
  adaptReservationAvailability,
  adaptReservationDensity,
  adaptReservationSettings,
  adaptWaitlistEntry,
  type ReservationAvailabilityDto,
  type ReservationListResponseDto,
  type ReservationDto,
  type ReservationDensityResponseDto,
  type ReservationSettingsDto,
  type WaitlistEntryDto,
} from './contracts';
import { toStaffReservationSource } from './source';

export type WaitlistAction = 'arrive' | 'remove' | 'mark_no_show' | 'seat';
export type ReservationListFilters = {
  date?: string;
  status?: Reservation['status'] | 'all';
  search?: string;
  includeArchived?: boolean;
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

export type ReservationActionInput = {
  commandId?: string;
  tableId?: string;
  waiterId?: string;
};

export type ArchiveReservationInput = {
  reason?: string;
};

type BackendReservationSource = 'host' | 'phone' | 'public_web' | 'public_app' | 'google';
type BackendCreateReservationPayload = {
  guestName: string;
  guestPhone: string;
  partySize: number;
  serviceDate: string;
  reservationTime: string;
  seatingPreference: Reservation['seatingPreference'];
  specialRequests?: string;
  notesInternal?: string;
  overridePacing?: boolean;
  channel: BackendReservationSource;
  source: BackendReservationSource;
};
type BackendUpdateReservationPayload = {
  partySize?: number;
  serviceDate?: string;
  reservationTime?: string;
  seatingPreference?: Reservation['seatingPreference'];
  specialRequests?: string;
  notesInternal?: string;
  overridePacing?: boolean;
};

function toBackendReservationSource(source: Reservation['source']): BackendReservationSource {
  switch (source) {
    case 'host_dashboard':
    case 'manual':
      return 'host';
    case 'staff_phone':
    case 'phone':
      return 'phone';
    case 'website_widget':
    case 'web':
    case 'walk_in':
    case 'yelp':
    case 'opentable':
    case 'resy':
    case 'sevenrooms':
    case 'import':
      return 'public_web';
    case 'app_native':
      return 'public_app';
    case 'google_business_profile':
    case 'google':
      return 'google';
    default:
      return toStaffReservationSource(source) === 'staff_phone' ? 'phone' : 'host';
  }
}

function toBackendServiceDate(dateValue: string): string {
  return dateValue.trim().slice(0, 10);
}

function toBackendReservationTime(timeValue: string): string {
  const trimmed = timeValue.trim();

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  const meridiemMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (meridiemMatch) {
    const [, hoursRaw, minutes, meridiem] = meridiemMatch;
    let hours = Number(hoursRaw);
    const normalizedMeridiem = (meridiem ?? '').toUpperCase();

    if (Number.isFinite(hours) && normalizedMeridiem) {
      if (normalizedMeridiem === 'AM') {
        hours = hours % 12;
      } else {
        hours = (hours % 12) + 12;
      }

      return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
    }
  }

  return trimmed;
}

function toCreateReservationPayload(
  input: CreateReservationInput,
): BackendCreateReservationPayload {
  const backendSource = toBackendReservationSource(input.source);

  return {
    guestName: input.guestName.trim(),
    guestPhone: input.guestPhone.trim(),
    partySize: input.partySize,
    serviceDate: toBackendServiceDate(input.date),
    reservationTime: toBackendReservationTime(input.timeSlot),
    seatingPreference: input.seatingPreference,
    specialRequests: input.specialRequests?.trim() || undefined,
    notesInternal: input.internalNotes?.trim() || undefined,
    overridePacing: input.pacingOverride ?? false,
    channel: backendSource,
    source: backendSource,
  };
}

function toUpdateReservationPayload(
  input: UpdateReservationInput,
): BackendUpdateReservationPayload {
  return {
    ...(input.partySize != null ? { partySize: input.partySize } : {}),
    ...(input.date ? { serviceDate: toBackendServiceDate(input.date) } : {}),
    ...(input.timeSlot ? { reservationTime: toBackendReservationTime(input.timeSlot) } : {}),
    ...(input.seatingPreference ? { seatingPreference: input.seatingPreference } : {}),
    ...(input.specialRequests != null
      ? { specialRequests: input.specialRequests.trim() || undefined }
      : {}),
    ...(input.internalNotes != null
      ? { notesInternal: input.internalNotes.trim() || undefined }
      : {}),
    ...(input.pacingOverride != null ? { overridePacing: input.pacingOverride } : {}),
  };
}

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
    {},
  );
  return adaptWaitlistEntry(response.data);
}

export async function fetchReservations(
  locationId: string,
  filters: ReservationListFilters = {},
): Promise<Reservation[]> {
  const response = await apiClient.get<ReservationListResponseDto>(
    `/locations/${locationId}/reservations`,
    {
      params: {
        ...(filters.date ? { date: filters.date } : {}),
        ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.includeArchived ? { includeArchived: true } : {}),
      },
    },
  );
  return response.data.reservations.map(adaptReservation);
}

export async function fetchReservation(
  locationId: string,
  reservationId: string,
): Promise<Reservation> {
  const response = await apiClient.get<ReservationListResponseDto | ReservationDto>(
    `/locations/${locationId}/reservations`,
    {
      params: { reservationId },
    },
  );

  const payload =
    'reservations' in response.data
      ? (response.data.reservations.find((reservation) => reservation.id === reservationId) ?? null)
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
    toCreateReservationPayload(input),
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
    toUpdateReservationPayload(input),
  );
  return adaptReservation(response.data);
}

export async function runReservationAction(
  locationId: string,
  reservationId: string,
  action: ReservationAction,
  input?: ReservationActionInput,
): Promise<Reservation> {
  const response = await apiClient.post<ReservationDto>(
    `/locations/${locationId}/reservations/${reservationId}/actions/${action}`,
    input ?? {},
  );
  return adaptReservation(response.data);
}

export async function archiveReservation(
  locationId: string,
  reservationId: string,
  input: ArchiveReservationInput = {},
): Promise<Reservation> {
  const response = await apiClient.post<ReservationDto>(
    `/locations/${locationId}/reservations/${reservationId}/archive`,
    input,
  );
  return adaptReservation(response.data);
}

export async function restoreReservation(
  locationId: string,
  reservationId: string,
): Promise<Reservation> {
  const response = await apiClient.post<ReservationDto>(
    `/locations/${locationId}/reservations/${reservationId}/restore`,
    {},
  );
  return adaptReservation(response.data);
}

export async function fetchReservationDensity(
  locationId: string,
  input: { dateFrom: string; dateTo: string; includeArchived?: boolean },
): Promise<ReservationDensityResponse> {
  const response = await apiClient.get<ReservationDensityResponseDto>(
    `/locations/${locationId}/reservations/density`,
    {
      params: {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        includeArchived: input.includeArchived ?? false,
      },
    },
  );
  return adaptReservationDensity(response.data);
}

export async function fetchReservationAvailability(
  locationId: string,
  input: ReservationAvailabilityInput,
): Promise<ReservationAvailability> {
  const response = await apiClient.get<ReservationAvailabilityDto>(
    `/locations/${locationId}/availability`,
    {
      params: {
        service_date: toBackendServiceDate(input.date),
        party_size: input.partySize,
        channel: toBackendReservationSource(input.channel),
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
