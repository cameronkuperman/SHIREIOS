import {
  createReservation,
  fetchReservationAvailability,
  runReservationAction,
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

  it('sends host_dashboard when creating a host reservation from mobile', async () => {
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
        channel: 'host_dashboard',
        source: 'host_dashboard',
        overridePacing: false,
      }),
    );
  });

  it('sends staff_phone when creating a phone reservation from mobile', async () => {
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
        channel: 'staff_phone',
        source: 'staff_phone',
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

  it('sends host_dashboard for availability lookups when the UI channel is host_dashboard', async () => {
    mockedApiClient.get.mockResolvedValue({
      data: {
        date: '2026-04-08',
        partySize: 2,
        channel: 'host_dashboard',
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
        channel: 'host_dashboard',
      },
    });
  });

  it('maps web-like UI sources into backend-supported website_widget channels', async () => {
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
        channel: 'website_widget',
        source: 'website_widget',
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
});
