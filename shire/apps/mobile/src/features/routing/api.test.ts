import { apiClient } from '@/services/api/client';
import { createWaiter, fetchWaiters } from './api';

jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
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
});
