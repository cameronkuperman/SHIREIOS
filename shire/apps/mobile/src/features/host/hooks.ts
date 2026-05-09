import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Reservation,
  ReservationAction,
  ReservationAvailability,
  ReservationSettings,
  SeatingPreference,
  WaitlistEntry,
  WaitlistStatus,
} from '@shire/shared';
import { useAuth } from '@/features/auth';
import { useIsWorkdayActive } from '@/features/workday';
import { queryKeys } from '@/services/api/queryKeys';
import {
  createReservation,
  createWaitlistEntry,
  fetchReservationAvailability,
  fetchReservationSettings,
  fetchReservations,
  runReservationAction,
  fetchWaitlist,
  updateReservation,
  runWaitlistAction,
  updateWaitlistEntry,
  type ReservationActionInput,
  type CreateReservationInput,
  type CreateWaitlistInput,
  type ReservationAvailabilityInput,
  type ReservationListFilters,
  type UpdateReservationInput,
  type UpdateWaitlistInput,
  type WaitlistAction,
} from './api';
import {
  selectActiveWaitlistEntries,
  upsertReservation,
  upsertWaitlistEntry,
} from './contracts';
import { usePendingSeatStore } from './pendingSeatStore';
import { getReservationSourceLabel } from './source';

const FALLBACK_WAITLIST_REFETCH_MS = 15_000;
const FALLBACK_RESERVATIONS_REFETCH_MS = 60_000;

export type HostSidebarStatus = 'Waiting' | 'Arrived' | 'Booked' | 'Confirmed' | 'Checked In';
export type HostSidebarSource = 'waitlist' | 'reservations';

export interface HostSidebarParty {
  id: string;
  source: HostSidebarSource;
  sourceLabel: string;
  name: string;
  phone: string;
  size: number;
  status: HostSidebarStatus;
  seatingPreference: SeatingPreference;
  joinedAt: string | null;
  waitLabel: string;
  notes: string;
}

function isReservationVisibleOnHost(reservation: Reservation): boolean {
  return !['seated', 'completed', 'canceled', 'no_show'].includes(reservation.status);
}

function getPendingSeatIds(
  pendingSeats: Record<string, { entityId: string; tableId: string; source: HostSidebarSource }>,
  source?: HostSidebarSource,
) {
  return new Set(
    Object.values(pendingSeats)
      .filter((entry) => !source || entry.source === source)
      .map((entry) => entry.entityId),
  );
}

function useLocationId(): string | null {
  const { currentLocation } = useAuth();
  return currentLocation?.id ?? null;
}

export function waitlistToSidebarParty(entry: WaitlistEntry): HostSidebarParty {
  return {
    id: entry.id,
    source: 'waitlist',
    sourceLabel: 'Waitlist',
    name: entry.guest.name,
    phone: entry.guest.phone,
    size: entry.partySize,
    status: entry.status === 'arrived' ? 'Arrived' : 'Waiting',
    seatingPreference: entry.seatingPreference,
    joinedAt: entry.joinedAt,
    waitLabel: entry.quotedWaitMinutes != null ? `${entry.quotedWaitMinutes}m` : 'TBD',
    notes: entry.notes,
  };
}

function reservationStatusLabel(status: Reservation['status']): HostSidebarStatus {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'checked_in':
      return 'Checked In';
    case 'seated':
      return 'Arrived';
    default:
      return 'Booked';
  }
}

function formatReservationWaitLabel(timeSlot: string): string {
  const [hoursRaw = '0', minutesRaw = '00'] = timeSlot.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

export function reservationToSidebarParty(reservation: Reservation): HostSidebarParty {
  return {
    id: reservation.id,
    source: 'reservations',
    sourceLabel: getReservationSourceLabel(reservation.source) ?? 'Reservation',
    name: reservation.guestName,
    phone: reservation.guestPhone,
    size: reservation.partySize,
    status: reservationStatusLabel(reservation.status),
    seatingPreference: reservation.seatingPreference,
    joinedAt: null,
    waitLabel: formatReservationWaitLabel(reservation.timeSlot),
    notes: reservation.internalNotes || reservation.specialRequests || reservation.notes,
  };
}

export function useWaitlist() {
  const locationId = useLocationId();
  const isWorkdayActive = useIsWorkdayActive(locationId);
  const pendingSeats = usePendingSeatStore((state) => state.pendingSeats);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: locationId ? queryKeys.waitlist.list(locationId) : ['waitlist', 'disabled'],
    queryFn: () => fetchWaitlist(locationId!),
    enabled: !!locationId && isWorkdayActive,
    // Keep polling even while connected so the queue does not depend on waitlist websocket events.
    refetchInterval: FALLBACK_WAITLIST_REFETCH_MS,
    refetchOnReconnect: true,
    select: (entries) => {
      const pendingWaitlistIds = getPendingSeatIds(pendingSeats, 'waitlist');
      return entries.filter((entry) => !pendingWaitlistIds.has(entry.id));
    },
  });

  useEffect(() => {
    if (!locationId || !isWorkdayActive) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.list(locationId) });
    });

    return () => {
      subscription.remove();
    };
  }, [isWorkdayActive, locationId, queryClient]);

  return query;
}

function invalidateWaitlistQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.list(locationId) });
}

function invalidateReservationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.location(locationId) });
}

export function useWaitlistMutations() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  const patchWaitlistEntry = (entry: WaitlistEntry) => {
    if (!locationId) {
      return;
    }

    queryClient.setQueryData<WaitlistEntry[]>(
      queryKeys.waitlist.list(locationId),
      (currentEntries) => upsertWaitlistEntry(currentEntries ?? [], entry),
    );
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateWaitlistInput) => createWaitlistEntry(locationId!, input),
    onSuccess: (entry) => {
      if (locationId) {
        patchWaitlistEntry(entry);
        invalidateWaitlistQuery(queryClient, locationId);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      waitlistEntryId,
      input,
    }: {
      waitlistEntryId: string;
      input: UpdateWaitlistInput;
    }) => updateWaitlistEntry(locationId!, waitlistEntryId, input),
    onSuccess: (entry) => {
      if (locationId) {
        patchWaitlistEntry(entry);
        invalidateWaitlistQuery(queryClient, locationId);
      }
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({
      waitlistEntryId,
      action,
    }: {
      waitlistEntryId: string;
      action: WaitlistAction;
    }) => runWaitlistAction(locationId!, waitlistEntryId, action),
    onSuccess: (entry) => {
      if (locationId) {
        patchWaitlistEntry(entry);
        invalidateWaitlistQuery(queryClient, locationId);
      }
    },
  });

  return {
    createWaitlistEntry: createMutation.mutateAsync,
    updateWaitlistEntry: updateMutation.mutateAsync,
    runWaitlistAction: actionMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending || actionMutation.isPending,
  };
}

export function useReservations(filters: ReservationListFilters = {}) {
  const locationId = useLocationId();
  const isWorkdayActive = useIsWorkdayActive(locationId);
  const pendingSeats = usePendingSeatStore((state) => state.pendingSeats);

  return useQuery({
    queryKey: locationId
      ? queryKeys.reservations.list(locationId, filters)
      : ['reservations', 'disabled'],
    queryFn: () => fetchReservations(locationId!, filters),
    enabled: !!locationId && isWorkdayActive,
    refetchInterval: FALLBACK_RESERVATIONS_REFETCH_MS,
    refetchOnReconnect: true,
    select: (reservations) => {
      const pendingReservationIds = getPendingSeatIds(pendingSeats, 'reservations');
      return reservations.filter((reservation) => !pendingReservationIds.has(reservation.id));
    },
  });
}

export function useReservationDayBook(date: string) {
  const reservationsQuery = useReservations({ date });

  return useMemo(
    () =>
      (reservationsQuery.data ?? []).sort((left, right) => left.timeSlot.localeCompare(right.timeSlot)),
    [reservationsQuery.data],
  );
}

export function useReservationDetail(reservationId: string | null, date?: string) {
  const reservationBook = useReservationDayBook(date ?? new Date().toISOString().slice(0, 10));
  const queryClient = useQueryClient();
  const locationId = useLocationId();

  return useMemo(() => {
    if (!reservationId) {
      return null;
    }

    const currentDayReservation = reservationBook.find((reservation) => reservation.id === reservationId);
    if (currentDayReservation) {
      return currentDayReservation;
    }

    if (!locationId) {
      return null;
    }

    const locationQueries = queryClient.getQueriesData<Reservation[]>({
      queryKey: queryKeys.reservations.location(locationId),
    });

    for (const [, reservations] of locationQueries) {
      const match = reservations?.find((reservation) => reservation.id === reservationId) ?? null;
      if (match) {
        return match;
      }
    }

    return null;
  }, [locationId, queryClient, reservationBook, reservationId]);
}

export function useReservationMutations() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (input: CreateReservationInput) => createReservation(locationId!, input),
    onSuccess: (reservation) => {
      if (!locationId) {
        return;
      }

      queryClient.setQueryData<Reservation[]>(
        queryKeys.reservations.list(locationId, { date: reservation.date }),
        (currentReservations) => upsertReservation(currentReservations ?? [], reservation),
      );
      invalidateReservationQueries(queryClient, locationId);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      reservationId,
      input,
    }: {
      reservationId: string;
      input: UpdateReservationInput;
    }) => updateReservation(locationId!, reservationId, input),
    onSuccess: () => {
      if (locationId) {
        invalidateReservationQueries(queryClient, locationId);
      }
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({
      reservationId,
      action,
      input,
    }: {
      reservationId: string;
      action: ReservationAction;
      input?: ReservationActionInput;
    }) => runReservationAction(locationId!, reservationId, action, input),
    onSuccess: () => {
      if (locationId) {
        invalidateReservationQueries(queryClient, locationId);
      }
    },
  });

  return {
    createReservation: createMutation.mutateAsync,
    updateReservation: updateMutation.mutateAsync,
    runReservationAction: actionMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending || actionMutation.isPending,
  };
}

export function useReservationAvailability(
  input: ReservationAvailabilityInput | null,
): ReservationAvailability | null {
  const locationId = useLocationId();
  const isWorkdayActive = useIsWorkdayActive(locationId);

  const query = useQuery({
    queryKey:
      locationId && input
        ? queryKeys.reservations.availability(locationId, input)
        : ['reservations', 'availability', 'disabled'],
    queryFn: () => fetchReservationAvailability(locationId!, input!),
    enabled: !!locationId && !!input && isWorkdayActive,
    retry: false,
    staleTime: 15_000,
  });

  return query.data ?? null;
}

export function useReservationSettings(): ReservationSettings | null {
  const locationId = useLocationId();
  const isWorkdayActive = useIsWorkdayActive(locationId);

  const query = useQuery({
    queryKey: locationId ? queryKeys.reservations.settings(locationId) : ['reservations', 'settings'],
    queryFn: () => fetchReservationSettings(locationId!),
    enabled: !!locationId && isWorkdayActive,
    retry: false,
    staleTime: 5 * 60_000,
  });

  return query.data ?? null;
}

export function useActiveWaitlistEntries(): WaitlistEntry[] {
  const waitlistQuery = useWaitlist();

  return useMemo(() => selectActiveWaitlistEntries(waitlistQuery.data ?? []), [waitlistQuery.data]);
}

export function useFloorSidebarParties() {
  const waitlist = useActiveWaitlistEntries();
  const today = new Date().toISOString().slice(0, 10);
  const reservations = useReservationDayBook(today);

  return useMemo(() => {
    const waitlistParties = waitlist.map(waitlistToSidebarParty);
    const reservationParties = reservations
      .filter(isReservationVisibleOnHost)
      .map(reservationToSidebarParty);
    return [...waitlistParties, ...reservationParties];
  }, [reservations, waitlist]);
}

export function waitlistStatusLabel(status: WaitlistStatus): HostSidebarStatus {
  switch (status) {
    case 'arrived':
      return 'Arrived';
    default:
      return 'Waiting';
  }
}
