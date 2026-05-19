import { apiClient } from '@/services/api/client';
import { createWaiter, deleteWaiter, fetchWaiters, updateWaiter } from './api';

jest.mock('@/services/api/client', () => ({
  apiClient: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('waiter roster API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('unwraps waiter list responses', async () => {
    mockedApiClient.get.mockResolvedValue({
      data: {
        waiters: [
          {
            id: 'waiter-1',
            name: 'Olivia',
            role: 'server',
            tier: null,
            isActive: true,
          },
        ],
      },
    });

    await expect(fetchWaiters('location-1')).resolves.toEqual([
      {
        id: 'waiter-1',
        name: 'Olivia',
        role: 'server',
        tier: null,
        isActive: true,
      },
    ]);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/locations/location-1/waiters');
  });

  it('posts waiter creation and unwraps the canonical waiter', async () => {
    mockedApiClient.post.mockResolvedValue({
      data: {
        waiter: {
          id: 'waiter-2',
          name: 'Marco',
          role: 'server',
          tier: null,
          isActive: true,
        },
      },
    });

    await expect(createWaiter('location-1', { name: 'Marco', role: 'server' })).resolves.toEqual(
      {
        id: 'waiter-2',
        name: 'Marco',
        role: 'server',
        tier: null,
        isActive: true,
      },
    );
    expect(mockedApiClient.post).toHaveBeenCalledWith('/locations/location-1/waiters', {
      name: 'Marco',
      role: 'server',
    });
  });

  it('patches waiter edits and unwraps the canonical waiter', async () => {
    mockedApiClient.patch.mockResolvedValue({
      data: {
        waiter: {
          id: 'waiter-2',
          name: 'Marcus',
          role: 'server',
          tier: null,
          isActive: true,
        },
      },
    });

    await expect(
      updateWaiter('location-1', 'waiter-2', { name: 'Marcus', role: 'server' }),
    ).resolves.toEqual({
      id: 'waiter-2',
      name: 'Marcus',
      role: 'server',
      tier: null,
      isActive: true,
    });
    expect(mockedApiClient.patch).toHaveBeenCalledWith(
      '/locations/location-1/waiters/waiter-2',
      {
        name: 'Marcus',
        role: 'server',
      },
    );
  });

  it('deletes waiters through the archive endpoint and unwraps the response', async () => {
    mockedApiClient.delete.mockResolvedValue({
      data: {
        waiter: {
          id: 'waiter-2',
          name: 'Marco',
          role: 'server',
          tier: null,
          isActive: false,
        },
      },
    });

    await expect(deleteWaiter('location-1', 'waiter-2')).resolves.toEqual({
      id: 'waiter-2',
      name: 'Marco',
      role: 'server',
      tier: null,
      isActive: false,
    });
    expect(mockedApiClient.delete).toHaveBeenCalledWith('/locations/location-1/waiters/waiter-2');
  });
});
