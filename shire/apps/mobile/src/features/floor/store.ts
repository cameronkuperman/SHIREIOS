import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ConnectionState,
  FloorMap,
  FloorSnapshot,
  FloorStreamMessage,
  TableCommand,
  TableLiveState,
  WaiterRoutingState,
} from '@shire/shared';
import { zustandStorage } from '@/lib/storage';
import { useWaiterRoutingStore } from '@/features/routing';
import { DEFAULT_FLOOR_ID, DEFAULT_FLOOR_MAP } from './floorMap';
import { normalizeFloorMap } from './mapContract';
import {
  applyFloorSnapshotState,
  applyFloorStreamMessageState,
  buildDefaultTablesById,
  type FloorRoomViewModel,
  type FloorStoreData,
  type PendingCommandEntry,
  type QuickSeatSuggestion,
  queuePendingCommandState,
  rejectPendingCommandState,
  selectAvailableTables,
  selectQuickSeatSuggestions,
  selectTableDetails,
  selectTablesByRoom,
  type TableDetailsViewModel,
} from './state';

type FloorStoreState = FloorStoreData & {
  connectionState: ConnectionState;
  floorMap: FloorMap;
  applySnapshot: (snapshot: FloorSnapshot) => void;
  applyStreamMessage: (message: FloorStreamMessage) => void;
  queuePendingCommand: (command: TableCommand) => void;
  rejectPendingCommand: (commandId: string, tableId: string, reason: string) => void;
  setConnectionState: (connectionState: ConnectionState) => void;
  setSyncError: (syncError: string | null) => void;
  setFloorMap: (floorMap: FloorMap) => void;
  resetSessionState: () => void;
  resetVolatileState: () => void;
};

const initialTables = buildDefaultTablesById(DEFAULT_FLOOR_MAP);

export const useFloorStore = create<FloorStoreState>()(
  persist(
    (set) => ({
      floorId: DEFAULT_FLOOR_ID,
      floorMap: DEFAULT_FLOOR_MAP,
      mapVersion: DEFAULT_FLOOR_MAP.mapVersion,
      tablesById: initialTables,
      lastSnapshotAt: null,
      lastAppliedSequence: 0,
      pendingCommands: {},
      syncError: null,
      connectionState: 'idle',
      applySnapshot: (snapshot) => {
        set((state) => ({
          ...state,
          ...applyFloorSnapshotState(state, snapshot),
        }));
      },
      applyStreamMessage: (message) => {
        set((state) => ({
          ...state,
          ...applyFloorStreamMessageState(state, message),
        }));
      },
      queuePendingCommand: (command) => {
        set((state) => ({
          ...state,
          ...queuePendingCommandState(state, command),
        }));
      },
      rejectPendingCommand: (commandId, tableId, reason) => {
        set((state) => ({
          ...state,
          ...rejectPendingCommandState(state, commandId, tableId, reason),
        }));
      },
      setConnectionState: (connectionState) => {
        set({ connectionState });
      },
      setSyncError: (syncError) => {
        set({ syncError });
      },
      setFloorMap: (floorMap) => {
        const normalizedFloorMap = normalizeFloorMap(floorMap);
        set((state) => {
          const shouldResetTables =
            state.floorMap.floorId !== normalizedFloorMap.floorId ||
            state.mapVersion !== normalizedFloorMap.mapVersion;
          const nextTablesById =
            !shouldResetTables && Object.keys(state.tablesById).length > 0
              ? state.tablesById
              : buildDefaultTablesById(normalizedFloorMap);

          return {
            floorMap: normalizedFloorMap,
            floorId: normalizedFloorMap.floorId,
            mapVersion: normalizedFloorMap.mapVersion,
            tablesById: nextTablesById,
            lastSnapshotAt: shouldResetTables ? null : state.lastSnapshotAt,
            lastAppliedSequence: shouldResetTables ? 0 : state.lastAppliedSequence,
          };
        });
      },
      resetSessionState: () => {
        set((state) => ({
          tablesById: buildDefaultTablesById(state.floorMap),
          lastSnapshotAt: null,
          lastAppliedSequence: 0,
          pendingCommands: {},
          syncError: null,
          connectionState: 'idle',
        }));
      },
      resetVolatileState: () => {
        set({
          connectionState: 'idle',
          pendingCommands: {},
          syncError: null,
        });
      },
    }),
    {
      name: 'shire-floor-store',
      storage: createJSONStorage(() => zustandStorage),
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }

        const nextState = persistedState as Partial<FloorStoreState> & {
          floorMap?: unknown;
          tablesById?: Record<string, TableLiveState>;
        };
        const floorMap = normalizeFloorMap(nextState.floorMap);
        const tablesById =
          nextState.tablesById && Object.keys(nextState.tablesById).length > 0
            ? nextState.tablesById
            : buildDefaultTablesById(floorMap);

        return {
          ...currentState,
          ...nextState,
          floorMap,
          floorId: floorMap.floorId,
          mapVersion: floorMap.mapVersion,
          tablesById,
          pendingCommands: {},
          syncError: null,
          connectionState: 'idle',
        };
      },
      partialize: (state) => ({
        floorId: state.floorId,
        floorMap: state.floorMap,
        mapVersion: state.mapVersion,
        tablesById: state.tablesById,
        lastSnapshotAt: state.lastSnapshotAt,
        lastAppliedSequence: state.lastAppliedSequence,
      }),
    },
  ),
);

type FloorSelectorState = {
  floorMap: FloorMap;
  tablesById: Record<string, TableLiveState>;
  pendingCommands: Record<string, PendingCommandEntry>;
  routing: WaiterRoutingState | null;
};

function useFloorDerivedInputs(): FloorSelectorState {
  const routing = useWaiterRoutingStore((state) => state.routing);
  return useFloorStore(
    useShallow((state) => ({
      floorMap: state.floorMap,
      tablesById: state.tablesById,
      pendingCommands: state.pendingCommands,
      routing,
    })),
  );
}

export function useFloorTablesByRoom(): FloorRoomViewModel[] {
  const { floorMap, tablesById, pendingCommands, routing } = useFloorDerivedInputs();

  return useMemo(
    () => selectTablesByRoom(floorMap, tablesById, pendingCommands, routing),
    [floorMap, pendingCommands, routing, tablesById],
  );
}

export function useAvailableTables() {
  const { floorMap, tablesById, pendingCommands, routing } = useFloorDerivedInputs();

  return useMemo(
    () => selectAvailableTables(floorMap, tablesById, pendingCommands, routing),
    [floorMap, pendingCommands, routing, tablesById],
  );
}

export function useQuickSeatSuggestions(): QuickSeatSuggestion[] {
  const { floorMap, tablesById, pendingCommands, routing } = useFloorDerivedInputs();

  return useMemo(
    () => selectQuickSeatSuggestions(floorMap, tablesById, pendingCommands, routing),
    [floorMap, pendingCommands, routing, tablesById],
  );
}

export function useTableDetails(tableId: string | null): TableDetailsViewModel | null {
  const { floorMap, tablesById, pendingCommands, routing } = useFloorDerivedInputs();

  return useMemo(
    () => selectTableDetails(floorMap, tablesById, pendingCommands, routing, tableId),
    [floorMap, pendingCommands, routing, tableId, tablesById],
  );
}

export function useFloorConnectionState() {
  const connectionState = useFloorStore((state) => state.connectionState);
  const syncError = useFloorStore((state) => state.syncError);
  const lastSnapshotAt = useFloorStore((state) => state.lastSnapshotAt);
  const floorId = useFloorStore((state) => state.floorId);

  return useMemo(
    () => ({
      connectionState,
      syncError,
      lastSnapshotAt,
      floorId,
    }),
    [connectionState, floorId, lastSnapshotAt, syncError],
  );
}
