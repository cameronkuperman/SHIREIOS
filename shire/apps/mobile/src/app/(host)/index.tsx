import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  LayoutRectangle,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth';
import { MOCK_WAITERS } from '@/features/routing/mockWaiters';
import {
  DEFAULT_FLOOR_MAP,
  useFloorActions,
  useFloorConnectionState,
  useFloorStore,
  useFloorTablesByRoom,
  useTableDetails,
} from '@/features/floor';
import { floorRealtimeRepository } from '@/features/floor/repository';
import { AddPartyModal } from '@/components/AddPartyModal';
import { FloorRoomPill, type FloorRoomOption } from '@/components/FloorRoomPill';
import { FloorStatusBar } from '@/components/FloorStatusBar';
import { HostPersonDetailSheet } from '@/components/HostPersonDetailSheet';
import { NextUpCard } from '@/components/NextUpCard';
import { SeatPartyModal } from '@/components/SeatPartyModal';
import { ShiftSetupSheet } from '@/components/ShiftSetupSheet';
import { Table } from '@/components/Table';
import { TablePopover } from '@/components/TablePopover';
import { WaitlistCard } from '@/components/WaitlistCard';
import { Panel, SegmentedControl } from '@/components/ui';
import {
  type HostSidebarParty,
  useActiveWaitlistEntries,
  useFloorSidebarParties,
  useReservationDayBook,
  useReservationMutations,
  useWaitlistMutations,
} from '@/features/host/hooks';
import { usePendingSeatStore } from '@/features/host/pendingSeatStore';
import { extractHostRequestErrorMessage } from '@/features/host/errors';
import {
  getRoutingModeSwitchWarnings,
  getWaiterById,
  resolveWaiterForTable,
  resolveWaiterIdForTable,
  useWaiterRoutingActions,
  useWaiterChips,
  useWaiterColorMap,
  useWaiterRoutingState,
} from '@/features/routing';
import type { TableParty, WaiterRoutingMode } from '@shire/shared';
import { borderRadius, fontFamily, spacing, type StatusKey, textStyles, useTheme } from '@/theme';

function toTableParty(party: HostSidebarParty): TableParty {
  return { id: party.id, name: party.name, size: party.size, source: party.source };
}

function createReservationSeatCommandId(): string {
  return `reservation-seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatConnectionLabel(connectionState: string, hasSnapshot: boolean) {
  if (connectionState === 'error' || connectionState === 'disconnected') return 'Manual';
  if (connectionState === 'connected' && hasSnapshot) return 'Synced';
  return 'Syncing';
}

type TableSizeBucket = '1-2' | '3-4' | '5+';
const TABLE_DIMENSIONS = {
  circle: { width: 64, height: 64 },
  square: { width: 64, height: 64 },
  horizontal: { width: 140, height: 64 },
} as const;
/** Reserve space so tables + zoom transform cannot cover All Rooms / status chrome. */
const MAP_BOTTOM_UI_INSET = 72;
/** Stacking above the tables layer (transform creates a native layer that steals taps). */
const MAP_CHROME_Z_INDEX = 100;
const MOCK_NEXT_UP_TABLE_LABELS: string[][] = [
  ['12', '14', '18'],
  ['3', '7'],
  ['9', '10', '11'],
  ['21', '22'],
  ['5', '6', '8'],
];

function tableSizeBucket(capacity: number): TableSizeBucket {
  if (capacity <= 2) return '1-2';
  if (capacity <= 4) return '3-4';
  return '5+';
}
function tableMatchesSizeFilters(capacity: number, filters: TableSizeBucket[]): boolean {
  return filters.length === 0 || filters.includes(tableSizeBucket(capacity));
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

type NextUpEntry = {
  waiterId: string;
  waiterName: string;
  tables: { id: string; label: string }[];
};

function addTableLookup(
  lookup: Map<string, { id: string; label: string }>,
  key: string | null | undefined,
  table: { id: string; label: string },
) {
  const normalized = key?.trim();
  if (normalized) {
    lookup.set(normalized, table);
  }
}

export default function FloorPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { currentLocation } = useAuth();
  const { routing, isSaving: isRoutingSaving } = useWaiterRoutingState();
  const { setRoutingMode } = useWaiterRoutingActions();
  const waiterColorMap = useWaiterColorMap();
  const waiterChips = useWaiterChips();
  const rooms = useFloorTablesByRoom();
  const floorMap = useFloorStore((state) => state.floorMap);
  const floorIdForCommands = useFloorStore((state) => state.floorId);
  const queuePendingCommand = useFloorStore((state) => state.queuePendingCommand);
  const rejectPendingCommand = useFloorStore((state) => state.rejectPendingCommand);
  const cctvSyncEnabled = useFloorStore((state) => state.cctvSyncEnabled);
  const tableStateMode = useFloorStore((state) => state.tableStateMode);
  const applySnapshot = useFloorStore((state) => state.applySnapshot);
  const setCctvSyncEnabled = useFloorStore((state) => state.setCctvSyncEnabled);
  const { seatParty, seatWalkIn, clearTable, markDirty, markClean, blockTable, unblockTable } =
    useFloorActions();
  const { connectionState, lastSnapshotAt } = useFloorConnectionState();
  const activeWaitlistEntries = useActiveWaitlistEntries();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const reservationBook = useReservationDayBook(today);
  const hostParties = useFloorSidebarParties();
  const { updateReservation, runReservationAction } = useReservationMutations();
  const { createWaitlistEntry, updateWaitlistEntry, runWaitlistAction } = useWaitlistMutations();
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showSeatPartyModal, setShowSeatPartyModal] = useState(false);
  const [showShiftSetup, setShowShiftSetup] = useState(false);
  const [isTableModeSaving, setIsTableModeSaving] = useState(false);
  const markPendingSeat = usePendingSeatStore((state) => state.markPendingSeat);
  const rollbackPendingSeat = usePendingSeatStore((state) => state.rollbackPendingSeat);

  const [activeFilter, setActiveFilter] = useState('All Rooms');
  const [sizeFilters] = useState<TableSizeBucket[]>([]);
  const [leftTab, setLeftTab] = useState<'waitlist' | 'reservations'>('waitlist');
  const [seatWaiterId, setSeatWaiterId] = useState<string | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<{
    source: HostSidebarParty['source'];
    id: string;
  } | null>(null);
  const [popover, setPopover] = useState<{ tableId: string; layout: LayoutRectangle } | null>(null);
  const [mapSize, setMapSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const handleMapLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const tableRefs = useRef<Record<string, View | null>>({});
  const liveTable = useTableDetails(popover?.tableId ?? null);
  const visibleRooms =
    activeFilter === 'All Rooms'
      ? rooms
      : rooms.filter((room) => room.filterLabel === activeFilter);

  const roomOptions = useMemo<FloorRoomOption[]>(() => {
    const totalTables = rooms.reduce((sum, room) => sum + room.tables.length, 0);
    const options: FloorRoomOption[] = [
      { id: 'All Rooms', label: 'All Rooms', tableCount: totalTables },
    ];
    const seen = new Set<string>();
    for (const room of rooms) {
      if (seen.has(room.filterLabel)) continue;
      seen.add(room.filterLabel);
      const count = rooms
        .filter((other) => other.filterLabel === room.filterLabel)
        .reduce((sum, other) => sum + other.tables.length, 0);
      options.push({ id: room.filterLabel, label: room.filterLabel, tableCount: count });
    }
    return options;
  }, [rooms]);

  const waitlistParties = useMemo(
    () => hostParties.filter((party) => party.source === 'waitlist'),
    [hostParties],
  );
  const reservationParties = useMemo(
    () => hostParties.filter((party) => party.source === 'reservations'),
    [hostParties],
  );
  const visibleTablesFlat = useMemo(
    () => visibleRooms.flatMap((room) => room.tables),
    [visibleRooms],
  );
  const allTablesFlat = useMemo(() => rooms.flatMap((room) => room.tables), [rooms]);

  const nextUpRotation = useMemo<NextUpEntry[]>(() => {
    if (!routing) return [];
    const tableByRoutingId = new Map<string, { id: string; label: string }>();
    for (const table of allTablesFlat) {
      addTableLookup(tableByRoutingId, table.id, table);
      addTableLookup(tableByRoutingId, table.backendTableId, table);
      addTableLookup(tableByRoutingId, table.label, table);
    }
    const queueRows = (routing.nextUpQueue ?? [])
      .slice(0, 4)
      .map((entry) => {
        if (!routing.activeWaiterIds.includes(entry.waiterId)) return null;
        const waiter = routing.waiters.find((w) => w.id === entry.waiterId);
        if (!waiter) return null;
        const tables = entry.tableIds
          .map((tableId) => tableByRoutingId.get(tableId))
          .filter((table): table is NonNullable<typeof table> => Boolean(table))
          .map((table) => ({ id: table.id, label: table.label }));
        if (tables.length === 0) return null;
        return {
          waiterId: entry.waiterId,
          waiterName: waiter.name,
          tables,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    if (queueRows.length > 0) return queueRows;

    const availableTables = allTablesFlat.filter(
      (table) => table.status === 'available' && !table.isBlocked,
    );
    const tablesByWaiter = new Map<string, typeof availableTables>();
    for (const table of availableTables) {
      const section = floorMap.tables[table.id]?.section ?? '';
      const waiterId = resolveWaiterIdForTable(routing, table.id, section, table.backendTableId);
      if (!waiterId || !routing.activeWaiterIds.includes(waiterId)) continue;
      tablesByWaiter.set(waiterId, [...(tablesByWaiter.get(waiterId) ?? []), table]);
    }
    const orderedWaiterIds = [
      ...(routing.nextWaiterId ? [routing.nextWaiterId] : []),
      ...routing.rotationOrder,
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    return orderedWaiterIds
      .filter((waiterId) => routing.activeWaiterIds.includes(waiterId))
      .map((waiterId) => {
        const waiter = routing.waiters.find((w) => w.id === waiterId);
        if (!waiter) return null;
        const tablesForWaiter = (tablesByWaiter.get(waiterId) ?? []).sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        );
        return { waiterId, waiterName: waiter.name, tables: tablesForWaiter };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [routing, allTablesFlat, floorMap.tables]);
  const nextUpRows = useMemo<NextUpEntry[]>(() => {
    if (nextUpRotation.length > 0) return nextUpRotation;
    if (routing) return [];

    const availableTables = allTablesFlat
      .filter((table) => table.status === 'available' && !table.isBlocked)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

    return MOCK_WAITERS.slice(0, 5).map((waiter, index) => {
      const liveLabels = availableTables
        .filter((_, tableIndex) => tableIndex % 5 === index)
        .slice(0, 4)
        .map((table) => ({ id: table.id, label: table.label }));
      const mockLabels = MOCK_NEXT_UP_TABLE_LABELS[index] ?? [];
      return {
        waiterId: waiter.id,
        waiterName: waiter.name,
        tables:
          liveLabels.length > 0
            ? liveLabels
            : mockLabels.map((label) => ({ id: `mock-${waiter.id}-${label}`, label })),
      };
    });
  }, [nextUpRotation, routing, allTablesFlat]);
  const nextGratRows = useMemo<NextUpEntry[]>(() => {
    if (!routing) return [];
    const threshold = routing.gratThreshold ?? 6;
    const gratTables = allTablesFlat.filter(
      (table) => table.status === 'available' && !table.isBlocked && table.capacity >= threshold,
    );
    const tablesByWaiter = new Map<string, typeof gratTables>();
    for (const table of gratTables) {
      const backendNextGratWaiter = table.backendTableId
        ? routing.nextGratByTable?.[table.backendTableId]
        : undefined;
      const section = floorMap.tables[table.id]?.section ?? '';
      const waiterId =
        backendNextGratWaiter ??
        routing.nextGratByTable?.[table.id] ??
        routing.nextGratBySection?.[section] ??
        routing.nextGratWaiterId;
      if (!waiterId || !routing.activeWaiterIds.includes(waiterId)) continue;
      tablesByWaiter.set(waiterId, [...(tablesByWaiter.get(waiterId) ?? []), table]);
    }
    const orderedWaiterIds = [
      ...(routing.nextGratWaiterId ? [routing.nextGratWaiterId] : []),
      ...(routing.gratRotationState?.rotationOrder ?? []),
      ...routing.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);
    return orderedWaiterIds
      .filter((waiterId) => routing.activeWaiterIds.includes(waiterId))
      .map((waiterId) => {
        const waiter = routing.waiters.find((w) => w.id === waiterId);
        if (!waiter) return null;
        const tablesForWaiter = (tablesByWaiter.get(waiterId) ?? []).sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        );
        return { waiterId, waiterName: waiter.name, tables: tablesForWaiter };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [routing, allTablesFlat, floorMap.tables]);

  const routingModeLabel = routing?.mode === 'section' ? 'Sections' : 'Rotation';
  const routingModeIcon = routing?.mode === 'section' ? 'grid-outline' : 'repeat-outline';
  const routingModeSwitchLabel =
    routing?.mode === 'section' ? 'Switch to rotation' : 'Switch to sections';

  const commitRoutingMode = useCallback(
    (mode: WaiterRoutingMode) => {
      setRoutingMode(mode).catch((error) => {
        Alert.alert(
          'Mode switch failed',
          error instanceof Error ? error.message : 'Could not change the seating mode.',
        );
      });
    },
    [setRoutingMode],
  );

  const handleToggleRoutingMode = useCallback(() => {
    if (!routing || isRoutingSaving) return;
    const nextMode: WaiterRoutingMode = routing.mode === 'section' ? 'manual_rotation' : 'section';
    const warnings = getRoutingModeSwitchWarnings(routing, floorMap, nextMode);
    if (warnings.length === 0) {
      commitRoutingMode(nextMode);
      return;
    }

    const warningText = warnings
      .map((warning) => {
        if (warning.names.length === 0) return warning.message;
        return `${warning.message}\n${warning.names.join(', ')}`;
      })
      .join('\n\n');

    Alert.alert(
      'Switch to Sections?',
      `${warningText}\n\nSeating will still work, but unassigned sections may fall back to rotation.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Switch Anyway', onPress: () => commitRoutingMode(nextMode) },
      ],
    );
  }, [commitRoutingMode, floorMap, isRoutingSaving, routing]);

  const serverBadgeForTable = useCallback(
    (serverName?: string, serverId?: string | null) => {
      if (!serverName) return undefined;
      return {
        initials: initialsForName(serverName),
        color: serverId
          ? (waiterColorMap[serverId] ?? colors.status.occupied.text)
          : colors.status.occupied.text,
      };
    },
    [colors.status.occupied.text, waiterColorMap],
  );

  // Render the floor at the proportions it was designed with in the builder,
  // scaled to fit — so the live floor matches the builder instead of cramming.
  const floorDesign = useMemo(() => {
    const mapHeight = Math.max(0, mapSize.height - MAP_BOTTOM_UI_INSET);
    const hasDesign =
      typeof floorMap.canvasWidth === 'number' &&
      typeof floorMap.canvasHeight === 'number' &&
      floorMap.canvasWidth > 0 &&
      floorMap.canvasHeight > 0;
    const designWidth = hasDesign ? floorMap.canvasWidth! : mapSize.width;
    const designHeight = hasDesign ? floorMap.canvasHeight! : mapHeight;
    const fit =
      hasDesign && designWidth > 0 && designHeight > 0
        ? Math.min(mapSize.width / designWidth, mapHeight / designHeight)
        : 1;
    return { designWidth, designHeight, fit, mapHeight };
  }, [mapSize, floorMap.canvasWidth, floorMap.canvasHeight]);

  type GlobalTablePos = {
    table: (typeof visibleRooms)[number]['tables'][number];
    x: number;
    y: number;
    rotation?: number;
  };
  const positionedTables = useMemo<GlobalTablePos[]>(() => {
    if (mapSize.width === 0 || mapSize.height === 0) return [];
    const out: GlobalTablePos[] = [];
    const mapHeight = Math.max(0, mapSize.height - MAP_BOTTOM_UI_INSET);
    const totalFlex = visibleRooms.reduce((sum, r) => sum + (r.flex ?? 1), 0) || 1;
    let leftFlex = 0;
    for (const room of visibleRooms) {
      const roomFlex = room.flex ?? 1;
      const left = (leftFlex / totalFlex) * mapSize.width;
      const width = (roomFlex / totalFlex) * mapSize.width;
      leftFlex += roomFlex;
      if (room.layoutMode === 'freeform') {
        for (const table of room.tables) {
          out.push({
            table,
            x: (table.x ?? 0.5) * floorDesign.designWidth,
            y: (table.y ?? 0.5) * floorDesign.designHeight,
            rotation: table.rotation,
          });
        }
      } else {
        const totalRows = room.rows.length || 1;
        room.rows.forEach((row, rowIdx) => {
          const totalCols = row.length || 1;
          row.forEach((table, colIdx) => {
            out.push({
              table,
              x: left + ((colIdx + 0.5) / totalCols) * width,
              y: ((rowIdx + 0.5) / totalRows) * mapHeight,
            });
          });
        });
      }
    }
    return out;
  }, [visibleRooms, mapSize, floorDesign]);

  const isUsingStarterMap =
    floorMap.floorId === DEFAULT_FLOOR_MAP.floorId &&
    floorMap.mapVersion === DEFAULT_FLOOR_MAP.mapVersion;

  const hasSnapshot = Boolean(lastSnapshotAt);
  const connectionLabel = formatConnectionLabel(connectionState, hasSnapshot);
  const connectionColor =
    connectionLabel === 'Manual'
      ? colors.status.dirty.text
      : connectionLabel === 'Synced'
        ? colors.status.available.text
        : colors.status.reserved.text;

  const handleToggleCctvSync = useCallback(async () => {
    if (!currentLocation || isTableModeSaving) {
      return;
    }
    const nextEnabled = !cctvSyncEnabled;
    const nextMode = nextEnabled ? 'hybrid' : 'manual';
    const previousEnabled = cctvSyncEnabled;
    setIsTableModeSaving(true);
    setCctvSyncEnabled(nextEnabled);
    try {
      const snapshot = await floorRealtimeRepository.updateTableStateMode(
        currentLocation.id,
        floorIdForCommands,
        nextMode,
      );
      applySnapshot(snapshot);
    } catch (error) {
      setCctvSyncEnabled(previousEnabled);
      Alert.alert(
        'Could not update CCTV mode',
        error instanceof Error ? error.message : 'Try again before changing table state mode.',
      );
    } finally {
      setIsTableModeSaving(false);
    }
  }, [
    applySnapshot,
    cctvSyncEnabled,
    currentLocation,
    floorIdForCommands,
    isTableModeSaving,
    setCctvSyncEnabled,
  ]);

  const selectedParty = selectedPartyId
    ? (hostParties.find((party) => party.id === selectedPartyId) ?? null)
    : null;
  const selectedWaitlistEntry =
    detailTarget?.source === 'waitlist'
      ? (activeWaitlistEntries.find((entry) => entry.id === detailTarget.id) ?? null)
      : null;
  const selectedReservation =
    detailTarget?.source === 'reservations'
      ? (reservationBook.find((reservation) => reservation.id === detailTarget.id) ?? null)
      : null;

  useEffect(() => {
    if (!detailTarget) return;
    if (detailTarget.source === 'waitlist' && !selectedWaitlistEntry) {
      setDetailTarget(null);
      return;
    }
    if (detailTarget.source === 'reservations' && !selectedReservation) {
      setDetailTarget(null);
    }
  }, [detailTarget, selectedReservation, selectedWaitlistEntry]);

  const seatWarning = useMemo(() => {
    if (!popover || !selectedParty || selectedParty.seatingPreference === 'none') return undefined;
    const mapTable = floorMap.tables[popover.tableId];
    if (!mapTable) return undefined;
    const pref = selectedParty.seatingPreference;
    const isMatch =
      (pref === 'booth' && mapTable.type === 'booth') ||
      (pref === 'bar' && (mapTable.type === 'bar' || mapTable.type === 'counter')) ||
      (pref === 'patio' && mapTable.type === 'outdoor') ||
      (pref === 'window' && mapTable.type === 'regular');
    return isMatch ? undefined : `Guest prefers ${pref} seating`;
  }, [floorMap.tables, popover, selectedParty]);

  const popoverResolvedWaiter = useMemo(() => {
    if (!popover || !liveTable) return null;
    return resolveWaiterForTable(
      routing,
      popover.tableId,
      liveTable.section,
      liveTable.backendTableId,
    );
  }, [liveTable, popover, routing]);

  useEffect(() => {
    setSeatWaiterId(null);
  }, [popover?.tableId]);

  const isRotationMode = routing?.mode === 'manual_rotation';
  const activeWaiterChips = useMemo(
    () => waiterChips.filter((chip) => chip.isActive),
    [waiterChips],
  );
  const resolveDefaultSeatWaiterId = useCallback(
    (
      tableId: string,
      section?: string,
      partySize?: number | null,
      backendTableId?: string | null,
    ) => {
      if (!routing) return null;
      return resolveWaiterIdForTable(routing, tableId, section, backendTableId, partySize);
    },
    [routing],
  );
  const seatWaiterIdEffective =
    seatWaiterId ??
    (popover && liveTable
      ? resolveDefaultSeatWaiterId(
          popover.tableId,
          liveTable.section,
          selectedParty?.size ?? null,
          liveTable.backendTableId,
        )
      : null);
  const seatWaiterEffective = getWaiterById(routing, seatWaiterIdEffective);
  const canPickSeatWaiter = Boolean(
    isRotationMode && liveTable && liveTable.status === 'available' && !liveTable.isBlocked,
  );
  const resolveAutoAssignmentLabel = useCallback(
    (partySize: number | null) => {
      if (!popover || !liveTable || !routing) return null;
      const threshold = routing.gratThreshold ?? 6;
      const effectiveSize = partySize ?? selectedParty?.size ?? null;
      const normalWaiter = getWaiterById(
        routing,
        resolveDefaultSeatWaiterId(
          popover.tableId,
          liveTable.section,
          null,
          liveTable.backendTableId,
        ),
      );
      const gratWaiter = getWaiterById(
        routing,
        resolveDefaultSeatWaiterId(
          popover.tableId,
          liveTable.section,
          threshold,
          liveTable.backendTableId,
        ),
      );
      if (effectiveSize != null && effectiveSize >= threshold && gratWaiter) {
        return `Auto route: Next grat ${gratWaiter.name}`;
      }
      if (effectiveSize != null && normalWaiter) {
        return `Auto route: Next up ${normalWaiter.name}`;
      }
      if (normalWaiter && gratWaiter && gratWaiter.id !== normalWaiter.id) {
        return `Auto route: Next up ${normalWaiter.name}; ${threshold}+ uses Next grat ${gratWaiter.name}`;
      }
      if (normalWaiter) return `Auto route: Next up ${normalWaiter.name}`;
      return null;
    },
    [liveTable, popover, resolveDefaultSeatWaiterId, routing, selectedParty?.size],
  );
  const popoverAutoAssignmentLabel = useMemo(
    () => resolveAutoAssignmentLabel(selectedParty?.size ?? null),
    [resolveAutoAssignmentLabel, selectedParty?.size],
  );

  const handleTablePress = (tableId: string, ref: View | null | undefined) => {
    if (!ref) {
      setPopover({ tableId, layout: { x: 0, y: 0, width: 0, height: 0 } });
      return;
    }
    ref.measureInWindow((x, y, width, height) => {
      setPopover({ tableId, layout: { x, y, width, height } });
    });
  };

  const handleSeat = async () => {
    if (!popover || !liveTable) return;
    if (!selectedParty) {
      Alert.alert('Select a Party', 'Choose a host party before seating from the floor plan.');
      return;
    }
    const tableId = popover.tableId;
    const backendTableId = liveTable.backendTableId ?? null;
    const waiterId =
      seatWaiterId ??
      resolveDefaultSeatWaiterId(tableId, liveTable.section, selectedParty.size, backendTableId);
    console.info('[HostFloor] seat party requested', {
      tableId,
      backendTableId,
      tableLabel: liveTable.label,
      partyId: selectedParty.id,
      partySize: selectedParty.size,
      waiterId: waiterId ?? null,
      source: selectedParty.source,
    });
    if (selectedParty.source === 'reservations') {
      const commandId = createReservationSeatCommandId();
      const requestedAt = new Date().toISOString();
      queuePendingCommand({
        type: 'seat_party',
        commandId,
        floorId: floorIdForCommands,
        tableId,
        ...(backendTableId ? { backendTableId } : {}),
        requestedAt,
        party: toTableParty(selectedParty),
        ...(waiterId ? { waiterId } : {}),
      });
      markPendingSeat(commandId, {
        entityId: selectedParty.id,
        tableId,
        source: selectedParty.source,
      });
      try {
        await runReservationAction({
          reservationId: selectedParty.id,
          action: 'seat',
          input: waiterId
            ? { commandId, tableId: backendTableId ?? tableId, waiterId }
            : { commandId, tableId: backendTableId ?? tableId },
        });
        setSeatWaiterId(null);
        setSelectedPartyId(null);
        setPopover(null);
      } catch (error) {
        rollbackPendingSeat(commandId);
        rejectPendingCommand(
          commandId,
          tableId,
          error instanceof Error ? error.message : 'Reservation could not be seated.',
        );
        Alert.alert(
          'Unable to Seat Reservation',
          error instanceof Error ? error.message : 'Reservation could not be seated.',
        );
      }
      return;
    }
    const result = seatParty(
      tableId,
      toTableParty(selectedParty),
      waiterId ?? undefined,
      backendTableId,
    );
    if (!result.ok) return;
    markPendingSeat(result.commandId, {
      entityId: selectedParty.id,
      tableId,
      source: selectedParty.source,
    });
    setSeatWaiterId(null);
    setSelectedPartyId(null);
    setPopover(null);
  };

  const handleSeatWalkIn = (size: number, name: string) => {
    if (!popover || !liveTable) return;
    const backendTableId = liveTable.backendTableId ?? null;
    const waiterId =
      seatWaiterId ??
      resolveDefaultSeatWaiterId(liveTable.id, liveTable.section, size, backendTableId);
    console.info('[HostFloor] seat walk-in requested', {
      tableId: liveTable.id,
      backendTableId,
      tableLabel: liveTable.label,
      partySize: size,
      partyName: name || null,
      waiterId: waiterId ?? null,
      cctvSyncEnabled,
      tableStateMode,
    });
    const result = seatWalkIn(liveTable.id, name, size, waiterId ?? undefined, backendTableId);
    console.info('[HostFloor] seat walk-in dispatch result', result);
    if (result.ok) {
      setSeatWaiterId(null);
      setPopover(null);
    }
  };

  const handleMarkAvailable = () => {
    if (!liveTable) return;
    if (liveTable.isBlocked) {
      if (unblockTable(liveTable.id).ok) setPopover(null);
      return;
    }
    if (liveTable.status === 'occupied') {
      const cleared = clearTable(liveTable.id);
      if (cleared.ok) {
        markClean(liveTable.id);
        setPopover(null);
      }
      return;
    }
    if (liveTable.status === 'dirty') {
      if (markClean(liveTable.id).ok) setPopover(null);
    }
  };

  const handleMarkDirty = () => {
    if (!liveTable) return;
    if (liveTable.status === 'occupied') {
      if (clearTable(liveTable.id).ok) setPopover(null);
      return;
    }
    if (liveTable.status === 'available') {
      if (markDirty(liveTable.id).ok) setPopover(null);
    }
  };

  const handleBlock = () => {
    if (!liveTable) return;
    const didDispatch = liveTable.isBlocked
      ? unblockTable(liveTable.id).ok
      : blockTable(liveTable.id).ok;
    if (didDispatch) setPopover(null);
  };

  const selectedTablePanel =
    popover && liveTable ? (
      <TablePopover
        visible
        presentation="panel"
        onClose={() => {
          setSeatWaiterId(null);
          setPopover(null);
        }}
        tableId={liveTable.id}
        tableLabel={liveTable.label}
        status={liveTable.status}
        isBlocked={liveTable.isBlocked}
        capacity={liveTable.capacity}
        sectionLabel={liveTable.section}
        server={
          canPickSeatWaiter
            ? (seatWaiterEffective?.name ?? 'Assign waiter')
            : (liveTable.currentWaiterName ?? popoverResolvedWaiter?.name ?? liveTable.server)
        }
        serverColor={
          canPickSeatWaiter
            ? seatWaiterEffective
              ? waiterColorMap[seatWaiterEffective.id]
              : undefined
            : popoverResolvedWaiter?.id
              ? waiterColorMap[popoverResolvedWaiter.id]
              : liveTable.serverId
                ? waiterColorMap[liveTable.serverId]
                : undefined
        }
        partyName={liveTable.partyName}
        currentPartySize={liveTable.currentPartySize}
        seatedTime={liveTable.seatedTime}
        initialWalkInMode={liveTable.status === 'available' && !selectedParty}
        selectedPartyName={selectedParty?.name ?? null}
        nextUpServer={
          popoverResolvedWaiter
            ? {
                name: popoverResolvedWaiter.name,
                color: waiterColorMap[popoverResolvedWaiter.id],
              }
            : null
        }
        autoAssignmentLabel={popoverAutoAssignmentLabel}
        resolveAutoAssignmentLabel={resolveAutoAssignmentLabel}
        routingModeLabel={routing?.mode === 'manual_rotation' ? 'rotation' : undefined}
        servers={canPickSeatWaiter ? activeWaiterChips : undefined}
        currentServerId={canPickSeatWaiter ? (seatWaiterIdEffective ?? undefined) : undefined}
        serverOverrideActive={Boolean(seatWaiterId)}
        onChangeServer={canPickSeatWaiter ? (id) => setSeatWaiterId(id) : undefined}
        onClearServerAssignment={canPickSeatWaiter ? () => setSeatWaiterId(null) : undefined}
        onMarkSeated={!selectedParty || liveTable.isBlocked ? undefined : handleSeat}
        onSeatWalkIn={liveTable.isBlocked ? undefined : handleSeatWalkIn}
        onMarkAvailable={handleMarkAvailable}
        onMarkDirty={handleMarkDirty}
        onBlock={handleBlock}
        seatWarning={seatWarning}
      />
    ) : null;

  const leftParties = leftTab === 'waitlist' ? waitlistParties : reservationParties;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {/* ===== TOP BAR ===== */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.surface.level2,
            borderBottomColor: colors.border.default,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <View style={styles.brandBlock}>
          <Text style={[styles.wordmark, { color: colors.text.primary }]}>SHIRE</Text>
          <Text style={[styles.hostTag, { color: colors.text.muted }]}>Host</Text>
        </View>

        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
          ]}
        >
          <Ionicons name="search" size={15} color={colors.text.muted} />
          <TextInput
            placeholder="Search guests, tables…"
            placeholderTextColor={colors.text.muted}
            style={[styles.searchInput, { color: colors.text.primary }]}
          />
        </View>

        <View style={styles.topBarRight}>
          <View
            style={[
              styles.connectionBadge,
              { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
            ]}
          >
            <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
            <Text style={[styles.connectionText, { color: colors.text.secondary }]}>
              {connectionLabel}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={cctvSyncEnabled ? 'Turn off CCTV sync' : 'Turn on CCTV sync'}
            disabled={isTableModeSaving}
            onPress={handleToggleCctvSync}
            style={[
              styles.connectionBadge,
              {
                backgroundColor: cctvSyncEnabled ? colors.surface.level1 : colors.status.dirty.fill,
                borderColor: cctvSyncEnabled ? colors.border.default : colors.status.dirty.border,
                opacity: isTableModeSaving ? 0.72 : 1,
              },
            ]}
          >
            <Ionicons
              name={cctvSyncEnabled ? 'videocam-outline' : 'videocam-off-outline'}
              size={14}
              color={cctvSyncEnabled ? colors.text.secondary : colors.status.dirty.text}
            />
            <Text
              style={[
                styles.connectionText,
                {
                  color: cctvSyncEnabled ? colors.text.secondary : colors.status.dirty.text,
                },
              ]}
            >
              {cctvSyncEnabled ? 'CCTV' : 'CCTV Off'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={routingModeSwitchLabel}
            disabled={!routing || isRoutingSaving}
            onPress={handleToggleRoutingMode}
            style={[
              styles.routingModeBadge,
              {
                backgroundColor:
                  routing?.mode === 'section' ? colors.accentLight : colors.surface.level1,
                borderColor: routing?.mode === 'section' ? colors.accent : colors.border.default,
                opacity: !routing || isRoutingSaving ? 0.58 : 1,
              },
            ]}
          >
            <Ionicons
              name={routingModeIcon}
              size={14}
              color={routing?.mode === 'section' ? colors.accent : colors.text.secondary}
            />
            <Text
              style={[
                styles.routingModeLabel,
                { color: routing?.mode === 'section' ? colors.accent : colors.text.secondary },
              ]}
            >
              {isRoutingSaving ? 'Mode: Saving' : `Mode: ${routingModeLabel}`}
            </Text>
          </TouchableOpacity>
          {[
            { icon: 'add-circle-outline' as const, onPress: () => setShowSeatPartyModal(true) },
            {
              icon: 'people-circle-outline' as const,
              onPress: () => setShowShiftSetup(true),
            },
            {
              icon: 'map-outline' as const,
              onPress: () => router.push('/floor-builder' as Href),
            },
            {
              icon: 'settings-outline' as const,
              onPress: () => router.push('/settings' as Href),
            },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.icon}
              activeOpacity={0.7}
              onPress={btn.onPress}
              style={[
                styles.iconButton,
                { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
              ]}
            >
              <Ionicons name={btn.icon} size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ===== NEXT UP STRIP ===== */}
      <View style={styles.nextUpStrip}>
        <View style={styles.routingStripGroup}>
          {nextUpRows.slice(0, 4).map((entry, idx) => {
            const primaryTableId = entry.tables[0]?.id;
            const canOpenTable = primaryTableId ? !primaryTableId.startsWith('mock-') : false;
            return (
              <NextUpCard
                key={entry.waiterId}
                waiterId={entry.waiterId}
                waiterName={entry.waiterName}
                waiterColor={waiterColorMap[entry.waiterId]}
                tableLabels={entry.tables.map((table) => table.label)}
                isNext={idx === 0}
                badgeLabel="NEXT PARTY"
                style={styles.nextUpStripCard}
                onPress={() => {
                  if (!primaryTableId || !canOpenTable) return;
                  handleTablePress(primaryTableId, tableRefs.current[primaryTableId] ?? null);
                }}
              />
            );
          })}
        </View>
        <View style={styles.routingStripSpacer} />
        {nextGratRows.length > 0 && (
          <View style={styles.routingStripGroup}>
            {nextGratRows.slice(0, 1).map((entry, idx) => {
              const primaryTableId = entry.tables[0]?.id;
              const canOpenTable = primaryTableId ? !primaryTableId.startsWith('mock-') : false;
              return (
                <NextUpCard
                  key={`grat-${entry.waiterId}`}
                  waiterId={entry.waiterId}
                  waiterName={entry.waiterName}
                  waiterColor={waiterColorMap[entry.waiterId]}
                  tableLabels={entry.tables.map((table) => table.label)}
                  isNext={idx === 0}
                  badgeLabel={`NEXT GRAT · ${routing?.gratThreshold ?? 6}+`}
                  tone="grat"
                  style={styles.nextUpStripCard}
                  onPress={() => {
                    if (!primaryTableId || !canOpenTable) return;
                    handleTablePress(primaryTableId, tableRefs.current[primaryTableId] ?? null);
                  }}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* ===== FLOOR BODY ===== */}
      <View style={styles.body}>
        {/* LEFT PANEL — keep above center map so Add Walk-in is never covered. */}
        <Panel level="level2" style={styles.leftPanel}>
          <View style={styles.leftPanelBody}>
            {selectedTablePanel ? (
              <ScrollView
                style={styles.leftScroll}
                contentContainerStyle={styles.tablePanelScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {selectedTablePanel}
              </ScrollView>
            ) : (
              <>
                <View style={styles.leftTabs}>
                  <SegmentedControl
                    options={[
                      { value: 'waitlist', label: 'Waitlist', count: waitlistParties.length },
                      {
                        value: 'reservations',
                        label: 'Reservations',
                        count: reservationParties.length,
                      },
                    ]}
                    value={leftTab}
                    onChange={setLeftTab}
                  />
                </View>
                <ScrollView
                  style={styles.leftScroll}
                  contentContainerStyle={styles.leftScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {leftParties.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.text.muted }]}>
                      {leftTab === 'waitlist'
                        ? 'No parties on the waitlist.'
                        : 'No upcoming reservations.'}
                    </Text>
                  ) : (
                    leftParties.map((party, index) => (
                      <WaitlistCard
                        key={party.id}
                        party={party}
                        index={index}
                        isSelected={selectedPartyId === party.id}
                        onPress={() => setDetailTarget({ source: party.source, id: party.id })}
                      />
                    ))
                  )}
                </ScrollView>
              </>
            )}
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setPopover(null);
              setShowAddPartyModal(true);
            }}
            style={[styles.addWalkIn, { borderColor: colors.border.strong }]}
            accessibilityRole="button"
            accessibilityLabel="Add walk-in to waitlist"
          >
            <Ionicons name="add" size={18} color={colors.text.secondary} />
            <Text style={[styles.addWalkInText, { color: colors.text.secondary }]}>
              Add Walk-in
            </Text>
          </TouchableOpacity>
        </Panel>

        {/* CENTER — FLOOR */}
        <View
          style={[
            styles.center,
            { backgroundColor: colors.surface.level3, borderColor: colors.border.default },
          ]}
        >
          <View style={styles.mapContainer} onLayout={handleMapLayout} pointerEvents="box-none">
            {/* Tables layer: clipped + low zIndex. Do not use absoluteFill here — it blocks
                bottom chrome taps when combined with transform scale (host map zoom only). */}
            <View style={styles.mapTablesLayer} pointerEvents="box-none">
              <View
                style={{
                  position: 'absolute',
                  width: floorDesign.designWidth,
                  height: floorDesign.designHeight,
                  left: (mapSize.width - floorDesign.designWidth) / 2,
                  top: (floorDesign.mapHeight - floorDesign.designHeight) / 2,
                  transform: [{ scale: floorDesign.fit * (floorMap.zoom ?? 1) }],
                }}
                pointerEvents="box-none"
              >
                {positionedTables.map(({ table, x, y, rotation }) => {
                  const baseDim = TABLE_DIMENSIONS[table.shape] ?? TABLE_DIMENSIONS.square;
                  const mapTable = floorMap.tables[table.id];
                  const tableWidth = mapTable?.width ?? baseDim.width;
                  const tableHeight = mapTable?.height ?? baseDim.height;
                  return (
                    <View
                      key={table.id}
                      ref={(ref) => {
                        tableRefs.current[table.id] = ref;
                      }}
                      collapsable={false}
                      pointerEvents="box-none"
                      style={{
                        position: 'absolute',
                        left: x - tableWidth / 2,
                        top: y - tableHeight / 2,
                        opacity: tableMatchesSizeFilters(table.capacity, sizeFilters) ? 1 : 0.28,
                        ...(rotation ? { transform: [{ rotate: `${rotation}deg` }] } : {}),
                      }}
                    >
                      <Table
                        id={table.label}
                        status={table.status as StatusKey}
                        shape={table.shape}
                        capacity={table.capacity}
                        width={tableWidth}
                        height={tableHeight}
                        isBlocked={table.isBlocked}
                        server={serverBadgeForTable(table.server, table.serverId)}
                        onPress={() =>
                          handleTablePress(table.id, tableRefs.current[table.id] ?? null)
                        }
                      />
                    </View>
                  );
                })}
              </View>
            </View>
            {/*
              TOUCH CONTRACT — MAP CHROME (do not regress):
              - Render chrome AFTER tables with MAP_CHROME_Z_INDEX (transform steals taps otherwise).
              - FloorStatusBar: pointerEvents="none" (display-only).
              - FloorRoomPill: anchors via measureInWindow; backdrop is sibling Pressable.
              - Tables layer uses marginBottom + overflow hidden, not absoluteFill.
            */}
            <View style={styles.mapChromeLayer} pointerEvents="box-none">
              <View pointerEvents="box-none">
                <FloorRoomPill
                  rooms={roomOptions}
                  activeRoomId={activeFilter}
                  onSelect={setActiveFilter}
                  onManagePress={() => router.push('/floor-builder' as Href)}
                />
              </View>
              <View pointerEvents="none">
                <FloorStatusBar tables={visibleTablesFlat} />
              </View>
            </View>
          </View>
          {isUsingStarterMap && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/floor-builder' as Href)}
              style={[
                styles.starterBanner,
                { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
              ]}
            >
              <Ionicons name="construct-outline" size={15} color={colors.text.muted} />
              <Text style={[styles.starterText, { color: colors.text.muted }]}>
                Starter floor map — tap to build your layout
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ===== MODALS / OVERLAYS ===== */}
      <AddPartyModal
        visible={showAddPartyModal}
        presentation="modal"
        onClose={() => setShowAddPartyModal(false)}
        onAdd={async (data) => {
          try {
            await createWaitlistEntry({
              guestName: data.name,
              guestPhone: data.phone,
              partySize: data.size,
              seatingPreference: data.seatingPreference,
              notes: data.notes,
              quotedWaitMinutes: data.quotedWaitMinutes,
              source: 'manual',
            });
          } catch (error) {
            Alert.alert(
              'Unable to Add Party',
              extractHostRequestErrorMessage(
                error,
                'The party could not be added to the waitlist.',
              ),
            );
            throw error;
          }
        }}
      />

      <HostPersonDetailSheet
        visible={Boolean(selectedWaitlistEntry || selectedReservation)}
        waitlistEntry={selectedWaitlistEntry}
        reservation={selectedReservation}
        onClose={() => setDetailTarget(null)}
        onSelectForSeating={() => {
          const nextId = detailTarget?.id ?? null;
          setSelectedPartyId((current) => (current === nextId ? null : nextId));
          setDetailTarget(null);
        }}
        isSelectedForSeating={selectedPartyId === detailTarget?.id}
        onSaveWaitlist={async (waitlistEntryId, input) => {
          try {
            await updateWaitlistEntry({ waitlistEntryId, input });
          } catch (error) {
            throw new Error(
              extractHostRequestErrorMessage(error, 'The waitlist entry could not be updated.'),
            );
          }
        }}
        onRunWaitlistAction={async (waitlistEntryId, action) => {
          try {
            await runWaitlistAction({ waitlistEntryId, action });
          } catch (error) {
            throw new Error(
              extractHostRequestErrorMessage(error, 'The waitlist entry could not be updated.'),
            );
          }
        }}
        onSaveReservation={async (reservationId, input) => {
          try {
            await updateReservation({ reservationId, input });
          } catch (error) {
            throw new Error(
              extractHostRequestErrorMessage(error, 'The reservation could not be updated.'),
            );
          }
        }}
        onRunReservationAction={async (reservationId, action) => {
          try {
            await runReservationAction({ reservationId, action });
          } catch (error) {
            throw new Error(
              extractHostRequestErrorMessage(error, 'The reservation could not be updated.'),
            );
          }
        }}
        onOpenReservation={
          selectedReservation
            ? () =>
                router.push({
                  pathname: '/reservation-modal/[id]',
                  params: { id: selectedReservation.id, date: selectedReservation.date },
                })
            : undefined
        }
      />

      <SeatPartyModal visible={showSeatPartyModal} onClose={() => setShowSeatPartyModal(false)} />
      <ShiftSetupSheet visible={showShiftSetup} onClose={() => setShowShiftSetup(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  // top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  brandBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  wordmark: { ...textStyles.wordmark, fontSize: 22 },
  hostTag: { ...textStyles.caption },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    padding: 0,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { ...textStyles.captionMedium },
  routingModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 132,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  routingModeLabel: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  // next-up strip
  nextUpStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  routingStripGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nextUpStripCard: {
    width: 228,
  },
  routingStripSpacer: { flex: 1 },
  // body
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  leftPanel: {
    width: 320,
    overflow: 'hidden',
    alignSelf: 'stretch',
    flexDirection: 'column',
    zIndex: 2,
    elevation: 2,
  },
  leftPanelBody: { flex: 1, minHeight: 0 },
  leftTabs: { padding: spacing.md },
  leftScroll: { flex: 1 },
  leftScrollContent: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
  tablePanelScrollContent: { padding: spacing.md },
  emptyText: { ...textStyles.caption, paddingVertical: spacing.lg, textAlign: 'center' },
  addWalkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    margin: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexShrink: 0,
    zIndex: 30,
    elevation: 30,
  },
  addWalkInText: { ...textStyles.bodyMedium },
  center: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 0,
  },
  mapContainer: { flex: 1 },
  mapTablesLayer: {
    flex: 1,
    marginBottom: MAP_BOTTOM_UI_INSET,
    overflow: 'hidden',
    zIndex: 1,
    elevation: 1,
  },
  mapChromeLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: MAP_BOTTOM_UI_INSET,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    zIndex: MAP_CHROME_Z_INDEX,
    elevation: MAP_CHROME_Z_INDEX,
  },
  starterBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  starterText: { ...textStyles.caption },
});
