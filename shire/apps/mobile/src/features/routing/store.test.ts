import type { FloorMap, WaiterRoutingState } from '@shire/shared';

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

import {
  getFloorSectionLabels,
  getOpenSectionIds,
  getRoutingModeSwitchWarnings,
  resolveWaiterIdForTable,
} from './store';

const baseRouting: WaiterRoutingState = {
  mode: 'section',
  waiters: [],
  activeWaiterIds: [
    'backend-next',
    'backend-section',
    'backend-grat',
    'explicit',
    'section',
    'fallback',
  ],
  sectionAssignments: { Patio: 'section' },
  tableAssignments: { T1: 'explicit', 'backend-table-1': 'explicit' },
  rotationOrder: ['fallback'],
  nextWaiterId: 'fallback',
  nextUpByTable: { T1: 'backend-next', 'backend-table-1': 'backend-next' },
  nextUpBySection: { Patio: 'backend-section' },
  gratThreshold: 6,
  nextGratWaiterId: 'backend-grat',
  nextGratByTable: { 'backend-table-1': 'backend-grat' },
  updatedAt: '2026-05-18T12:00:00.000Z',
};

describe('waiter routing resolution', () => {
  it('uses backend table id recommendations first in rotation mode', () => {
    expect(
      resolveWaiterIdForTable(
        { ...baseRouting, mode: 'manual_rotation' },
        'T1',
        'Patio',
        'backend-table-1',
      ),
    ).toBe('backend-next');
  });

  it('uses grat recommendations for large parties in rotation mode', () => {
    expect(
      resolveWaiterIdForTable(
        { ...baseRouting, mode: 'manual_rotation' },
        'T1',
        'Patio',
        'backend-table-1',
        6,
      ),
    ).toBe('backend-grat');
  });

  it('uses table assignments before section assignments in section mode', () => {
    expect(
      resolveWaiterIdForTable(
        {
          ...baseRouting,
          tableAssignments: { T2: 'explicit' },
          nextUpByTable: {},
          nextUpBySection: {},
        },
        'T2',
        'Patio',
      ),
    ).toBe('explicit');
  });

  it('uses section assignments before backend next-up in section mode', () => {
    expect(resolveWaiterIdForTable(baseRouting, 'T2', 'Patio')).toBe('section');
  });

  it('uses grat recommendations for large parties in section mode', () => {
    expect(resolveWaiterIdForTable(baseRouting, 'T2', 'Patio', null, 6)).toBe('backend-grat');
  });

  it('keeps section owner for large parties when no grat waiter is configured', () => {
    expect(
      resolveWaiterIdForTable(
        {
          ...baseRouting,
          nextGratWaiterId: null,
          nextGratByTable: {},
          nextGratBySection: {},
        },
        'T2',
        'Patio',
        null,
        8,
      ),
    ).toBe('section');
  });

  it('falls back to backend next-up in section mode when no section owner exists', () => {
    expect(
      resolveWaiterIdForTable(
        {
          ...baseRouting,
          tableAssignments: {},
          sectionAssignments: {},
        },
        'T2',
        'Patio',
      ),
    ).toBe('backend-section');
  });

  it('ignores section assignments outside the active section plan', () => {
    const routing: WaiterRoutingState = {
      ...baseRouting,
      mode: 'section',
      sectionAssignments: { Patio: 'section', Main: 'closed-waiter' },
      nextUpBySection: {},
      nextWaiterId: 'fallback',
      rotationOrder: ['fallback', 'section', 'closed-waiter'],
    };

    const twoSectionPlanMap: FloorMap = {
      ...floorMap,
      sectionPlans: [
        {
          planId: 'plan-1',
          name: 'Two Waiters',
          waiterCount: 2,
          sections: [
            { sectionId: 'Front', tableIds: [] },
            { sectionId: 'Back', tableIds: [] },
          ],
        },
      ],
      activeSectionPlanId: 'plan-1',
    };

    expect(resolveWaiterIdForTable(routing, 'T2', 'Main', null, null, twoSectionPlanMap)).toBe(
      'fallback',
    );
    expect(getOpenSectionIds(twoSectionPlanMap)).toEqual(new Set(['Front', 'Back']));
  });

  it('skips grat waiters who only own closed sections', () => {
    const routing: WaiterRoutingState = {
      ...baseRouting,
      mode: 'section',
      sectionAssignments: { Patio: 'section', Main: 'closed-grat' },
      nextGratWaiterId: 'closed-grat',
      nextGratByTable: {},
      nextGratBySection: {},
      nextWaiterId: 'section',
      rotationOrder: ['section', 'closed-grat'],
      activeWaiterIds: ['section', 'closed-grat', 'fallback'],
    };
    const patioOpenFloorMap: FloorMap = {
      ...floorMap,
      sectionPlans: [
        {
          planId: 'patio-plan',
          name: 'Patio Service',
          waiterCount: 2,
          sections: [{ sectionId: 'Patio', tableIds: ['T1'] }],
        },
      ],
      activeSectionPlanId: 'patio-plan',
    };

    expect(
      resolveWaiterIdForTable(routing, 'T1', 'Patio', 'backend-table-1', 6, patioOpenFloorMap),
    ).toBe('section');
  });
});

const floorMap: FloorMap = {
  floorId: 'floor-1',
  mapVersion: 'test',
  rooms: [],
  tables: {
    T1: {
      tableId: 'T1',
      tableNumber: '1',
      roomId: 'main',
      section: 'Patio',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
    },
    T2: {
      tableId: 'T2',
      tableNumber: '2',
      roomId: 'main',
      section: 'Main',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
    },
  },
};

const shiftRouting: WaiterRoutingState = {
  ...baseRouting,
  waiters: [
    {
      id: 'section',
      name: 'Jamie',
      isTemporary: false,
      status: 'available',
      isActive: true,
      assignedSectionIds: [],
      assignedTableIds: [],
      currentTableIds: [],
      servedTableIds: [],
      liveTables: 0,
      servedSeatingCount: 0,
      lastAssignedAt: null,
    },
    {
      id: 'fallback',
      name: 'Skylar',
      isTemporary: false,
      status: 'available',
      isActive: true,
      assignedSectionIds: [],
      assignedTableIds: [],
      currentTableIds: [],
      servedTableIds: [],
      liveTables: 0,
      servedSeatingCount: 0,
      lastAssignedAt: null,
    },
  ],
  activeWaiterIds: ['section', 'fallback'],
  sectionAssignments: { Patio: 'section' },
  nextUpByTable: {},
  nextUpBySection: {},
};

describe('routing mode switch warnings', () => {
  it('uses active section plans before table sections', () => {
    expect(
      getFloorSectionLabels({
        ...floorMap,
        sectionPlans: [
          {
            planId: 'plan-1',
            name: 'Two Waiters',
            waiterCount: 2,
            sections: [
              { sectionId: 'Front', tableIds: [] },
              { sectionId: 'Back', tableIds: [] },
            ],
          },
        ],
        activeSectionPlanId: 'plan-1',
      }),
    ).toEqual(['Back', 'Front']);
  });

  it('warns before switching to sections when a waiter and section are unassigned', () => {
    const warnings = getRoutingModeSwitchWarnings(shiftRouting, floorMap, 'section');

    expect(warnings).toEqual([
      {
        code: 'active_waiters_without_sections',
        message: 'Some active waiters do not own a section.',
        names: ['Skylar'],
      },
      {
        code: 'sections_without_waiters',
        message: 'Some floor sections do not have an active waiter.',
        names: ['Main'],
      },
    ]);
  });

  it('does not count stale assignments outside the active section plan', () => {
    const warnings = getRoutingModeSwitchWarnings(
      shiftRouting,
      {
        ...floorMap,
        sectionPlans: [
          {
            planId: 'plan-1',
            name: 'Two Waiters',
            waiterCount: 2,
            sections: [
              { sectionId: 'Front', tableIds: [] },
              { sectionId: 'Back', tableIds: [] },
            ],
          },
        ],
        activeSectionPlanId: 'plan-1',
      },
      'section',
    );

    expect(warnings.find((warning) => warning.code === 'active_waiters_without_sections')).toEqual({
      code: 'active_waiters_without_sections',
      message: 'Some active waiters do not own a section.',
      names: ['Jamie', 'Skylar'],
    });
  });

  it('does not warn when switching back to rotation', () => {
    expect(getRoutingModeSwitchWarnings(shiftRouting, floorMap, 'manual_rotation')).toEqual([]);
  });
});
