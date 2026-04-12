import type {
  MessageDelivery,
  Reservation,
  ReservationAvailability,
  ReservationAvailabilitySlot,
  ReservationSettings,
  ReservationSource,
  ReservationStatus,
  WaitlistEntry,
} from '@shire/shared';

export interface WaitlistEntryDto {
  id: string;
  guest: {
    id: string;
    name: string;
    phone: string;
  };
  partySize: number;
  seatingPreference: WaitlistEntry['seatingPreference'];
  status: WaitlistEntry['status'];
  notes?: string | null;
  source: WaitlistEntry['source'];
  joinedAt: string;
  quotedWaitMinutes: number | null;
  arrivedAt?: string | null;
  seatedAt?: string | null;
  removedAt?: string | null;
  noShowAt?: string | null;
  assignedTableId?: string | null;
  createdAt: string;
  updatedAt: string;
}

type ReservationStatusDto = ReservationStatus | 'pending' | 'arrived' | 'cancelled';
type ReservationSourceDto =
  | ReservationSource
  | 'host'
  | 'public_web'
  | 'public_app'
  | null
  | undefined;

export interface ReservationDto {
  id: string;
  guestId?: string | null;
  guest?: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
  } | null;
  guestName?: string | null;
  guestPhone?: string | null;
  partySize: number;
  serviceDate?: string | null;
  date?: string | null;
  reservationTime?: string | null;
  timeSlot?: string | null;
  seatingPreference?: Reservation['seatingPreference'] | null;
  status: ReservationStatusDto;
  notes?: string | null;
  specialRequests?: string | null;
  internalNotes?: string | null;
  notesInternal?: string | null;
  source?: ReservationSourceDto;
  channel?: ReservationSourceDto;
  linkedVisitId?: string | null;
  assignedTableId?: string | null;
  pacingOverrideApplied?: boolean | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  checkedInAt?: string | null;
  seatedAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
  noShowAt?: string | null;
  messageDelivery?: MessageDeliveryDto | null;
}

export interface ReservationListResponseDto {
  reservations: ReservationDto[];
}

export interface MessageDeliveryDto {
  channel: 'sms';
  status: MessageDelivery['status'];
  destinationMasked?: string | null;
  updatedAt?: string | null;
  errorMessage?: string | null;
}

export interface ReservationAvailabilitySlotDto {
  timeSlot?: string | null;
  reservationTime?: string | null;
  available?: boolean | null;
  isAvailable?: boolean | null;
  reason?: string | null;
  servicePeriodId?: string | null;
  servicePeriodName?: string | null;
  canOverridePacing?: boolean | null;
}

export interface ReservationAvailabilityDto {
  date: string;
  partySize: number;
  channel?: ReservationSourceDto;
  timezone?: string | null;
  slots: ReservationAvailabilitySlotDto[];
}

export interface ReservationSettingsDto {
  locationId?: string;
  bookingHorizonDays?: number | null;
  gracePeriodMinutes?: number | null;
  leadTimeMinutes?: number | null;
  sameDayCutoffMinutes?: number | null;
  defaultChannel?: ReservationSourceDto;
  updatedAt?: string | null;
}

function normalizeReservationStatus(status: ReservationStatusDto): ReservationStatus {
  switch (status) {
    case 'pending':
      return 'booked';
    case 'arrived':
      return 'checked_in';
    case 'cancelled':
      return 'canceled';
    default:
      return status;
  }
}

function normalizeReservationSource(source: ReservationSourceDto): ReservationSource {
  switch (source) {
    case 'host':
      return 'manual';
    case 'public_web':
    case 'public_app':
      return 'web';
    case 'manual':
    case 'phone':
    case 'web':
    case 'walk_in':
    case 'yelp':
    case 'google':
    case 'opentable':
    case 'resy':
    case 'sevenrooms':
    case 'import':
      return source;
    default:
      return 'manual';
  }
}

function normalizeSeatingPreference(
  seatingPreference: Reservation['seatingPreference'] | null | undefined,
): Reservation['seatingPreference'] {
  switch (seatingPreference) {
    case 'window':
    case 'bar':
    case 'booth':
    case 'patio':
      return seatingPreference;
    default:
      return 'none';
  }
}

function adaptMessageDelivery(messageDelivery?: MessageDeliveryDto | null): MessageDelivery | null {
  if (!messageDelivery) {
    return null;
  }

  return {
    channel: messageDelivery.channel,
    status: messageDelivery.status,
    destinationMasked: messageDelivery.destinationMasked ?? null,
    updatedAt: messageDelivery.updatedAt ?? null,
    errorMessage: messageDelivery.errorMessage ?? null,
  };
}

export function adaptWaitlistEntry(entry: WaitlistEntryDto): WaitlistEntry {
  return {
    id: entry.id,
    guest: entry.guest,
    partySize: entry.partySize,
    seatingPreference: entry.seatingPreference,
    status: entry.status,
    notes: entry.notes ?? '',
    source: entry.source,
    joinedAt: entry.joinedAt,
    quotedWaitMinutes: entry.quotedWaitMinutes,
    arrivedAt: entry.arrivedAt ?? null,
    seatedAt: entry.seatedAt ?? null,
    removedAt: entry.removedAt ?? null,
    noShowAt: entry.noShowAt ?? null,
    assignedTableId: entry.assignedTableId ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function adaptReservation(entry: ReservationDto): Reservation {
  const guestName = entry.guestName?.trim() || entry.guest?.name?.trim() || 'Guest';
  const guestPhone = entry.guestPhone?.trim() || entry.guest?.phone?.trim() || '';
  const serviceDate = entry.date ?? entry.serviceDate ?? '';
  const reservationTime = entry.timeSlot ?? entry.reservationTime ?? '';
  const guestId = entry.guest?.id ?? entry.guestId ?? null;
  const notes = entry.notes ?? entry.specialRequests ?? '';
  const internalNotes = entry.internalNotes ?? entry.notesInternal ?? '';

  return {
    id: entry.id,
    guestId,
    guest: guestId
      ? {
          id: guestId,
          name: guestName,
          phone: guestPhone,
        }
      : null,
    guestName,
    guestPhone,
    partySize: entry.partySize,
    date: serviceDate,
    timeSlot: reservationTime,
    seatingPreference: normalizeSeatingPreference(entry.seatingPreference),
    status: normalizeReservationStatus(entry.status),
    notes,
    specialRequests: entry.specialRequests ?? '',
    internalNotes,
    source: normalizeReservationSource(entry.source ?? entry.channel),
    linkedVisitId: entry.linkedVisitId ?? null,
    assignedTableId: entry.assignedTableId ?? null,
    pacingOverrideApplied: Boolean(entry.pacingOverrideApplied),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    confirmedAt: entry.confirmedAt ?? null,
    checkedInAt: entry.checkedInAt ?? null,
    seatedAt: entry.seatedAt ?? null,
    completedAt: entry.completedAt ?? null,
    canceledAt: entry.canceledAt ?? null,
    noShowAt: entry.noShowAt ?? null,
    messageDelivery: adaptMessageDelivery(entry.messageDelivery),
  };
}

export function adaptReservationAvailabilitySlot(
  slot: ReservationAvailabilitySlotDto,
): ReservationAvailabilitySlot {
  return {
    timeSlot: slot.timeSlot ?? slot.reservationTime ?? '',
    available: slot.available ?? slot.isAvailable ?? false,
    reason: slot.reason ?? null,
    servicePeriodId: slot.servicePeriodId ?? null,
    servicePeriodName: slot.servicePeriodName ?? null,
    canOverridePacing: Boolean(slot.canOverridePacing),
  };
}

export function adaptReservationAvailability(
  availability: ReservationAvailabilityDto,
): ReservationAvailability {
  return {
    date: availability.date,
    partySize: availability.partySize,
    channel: normalizeReservationSource(availability.channel),
    timezone: availability.timezone ?? null,
    slots: availability.slots.map(adaptReservationAvailabilitySlot),
  };
}

export function adaptReservationSettings(settings: ReservationSettingsDto): ReservationSettings {
  return {
    locationId: settings.locationId ?? '',
    bookingHorizonDays: settings.bookingHorizonDays ?? 30,
    gracePeriodMinutes: settings.gracePeriodMinutes ?? 15,
    leadTimeMinutes: settings.leadTimeMinutes ?? 0,
    sameDayCutoffMinutes: settings.sameDayCutoffMinutes ?? null,
    defaultChannel: normalizeReservationSource(settings.defaultChannel),
    updatedAt: settings.updatedAt ?? null,
  };
}

export function upsertWaitlistEntry(
  entries: WaitlistEntry[],
  nextEntry: WaitlistEntry,
): WaitlistEntry[] {
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
  const nextEntries =
    existingIndex === -1
      ? [...entries, nextEntry]
      : entries.map((entry, index) => (index === existingIndex ? nextEntry : entry));

  return nextEntries.sort(
    (left, right) => new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime(),
  );
}

function compareReservations(left: Reservation, right: Reservation): number {
  const leftKey = `${left.date}T${left.timeSlot}`;
  const rightKey = `${right.date}T${right.timeSlot}`;
  return leftKey.localeCompare(rightKey);
}

export function upsertReservation(
  reservations: Reservation[],
  nextReservation: Reservation,
): Reservation[] {
  const existingIndex = reservations.findIndex((reservation) => reservation.id === nextReservation.id);
  const nextReservations =
    existingIndex === -1
      ? [...reservations, nextReservation]
      : reservations.map((reservation, index) =>
          index === existingIndex ? nextReservation : reservation,
        );

  return nextReservations.sort(compareReservations);
}

export function markWaitlistEntrySeated(
  entries: WaitlistEntry[],
  waitlistEntryId: string,
  tableId: string,
  seatedAt: string,
): WaitlistEntry[] {
  return entries.map((entry) =>
    entry.id === waitlistEntryId
      ? {
          ...entry,
          status: 'seated',
          assignedTableId: tableId,
          seatedAt,
          updatedAt: seatedAt,
        }
      : entry,
  );
}

export function markReservationSeated(
  reservations: Reservation[],
  reservationId: string,
  tableId: string,
  seatedAt: string,
  linkedVisitId?: string | null,
): Reservation[] {
  return reservations.map((reservation) =>
    reservation.id === reservationId
      ? {
          ...reservation,
          status: 'seated',
          assignedTableId: tableId,
          linkedVisitId: linkedVisitId ?? reservation.linkedVisitId ?? null,
          seatedAt,
          updatedAt: seatedAt,
        }
      : reservation,
  );
}
