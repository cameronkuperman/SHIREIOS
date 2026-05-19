import type { WaiterRoutingState } from '@shire/shared';

jest.mock('./api', () => ({
  toWaiterRoutingUpdatePayload: jest.fn(),
  updateWaiterRouting: jest.fn(),
}));

jest.mock('@/services/api/queryKeys', () => ({
  queryKeys: {
    routing: {
      location: (locationId: string) => ['routing', 'location', locationId],
    },
  },
}));

import { resolveWaiterIdForTable } from './store';

const baseRouting: WaiterRoutingState = {
  mode: 'section',
  waiters: [],
  activeWaiterIds: ['backend-next', 'backend-section', 'explicit', 'section', 'fallback'],
  sectionAssignments: { Patio: 'section' },
  tableAssignments: { T1: 'explicit' },
  rotationOrder: ['fallback'],
  nextWaiterId: 'fallback',
  nextUpByTable: { T1: 'backend-next' },
  nextUpBySection: { Patio: 'backend-section' },
  updatedAt: '2026-05-18T12:00:00.000Z',
};

describe('waiter routing resolution', () => {
  it('uses backend next-up table recommendations before local assignments', () => {
    expect(resolveWaiterIdForTable(baseRouting, 'T1', 'Patio')).toBe('backend-next');
  });

  it('uses backend section recommendations before static section assignments', () => {
    expect(resolveWaiterIdForTable(baseRouting, 'T2', 'Patio')).toBe('backend-section');
  });
});
