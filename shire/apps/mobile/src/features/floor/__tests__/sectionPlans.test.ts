import type { FloorMap } from '@shire/shared';
import {
  buildSectionPlanFromCurrentSections,
  buildSectionPlanFromFloorMap,
} from '../sectionPlans';

const floorMap: FloorMap = {
  floorId: 'floor-1',
  mapVersion: 'v1',
  rooms: [
    {
      roomId: 'main',
      label: 'Main',
      filterLabel: 'Main',
      rows: [['t2', 't10', 't1']],
      layoutMode: 'freeform',
    },
  ],
  tables: {
    t10: {
      tableId: 't10',
      tableNumber: '10',
      roomId: 'main',
      section: 'TEST 1',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
    },
    t2: {
      tableId: 't2',
      tableNumber: '2',
      roomId: 'main',
      section: 'TEST 2',
      capacity: 2,
      shape: 'square',
      type: 'regular',
    },
    t1: {
      tableId: 't1',
      tableNumber: '1',
      roomId: 'main',
      section: 'TEST 1',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
    },
  },
};

describe('section plan builders', () => {
  it('captures current section labels as a default preset without adding empty sections', () => {
    const plan = buildSectionPlanFromCurrentSections(floorMap, {
      name: 'TEST',
      waiterCount: 5,
      isDefault: true,
    });

    expect(plan.name).toBe('TEST');
    expect(plan.waiterCount).toBe(5);
    expect(plan.isDefault).toBe(true);
    expect(plan.sections).toEqual([
      { sectionId: 'TEST 1', tableIds: ['t1', 't10'] },
      { sectionId: 'TEST 2', tableIds: ['t2'] },
    ]);
  });

  it('keeps floor-builder presets padded to the requested waiter count', () => {
    const plan = buildSectionPlanFromFloorMap(floorMap, {
      name: '5 Waiters',
      waiterCount: 5,
      isDefault: true,
    });

    expect(plan.sections).toEqual([
      { sectionId: 'TEST 1', tableIds: ['t1', 't10'] },
      { sectionId: 'TEST 2', tableIds: ['t2'] },
      { sectionId: 'Section 3', tableIds: [] },
      { sectionId: 'Section 4', tableIds: [] },
      { sectionId: 'Section 5', tableIds: [] },
    ]);
  });
});
