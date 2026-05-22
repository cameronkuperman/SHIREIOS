import type { WaiterRoutingState } from '@shire/shared';
import {
  buildBeginningShiftRouting,
  getShiftSetupDraftKey,
  hasUsableLastShift,
  inferSetupModeFromRouting,
  summarizeShiftSetup,
} from './shiftSetupDraft';

const baseRouting: WaiterRoutingState = {
  mode: 'manual_rotation',
  waiters: [
    {
      id: 'waiter-1',
      name: 'Fernando',
      isTemporary: false,
      status: 'available',
      isActive: true,
      assignedSectionIds: ['Patio'],
      assignedTableIds: [],
      currentTableIds: [],
      servedTableIds: [],
      liveTables: 0,
      servedSeatingCount: 0,
      lastAssignedAt: null,
    },
  ],
  activeWaiterIds: ['waiter-1'],
  sectionAssignments: { Patio: 'waiter-1' },
  tableAssignments: {},
  rotationOrder: ['waiter-1'],
  nextWaiterId: 'waiter-1',
  shiftStartGroups: [{ id: 'five', name: '5pm', startTime: '17:00', waiterIds: ['waiter-1'] }],
  gratThreshold: 6,
  gratRotationState: { rotationOrder: ['waiter-1'] },
  nextGratWaiterId: 'waiter-1',
  nextUpQueue: [],
  nextUpByTable: {},
  nextUpBySection: {},
  updatedAt: '2026-05-21T12:00:00.000Z',
};

describe('shift setup draft helpers', () => {
  it('recognizes a backend routing snapshot as a reusable last shift', () => {
    expect(hasUsableLastShift(baseRouting)).toBe(true);
    expect(
      hasUsableLastShift({
        ...baseRouting,
        activeWaiterIds: [],
        sectionAssignments: {},
        rotationOrder: [],
        shiftStartGroups: [],
        setupApproval: null,
        setupApprovedAt: null,
      }),
    ).toBe(false);
  });

  it('infers the setup mode from backend-approved routing fields', () => {
    expect(inferSetupModeFromRouting({ ...baseRouting, mode: 'section' })).toBe('sections_now');
    expect(
      inferSetupModeFromRouting({
        ...baseRouting,
        activeWaiterIds: [],
        setupPlannedMode: 'manual_rotation',
        setupSectionPlanId: null,
      }),
    ).toBe('rotation_only');
    expect(
      inferSetupModeFromRouting({
        ...baseRouting,
        setupPlannedMode: 'section',
        setupSectionPlanId: 'dinner',
      }),
    ).toBe('rotation_sections');
  });

  it('builds a beginning draft without mutating the previous backend snapshot', () => {
    const draft = buildBeginningShiftRouting(baseRouting, '2026-05-22T12:00:00.000Z');

    expect(draft.mode).toBe('manual_rotation');
    expect(draft.activeWaiterIds).toEqual([]);
    expect(draft.rotationOrder).toEqual([]);
    expect(draft.sectionAssignments).toEqual({});
    expect(draft.shiftStartGroups).toEqual([]);
    expect(draft.nextWaiterId).toBeNull();
    expect(draft.waiters[0]?.isActive).toBe(false);
    expect(baseRouting.activeWaiterIds).toEqual(['waiter-1']);
  });

  it('scopes local drafts by location and service date', () => {
    expect(getShiftSetupDraftKey('loc-1', '2026-05-22')).toBe(
      'shire-shift-setup-draft:loc-1:2026-05-22',
    );
  });

  it('summarizes the compact review state', () => {
    expect(summarizeShiftSetup(baseRouting, 'rotation_sections', 2)).toBe(
      'Rotation now · 1 waiter · 1 start group · 2 sections',
    );
  });
});
