import type { FloorMap } from '@shire/shared';
import { storage } from '@/lib/storage';
import { useBuilderStore } from './store';

const floorMap: FloorMap = {
  floorId: 'floor-1',
  mapVersion: 'v1',
  rooms: [
    {
      roomId: 'room-1',
      label: 'Main',
      filterLabel: 'Main',
      rows: [['t1']],
      layoutMode: 'freeform',
    },
  ],
  tables: {
    t1: {
      tableId: 't1',
      tableNumber: 't1',
      roomId: 'room-1',
      section: 'A',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      x: 0.5,
      y: 0.5,
    },
    t2: {
      tableId: 't2',
      tableNumber: 't2',
      roomId: 'room-1',
      section: 'A',
      capacity: 2,
      shape: 'square',
      type: 'regular',
      x: 0.25,
      y: 0.25,
    },
  },
};

describe('floor builder store', () => {
  afterEach(() => {
    useBuilderStore.getState().reset();
    storage.delete('shire-floor-builder-store');
  });

  it('renames a table atomically for undo', () => {
    const store = useBuilderStore.getState();

    store.loadMap(floorMap);
    store.selectTable('t1');
    store.renameTable('t1', 't3', {
      tableId: 't3',
      tableNumber: 't3',
    });

    const renamedState = useBuilderStore.getState();
    expect(renamedState.undoStack).toHaveLength(1);
    expect(renamedState.selectedTableId).toBe('t3');
    expect(renamedState.draftMap?.tables.t1).toBeUndefined();
    expect(renamedState.draftMap?.tables.t3?.tableNumber).toBe('t3');
    expect(renamedState.draftMap?.rooms[0]?.rows[0]?.[0]).toBe('t3');

    renamedState.undo();

    const undoneState = useBuilderStore.getState();
    expect(undoneState.draftMap?.tables.t1?.tableNumber).toBe('t1');
    expect(undoneState.draftMap?.tables.t3).toBeUndefined();
    expect(undoneState.draftMap?.rooms[0]?.rows[0]?.[0]).toBe('t1');
  });

  it('toggles a table section with normalized values', () => {
    const store = useBuilderStore.getState();

    store.loadMap(floorMap);
    store.setTableSection('t1', 'Patio');

    expect(useBuilderStore.getState().draftMap?.tables.t1?.section).toBe('Patio');

    store.setTableSection('t1', '');

    expect(useBuilderStore.getState().draftMap?.tables.t1?.section).toBe('');
  });

  it('moves a table and records undo', () => {
    const store = useBuilderStore.getState();

    store.loadMap(floorMap);
    store.moveTable('t1', 0.8, 0.2);

    const movedState = useBuilderStore.getState();
    expect(movedState.draftMap?.tables.t1?.x).toBe(0.8);
    expect(movedState.draftMap?.tables.t1?.y).toBe(0.2);
    expect(movedState.isDirty).toBe(true);
    expect(movedState.undoStack).toHaveLength(1);

    movedState.undo();

    const undoneState = useBuilderStore.getState();
    expect(undoneState.draftMap?.tables.t1?.x).toBe(0.5);
    expect(undoneState.draftMap?.tables.t1?.y).toBe(0.5);
  });

  it('clears a section from all tables as one undoable edit', () => {
    const store = useBuilderStore.getState();

    store.loadMap(floorMap);
    store.clearSection('A');

    const clearedState = useBuilderStore.getState();
    expect(clearedState.undoStack).toHaveLength(1);
    expect(clearedState.draftMap?.tables.t1?.section).toBe('');
    expect(clearedState.draftMap?.tables.t2?.section).toBe('');

    clearedState.undo();

    const undoneState = useBuilderStore.getState();
    expect(undoneState.draftMap?.tables.t1?.section).toBe('A');
    expect(undoneState.draftMap?.tables.t2?.section).toBe('A');
  });

  it('saves, applies, and deletes permanent section plans', () => {
    const store = useBuilderStore.getState();

    store.loadMap(floorMap);
    store.saveCurrentSectionPlan({
      name: '2 Waiters',
      waiterCount: 2,
      isDefault: true,
    });

    const savedState = useBuilderStore.getState();
    const savedPlan = savedState.draftMap?.sectionPlans?.[0];
    expect(savedPlan?.name).toBe('2 Waiters');
    expect(savedPlan?.waiterCount).toBe(2);
    expect(savedPlan?.sections).toEqual([
      { sectionId: 'A', tableIds: ['t1', 't2'] },
      { sectionId: 'Section 2', tableIds: [] },
    ]);
    expect(savedState.draftMap?.activeSectionPlanId).toBe(savedPlan?.planId);

    store.setTableSection('t1', 'Patio');
    expect(useBuilderStore.getState().draftMap?.tables.t1?.section).toBe('Patio');

    store.applySectionPlan(savedPlan?.planId ?? '');
    expect(useBuilderStore.getState().draftMap?.tables.t1?.section).toBe('A');
    expect(useBuilderStore.getState().draftMap?.tables.t2?.section).toBe('A');

    store.deleteSectionPlan(savedPlan?.planId ?? '');
    expect(useBuilderStore.getState().draftMap?.sectionPlans).toEqual([]);
    expect(useBuilderStore.getState().draftMap?.activeSectionPlanId).toBeNull();
  });
});
