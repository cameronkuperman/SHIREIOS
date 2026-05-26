import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  Reservation,
  ReservationAction,
  ReservationAvailability,
  ReservationDensityResponse,
  ReservationSettings,
  SeatingPreference,
  WaitlistEntry,
  WaitlistStatus,
} from '@shire/shared';
import { useAuth } from '@/features/auth';
import { useFloorStore } from '@/features/floor';
import { useIsWorkdayActive } from '@/features/workday';
import { queryKeys } from '@/services/api/queryKeys';
import { usePolling } from '@/lib/usePolling';
import {
  createReservation,
  createWaitlistEntry,
  archiveReservation,
  fetchReservationAvailability,
  fetchReservationDensity,
  fetchReservationSettings,
  fetchReservations,
  fetchShiftAnalytics,
  removeDuplicateReservation,
  restoreReservation,
  runReservationAction,
  fetchWaitlist,
  updateReservationSchedule,
  updateReservation,
  runWaitlistAction,
  updateWaitlistEntry,
  type ReservationActionInput,
  type ArchiveReservationInput,
  type CreateReservationInput,
  type CreateWaitlistInput,
  type HostAnalyticsRange,
  type ReservationAvailabilityInput,
  type ReservationListFilters,
  type ReservationScheduleInput,
  type UpdateReservationInput,
  type UpdateWaitlistInput,
  type WaitlistAction,
} from './api';
import { selectActiveWaitlistEntries, upsertReservation, upsertWaitlistEntry } from './contracts';
import { getReservationSourceLabel } from './source';

const FALLBACK_WAITLIST_REFETCH_MS = 15_000;
const FALLBACK_RESERVATIONS_REFETCH_MS = 60_000;
const FALLBACK_ANALYTICS_REFETCH_MS = 30_000;

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
  quotedWaitMinutes: number | null;
  notes: string;
}

function isReservationVisibleOnHost(reservation: Reservation): boolean {
  return !['seated', 'completed', 'canceled', 'no_show'].includes(reservation.status);
}

function useLocationId(): string | null {
  const { currentLocation } = useAuth();
  return currentLocation?.id ?? null;
}

function useIsRealtimeHealthy(): boolean {
  return useFloorStore((state) => state.connectionState === 'connected');
}

function createOptimisticId(prefix: string): string {
  return `${prefix}-optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rollbackQuerySnapshots<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: [QueryKey, T | undefined][],
) {
  for (const [queryKey, data] of snapshots) {
    queryClient.setQueryData(queryKey, data);
  }
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
    quotedWaitMinutes: entry.quotedWaitMinutes,
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
    quotedWaitMinutes: null,
    notes: reservation.internalNotes || reservation.specialRequests || reservation.notes,
  };
}

export function useWaitlist() {
  const locationId = useLocationId();
  const isWorkdayActive = useIsWorkdayActive(locationId);
  const isRealtimeHealthy = useIsRealtimeHealthy();
  const queryClient = useQueryClient();
  const queryRef = useRef<() => void>(() => undefined);
  const polling = usePolling(() => queryRef.current(), {
    foregroundMs: FALLBACK_WAITLIST_REFETCH_MS,
    backgroundMs: FALLBACK_WAITLIST_REFETCH_MS,
    enabled: !!locationId && isWorkdayActive && !isRealtimeHealthy,
  });

  const query = useQuery({
    queryKey: locationId ? queryKeys.waitlist.list(locationId) : ['waitlist', 'disabled'],
    queryFn: () => fetchWaitlist(locationId!),
    enabled: !!locationId && isWorkdayActive,
    ...polling,
  });

  queryRef.current = () => {
    void query.refetch();
  };

  useEffect(() => {
    if (!locationId || !isWorkdayActive) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }

      if (!isRealtimeHealthy) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.list(locationId) });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isRealtimeHealthy, isWorkdayActive, locationId, queryClient]);

  return query;
}

export function useHostShiftAnalytics(range: HostAnalyticsRange) {
  const locationId = useLocationId();
  const queryRef = useRef<() => void>(() => undefined);
  const polling = usePolling(() => queryRef.current(), {
    foregroundMs: FALLBACK_ANALYTICS_REFETCH_MS,
    backgroundMs: FALLBACK_ANALYTICS_REFETCH_MS,
    enabled: !!locationId,
  });

  const query = useQuery({
    queryKey: locationId
      ? queryKeys.analytics.shift(locationId, range)
      : ['analytics', 'shift', 'disabled', range],
    queryFn: () => fetchShiftAnalytics(locationId!, range),
    enabled: !!locationId,
    placeholderData: (previousData) => previousData,
    retry: false,
    staleTime: 30_000,
    ...polling,
  });

  queryRef.current = () => {
    void query.refetch();
  };

  return query;
}

const DEFAULT_ANALYTICS_PREFETCH_RANGES: readonly HostAnalyticsRange[] = ['current_shift'];

export function usePrefetchHostShiftAnalytics(
  ranges: readonly HostAnalyticsRange[] = DEFAULT_ANALYTICS_PREFETCH_RANGES,
) {
  const locationId = useLocationId();
  const isWorkdayActive = useIsWorkdayActive(locationId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!locationId || !isWorkdayActive) {
      return;
    }

    for (const range of ranges) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.analytics.shift(locationId, range),
        queryFn: () => fetchShiftAnalytics(locationId, range),
        retry: false,
        staleTime: 30_000,
      });
    }
  }, [isWorkdayActive, locationId, queryClient, ranges]);
}

function invalidateReservationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.location(locationId) });
}

function snapshotReservationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
): [QueryKey, Reservation[] | undefined][] {
  return queryClient
    .getQueriesData<unknown>({
      queryKey: queryKeys.reservations.location(locationId),
    })
    .filter((entry): entry is [QueryKey, Reservation[]] => Array.isArray(entry[1]));
}

function patchReservationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
  reservation: Reservation,
  options: { previousId?: string; insertIfDateList?: boolean } = {},
) {
  queryClient.setQueriesData<Reservation[]>(
    { queryKey: queryKeys.reservations.location(locationId) },
    (currentReservations) => {
      if (!Array.isArray(currentReservations)) {
        return currentReservations;
      }

      const hasPrevious = options.previousId
        ? currentReservations.some(
            (currentReservation) => currentReservation.id === options.previousId,
          )
        : false;
      const hasReservation = currentReservations.some(
        (currentReservation) => currentReservation.id === reservation.id,
      );
      const isMatchingDateList =
        options.insertIfDateList &&
        currentReservations.every(
          (currentReservation) => currentReservation.date === reservation.date,
        );

      if (!hasPrevious && !hasReservation && !isMatchingDateList) {
        return currentReservations;
      }

      const withoutPrevious = options.previousId
        ? currentReservations.filter(
            (currentReservation) => currentReservation.id !== options.previousId,
          )
        : currentReservations;

      return upsertReservation(withoutPrevious, reservation);
    },
  );
}

function removeReservationFromQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
  reservationId: string,
) {
  queryClient.setQueriesData<Reservation[]>(
    { queryKey: queryKeys.reservations.location(locationId) },
    (currentReservations) =>
      Array.isArray(currentReservations)
        ? currentReservations.filter((reservation) => reservation.id !== reservationId)
        : currentReservations,
  );
}

function findCachedReservation(
  queryClient: ReturnType<typeof useQueryClient>,
  locationId: string,
  reservationId: string,
): Reservation | null {
  const locationQueries = snapshotReservationQueries(queryClient, locationId);
  for (const [, reservations] of locationQueries) {
    if (!Array.isArray(reservations)) {
      continue;
    }
    const match = reservations?.find((reservation) => reservation.id === reservationId) ?? null;
    if (match) {
      return match;
    }
  }
  return null;
}

function buildOptimisticWaitlistEntry(input: CreateWaitlistInput): WaitlistEntry {
  const createdAt = nowIso();
  return {
    id: createOptimisticId('waitlist'),
    guest: {
      id: createOptimisticId('guest'),
      name: input.guestName.trim(),
      phone: input.guestPhone.trim(),
    },
    partySize: input.partySize,
    seatingPreference: input.seatingPreference,
    status: 'waiting',
    notes: input.notes ?? '',
    source: input.source,
    joinedAt: createdAt,
    quotedWaitMinutes: input.quotedWaitMinutes ?? null,
    arrivedAt: null,
    seatedAt: null,
    removedAt: null,
    noShowAt: null,
    assignedTableId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function applyWaitlistInput(entry: WaitlistEntry, input: UpdateWaitlistInput): WaitlistEntry {
  return {
    ...entry,
    ...(input.partySize != null ? { partySize: input.partySize } : {}),
    ...(input.seatingPreference ? { seatingPreference: input.seatingPreference } : {}),
    ...(input.notes != null ? { notes: input.notes } : {}),
    ...(input.quotedWaitMinutes !== undefined
      ? { quotedWaitMinutes: input.quotedWaitMinutes ?? null }
      : {}),
    updatedAt: nowIso(),
  };
}

function applyWaitlistAction(entry: WaitlistEntry, action: WaitlistAction): WaitlistEntry {
  const updatedAt = nowIso();
  switch (action) {
    case 'arrive':
      return { ...entry, status: 'arrived', arrivedAt: updatedAt, updatedAt };
    case 'remove':
      return { ...entry, status: 'removed', removedAt: updatedAt, updatedAt };
    case 'mark_no_show':
      return { ...entry, status: 'no_show', noShowAt: updatedAt, updatedAt };
    case 'seat':
      return { ...entry, status: 'seated', seatedAt: updatedAt, updatedAt };
    default:
      return { ...entry, updatedAt };
  }
}

function replaceWaitlistEntry(
  entries: WaitlistEntry[],
  entry: WaitlistEntry,
  previousId?: string,
): WaitlistEntry[] {
  const withoutPrevious = previousId
    ? entries.filter((currentEntry) => currentEntry.id !== previousId)
    : entries;
  return upsertWaitlistEntry(withoutPrevious, entry);
}

function buildOptimisticReservation(input: CreateReservationInput): Reservation {
  const createdAt = nowIso();
  return {
    id: input.clientRequestId?.trim() || createOptimisticId('reservation'),
    guestId: null,
    guest: null,
    guestName: input.guestName.trim(),
    guestPhone: input.guestPhone.trim(),
    partySize: input.partySize,
    date: input.date.trim().slice(0, 10),
    timeSlot: input.timeSlot.trim().slice(0, 5),
    seatingPreference: input.seatingPreference,
    status: 'booked',
    notes: input.notes ?? input.specialRequests ?? '',
    specialRequests: input.specialRequests ?? '',
    internalNotes: input.internalNotes ?? '',
    source: input.source,
    linkedVisitId: null,
    assignedTableId: null,
    pacingOverrideApplied: Boolean(input.pacingOverride),
    createdAt,
    updatedAt: createdAt,
    confirmedAt: null,
    checkedInAt: null,
    seatedAt: null,
    completedAt: null,
    canceledAt: null,
    noShowAt: null,
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    messageDelivery: null,
  };
}

function applyReservationInput(
  reservation: Reservation,
  input: UpdateReservationInput,
): Reservation {
  return {
    ...reservation,
    ...(input.guestName != null ? { guestName: input.guestName.trim() } : {}),
    ...(input.guestPhone != null ? { guestPhone: input.guestPhone.trim() } : {}),
    ...(input.partySize != null ? { partySize: input.partySize } : {}),
    ...(input.date != null ? { date: input.date.trim().slice(0, 10) } : {}),
    ...(input.timeSlot != null ? { timeSlot: input.timeSlot.trim().slice(0, 5) } : {}),
    ...(input.seatingPreference ? { seatingPreference: input.seatingPreference } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.notes != null ? { notes: input.notes } : {}),
    ...(input.specialRequests != null ? { specialRequests: input.specialRequests } : {}),
    ...(input.internalNotes != null ? { internalNotes: input.internalNotes } : {}),
    ...(input.pacingOverride != null ? { pacingOverrideApplied: input.pacingOverride } : {}),
    updatedAt: nowIso(),
  };
}

function applyReservationAction(
  reservation: Reservation,
  action: ReservationAction,
  input?: ReservationActionInput,
): Reservation {
  const updatedAt = nowIso();
  switch (action) {
    case 'confirm':
      return { ...reservation, status: 'confirmed', confirmedAt: updatedAt, updatedAt };
    case 'arrive':
    case 'check_in':
      return { ...reservation, status: 'checked_in', checkedInAt: updatedAt, updatedAt };
    case 'seat':
      return {
        ...reservation,
        status: 'seated',
        assignedTableId: input?.tableId ?? reservation.assignedTableId,
        seatedAt: updatedAt,
        updatedAt,
      };
    case 'complete':
      return { ...reservation, status: 'completed', completedAt: updatedAt, updatedAt };
    case 'cancel':
      return { ...reservation, status: 'canceled', canceledAt: updatedAt, updatedAt };
    case 'mark_no_show':
      return { ...reservation, status: 'no_show', noShowAt: updatedAt, updatedAt };
    default:
      return { ...reservation, updatedAt };
  }
}

export function useWaitlistMutations() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  const patchWaitlistEntry = (entry: WaitlistEntry, previousId?: string) => {
    if (!locationId) {
      return;
    }

    queryClient.setQueryData<WaitlistEntry[]>(
      queryKeys.waitlist.list(locationId),
      (currentEntries) => replaceWaitlistEntry(currentEntries ?? [], entry, previousId),
    );
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateWaitlistInput) => createWaitlistEntry(locationId!, input),
    onMutate: async (input) => {
      if (!locationId) {
        return;
      }

      const queryKey = queryKeys.waitlist.list(locationId);
      await queryClient.cancelQueries({ queryKey });
      const previousEntries = queryClient.getQueryData<WaitlistEntry[]>(queryKey);
      const optimisticEntry = buildOptimisticWaitlistEntry(input);
      queryClient.setQueryData<WaitlistEntry[]>(queryKey, (currentEntries) =>
        upsertWaitlistEntry(currentEntries ?? [], optimisticEntry),
      );

      return { optimisticId: optimisticEntry.id, previousEntries };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      queryClient.setQueryData(queryKeys.waitlist.list(locationId), context.previousEntries);
    },
    onSuccess: (entry, _input, context) => {
      if (locationId) {
        patchWaitlistEntry(entry, context?.optimisticId);
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
    onMutate: async ({ waitlistEntryId, input }) => {
      if (!locationId) {
        return;
      }

      const queryKey = queryKeys.waitlist.list(locationId);
      await queryClient.cancelQueries({ queryKey });
      const previousEntries = queryClient.getQueryData<WaitlistEntry[]>(queryKey);
      queryClient.setQueryData<WaitlistEntry[]>(queryKey, (currentEntries) =>
        currentEntries?.map((entry) =>
          entry.id === waitlistEntryId ? applyWaitlistInput(entry, input) : entry,
        ),
      );

      return { previousEntries };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      queryClient.setQueryData(queryKeys.waitlist.list(locationId), context.previousEntries);
    },
    onSuccess: (entry) => {
      if (locationId) {
        patchWaitlistEntry(entry);
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
    onMutate: async ({ waitlistEntryId, action }) => {
      if (!locationId) {
        return;
      }

      const queryKey = queryKeys.waitlist.list(locationId);
      await queryClient.cancelQueries({ queryKey });
      const previousEntries = queryClient.getQueryData<WaitlistEntry[]>(queryKey);
      queryClient.setQueryData<WaitlistEntry[]>(queryKey, (currentEntries) =>
        currentEntries?.map((entry) =>
          entry.id === waitlistEntryId ? applyWaitlistAction(entry, action) : entry,
        ),
      );

      return { previousEntries };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      queryClient.setQueryData(queryKeys.waitlist.list(locationId), context.previousEntries);
    },
    onSuccess: (entry) => {
      if (locationId) {
        patchWaitlistEntry(entry);
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
  const isRealtimeHealthy = useIsRealtimeHealthy();
  const queryRef = useRef<() => void>(() => undefined);
  const polling = usePolling(() => queryRef.current(), {
    foregroundMs: FALLBACK_RESERVATIONS_REFETCH_MS,
    backgroundMs: FALLBACK_RESERVATIONS_REFETCH_MS,
    enabled: !!locationId && isWorkdayActive && !isRealtimeHealthy,
  });

  const query = useQuery({
    queryKey: locationId
      ? queryKeys.reservations.list(locationId, filters)
      : ['reservations', 'disabled'],
    queryFn: () => fetchReservations(locationId!, filters),
    enabled: !!locationId && isWorkdayActive,
    ...polling,
  });

  queryRef.current = () => {
    void query.refetch();
  };

  return query;
}

/**
 * Mock: surface a table suggestion on the first few upcoming reservations so
 * hosts can pre-block a table. Remove once the backend returns a real
 * `suggestedTableId` on the reservation payload.
 */
function withMockTableSuggestions(reservations: Reservation[], tableIds: string[]): Reservation[] {
  if (tableIds.length === 0) {
    return reservations;
  }

  const maxSuggestions = Math.min(3, tableIds.length);
  let assigned = 0;

  return reservations.map((reservation) => {
    if (
      reservation.suggestedTableId ||
      reservation.assignedTableId ||
      assigned >= maxSuggestions ||
      ['seated', 'completed', 'canceled', 'no_show'].includes(reservation.status)
    ) {
      return reservation;
    }

    const tableId = tableIds[assigned];
    assigned += 1;
    return { ...reservation, suggestedTableId: tableId };
  });
}

export function useReservationDayBook(date: string) {
  const reservationsQuery = useReservations({ date });
  const floorTables = useFloorStore((state) => state.floorMap.tables);

  return useMemo(
    () =>
      withMockTableSuggestions(
        (reservationsQuery.data ?? [])
          .slice()
          .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot)),
        Object.keys(floorTables),
      ),
    [reservationsQuery.data, floorTables],
  );
}

export function useReservationDensity(
  input: {
    dateFrom: string;
    dateTo: string;
    includeArchived?: boolean;
  } | null,
) {
  const locationId = useLocationId();
  const isWorkdayActive = useIsWorkdayActive(locationId);
  const includeArchived = input?.includeArchived ?? false;

  return useQuery<ReservationDensityResponse>({
    queryKey:
      locationId && input
        ? queryKeys.reservations.density(locationId, input.dateFrom, input.dateTo, includeArchived)
        : ['reservations', 'density', 'disabled'],
    queryFn: () => fetchReservationDensity(locationId!, { ...input!, includeArchived }),
    enabled: !!locationId && !!input && isWorkdayActive,
    retry: false,
    staleTime: 60_000,
  });
}

export function useReservationDetail(reservationId: string | null, date?: string) {
  const reservationBook = useReservationDayBook(date ?? new Date().toISOString().slice(0, 10));
  const queryClient = useQueryClient();
  const locationId = useLocationId();

  return useMemo(() => {
    if (!reservationId) {
      return null;
    }

    const currentDayReservation = reservationBook.find(
      (reservation) => reservation.id === reservationId,
    );
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
      if (!Array.isArray(reservations)) {
        continue;
      }
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
    onMutate: async (input) => {
      if (!locationId) {
        return;
      }

      const queryKey = queryKeys.reservations.list(locationId, { date: input.date });
      await queryClient.cancelQueries({ queryKey: queryKeys.reservations.location(locationId) });
      const snapshots = snapshotReservationQueries(queryClient, locationId);
      const previousCreatedReservations = queryClient.getQueryData<Reservation[]>(queryKey);
      const optimisticReservation = buildOptimisticReservation(input);
      queryClient.setQueryData<Reservation[]>(queryKey, (currentReservations) =>
        upsertReservation(currentReservations ?? [], optimisticReservation),
      );

      return {
        optimisticId: optimisticReservation.id,
        previousCreatedReservations,
        queryKey,
        snapshots,
      };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      rollbackQuerySnapshots(queryClient, context.snapshots);
      queryClient.setQueryData(context.queryKey, context.previousCreatedReservations);
    },
    onSuccess: (reservation, _input, context) => {
      if (!locationId) {
        return;
      }

      patchReservationQueries(queryClient, locationId, reservation, {
        previousId: context?.optimisticId,
        insertIfDateList: true,
      });
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
    onMutate: async ({ reservationId, input }) => {
      if (!locationId) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.reservations.location(locationId) });
      const snapshots = snapshotReservationQueries(queryClient, locationId);
      const cachedReservation = findCachedReservation(queryClient, locationId, reservationId);
      if (cachedReservation) {
        patchReservationQueries(
          queryClient,
          locationId,
          applyReservationInput(cachedReservation, input),
        );
      }

      return { snapshots };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      rollbackQuerySnapshots(queryClient, context.snapshots);
    },
    onSuccess: (reservation) => {
      if (locationId) {
        patchReservationQueries(queryClient, locationId, reservation);
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
    onMutate: async ({ reservationId, action, input }) => {
      if (!locationId) {
        return;
      }

      const snapshots = snapshotReservationQueries(queryClient, locationId);
      const cachedReservation = findCachedReservation(queryClient, locationId, reservationId);
      if (cachedReservation) {
        patchReservationQueries(
          queryClient,
          locationId,
          applyReservationAction(cachedReservation, action, input),
        );
      }

      void queryClient.cancelQueries({ queryKey: queryKeys.reservations.location(locationId) });
      return { snapshots };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      rollbackQuerySnapshots(queryClient, context.snapshots);
    },
    onSuccess: (reservation) => {
      if (locationId) {
        patchReservationQueries(queryClient, locationId, reservation);
      }
    },
    retry: false,
  });

  const archiveMutation = useMutation({
    mutationFn: ({
      reservationId,
      input,
    }: {
      reservationId: string;
      input?: ArchiveReservationInput;
    }) => archiveReservation(locationId!, reservationId, input ?? {}),
    onMutate: async ({ reservationId, input }) => {
      if (!locationId) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.reservations.location(locationId) });
      const snapshots = snapshotReservationQueries(queryClient, locationId);
      const cachedReservation = findCachedReservation(queryClient, locationId, reservationId);
      if (cachedReservation) {
        patchReservationQueries(queryClient, locationId, {
          ...cachedReservation,
          archivedAt: nowIso(),
          archiveReason: input?.reason ?? cachedReservation.archiveReason,
          updatedAt: nowIso(),
        });
      }

      return { snapshots };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      rollbackQuerySnapshots(queryClient, context.snapshots);
    },
    onSuccess: (reservation) => {
      if (locationId) {
        patchReservationQueries(queryClient, locationId, reservation);
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ reservationId }: { reservationId: string }) =>
      restoreReservation(locationId!, reservationId),
    onMutate: async ({ reservationId }) => {
      if (!locationId) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.reservations.location(locationId) });
      const snapshots = snapshotReservationQueries(queryClient, locationId);
      const cachedReservation = findCachedReservation(queryClient, locationId, reservationId);
      if (cachedReservation) {
        patchReservationQueries(queryClient, locationId, {
          ...cachedReservation,
          archivedAt: null,
          archivedByUserId: null,
          archiveReason: null,
          updatedAt: nowIso(),
        });
      }

      return { snapshots };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      rollbackQuerySnapshots(queryClient, context.snapshots);
    },
    onSuccess: (reservation) => {
      if (locationId) {
        patchReservationQueries(queryClient, locationId, reservation);
      }
    },
  });

  const removeDuplicateMutation = useMutation({
    mutationFn: ({ reservationId }: { reservationId: string }) =>
      removeDuplicateReservation(locationId!, reservationId),
    onMutate: async ({ reservationId }) => {
      if (!locationId) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: queryKeys.reservations.location(locationId) });
      const snapshots = snapshotReservationQueries(queryClient, locationId);
      removeReservationFromQueries(queryClient, locationId, reservationId);

      return { snapshots };
    },
    onError: (_error, _input, context) => {
      if (!locationId || !context) {
        return;
      }
      rollbackQuerySnapshots(queryClient, context.snapshots);
    },
  });

  return {
    createReservation: createMutation.mutateAsync,
    updateReservation: updateMutation.mutateAsync,
    runReservationAction: actionMutation.mutateAsync,
    archiveReservation: archiveMutation.mutateAsync,
    restoreReservation: restoreMutation.mutateAsync,
    removeDuplicateReservation: removeDuplicateMutation.mutateAsync,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      actionMutation.isPending ||
      archiveMutation.isPending ||
      restoreMutation.isPending ||
      removeDuplicateMutation.isPending,
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
    queryKey: locationId
      ? queryKeys.reservations.settings(locationId)
      : ['reservations', 'settings'],
    queryFn: () => fetchReservationSettings(locationId!),
    enabled: !!locationId && isWorkdayActive,
    retry: false,
    staleTime: 5 * 60_000,
  });

  return query.data ?? null;
}

export function useUpdateReservationSchedule() {
  const locationId = useLocationId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReservationScheduleInput) => {
      if (!locationId) {
        throw new Error('No location selected');
      }
      return updateReservationSchedule(locationId, input);
    },
    onSuccess: () => {
      if (locationId) {
        invalidateReservationQueries(queryClient, locationId);
      }
    },
  });
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
