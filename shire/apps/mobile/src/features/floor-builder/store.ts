import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FloorMap, FloorMapTable, FloorMapRoom } from '@shire/shared';
import { zustandStorage } from '@/lib/storage';

export interface BuilderState {
  draftMap: FloorMap | null;
  selectedTableId: string | null;
  undoStack: FloorMap[];
  redoStack: FloorMap[];
  isDirty: boolean;
  snapToGrid: boolean;

  // Actions
  loadMap: (map: FloorMap) => void;
  addTable: (table: FloorMapTable) => void;
  removeTable: (tableId: string) => void;
  renameTable: (tableId: string, nextTableId: string, updates: Partial<FloorMapTable>) => void;
  updateTable: (tableId: string, updates: Partial<FloorMapTable>) => void;
  moveTable: (tableId: string, x: number, y: number) => void;
  selectTable: (tableId: string | null) => void;
  addRoom: (room: FloorMapRoom) => void;
  removeRoom: (roomId: string) => void;
  updateRoom: (roomId: string, updates: Partial<FloorMapRoom>) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
  setSnapToGrid: (snap: boolean) => void;
  reset: () => void;
}

function pushUndo(state: BuilderState): Pick<BuilderState, 'undoStack' | 'redoStack'> {
  if (!state.draftMap) return { undoStack: state.undoStack, redoStack: [] };
  return {
    undoStack: [...state.undoStack.slice(-19), state.draftMap],
    redoStack: [],
  };
}

const GRID_SNAP = 0.025; // ~2.5% increments

function snapValue(val: number, snap: boolean): number {
  if (!snap) return val;
  return Math.round(val / GRID_SNAP) * GRID_SNAP;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set) => ({
      draftMap: null,
      selectedTableId: null,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      snapToGrid: true,

      loadMap: (map) => {
        set({
          draftMap: map,
          selectedTableId: null,
          undoStack: [],
          redoStack: [],
          isDirty: false,
        });
      },

      addTable: (table) => {
        set((state) => {
          if (!state.draftMap) return state;
          const undo = pushUndo(state);
          return {
            ...undo,
            isDirty: true,
            selectedTableId: table.tableId,
            draftMap: {
              ...state.draftMap,
              tables: { ...state.draftMap.tables, [table.tableId]: table },
            },
          };
        });
      },

      removeTable: (tableId) => {
        set((state) => {
          if (!state.draftMap) return state;
          const undo = pushUndo(state);
          const { [tableId]: _, ...rest } = state.draftMap.tables;
          // Also remove from any room rows
          const rooms = state.draftMap.rooms.map((room) => ({
            ...room,
            rows: room.rows.map((row) => row.filter((id) => id !== tableId)),
          }));
          return {
            ...undo,
            isDirty: true,
            selectedTableId: state.selectedTableId === tableId ? null : state.selectedTableId,
            draftMap: { ...state.draftMap, tables: rest, rooms },
          };
        });
      },

      renameTable: (tableId, nextTableId, updates) => {
        set((state) => {
          if (!state.draftMap) return state;
          const table = state.draftMap.tables[tableId];
          if (!table) return state;

          const trimmedNextTableId = nextTableId.trim();
          if (!trimmedNextTableId || trimmedNextTableId === tableId) return state;
          if (state.draftMap.tables[trimmedNextTableId]) return state;

          const undo = pushUndo(state);
          const { [tableId]: _, ...rest } = state.draftMap.tables;
          const renamedTable: FloorMapTable = {
            ...table,
            ...updates,
            tableId: trimmedNextTableId,
          };
          const rooms = state.draftMap.rooms.map((room) => ({
            ...room,
            rows: room.rows.map((row) =>
              row.map((currentTableId) =>
                currentTableId === tableId ? trimmedNextTableId : currentTableId,
              ),
            ),
          }));

          return {
            ...undo,
            isDirty: true,
            selectedTableId:
              state.selectedTableId === tableId ? trimmedNextTableId : state.selectedTableId,
            draftMap: {
              ...state.draftMap,
              tables: {
                ...rest,
                [trimmedNextTableId]: renamedTable,
              },
              rooms,
            },
          };
        });
      },

      updateTable: (tableId, updates) => {
        set((state) => {
          if (!state.draftMap || !state.draftMap.tables[tableId]) return state;
          const undo = pushUndo(state);
          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              tables: {
                ...state.draftMap.tables,
                [tableId]: { ...state.draftMap.tables[tableId], ...updates },
              },
            },
          };
        });
      },

      moveTable: (tableId, x, y) => {
        set((state) => {
          if (!state.draftMap || !state.draftMap.tables[tableId]) return state;
          const snappedX = snapValue(Math.max(0, Math.min(1, x)), state.snapToGrid);
          const snappedY = snapValue(Math.max(0, Math.min(1, y)), state.snapToGrid);
          return {
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              tables: {
                ...state.draftMap.tables,
                [tableId]: {
                  ...state.draftMap.tables[tableId],
                  x: snappedX,
                  y: snappedY,
                },
              },
            },
          };
        });
      },

      selectTable: (tableId) => {
        set({ selectedTableId: tableId });
      },

      addRoom: (room) => {
        set((state) => {
          if (!state.draftMap) return state;
          const undo = pushUndo(state);
          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              rooms: [...state.draftMap.rooms, room],
            },
          };
        });
      },

      removeRoom: (roomId) => {
        set((state) => {
          if (!state.draftMap) return state;
          const undo = pushUndo(state);
          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              rooms: state.draftMap.rooms.filter((r) => r.roomId !== roomId),
            },
          };
        });
      },

      updateRoom: (roomId, updates) => {
        set((state) => {
          if (!state.draftMap) return state;
          const undo = pushUndo(state);
          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              rooms: state.draftMap.rooms.map((r) =>
                r.roomId === roomId ? { ...r, ...updates } : r,
              ),
            },
          };
        });
      },

      undo: () => {
        set((state) => {
          if (state.undoStack.length === 0 || !state.draftMap) return state;
          const previous = state.undoStack[state.undoStack.length - 1];
          return {
            draftMap: previous,
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, state.draftMap],
            isDirty: true,
          };
        });
      },

      redo: () => {
        set((state) => {
          if (state.redoStack.length === 0 || !state.draftMap) return state;
          const next = state.redoStack[state.redoStack.length - 1];
          return {
            draftMap: next,
            undoStack: [...state.undoStack, state.draftMap],
            redoStack: state.redoStack.slice(0, -1),
            isDirty: true,
          };
        });
      },

      markClean: () => {
        set({ isDirty: false });
      },

      setSnapToGrid: (snap) => {
        set({ snapToGrid: snap });
      },

      reset: () => {
        set({
          draftMap: null,
          selectedTableId: null,
          undoStack: [],
          redoStack: [],
          isDirty: false,
        });
      },
    }),
    {
      name: 'shire-floor-builder-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        draftMap: state.draftMap,
        isDirty: state.isDirty,
        snapToGrid: state.snapToGrid,
      }),
    },
  ),
);
