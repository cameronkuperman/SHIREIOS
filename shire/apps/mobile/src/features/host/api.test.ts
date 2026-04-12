import {
  createReservation,
  fetchReservationAvailability,
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
  source: 'host',
  createdAt: '2026-04-08T12:00:00.000Z',
  updatedAt: '2026-04-08T12:00:00.000Z',
};

describe('reservation API request normalization', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sends host when creating a manual reservation from mobile', async () => {
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
      source: 'manual',
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

  it('sends host for availability lookups when the UI channel is manual', async () => {
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
      channel: 'manual',
    });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/locations/location-1/availability', {
      params: {
        service_date: '2026-04-08',
        party_size: 2,
        channel: 'host',
      },
    });
  });

  it('maps web-like UI sources into backend-supported public web channels', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        ...reservationDto,
        source: 'public_web',
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
});
