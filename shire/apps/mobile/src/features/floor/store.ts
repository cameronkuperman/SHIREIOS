import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ConnectionState,
  FloorTableStateMode,
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
  staleCheckAt: number;
  applySnapshot: (snapshot: FloorSnapshot) => void;
  applyStreamMessage: (message: FloorStreamMessage) => void;
  queuePendingCommand: (command: TableCommand) => void;
  rejectPendingCommand: (commandId: string, tableId: string, reason: string) => void;
  setConnectionState: (connectionState: ConnectionState) => void;
  setSyncError: (syncError: string | null) => void;
  setFloorMap: (floorMap: FloorMap) => void;
  setCctvSyncEnabled: (enabled: boolean) => void;
  setTableStateMode: (tableStateMode: FloorTableStateMode) => void;
  touchStaleClock: () => void;
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
      cctvSyncEnabled: true,
      tableStateMode: 'hybrid',
      connectionState: 'idle',
      staleCheckAt: Date.now(),
      applySnapshot: (snapshot) => {
        set((state) => ({
          ...state,
          ...applyFloorSnapshotState(state, snapshot),
          staleCheckAt: Date.now(),
        }));
      },
      applyStreamMessage: (message) => {
        set((state) => ({
          ...state,
          ...applyFloorStreamMessageState(state, message),
          staleCheckAt: Date.now(),
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
      setCctvSyncEnabled: (cctvSyncEnabled) => {
        set({
          cctvSyncEnabled,
          tableStateMode: cctvSyncEnabled ? 'hybrid' : 'manual',
        });
      },
      setTableStateMode: (tableStateMode) => {
        set({
          tableStateMode,
          cctvSyncEnabled: tableStateMode !== 'manual',
        });
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
            staleCheckAt: Date.now(),
          };
        });
      },
      touchStaleClock: () => {
        set({ staleCheckAt: Date.now() });
      },
      resetSessionState: () => {
        set((state) => ({
          tablesById: buildDefaultTablesById(state.floorMap),
          lastSnapshotAt: null,
          lastAppliedSequence: 0,
          pendingCommands: {},
          syncError: null,
          tableStateMode: state.tableStateMode,
          connectionState: 'idle',
          staleCheckAt: Date.now(),
        }));
      },
      resetVolatileState: () => {
        set({
          connectionState: 'idle',
          pendingCommands: {},
          syncError: null,
          staleCheckAt: Date.now(),
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
          cctvSyncEnabled: nextState.cctvSyncEnabled ?? true,
          tableStateMode: nextState.tableStateMode ?? 'hybrid',
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
        cctvSyncEnabled: state.cctvSyncEnabled,
        tableStateMode: state.tableStateMode,
      }),
    },
  ),
);

type FloorSelectorState = {
  floorMap: FloorMap;
  tablesById: Record<string, TableLiveState>;
  pendingCommands: Record<string, PendingCommandEntry>;
  routing: WaiterRoutingState | null;
  staleCheckAt: number;
};

function useFloorDerivedInputs(): FloorSelectorState {
  const routing = useWaiterRoutingStore((state) => state.routing);
  return useFloorStore(
    useShallow((state) => ({
      floorMap: state.floorMap,
      tablesById: state.tablesById,
      pendingCommands: state.pendingCommands,
      staleCheckAt: state.staleCheckAt,
      routing,
    })),
  );
}

export function useFloorTablesByRoom(): FloorRoomViewModel[] {
  const { floorMap, tablesById, pendingCommands, routing, staleCheckAt } = useFloorDerivedInputs();

  return useMemo(
    () => selectTablesByRoom(floorMap, tablesById, pendingCommands, routing, staleCheckAt),
    [floorMap, pendingCommands, routing, staleCheckAt, tablesById],
  );
}

export function useAvailableTables() {
  const { floorMap, tablesById, pendingCommands, routing, staleCheckAt } = useFloorDerivedInputs();

  return useMemo(
    () => selectAvailableTables(floorMap, tablesById, pendingCommands, routing, staleCheckAt),
    [floorMap, pendingCommands, routing, staleCheckAt, tablesById],
  );
}

export function useQuickSeatSuggestions(): QuickSeatSuggestion[] {
  const { floorMap, tablesById, pendingCommands, routing, staleCheckAt } = useFloorDerivedInputs();

  return useMemo(
    () => selectQuickSeatSuggestions(floorMap, tablesById, pendingCommands, routing, staleCheckAt),
    [floorMap, pendingCommands, routing, staleCheckAt, tablesById],
  );
}

export function useTableDetails(tableId: string | null): TableDetailsViewModel | null {
  const { floorMap, tablesById, pendingCommands, routing, staleCheckAt } = useFloorDerivedInputs();

  return useMemo(
    () => selectTableDetails(floorMap, tablesById, pendingCommands, routing, tableId, staleCheckAt),
    [floorMap, pendingCommands, routing, staleCheckAt, tableId, tablesById],
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
