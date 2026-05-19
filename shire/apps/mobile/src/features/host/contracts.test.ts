import {
  adaptReservation,
  adaptReservationSettings,
  selectActiveWaitlistEntries,
  upsertWaitlistEntry,
} from './contracts';

describe('host waitlist cache helpers', () => {
  const baseEntry = {
    guest: {
      id: 'guest-1',
      name: 'Jordan',
      phone: '555-0100',
    },
    partySize: 4,
    seatingPreference: 'none' as const,
    notes: '',
    source: 'manual' as const,
    quotedWaitMinutes: 15,
    arrivedAt: null,
    seatedAt: null,
    removedAt: null,
    noShowAt: null,
    assignedTableId: null,
    createdAt: '2026-04-13T12:00:00.000Z',
    updatedAt: '2026-04-13T12:00:00.000Z',
  };

  it('upserts new waitlist entries and preserves joined order', () => {
    const entries = [
      {
        ...baseEntry,
        id: 'waitlist-2',
        status: 'waiting' as const,
        joinedAt: '2026-04-13T12:10:00.000Z',
      },
    ];

    const nextEntries = upsertWaitlistEntry(entries, {
      ...baseEntry,
      id: 'waitlist-1',
      status: 'waiting',
      joinedAt: '2026-04-13T12:05:00.000Z',
    });

    expect(nextEntries.map((entry) => entry.id)).toEqual(['waitlist-1', 'waitlist-2']);
  });

  it('replaces an existing waitlist row authoritatively by id', () => {
    const entries = [
      {
        ...baseEntry,
        id: 'waitlist-1',
        status: 'waiting' as const,
        joinedAt: '2026-04-13T12:05:00.000Z',
        quotedWaitMinutes: 20,
      },
    ];

    const nextEntries = upsertWaitlistEntry(entries, {
      ...baseEntry,
      id: 'waitlist-1',
      status: 'arrived',
      joinedAt: '2026-04-13T12:05:00.000Z',
      quotedWaitMinutes: 5,
      arrivedAt: '2026-04-13T12:20:00.000Z',
      updatedAt: '2026-04-13T12:20:00.000Z',
    });

    expect(nextEntries).toHaveLength(1);
    expect(nextEntries[0]?.status).toBe('arrived');
    expect(nextEntries[0]?.quotedWaitMinutes).toBe(5);
    expect(nextEntries[0]?.arrivedAt).toBe('2026-04-13T12:20:00.000Z');
  });

  it('keeps canonical non-active rows in cache but hides them from the active selector', () => {
    const entries = [
      {
        ...baseEntry,
        id: 'waitlist-1',
        status: 'waiting' as const,
        joinedAt: '2026-04-13T12:05:00.000Z',
      },
      {
        ...baseEntry,
        id: 'waitlist-2',
        status: 'seated' as const,
        joinedAt: '2026-04-13T12:00:00.000Z',
        seatedAt: '2026-04-13T12:25:00.000Z',
        assignedTableId: '2',
      },
      {
        ...baseEntry,
        id: 'waitlist-3',
        status: 'removed' as const,
        joinedAt: '2026-04-13T12:03:00.000Z',
        removedAt: '2026-04-13T12:15:00.000Z',
      },
    ];

    expect(entries).toHaveLength(3);
    expect(selectActiveWaitlistEntries(entries).map((entry) => entry.id)).toEqual(['waitlist-1']);
  });
});

describe('host reservation contract normalization', () => {
  const baseReservation = {
    id: 'reservation-1',
    guestName: 'Taylor',
    guestPhone: '5551112222',
    partySize: 2,
    date: '2026-04-08',
    timeSlot: '18:30',
    seatingPreference: 'none' as const,
    status: 'booked' as const,
    createdAt: '2026-04-08T12:00:00.000Z',
    updatedAt: '2026-04-08T12:00:00.000Z',
  };

  it.each([
    ['host', 'host_dashboard'],
    ['manual', 'host_dashboard'],
    ['staff_phone', 'staff_phone'],
    ['phone', 'staff_phone'],
    ['public_web', 'website_widget'],
    ['web', 'website_widget'],
    ['public_app', 'app_native'],
    ['google', 'google_business_profile'],
    ['google_business_profile', 'google_business_profile'],
  ] as const)('normalizes %s reservation origins into %s', (source, expected) => {
    const reservation = adaptReservation({
      ...baseReservation,
      source,
    });

    expect(reservation.source).toBe(expected);
  });

  it('normalizes reservation settings defaultChannel with the same source rules', () => {
    const settings = adaptReservationSettings({
      locationId: 'location-1',
      defaultChannel: 'public_app',
      updatedAt: '2026-04-08T12:00:00.000Z',
      servicePeriods: [
        {
          id: 'period-1',
          name: 'Dinner',
          dayOfWeek: 2,
          startTime: '17:00:00',
          endTime: '22:00:00',
          slotIntervalMinutes: 15,
          leadTimeMinutes: 60,
          sameDayCutoffTime: null,
          minPartySize: 1,
          maxPartySize: 8,
          defaultDurationMinutes: 90,
          active: true,
        },
      ],
    });

    expect(settings.defaultChannel).toBe('app_native');
    expect(settings.servicePeriods[0]).toEqual(
      expect.objectContaining({
        id: 'period-1',
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '22:00',
      }),
    );
  });
});
