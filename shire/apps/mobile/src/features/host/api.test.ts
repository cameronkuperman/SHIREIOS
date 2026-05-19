import {
  createReservation,
  fetchShiftAnalytics,
  fetchReservationAvailability,
  runReservationAction,
  updateReservationSchedule,
  updateReservation,
} from './api';
import { apiClient } from '@/services/api/client';

jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

const reservationDto = {
  id: 'reservation-1',
  guestName: 'Taylor',
  guestPhone: '5551112222',
  partySize: 2,
  date: '2026-04-08',
  timeSlot: '18:30',
  seatingPreference: 'none',
  status: 'booked',
  source: 'host_dashboard',
  createdAt: '2026-04-08T12:00:00.000Z',
  updatedAt: '2026-04-08T12:00:00.000Z',
};

describe('reservation API request normalization', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sends host when creating a host reservation from mobile', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: reservationDto,
    });

    await createReservation('location-1', {
      guestName: 'Taylor',
      guestPhone: '5551112222',
      partySize: 2,
      date: '2026-04-08',
      timeSlot: '18:30',
      seatingPreference: 'none',
      source: 'host_dashboard',
      notes: '',
      specialRequests: '',
      internalNotes: '',
      pacingOverride: false,
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/locations/location-1/reservations',
      expect.objectContaining({
        serviceDate: '2026-04-08',
        reservationTime: '18:30:00',
        channel: 'host',
        source: 'host',
        overridePacing: false,
      }),
    );
  });

  it('sends phone when creating a phone reservation from mobile', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        ...reservationDto,
        source: 'staff_phone',
      },
    });

    await createReservation('location-1', {
      guestName: 'Taylor',
      guestPhone: '5551112222',
      partySize: 2,
      date: '2026-04-08',
      timeSlot: '18:30',
      seatingPreference: 'none',
      source: 'staff_phone',
      notes: '',
      specialRequests: '',
      internalNotes: '',
      pacingOverride: false,
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/locations/location-1/reservations',
      expect.objectContaining({
        channel: 'phone',
        source: 'phone',
      }),
    );
  });

  it('uses backend-supported update field names for reservation edits', async () => {
    mockedApiClient.patch.mockResolvedValue({
      data: reservationDto,
    });

    await updateReservation('location-1', 'reservation-1', {
      date: '2026-04-08',
      timeSlot: '18:30',
      internalNotes: 'VIP',
      pacingOverride: true,
    });

    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/locations/location-1/reservations/reservation-1',
      expect.objectContaining({
        serviceDate: '2026-04-08',
        reservationTime: '18:30:00',
        notesInternal: 'VIP',
        overridePacing: true,
      }),
    );

    await updateReservation('location-1', 'reservation-1', {
      internalNotes: 'Still VIP',
    });

    expect(mockedApiClient.patch).toHaveBeenLastCalledWith(
      '/locations/location-1/reservations/reservation-1',
      expect.not.objectContaining({
        source: expect.anything(),
      }),
    );
  });

  it('sends host for availability lookups when the UI channel is host_dashboard', async () => {
    mockedApiClient.get.mockResolvedValue({
      data: {
        date: '2026-04-08',
        partySize: 2,
        channel: 'host',
        timezone: 'America/New_York',
        slots: [],
      },
    });

    await fetchReservationAvailability('location-1', {
      date: '2026-04-08',
      partySize: 2,
      channel: 'host_dashboard',
    });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/locations/location-1/availability', {
      params: {
        service_date: '2026-04-08',
        party_size: 2,
        channel: 'host',
      },
    });
  });

  it('maps web-like UI sources into the public_web channel', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        ...reservationDto,
        source: 'website_widget',
      },
    });

    await createReservation('location-1', {
      guestName: 'Taylor',
      guestPhone: '5551112222',
      partySize: 2,
      date: '2026-04-08',
      timeSlot: '18:30',
      seatingPreference: 'none',
      source: 'opentable',
      notes: '',
      specialRequests: '',
      internalNotes: '',
      pacingOverride: false,
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/locations/location-1/reservations',
      expect.objectContaining({
        reservationTime: '18:30:00',
        channel: 'public_web',
        source: 'public_web',
      }),
    );
  });

  it('sends an empty action payload when no reservation action body is required', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: reservationDto,
    });

    await runReservationAction('location-1', 'reservation-1', 'cancel');

    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/locations/location-1/reservations/reservation-1/actions/cancel',
      {},
    );
  });

  it('saves reservation schedule through the schedule-only endpoint', async () => {
    mockedApiClient.patch.mockResolvedValue({
      data: {
        locationId: 'location-1',
        bookingHorizonDays: 30,
        gracePeriodMinutes: 15,
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
        pacingRules: [],
        channelRules: [],
        updatedAt: '2026-04-08T12:00:00.000Z',
      },
    });

    const settings = await updateReservationSchedule('location-1', {
      servicePeriods: [
        {
          id: null,
          name: 'Dinner',
          dayOfWeek: 2,
          startTime: '17:00',
          endTime: '22:00',
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

    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/locations/location-1/reservation-schedule',
      {
        servicePeriods: [
          expect.objectContaining({
            name: 'Dinner',
            dayOfWeek: 2,
            startTime: '17:00:00',
            endTime: '22:00:00',
            leadTimeMinutes: 60,
          }),
        ],
      },
    );
    expect(settings.servicePeriods[0]?.startTime).toBe('17:00');
  });

  it('fetches live shift analytics for the selected range', async () => {
    mockedApiClient.get.mockResolvedValue({
      data: {
        range: 'today',
        generatedAt: '2026-05-18T23:00:00.000Z',
        windowStart: '2026-05-18T04:00:00.000Z',
        windowEnd: '2026-05-18T23:00:00.000Z',
        summary: {
          covers: 0,
          parties: 0,
          tablesTurned: 0,
          avgTurnTimeMinutes: null,
          peakBucketLabel: null,
        },
        hourly: [],
        waiters: [],
        bottlenecks: { longOccupiedTables: [] },
        insights: [
          {
            id: 'steady-shift',
            tone: 'good',
            title: 'Shift flow',
            detail: 'Service flow is steady against the current shift targets.',
          },
        ],
      },
    });

    const analytics = await fetchShiftAnalytics('location-1', 'today');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/locations/location-1/analytics/shift', {
      params: { range: 'today' },
    });
    expect(analytics.summary.covers).toBe(0);
    expect(JSON.stringify(analytics).toLowerCase()).not.toContain('mock');
  });
});
