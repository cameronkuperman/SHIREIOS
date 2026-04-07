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
    store.renameTable('t1', 't2', {
      tableId: 't2',
      tableNumber: 't2',
    });

    const renamedState = useBuilderStore.getState();
    expect(renamedState.undoStack).toHaveLength(1);
    expect(renamedState.selectedTableId).toBe('t2');
    expect(renamedState.draftMap?.tables.t1).toBeUndefined();
    expect(renamedState.draftMap?.tables.t2?.tableNumber).toBe('t2');
    expect(renamedState.draftMap?.rooms[0]?.rows[0]?.[0]).toBe('t2');

    renamedState.undo();

    const undoneState = useBuilderStore.getState();
    expect(undoneState.draftMap?.tables.t1?.tableNumber).toBe('t1');
    expect(undoneState.draftMap?.tables.t2).toBeUndefined();
    expect(undoneState.draftMap?.rooms[0]?.rows[0]?.[0]).toBe('t1');
  });
});
