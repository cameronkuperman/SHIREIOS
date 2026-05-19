import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FloorMap, FloorMapTable, FloorMapRoom } from '@shire/shared';
import { zustandStorage } from '@/lib/storage';
import { applySectionPlanToFloorMap, buildSectionPlanFromFloorMap } from '@/features/floor/sectionPlans';

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
  setTableSection: (tableId: string, section: string) => void;
  clearSection: (section: string) => void;
  saveCurrentSectionPlan: (input: {
    planId?: string;
    name: string;
    waiterCount: number;
    isDefault?: boolean;
  }) => void;
  applySectionPlan: (planId: string) => void;
  deleteSectionPlan: (planId: string) => void;
  moveTable: (tableId: string, x: number, y: number) => void;
  selectTable: (tableId: string | null) => void;
  addRoom: (room: FloorMapRoom) => void;
  removeRoom: (roomId: string) => void;
  updateRoom: (roomId: string, updates: Partial<FloorMapRoom>) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
  setSnapToGrid: (snap: boolean) => void;
  setMapZoom: (zoom: number) => void;
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

function normalizeSectionName(section: string): string {
  return section.trim().replace(/\s+/g, ' ');
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

      setMapZoom: (zoom) => {
        set((state) => {
          if (!state.draftMap || state.draftMap.zoom === zoom) return state;
          return {
            isDirty: true,
            draftMap: { ...state.draftMap, zoom },
          };
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

      setTableSection: (tableId, section) => {
        set((state) => {
          const table = state.draftMap?.tables[tableId];
          const nextSection = normalizeSectionName(section);
          if (
            !state.draftMap ||
            !table ||
            normalizeSectionName(table.section ?? '') === nextSection
          ) {
            return state;
          }
          const undo = pushUndo(state);
          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              tables: {
                ...state.draftMap.tables,
                [tableId]: { ...table, section: nextSection },
              },
            },
          };
        });
      },

      clearSection: (section) => {
        set((state) => {
          if (!state.draftMap) return state;
          const matchingTables = Object.values(state.draftMap.tables).filter(
            (table) => normalizeSectionName(table.section) === section,
          );
          if (matchingTables.length === 0) return state;

          const undo = pushUndo(state);
          const tables = { ...state.draftMap.tables };
          for (const table of matchingTables) {
            tables[table.tableId] = { ...table, section: '' };
          }

          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              tables,
            },
          };
        });
      },

      saveCurrentSectionPlan: (input) => {
        set((state) => {
          if (!state.draftMap) return state;
          const waiterCount = Math.max(1, Math.round(input.waiterCount || 1));
          const existingPlan = input.planId
            ? state.draftMap.sectionPlans?.find((plan) => plan.planId === input.planId)
            : null;
          const plan = {
            ...buildSectionPlanFromFloorMap(state.draftMap, {
              planId: existingPlan?.planId,
              name: input.name,
              waiterCount,
              isDefault: input.isDefault ?? existingPlan?.isDefault,
            }),
            createdAt: existingPlan?.createdAt ?? new Date().toISOString(),
          };
          const undo = pushUndo(state);
          const sectionPlans = [
            ...(state.draftMap.sectionPlans ?? []).filter((current) => current.planId !== plan.planId),
            plan,
          ]
            .map((current) =>
              plan.isDefault && current.waiterCount === plan.waiterCount
                ? { ...current, isDefault: current.planId === plan.planId }
                : current,
            )
            .sort((left, right) => left.waiterCount - right.waiterCount || left.name.localeCompare(right.name));

          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              sectionPlans,
              activeSectionPlanId: plan.planId,
            },
          };
        });
      },

      applySectionPlan: (planId) => {
        set((state) => {
          if (!state.draftMap) return state;
          const plan = state.draftMap.sectionPlans?.find((current) => current.planId === planId);
          if (!plan) return state;
          const undo = pushUndo(state);
          return {
            ...undo,
            isDirty: true,
            draftMap: applySectionPlanToFloorMap(state.draftMap, plan),
          };
        });
      },

      deleteSectionPlan: (planId) => {
        set((state) => {
          if (!state.draftMap) return state;
          const currentPlans = state.draftMap.sectionPlans ?? [];
          if (!currentPlans.some((plan) => plan.planId === planId)) return state;
          const undo = pushUndo(state);
          const sectionPlans = currentPlans.filter((plan) => plan.planId !== planId);
          return {
            ...undo,
            isDirty: true,
            draftMap: {
              ...state.draftMap,
              sectionPlans,
              activeSectionPlanId:
                state.draftMap.activeSectionPlanId === planId
                  ? (sectionPlans[0]?.planId ?? null)
                  : state.draftMap.activeSectionPlanId,
            },
          };
        });
      },

      moveTable: (tableId, x, y) => {
        set((state) => {
          if (!state.draftMap || !state.draftMap.tables[tableId]) return state;
          const snappedX = snapValue(Math.max(0, Math.min(1, x)), state.snapToGrid);
          const snappedY = snapValue(Math.max(0, Math.min(1, y)), state.snapToGrid);
          const undo = pushUndo(state);
          return {
            ...undo,
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
