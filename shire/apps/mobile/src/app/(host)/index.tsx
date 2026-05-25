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
  useWindowDimensions,
  View,
  type GestureResponderEvent,
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
import {
  buildDefaultTablesById,
  selectTablesByRoom,
  type TableDetailsViewModel,
} from '@/features/floor/state';
import { requestCctvModeChangeConfirmation } from '@/features/floor/cctvModeConfirmation';
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
import type { WaiterChipData } from '@/features/routing';
import type {
  FloorMap,
  TableDisplayStatus,
  TableLiveState,
  TableParty,
  WaitlistEntry,
  WaiterRoutingMode,
  WaiterRoutingState,
} from '@shire/shared';
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

function formatQueuePositionLabel(index: number, label: string): string {
  if (index === 0) return `NEXT ${label}`;
  const value = index + 1;
  const suffix =
    value % 10 === 1 && value % 100 !== 11
      ? 'ST'
      : value % 10 === 2 && value % 100 !== 12
        ? 'ND'
        : value % 10 === 3 && value % 100 !== 13
          ? 'RD'
          : 'TH';
  return `${value}${suffix} ${label}`;
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
const HOST_RAIL_WIDTH = 80;
const MAX_NORMAL_NEXT_UP_CARD_COUNT = 4;
const MOCK_NEXT_UP_TABLE_LABELS: string[][] = [
  ['12', '14', '18'],
  ['3', '7'],
  ['9', '10', '11'],
  ['21', '22'],
  ['5', '6', '8'],
];
const GIF_DEMO_WAITERS = [
  { id: 'b8c8bd03-c86f-4aa0-bc68-ed05a1b0e044', name: 'Maria' },
  { id: '371847a3-ddc6-4cc0-87f8-3636b0c1264f', name: 'Fernando' },
  { id: '1f24e762-4b80-4b15-bae1-7331b055219e', name: 'Lola' },
  { id: 'fe96080c-486a-4f05-abd0-00d21f9eaf34', name: 'Kiersten' },
  { id: 'c146a54b-3c4d-4e34-a66c-9f9238cfa895', name: 'Makayla' },
  { id: '39e44fab-59af-44e1-8858-dae07bada373', name: 'Sava' },
] as const;
const GIF_DEMO_WAITER_COLORS: Record<string, string> = {
  'b8c8bd03-c86f-4aa0-bc68-ed05a1b0e044': '#8E5CF4',
  '371847a3-ddc6-4cc0-87f8-3636b0c1264f': '#2F8F74',
  '1f24e762-4b80-4b15-bae1-7331b055219e': '#D36D43',
  'fe96080c-486a-4f05-abd0-00d21f9eaf34': '#3E83C4',
  'c146a54b-3c4d-4e34-a66c-9f9238cfa895': '#C2517A',
  '39e44fab-59af-44e1-8858-dae07bada373': '#B58B21',
};

type GifDemoSeat = {
  party: HostSidebarParty;
  waiterId: string | null;
  seatedAt: string;
};

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

function isoMinutesAgo(minutes: number, now = Date.now()): string {
  return new Date(now - minutes * 60_000).toISOString();
}

function tableStateForDisplayStatus(status: TableDisplayStatus): TableLiveState['sensedState'] {
  if (status === 'occupied') return 'occupied';
  if (status === 'dirty') return 'empty_dirty';
  return 'empty_clean';
}

function orderedFloorTableIds(floorMap: FloorMap): string[] {
  return floorMap.rooms.flatMap((room) =>
    room.layoutMode === 'freeform'
      ? Object.values(floorMap.tables)
          .filter((table) => table.roomId === room.roomId)
          .map((table) => table.tableId)
      : room.rows.flatMap((row) => row),
  );
}

function tableIdByLabel(floorMap: FloorMap, label: string): string | null {
  return (
    Object.values(floorMap.tables).find((table) => table.tableNumber === label)?.tableId ?? null
  );
}

function getGifDemoTableSlots(floorMap: FloorMap) {
  const orderedIds = orderedFloorTableIds(floorMap);
  const recommended =
    tableIdByLabel(floorMap, '8') ??
    orderedIds.find((id) => (floorMap.tables[id]?.capacity ?? 0) >= 4) ??
    orderedIds[0] ??
    null;
  const alternate =
    tableIdByLabel(floorMap, '11') ??
    orderedIds.find((id) => id !== recommended && (floorMap.tables[id]?.capacity ?? 0) >= 4) ??
    orderedIds.find((id) => id !== recommended) ??
    null;
  const dirty =
    tableIdByLabel(floorMap, '6') ??
    orderedIds.find((id) => id !== recommended && id !== alternate) ??
    null;
  const blocked =
    tableIdByLabel(floorMap, '4') ??
    orderedIds.find((id) => id !== recommended && id !== alternate && id !== dirty) ??
    null;
  const remaining = orderedIds.filter((id) => ![recommended, alternate, dirty, blocked].includes(id));
  const clean = remaining.slice(5, 9);
  const occupied = remaining.slice(0, 5);

  return { recommended, alternate, dirty, blocked, clean, occupied };
}

function buildGifDemoParties(hiddenPartyIds: Set<string>, now = Date.now()): HostSidebarParty[] {
  const parties: HostSidebarParty[] = [
    {
      id: 'gif-martinez',
      source: 'waitlist',
      sourceLabel: 'Waitlist',
      name: 'Martinez',
      phone: '(843) 555-0142',
      size: 4,
      status: 'Arrived',
      seatingPreference: 'none',
      joinedAt: isoMinutesAgo(12, now),
      waitLabel: '8m',
      quotedWaitMinutes: 8,
      notes: 'Ready at host stand',
    },
    {
      id: 'gif-robinson',
      source: 'waitlist',
      sourceLabel: 'Waitlist',
      name: 'Robinson',
      phone: '(843) 555-0178',
      size: 2,
      status: 'Waiting',
      seatingPreference: 'booth',
      joinedAt: isoMinutesAgo(18, now),
      waitLabel: '14m',
      quotedWaitMinutes: 14,
      notes: 'Prefers booth',
    },
    {
      id: 'gif-patel',
      source: 'waitlist',
      sourceLabel: 'Waitlist',
      name: 'Patel',
      phone: '(843) 555-0109',
      size: 5,
      status: 'Waiting',
      seatingPreference: 'none',
      joinedAt: isoMinutesAgo(24, now),
      waitLabel: '18m',
      quotedWaitMinutes: 18,
      notes: 'High chair',
    },
    {
      id: 'gif-harris',
      source: 'waitlist',
      sourceLabel: 'Waitlist',
      name: 'Harris',
      phone: '(843) 555-0191',
      size: 3,
      status: 'Waiting',
      seatingPreference: 'patio',
      joinedAt: isoMinutesAgo(9, now),
      waitLabel: '10m',
      quotedWaitMinutes: 10,
      notes: 'Patio if open',
    },
    {
      id: 'gif-nguyen',
      source: 'waitlist',
      sourceLabel: 'Waitlist',
      name: 'Nguyen',
      phone: '(843) 555-0137',
      size: 6,
      status: 'Waiting',
      seatingPreference: 'none',
      joinedAt: isoMinutesAgo(31, now),
      waitLabel: '22m',
      quotedWaitMinutes: 22,
      notes: 'Birthday',
    },
  ];

  return parties.filter((party) => !hiddenPartyIds.has(party.id));
}

function buildGifDemoWaitlistEntry(party: HostSidebarParty): WaitlistEntry {
  const timestamp = new Date().toISOString();
  return {
    id: party.id,
    guest: {
      id: `${party.id}-guest`,
      name: party.name,
      phone: party.phone,
    },
    partySize: party.size,
    seatingPreference: party.seatingPreference,
    status: party.status === 'Arrived' ? 'arrived' : 'waiting',
    notes: party.notes,
    source: 'manual',
    joinedAt: party.joinedAt ?? timestamp,
    quotedWaitMinutes: party.quotedWaitMinutes,
    arrivedAt: party.status === 'Arrived' ? (party.joinedAt ?? timestamp) : null,
    seatedAt: null,
    removedAt: null,
    noShowAt: null,
    assignedTableId: null,
    createdAt: party.joinedAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function buildGifDemoRouting(
  floorMap: FloorMap,
  seatsByTableId: Record<string, GifDemoSeat>,
): WaiterRoutingState {
  const slots = getGifDemoTableSlots(floorMap);
  const activeWaiterIds: string[] = GIF_DEMO_WAITERS.map((waiter) => waiter.id);
  const seatedTables = Object.values(seatsByTableId);
  const seatCount = seatedTables.length;
  const lastSeat = seatedTables[seatCount - 1] ?? null;
  const lastWaiterIndex = activeWaiterIds.indexOf(lastSeat?.waiterId ?? '');
  const rotationStart = lastWaiterIndex >= 0 ? lastWaiterIndex + 1 : seatCount;
  const rotationOrder = [
    ...activeWaiterIds.slice(rotationStart % activeWaiterIds.length),
    ...activeWaiterIds.slice(0, rotationStart % activeWaiterIds.length),
  ];
  const seatedTableIds = new Set(Object.keys(seatsByTableId));
  const nextTableIds = [
    slots.recommended,
    slots.alternate,
    ...slots.clean,
    slots.dirty,
  ].filter((id): id is string => typeof id === 'string' && !seatedTableIds.has(id));
  const sectionAssignments = Object.values(floorMap.tables)
    .map((table) => normalizeRoutingSection(table.section))
    .filter((section, index, sections) => Boolean(section) && sections.indexOf(section) === index)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .reduce<Record<string, string>>((acc, section, index) => {
      acc[section] = activeWaiterIds[index % activeWaiterIds.length]!;
      return acc;
    }, {});
  const nextUpByTable = nextTableIds
    .filter((id): id is string => Boolean(id))
    .reduce<Record<string, string>>((acc, tableId) => {
      const section = normalizeRoutingSection(floorMap.tables[tableId]?.section);
      acc[tableId] = sectionAssignments[section] ?? rotationOrder[0]!;
      return acc;
    }, {});
  const currentTableIdsByWaiter = Object.entries(seatsByTableId).reduce<Record<string, string[]>>(
    (acc, [tableId, seat]) => {
      if (!seat.waiterId) return acc;
      acc[seat.waiterId] = [...(acc[seat.waiterId] ?? []), tableId];
      return acc;
    },
    {},
  );

  return {
    mode: 'section',
    waiters: GIF_DEMO_WAITERS.map((waiter, index) => ({
      id: waiter.id,
      name: waiter.name,
      isTemporary: false,
      status: 'available',
      isActive: true,
      assignedSectionIds: [],
      assignedTableIds: [],
      currentTableIds: currentTableIdsByWaiter[waiter.id] ?? [],
      servedTableIds: [],
      liveTables: index < 3 ? 4 : 3,
      servedSeatingCount: 8 + index,
      currentCovers: index < 2 ? 14 : 10,
      recentHourCovers: index < 2 ? 8 : 6,
      shiftClockIn: null,
      gratCountToday: index === 0 ? 1 : 0,
      lastGratAt: null,
      lastAssignedAt: null,
    })),
    activeWaiterIds,
    sectionAssignments,
    tableAssignments: {},
    rotationOrder,
    nextWaiterId: rotationOrder[0] ?? null,
    nextUpQueue: rotationOrder.slice(0, 4).map((waiterId) => {
      const ownedTableIds = nextTableIds.filter((tableId) => nextUpByTable[tableId] === waiterId);
      const fallbackTableIds = nextTableIds.filter((tableId) => nextUpByTable[tableId] !== waiterId);
      const rotatedTableIds = [...ownedTableIds, ...fallbackTableIds].slice(0, 5);
      return {
        waiterId,
        tableIds: rotatedTableIds,
      };
    }),
    nextUpByTable,
    nextUpBySection: {},
    gratThreshold: 6,
    gratRotationState: { rotationOrder },
    nextGratWaiterId: rotationOrder[3] ?? null,
    nextGratByTable: {},
    nextGratBySection: {},
    requiresSetup: false,
    updatedAt: new Date().toISOString(),
  };
}

function buildGifDemoTables(
  floorMap: FloorMap,
  demoStep: number,
  seatsByTableId: Record<string, GifDemoSeat>,
): Record<string, TableLiveState> {
  const now = new Date().toISOString();
  const slots = getGifDemoTableSlots(floorMap);
  const tables = buildDefaultTablesById(floorMap);
  const setStatus = (
    tableId: string | null,
    status: TableDisplayStatus,
    waiterIndex: number | null = null,
    party: TableParty | null = null,
  ) => {
    if (!tableId || !tables[tableId]) return;
    const waiter = waiterIndex == null ? null : GIF_DEMO_WAITERS[waiterIndex % GIF_DEMO_WAITERS.length];
    tables[tableId] = {
      ...tables[tableId]!,
      displayStatus: status,
      sensedState: tableStateForDisplayStatus(status),
      stateConfidence: status === 'dirty' ? 0.91 : 0.97,
      lastStateChange: now,
      updatedAt: now,
      sequence: 10 + demoStep,
      party,
      seatedAt: party ? now : null,
      currentPartySize: party?.size ?? null,
      currentWaiterId: waiter?.id ?? null,
      currentWaiterName: waiter?.name ?? null,
      lastUpdateSource: status === 'occupied' ? 'host' : 'ml',
    };
  };

  slots.occupied.forEach((tableId, index) =>
    setStatus(tableId, 'occupied', index, {
      id: `gif-party-${tableId}`,
      name: 'Dining',
      size: floorMap.tables[tableId]?.capacity ?? 2,
      source: 'walk_in',
    }),
  );
  slots.clean.forEach((tableId, index) => {
    const isFreshlyCleared = index === demoStep % Math.max(1, slots.clean.length);
    setStatus(tableId, isFreshlyCleared && demoStep % 3 === 0 ? 'dirty' : 'available', null);
  });
  setStatus(slots.dirty, demoStep % 4 >= 2 ? 'available' : 'dirty', null);
  setStatus(slots.blocked, 'dirty', null);
  setStatus(slots.recommended, 'available', null);
  setStatus(slots.alternate, 'available', null);

  for (const [tableId, seat] of Object.entries(seatsByTableId)) {
    const waiterIndex = GIF_DEMO_WAITERS.findIndex((waiter) => waiter.id === seat.waiterId);
    setStatus(tableId, 'occupied', Math.max(0, waiterIndex), toTableParty(seat.party));
    tables[tableId] = {
      ...tables[tableId]!,
      seatedAt: seat.seatedAt,
      lastUpdateSource: 'host',
      currentWaitlistEntryId: seat.party.source === 'waitlist' ? seat.party.id : null,
    };
  }

  return tables;
}

function buildGifDemoTableDetails(
  floorMap: FloorMap,
  tablesById: Record<string, TableLiveState>,
  routing: WaiterRoutingState,
  tableId: string | null | undefined,
): TableDetailsViewModel | null {
  if (!tableId) return null;
  const table = selectTablesByRoom(floorMap, tablesById, {}, routing)
    .flatMap((room) => room.tables)
    .find((candidate) => candidate.id === tableId);
  const liveTable = tablesById[tableId];
  const mapTable = floorMap.tables[tableId];
  if (!table || !liveTable || !mapTable) return null;

  return {
    ...table,
    section: mapTable.section,
    override: liveTable.override,
    currentWaiterId: liveTable.currentWaiterId ?? null,
    currentWaiterName: liveTable.currentWaiterName ?? null,
    currentPartySize: liveTable.currentPartySize ?? null,
  };
}

type NextUpEntry = {
  waiterId: string;
  waiterName: string;
  tables: { id: string; label: string }[];
};

type QuickSeatRecommendation = {
  party: HostSidebarParty;
  tableId: string;
  tableLabel: string;
  waiterName: string | null;
  reason: string;
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

function normalizeRoutingSection(section: string | null | undefined): string {
  return (section ?? '').trim().replace(/\s+/g, ' ');
}

function routingSectionForTable(floorMap: FloorMap, tableId: string): string {
  const activePlan =
    floorMap.activeSectionPlanId && floorMap.sectionPlans
      ? floorMap.sectionPlans.find((plan) => plan.planId === floorMap.activeSectionPlanId)
      : null;
  const planSection = activePlan?.sections.find((section) => section.tableIds.includes(tableId));
  return planSection?.sectionId ?? floorMap.tables[tableId]?.section ?? '';
}

function waiterAssignedToTableSection(
  routing: WaiterRoutingState,
  floorMap: FloorMap,
  tableId: string,
): string | null {
  const tableSection = normalizeRoutingSection(routingSectionForTable(floorMap, tableId));
  if (!tableSection) {
    return null;
  }

  return (
    routing.sectionAssignments[tableSection] ??
    Object.entries(routing.sectionAssignments).find(
      ([section]) => normalizeRoutingSection(section) === tableSection,
    )?.[1] ??
    null
  );
}

function buildQuickSeatRecommendation(
  party: HostSidebarParty,
  tables: {
    id: string;
    label: string;
    capacity: number;
    status: string;
    isBlocked: boolean;
    backendTableId?: string | null;
  }[],
  floorMap: FloorMap,
  routing: WaiterRoutingState | null,
): QuickSeatRecommendation | null {
  const availableTables = tables
    .filter((table) => table.status === 'available' && !table.isBlocked)
    .sort((a, b) => {
      const capacityDelta =
        Math.abs(a.capacity - party.size) - Math.abs(b.capacity - party.size);
      if (capacityDelta !== 0) return capacityDelta;
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });
  const table =
    availableTables.find((candidate) => candidate.capacity >= party.size) ?? availableTables[0];
  if (!table) return null;

  // TODO(host-routing): replace this local heuristic with the backend table-decision service
  // once it can score table fit, server load, section fairness, wait time, and CCTV confidence.
  const section = floorMap.tables[table.id]?.section ?? '';
  const waiterId = resolveWaiterIdForTable(
    routing,
    table.id,
    section,
    table.backendTableId,
    party.size,
    floorMap,
  );
  const waiterName = routing?.waiters.find((waiter) => waiter.id === waiterId)?.name ?? null;
  const reason =
    table.capacity >= party.size
      ? `Fits ${party.size} · ${waiterName ? `${waiterName} next` : 'open table'}`
      : `Best open table · ${waiterName ? `${waiterName} next` : 'confirm fit'}`;

  return {
    party,
    tableId: table.id,
    tableLabel: table.label,
    waiterName,
    reason,
  };
}

export default function FloorPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const { currentLocation } = useAuth();
  const { routing, isSaving: isRoutingSaving } = useWaiterRoutingState();
  const { setRoutingMode } = useWaiterRoutingActions();
  const waiterColorMap = useWaiterColorMap();
  const waiterChips = useWaiterChips();
  const liveRooms = useFloorTablesByRoom();
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
  const [gratCardIndex, setGratCardIndex] = useState(0);
  const gifModeEnabled = false;
  const [gifDemoStep, setGifDemoStep] = useState(0);
  const [gifDemoSeatsByTableId, setGifDemoSeatsByTableId] = useState<
    Record<string, GifDemoSeat>
  >({});
  const [gifDemoHiddenPartyIds, setGifDemoHiddenPartyIds] = useState<Set<string>>(
    () => new Set(),
  );
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
  const hostContentWidth = Math.max(0, windowWidth - HOST_RAIL_WIDTH);
  const isCompactHostLayout = hostContentWidth < 1180;
  const isTightHostLayout = hostContentWidth < 1040;
  const responsiveLayout = useMemo(
    () => ({
      horizontalPadding: isTightHostLayout
        ? spacing.sm
        : isCompactHostLayout
          ? spacing.md
          : spacing.lg,
      topGap: isTightHostLayout ? spacing.sm : isCompactHostLayout ? spacing.md : spacing.lg,
      controlGap: isTightHostLayout ? spacing.xs : spacing.sm,
      badgePadding: isTightHostLayout ? spacing.sm : spacing.md,
      leftPanelWidth: isTightHostLayout ? 280 : isCompactHostLayout ? 296 : 320,
      nextUpCardWidth: isTightHostLayout ? 176 : isCompactHostLayout ? 196 : 228,
      nextUpCardMinWidth: isTightHostLayout ? 150 : isCompactHostLayout ? 168 : 196,
      gratCardWidth: isTightHostLayout ? 184 : isCompactHostLayout ? 204 : 228,
    }),
    [isCompactHostLayout, isTightHostLayout],
  );
  const gifDemoParties = useMemo(
    () => buildGifDemoParties(gifDemoHiddenPartyIds),
    [gifDemoHiddenPartyIds],
  );
  const activeHostParties = gifModeEnabled ? gifDemoParties : hostParties;

  const handleMapLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const gifDemoRouting = useMemo(
    () => buildGifDemoRouting(floorMap, gifDemoSeatsByTableId),
    [floorMap, gifDemoSeatsByTableId],
  );
  const activeRouting = gifModeEnabled ? gifDemoRouting : routing;
  const activeWaiterColorMap = gifModeEnabled ? GIF_DEMO_WAITER_COLORS : waiterColorMap;
  const gifDemoTablesById = useMemo(
    () => buildGifDemoTables(floorMap, gifDemoStep, gifDemoSeatsByTableId),
    [floorMap, gifDemoSeatsByTableId, gifDemoStep],
  );
  const gifDemoRooms = useMemo(
    () => selectTablesByRoom(floorMap, gifDemoTablesById, {}, gifDemoRouting),
    [floorMap, gifDemoRouting, gifDemoTablesById],
  );
  const rooms = gifModeEnabled ? gifDemoRooms : liveRooms;

  const tableRefs = useRef<Record<string, View | null>>({});
  const gratSwipeStartY = useRef<number | null>(null);
  const gratSwipeHandled = useRef(false);
  const liveTableDetails = useTableDetails(popover?.tableId ?? null);
  const gifDemoLiveTable = useMemo(
    () =>
      buildGifDemoTableDetails(
        floorMap,
        gifDemoTablesById,
        gifDemoRouting,
        popover?.tableId ?? null,
      ),
    [floorMap, gifDemoRouting, gifDemoTablesById, popover?.tableId],
  );
  const liveTable = gifModeEnabled ? gifDemoLiveTable : liveTableDetails;
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
    () => activeHostParties.filter((party) => party.source === 'waitlist'),
    [activeHostParties],
  );
  const reservationParties = useMemo(
    () => activeHostParties.filter((party) => party.source === 'reservations'),
    [activeHostParties],
  );
  const visibleTablesFlat = useMemo(
    () => visibleRooms.flatMap((room) => room.tables),
    [visibleRooms],
  );
  const allTablesFlat = useMemo(() => rooms.flatMap((room) => room.tables), [rooms]);
  const quickSeatRecommendationsByPartyId = useMemo(
    () =>
      waitlistParties.reduce<Record<string, QuickSeatRecommendation>>((acc, party) => {
        const recommendation = buildQuickSeatRecommendation(
          party,
          allTablesFlat,
          floorMap,
          activeRouting,
        );
        if (recommendation) {
          acc[party.id] = recommendation;
        }
        return acc;
      }, {}),
    [activeRouting, allTablesFlat, floorMap, waitlistParties],
  );
  const shiftStats = useMemo(() => {
    const availableCount = allTablesFlat.filter(
      (table) => table.status === 'available' && !table.isBlocked,
    ).length;
    const dirtyCount = allTablesFlat.filter((table) => table.status === 'dirty').length;
    const occupiedCount = allTablesFlat.filter((table) => table.status === 'occupied').length;
    return [
      { label: 'Open', value: String(availableCount) },
      { label: 'Dirty', value: String(dirtyCount) },
      { label: 'Seated', value: String(occupiedCount) },
    ];
  }, [allTablesFlat]);

  const nextUpRotation = useMemo<NextUpEntry[]>(() => {
    if (!activeRouting) return [];
    const tableByRoutingId = new Map<string, { id: string; label: string }>();
    for (const table of allTablesFlat) {
      addTableLookup(tableByRoutingId, table.id, table);
      addTableLookup(tableByRoutingId, table.backendTableId, table);
      addTableLookup(tableByRoutingId, table.label, table);
    }
    const queueRows = (activeRouting.nextUpQueue ?? [])
      .slice(0, 4)
      .map((entry) => {
        if (!activeRouting.activeWaiterIds.includes(entry.waiterId)) return null;
        const waiter = activeRouting.waiters.find((w) => w.id === entry.waiterId);
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
      const waiterId = resolveWaiterIdForTable(
        activeRouting,
        table.id,
        section,
        table.backendTableId,
        null,
        floorMap,
      );
      if (!waiterId || !activeRouting.activeWaiterIds.includes(waiterId)) continue;
      tablesByWaiter.set(waiterId, [...(tablesByWaiter.get(waiterId) ?? []), table]);
    }
    const orderedWaiterIds = [
      ...(activeRouting.nextWaiterId ? [activeRouting.nextWaiterId] : []),
      ...activeRouting.rotationOrder,
      ...activeRouting.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);

    return orderedWaiterIds
      .filter((waiterId) => activeRouting.activeWaiterIds.includes(waiterId))
      .map((waiterId) => {
        const waiter = activeRouting.waiters.find((w) => w.id === waiterId);
        if (!waiter) return null;
        const tablesForWaiter = (tablesByWaiter.get(waiterId) ?? []).sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        );
        return { waiterId, waiterName: waiter.name, tables: tablesForWaiter };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [activeRouting, allTablesFlat, floorMap]);
  const nextUpRows = useMemo<NextUpEntry[]>(() => {
    if (nextUpRotation.length > 0) return nextUpRotation;
    if (activeRouting) return [];

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
  }, [nextUpRotation, activeRouting, allTablesFlat]);
  const nextGratRows = useMemo<NextUpEntry[]>(() => {
    if (!activeRouting) return [];
    const threshold = activeRouting.gratThreshold ?? 6;
    const gratTables = allTablesFlat.filter(
      (table) => table.status === 'available' && !table.isBlocked && table.capacity >= threshold,
    );
    const tablesByWaiter = new Map<string, typeof gratTables>();
    for (const table of gratTables) {
      const section = routingSectionForTable(floorMap, table.id);
      const waiterId =
        activeRouting.mode === 'section'
          ? waiterAssignedToTableSection(activeRouting, floorMap, table.id)
          : resolveWaiterIdForTable(
              activeRouting,
              table.id,
              section,
              table.backendTableId,
              threshold,
              floorMap,
            );
      if (!waiterId || !activeRouting.activeWaiterIds.includes(waiterId)) continue;
      tablesByWaiter.set(waiterId, [...(tablesByWaiter.get(waiterId) ?? []), table]);
    }
    const orderedWaiterIds = [
      ...(activeRouting.nextGratWaiterId ? [activeRouting.nextGratWaiterId] : []),
      ...(activeRouting.gratRotationState?.rotationOrder ?? []),
      ...activeRouting.activeWaiterIds,
    ].filter((waiterId, index, values) => values.indexOf(waiterId) === index);
    return orderedWaiterIds
      .filter((waiterId) => activeRouting.activeWaiterIds.includes(waiterId))
      .map((waiterId) => {
        const waiter = activeRouting.waiters.find((w) => w.id === waiterId);
        if (!waiter) return null;
        const tablesForWaiter = (tablesByWaiter.get(waiterId) ?? []).sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true }),
        );
        return { waiterId, waiterName: waiter.name, tables: tablesForWaiter };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [activeRouting, allTablesFlat, floorMap]);

  const sectionsReady =
    activeRouting?.mode === 'manual_rotation' &&
    activeRouting.setupPlannedMode === 'section' &&
    Object.keys(activeRouting.sectionAssignments).length > 0;
  const routingModeLabel =
    activeRouting?.mode === 'section' ? 'Sections' : sectionsReady ? 'Sections Ready' : 'Rotation';
  const routingModeIcon = activeRouting?.mode === 'section' ? 'grid-outline' : 'repeat-outline';
  const routingModeSwitchLabel =
    activeRouting?.mode === 'section' ? 'Switch to rotation' : 'Switch to sections';

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
    if (gifModeEnabled) return;
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
  }, [commitRoutingMode, floorMap, gifModeEnabled, isRoutingSaving, routing]);

  const serverBadgeForTable = useCallback(
    (serverName?: string, serverId?: string | null) => {
      if (!serverName) return undefined;
      return {
        initials: initialsForName(serverName),
        color: serverId
          ? (activeWaiterColorMap[serverId] ?? colors.status.occupied.text)
          : colors.status.occupied.text,
      };
    },
    [activeWaiterColorMap, colors.status.occupied.text],
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
    !gifModeEnabled &&
    floorMap.floorId === DEFAULT_FLOOR_MAP.floorId &&
    floorMap.mapVersion === DEFAULT_FLOOR_MAP.mapVersion;

  const hasSnapshot = Boolean(lastSnapshotAt);
  const connectionLabel = gifModeEnabled
    ? 'Synced'
    : formatConnectionLabel(connectionState, hasSnapshot);
  const connectionColor =
    connectionLabel === 'Manual'
      ? colors.status.dirty.text
      : connectionLabel === 'Synced'
        ? colors.status.available.text
        : colors.status.reserved.text;
  const isCctvActive = gifModeEnabled ? true : cctvSyncEnabled;

  const handleToggleCctvSync = useCallback(async () => {
    if (gifModeEnabled) return;
    if (!currentLocation || isTableModeSaving) {
      return;
    }
    const nextEnabled = !cctvSyncEnabled;
    const nextMode = nextEnabled ? 'hybrid' : 'manual';
    const previousEnabled = cctvSyncEnabled;
    const didConfirm = await requestCctvModeChangeConfirmation(nextEnabled);
    if (!didConfirm) {
      return;
    }
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
    gifModeEnabled,
    floorIdForCommands,
    isTableModeSaving,
    setCctvSyncEnabled,
  ]);

  const selectedParty = selectedPartyId
    ? (activeHostParties.find((party) => party.id === selectedPartyId) ?? null)
    : null;
  const selectedWaitlistEntry =
    detailTarget?.source === 'waitlist'
      ? gifModeEnabled
        ? activeHostParties
            .filter((party) => party.source === 'waitlist')
            .map(buildGifDemoWaitlistEntry)
            .find((entry) => entry.id === detailTarget.id) ?? null
        : (activeWaitlistEntries.find((entry) => entry.id === detailTarget.id) ?? null)
      : null;
  const selectedReservation =
    !gifModeEnabled && detailTarget?.source === 'reservations'
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

  useEffect(() => {
    if (!gifModeEnabled) return undefined;
    const interval = setInterval(() => {
      setGifDemoStep((current) => (current + 1) % 6);
    }, 1400);
    return () => clearInterval(interval);
  }, [gifModeEnabled]);

  useEffect(() => {
    if (gifModeEnabled) return;
    setGifDemoStep(0);
    setGifDemoSeatsByTableId({});
    setGifDemoHiddenPartyIds(new Set<string>());
  }, [gifModeEnabled]);

  const resetGifDemo = useCallback(() => {
    setGifDemoStep(0);
    setGifDemoSeatsByTableId({});
    setGifDemoHiddenPartyIds(new Set<string>());
    setSelectedPartyId(null);
    setDetailTarget(null);
    setPopover(null);
    setSeatWaiterId(null);
  }, []);

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
      activeRouting,
      popover.tableId,
      liveTable.section,
      liveTable.backendTableId,
      null,
      floorMap,
    );
  }, [activeRouting, floorMap, liveTable, popover]);

  useEffect(() => {
    setSeatWaiterId(null);
  }, [popover?.tableId]);

  const isRotationMode = activeRouting?.mode === 'manual_rotation';
  const gifWaiterChips = useMemo<WaiterChipData[]>(
    () =>
      gifDemoRouting.waiters.map((waiter) => ({
        id: waiter.id,
        name: waiter.name,
        color: GIF_DEMO_WAITER_COLORS[waiter.id] ?? colors.accent,
        tableCount: waiter.liveTables,
        isNext: waiter.id === gifDemoRouting.nextWaiterId,
        isActive: true,
        isTemporary: false,
      })),
    [colors.accent, gifDemoRouting],
  );
  const activeWaiterChips = useMemo(
    () => (gifModeEnabled ? gifWaiterChips : waiterChips.filter((chip) => chip.isActive)),
    [gifModeEnabled, gifWaiterChips, waiterChips],
  );
  const resolveDefaultSeatWaiterId = useCallback(
    (
      tableId: string,
      section?: string,
      partySize?: number | null,
      backendTableId?: string | null,
    ) => {
      if (!activeRouting) return null;
      return resolveWaiterIdForTable(
        activeRouting,
        tableId,
        section,
        backendTableId,
        partySize,
        floorMap,
      );
    },
    [activeRouting, floorMap],
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
  const seatWaiterEffective = getWaiterById(activeRouting, seatWaiterIdEffective);
  const canPickSeatWaiter = Boolean(
    isRotationMode && liveTable && liveTable.status === 'available' && !liveTable.isBlocked,
  );
  const resolveAutoAssignmentLabel = useCallback(
    (partySize: number | null) => {
      if (!popover || !liveTable || !activeRouting) return null;
      const threshold = activeRouting.gratThreshold ?? 6;
      const effectiveSize = partySize ?? selectedParty?.size ?? null;
      const normalWaiter = getWaiterById(
        activeRouting,
        resolveDefaultSeatWaiterId(
          popover.tableId,
          liveTable.section,
          null,
          liveTable.backendTableId,
        ),
      );
      const gratWaiter = getWaiterById(
        activeRouting,
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
    [activeRouting, liveTable, popover, resolveDefaultSeatWaiterId, selectedParty?.size],
  );
  const popoverAutoAssignmentLabel = useMemo(
    () => resolveAutoAssignmentLabel(selectedParty?.size ?? null),
    [resolveAutoAssignmentLabel, selectedParty?.size],
  );

  const seatGifPartyAtTable = useCallback(
    (party: HostSidebarParty, tableId: string) => {
      const mapTable = floorMap.tables[tableId];
      const live = gifDemoTablesById[tableId];
      if (!mapTable || !live || live.displayStatus !== 'available' || live.isBlocked) {
        Alert.alert('Table Unavailable', 'Choose an open table for this party.');
        return false;
      }

      const waiterId = resolveDefaultSeatWaiterId(
        tableId,
        mapTable.section,
        party.size,
        live.backendTableId,
      );
      setGifDemoSeatsByTableId((current) => ({
        ...current,
        [tableId]: {
          party,
          waiterId,
          seatedAt: new Date().toISOString(),
        },
      }));
      setGifDemoHiddenPartyIds((current) => new Set([...current, party.id]));
      setSeatWaiterId(null);
      setSelectedPartyId(null);
      setPopover(null);
      return true;
    },
    [floorMap.tables, gifDemoTablesById, resolveDefaultSeatWaiterId],
  );

  const handleTablePress = (tableId: string, ref: View | null | undefined) => {
    if (gifModeEnabled && selectedParty) {
      if (seatGifPartyAtTable(selectedParty, tableId)) {
        return;
      }
    }

    if (!ref) {
      setPopover({ tableId, layout: { x: 0, y: 0, width: 0, height: 0 } });
      return;
    }
    ref.measureInWindow((x, y, width, height) => {
      setPopover({ tableId, layout: { x, y, width, height } });
    });
  };

  const handleQuickSeatParty = (party: HostSidebarParty) => {
    // TODO(host-routing): when backend table scoring lands, keep Quick Seat as
    // party-selection mode and let the recommendation rank the best table
    // without forcing the host to use it.
    setSelectedPartyId(party.id);
    setDetailTarget(null);
    setSeatWaiterId(null);
    setPopover(null);
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
    if (gifModeEnabled) {
      seatGifPartyAtTable(selectedParty, tableId);
      return;
    }
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
    if (gifModeEnabled) {
      const party: HostSidebarParty = {
        id: `gif-walkin-${Date.now()}`,
        source: 'waitlist',
        sourceLabel: 'Waitlist',
        name: name || 'Walk-in',
        phone: '',
        size,
        status: 'Arrived',
        seatingPreference: 'none',
        joinedAt: new Date().toISOString(),
        waitLabel: '<1m',
        quotedWaitMinutes: 0,
        notes: 'Walk-in',
      };
      setGifDemoSeatsByTableId((current) => ({
        ...current,
        [liveTable.id]: {
          party,
          waiterId,
          seatedAt: new Date().toISOString(),
        },
      }));
      setSeatWaiterId(null);
      setPopover(null);
      return;
    }
    const result = seatWalkIn(liveTable.id, name, size, waiterId ?? undefined, backendTableId);
    console.info('[HostFloor] seat walk-in dispatch result', result);
    if (result.ok) {
      setSeatWaiterId(null);
      setPopover(null);
    }
  };

  const handleMarkAvailable = () => {
    if (!liveTable) return;
    if (gifModeEnabled) {
      setGifDemoSeatsByTableId((current) => {
        const next = { ...current };
        delete next[liveTable.id];
        return next;
      });
      setPopover(null);
      return;
    }
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
    if (gifModeEnabled) {
      setGifDemoSeatsByTableId((current) => {
        const next = { ...current };
        delete next[liveTable.id];
        return next;
      });
      setPopover(null);
      return;
    }
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
    if (gifModeEnabled) {
      setPopover(null);
      return;
    }
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
              ? activeWaiterColorMap[seatWaiterEffective.id]
              : undefined
            : popoverResolvedWaiter?.id
              ? activeWaiterColorMap[popoverResolvedWaiter.id]
              : liveTable.serverId
                ? activeWaiterColorMap[liveTable.serverId]
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
                color: activeWaiterColorMap[popoverResolvedWaiter.id],
              }
            : null
        }
        autoAssignmentLabel={popoverAutoAssignmentLabel}
        resolveAutoAssignmentLabel={resolveAutoAssignmentLabel}
        routingModeLabel={activeRouting?.mode === 'manual_rotation' ? 'rotation' : undefined}
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
  const visibleGratIndex = Math.min(gratCardIndex, Math.max(0, nextGratRows.length - 1));
  const nextGratEntry = nextGratRows[visibleGratIndex] ?? null;
  const gratBadgeLabel = nextGratEntry ? formatQueuePositionLabel(visibleGratIndex, 'GRAT') : null;
  const nextUpStripInnerWidth = Math.max(
    0,
    hostContentWidth - responsiveLayout.horizontalPadding * 2,
  );
  const normalNextUpAreaWidth = Math.max(
    0,
    nextUpStripInnerWidth -
      (nextGratEntry ? responsiveLayout.gratCardWidth + responsiveLayout.controlGap : 0),
  );
  const normalNextUpFitCount = Math.floor(
    (normalNextUpAreaWidth + responsiveLayout.controlGap) /
      (responsiveLayout.nextUpCardMinWidth + responsiveLayout.controlGap),
  );
  const normalNextUpCardCount =
    nextUpRows.length === 0
      ? 0
      : Math.max(
          1,
          Math.min(MAX_NORMAL_NEXT_UP_CARD_COUNT, nextUpRows.length, normalNextUpFitCount),
        );
  const normalNextUpCardWidth =
    normalNextUpCardCount > 0
      ? Math.max(
          responsiveLayout.nextUpCardMinWidth,
          (normalNextUpAreaWidth - responsiveLayout.controlGap * (normalNextUpCardCount - 1)) /
            normalNextUpCardCount,
        )
      : responsiveLayout.nextUpCardWidth;
  const normalNextUpRows = nextUpRows.slice(0, normalNextUpCardCount);

  useEffect(() => {
    if (gratCardIndex >= nextGratRows.length) {
      setGratCardIndex(0);
    }
  }, [gratCardIndex, nextGratRows.length]);

  const handleGratTouchStart = useCallback((event: GestureResponderEvent) => {
    gratSwipeStartY.current = event.nativeEvent.pageY;
    gratSwipeHandled.current = false;
  }, []);

  const handleGratTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      const startY = gratSwipeStartY.current;
      gratSwipeStartY.current = null;
      if (startY == null || nextGratRows.length <= 1) return;
      const deltaY = event.nativeEvent.pageY - startY;
      if (Math.abs(deltaY) < 24) return;
      gratSwipeHandled.current = true;
      setGratCardIndex((current) => {
        const maxIndex = nextGratRows.length - 1;
        if (deltaY < 0) return Math.min(maxIndex, current + 1);
        return Math.max(0, current - 1);
      });
      setTimeout(() => {
        gratSwipeHandled.current = false;
      }, 200);
    },
    [nextGratRows.length],
  );

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
            paddingHorizontal: responsiveLayout.horizontalPadding,
            gap: responsiveLayout.topGap,
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
            numberOfLines={1}
            style={[styles.searchInput, { color: colors.text.primary }]}
          />
        </View>

        <View style={[styles.topBarRight, { gap: responsiveLayout.controlGap }]}>
          <View
            style={[
              styles.connectionBadge,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.border.default,
                paddingHorizontal: responsiveLayout.badgePadding,
              },
            ]}
          >
            <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
            <Text
              numberOfLines={1}
              style={[styles.connectionText, { color: colors.text.secondary }]}
            >
              {isTightHostLayout && connectionLabel === 'Synced' ? 'Sync' : connectionLabel}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isCctvActive ? 'Turn off CCTV sync' : 'Turn on CCTV sync'}
            disabled={isTableModeSaving}
            onPress={handleToggleCctvSync}
            style={[
              styles.connectionBadge,
              {
                backgroundColor: isCctvActive ? colors.surface.level1 : colors.status.dirty.fill,
                borderColor: isCctvActive ? colors.border.default : colors.status.dirty.border,
                opacity: isTableModeSaving ? 0.72 : 1,
                paddingHorizontal: responsiveLayout.badgePadding,
              },
            ]}
          >
            <Ionicons
              name={isCctvActive ? 'videocam-outline' : 'videocam-off-outline'}
              size={14}
              color={isCctvActive ? colors.text.secondary : colors.status.dirty.text}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.connectionText,
                {
                  color: isCctvActive ? colors.text.secondary : colors.status.dirty.text,
                },
              ]}
            >
              {isTightHostLayout && isCctvActive ? 'Cam' : isCctvActive ? 'CCTV' : 'CCTV Off'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={routingModeSwitchLabel}
            disabled={gifModeEnabled || !activeRouting || isRoutingSaving}
            onPress={handleToggleRoutingMode}
            style={[
              styles.routingModeBadge,
              {
                backgroundColor:
                  activeRouting?.mode === 'section' || sectionsReady
                    ? colors.accentLight
                    : colors.surface.level1,
                borderColor:
                  activeRouting?.mode === 'section' || sectionsReady
                    ? colors.accent
                    : colors.border.default,
                opacity: !activeRouting || isRoutingSaving ? 0.58 : 1,
                minWidth: isTightHostLayout ? 92 : 132,
                paddingHorizontal: responsiveLayout.badgePadding,
              },
            ]}
          >
            <Ionicons
              name={routingModeIcon}
              size={14}
              color={
                activeRouting?.mode === 'section' || sectionsReady
                  ? colors.accent
                  : colors.text.secondary
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.routingModeLabel,
                {
                  color:
                    activeRouting?.mode === 'section' || sectionsReady
                      ? colors.accent
                      : colors.text.secondary,
                },
              ]}
            >
              {isTightHostLayout
                ? isRoutingSaving
                  ? 'Saving'
                  : routingModeLabel
                : isRoutingSaving
                  ? 'Mode: Saving'
                  : sectionsReady
                    ? 'Rotation active · Sections ready'
                    : `Mode: ${routingModeLabel}`}
            </Text>
          </TouchableOpacity>
          {[
            {
              icon: 'add-circle-outline' as const,
              onPress: () => (gifModeEnabled ? resetGifDemo() : setShowSeatPartyModal(true)),
            },
            {
              icon: 'people-circle-outline' as const,
              onPress: () => (gifModeEnabled ? resetGifDemo() : setShowShiftSetup(true)),
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
      <View
        style={[
          styles.nextUpStrip,
          {
            gap: responsiveLayout.controlGap,
            paddingHorizontal: responsiveLayout.horizontalPadding,
          },
        ]}
      >
        <View
          style={[
            styles.routingStripGroup,
            styles.normalRoutingStripGroup,
            { gap: responsiveLayout.controlGap },
          ]}
        >
          {normalNextUpRows.map((entry, idx) => {
            const primaryTableId = entry.tables[0]?.id;
            const canOpenTable = primaryTableId ? !primaryTableId.startsWith('mock-') : false;
            return (
              <NextUpCard
                key={entry.waiterId}
                waiterId={entry.waiterId}
                waiterName={entry.waiterName}
                waiterColor={activeWaiterColorMap[entry.waiterId]}
                tableLabels={entry.tables.map((table) => table.label)}
                isNext={idx === 0}
                badgeLabel={idx === 0 ? 'NEXT PARTY' : undefined}
                style={[
                  styles.nextUpStripCard,
                  {
                    width: normalNextUpCardWidth,
                    minWidth: responsiveLayout.nextUpCardMinWidth,
                  },
                ]}
                onPress={() => {
                  if (!primaryTableId || !canOpenTable) return;
                  handleTablePress(primaryTableId, tableRefs.current[primaryTableId] ?? null);
                }}
              />
            );
          })}
        </View>
        {nextGratEntry && (
          <View
            style={[
              styles.routingStripGroup,
              styles.gratStripGroup,
              { gap: responsiveLayout.controlGap },
            ]}
          >
            <NextUpCard
              key={`grat-${nextGratEntry.waiterId}`}
              waiterId={nextGratEntry.waiterId}
              waiterName={nextGratEntry.waiterName}
              waiterColor={activeWaiterColorMap[nextGratEntry.waiterId]}
              tableLabels={nextGratEntry.tables.map((table) => table.label)}
              isNext
              badgeLabel={gratBadgeLabel ?? 'NEXT GRAT'}
              tone="grat"
              style={[
                styles.nextUpStripCard,
                styles.gratStripCard,
                {
                  width: responsiveLayout.gratCardWidth,
                  minWidth: responsiveLayout.gratCardWidth,
                },
              ]}
              onTouchStart={handleGratTouchStart}
              onTouchEnd={handleGratTouchEnd}
              onPress={() => {
                if (gratSwipeHandled.current) {
                  gratSwipeHandled.current = false;
                  return;
                }
                const primaryTableId = nextGratEntry.tables[0]?.id;
                const canOpenTable = primaryTableId ? !primaryTableId.startsWith('mock-') : false;
                if (!primaryTableId || !canOpenTable) return;
                handleTablePress(primaryTableId, tableRefs.current[primaryTableId] ?? null);
              }}
            />
          </View>
        )}
      </View>

      {/* ===== FLOOR BODY ===== */}
      <View
        style={[
          styles.body,
          {
            gap: responsiveLayout.controlGap,
            paddingHorizontal: responsiveLayout.horizontalPadding,
          },
        ]}
      >
        {/* LEFT PANEL — keep above center map so Add Walk-in is never covered. */}
        <Panel
          level="level2"
          style={{ ...styles.leftPanel, width: responsiveLayout.leftPanelWidth }}
        >
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
                <View style={styles.shiftStatsRow}>
                  {shiftStats.map((stat) => (
                    <View
                      key={stat.label}
                      style={[
                        styles.shiftStat,
                        {
                          backgroundColor: colors.surface.level1,
                          borderColor: colors.border.subtle,
                        },
                      ]}
                    >
                      <Text style={[styles.shiftStatValue, { color: colors.text.primary }]}>
                        {stat.value}
                      </Text>
                      <Text style={[styles.shiftStatLabel, { color: colors.text.muted }]}>
                        {stat.label}
                      </Text>
                    </View>
                  ))}
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
                    leftParties.map((party, index) => {
                      const recommendation = quickSeatRecommendationsByPartyId[party.id] ?? null;
                      return (
                        <WaitlistCard
                          key={party.id}
                          party={party}
                          index={index}
                          isSelected={selectedPartyId === party.id}
                          onPress={() => {
                            setDetailTarget({ source: party.source, id: party.id });
                          }}
                          onSeat={() => handleQuickSeatParty(party)}
                          quickSeatSuggestion={
                            recommendation
                              ? {
                                  tableLabel: recommendation.tableLabel,
                                  reason: recommendation.reason,
                                  isSelected: selectedPartyId === party.id,
                                }
                              : null
                          }
                        />
                      );
                    })
                  )}
                </ScrollView>
              </>
            )}
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (gifModeEnabled) {
                return;
              }
              setPopover(null);
              setShowAddPartyModal(true);
            }}
            style={[styles.addWalkIn, { borderColor: colors.border.strong }]}
            accessibilityRole="button"
            accessibilityLabel="Add walk-in to waitlist"
            onLongPress={gifModeEnabled ? resetGifDemo : undefined}
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
                        server={
                          isRotationMode
                            ? undefined
                            : serverBadgeForTable(table.server, table.serverId)
                        }
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
          if (gifModeEnabled) {
            return;
          }
          try {
            await updateWaitlistEntry({ waitlistEntryId, input });
          } catch (error) {
            throw new Error(
              extractHostRequestErrorMessage(error, 'The waitlist entry could not be updated.'),
            );
          }
        }}
        onRunWaitlistAction={async (waitlistEntryId, action) => {
          if (gifModeEnabled) {
            return;
          }
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
  brandBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 0 },
  wordmark: { ...textStyles.wordmark, fontSize: 22 },
  hostTag: { ...textStyles.caption },
  search: {
    flex: 1,
    minWidth: 120,
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
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    flexShrink: 1,
    minWidth: 0,
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
    flexShrink: 1,
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
    flexShrink: 0,
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
  normalRoutingStripGroup: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  gratStripGroup: {
    flexShrink: 0,
  },
  nextUpStripCard: {
    width: 228,
    flexShrink: 1,
  },
  gratStripCard: {
    flexShrink: 0,
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
  shiftStatsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  shiftStat: {
    flex: 1,
    minWidth: 0,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  shiftStatValue: {
    ...textStyles.label,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  shiftStatLabel: {
    ...textStyles.tiny,
    marginTop: 2,
    fontWeight: '800',
  },
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
