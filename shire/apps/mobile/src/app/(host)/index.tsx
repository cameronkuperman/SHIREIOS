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
import { MOCK_WAITERS } from '@/features/routing/mockWaiters';
import {
  DEFAULT_FLOOR_MAP,
  DEFAULT_FLOOR_ID,
  useFloorActions,
  useFloorConnectionState,
  useFloorStore,
  useFloorTablesByRoom,
  useTableDetails,
} from '@/features/floor';
import { useAuth } from '@/features/auth';
import { AddPartyModal } from '@/components/AddPartyModal';
import { HostDiagnosticsModal } from '@/components/HostDiagnosticsModal';
import { FloorRoomPill, type FloorRoomOption } from '@/components/FloorRoomPill';
import { FloorStatusBar } from '@/components/FloorStatusBar';
import { HostPersonDetailSheet } from '@/components/HostPersonDetailSheet';
import { NextUpCard } from '@/components/NextUpCard';
import { SeatPartyModal } from '@/components/SeatPartyModal';
import { ShiftSetupSheet } from '@/components/ShiftSetupSheet';
import { StatsPanel } from '@/components/StatsPanel';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Table } from '@/components/Table';
import { TablePopover } from '@/components/TablePopover';
import { WaitlistCard } from '@/components/WaitlistCard';
import { Panel, SegmentedControl } from '@/components/ui';
import { getAppVersionLabel, getOrCreateDeviceId } from '@/lib/device';
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
  getWaiterById,
  resolveWaiterForTable,
  resolveWaiterIdForTable,
  useWaiterChips,
  useWaiterColorMap,
  useWaiterRoutingState,
} from '@/features/routing';
import { useWorkdayStore } from '@/features/workday';
import type { TableParty } from '@shire/shared';
import {
  borderRadius,
  fontFamily,
  shadows,
  spacing,
  type StatusKey,
  textStyles,
  useTheme,
} from '@/theme';

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
const TABLE_SIZE_BUCKETS: TableSizeBucket[] = ['1-2', '3-4', '5+'];

function tableSizeBucket(capacity: number): TableSizeBucket {
  if (capacity <= 2) return '1-2';
  if (capacity <= 4) return '3-4';
  return '5+';
}
function tableMatchesSizeFilters(capacity: number, filters: TableSizeBucket[]): boolean {
  return filters.length === 0 || filters.includes(tableSizeBucket(capacity));
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'good' | 'attention';
}) {
  const { colors } = useTheme();
  const valueColor =
    tone === 'good'
      ? colors.status.available.text
      : tone === 'attention'
        ? colors.status.dirty.text
        : colors.text.primary;
  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
        shadows.subtle,
      ]}
    >
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>{label}</Text>
    </View>
  );
}

export default function FloorPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { currentLocation, userSession } = useAuth();
  const {
    routing,
    error: routingError,
    isLoading: isRoutingLoading,
  } = useWaiterRoutingState();
  const waiterColorMap = useWaiterColorMap();
  const waiterChips = useWaiterChips();
  const endWorkday = useWorkdayStore((state) => state.endWorkday);
  const workdayHref = '/workday' as Href;
  const rooms = useFloorTablesByRoom();
  const floorMap = useFloorStore((state) => state.floorMap);
  const { seatParty, seatWalkIn, clearTable, markClean, blockTable, unblockTable } =
    useFloorActions();
  const { connectionState, syncError, lastSnapshotAt, floorId } = useFloorConnectionState();
  const activeWaitlistEntries = useActiveWaitlistEntries();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const reservationBook = useReservationDayBook(today);
  const hostParties = useFloorSidebarParties();
  const { updateReservation, runReservationAction } = useReservationMutations();
  const { createWaitlistEntry, updateWaitlistEntry, runWaitlistAction } = useWaitlistMutations();
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showSeatPartyModal, setShowSeatPartyModal] = useState(false);
  const [showShiftSetup, setShowShiftSetup] = useState(false);
  const markPendingSeat = usePendingSeatStore((state) => state.markPendingSeat);

  const [activeFilter, setActiveFilter] = useState('All Rooms');
  const [sizeFilters, setSizeFilters] = useState<TableSizeBucket[]>([]);
  const [leftTab, setLeftTab] = useState<'waitlist' | 'reservations'>('waitlist');
  const [seatWaiterId, setSeatWaiterId] = useState<string | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<{
    source: HostSidebarParty['source'];
    id: string;
  } | null>(null);
  const [popover, setPopover] = useState<{ tableId: string; layout: LayoutRectangle } | null>(
    null,
  );
  const [showDiagnostics, setShowDiagnostics] = useState(false);
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

  const nextUpRotation = useMemo(() => {
    if (!routing) return [];
    const availableTables = allTablesFlat.filter(
      (table) => table.status === 'available' && !table.isBlocked,
    );
    return routing.rotationOrder
      .filter((waiterId) => routing.activeWaiterIds.includes(waiterId))
      .map((waiterId) => {
        const waiter = routing.waiters.find((w) => w.id === waiterId);
        if (!waiter) return null;
        const tablesForWaiter = availableTables
          .filter((table) => {
            if (routing.tableAssignments[table.id] === waiterId) return true;
            const section = floorMap.tables[table.id]?.section;
            if (section && routing.sectionAssignments[section] === waiterId) return true;
            return false;
          })
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
        return { waiterId, waiterName: waiter.name, tables: tablesForWaiter };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [routing, allTablesFlat, floorMap.tables]);

  const floorMetrics = useMemo(() => {
    let open = 0;
    let seated = 0;
    let dirty = 0;
    let blocked = 0;
    for (const table of visibleTablesFlat) {
      if (table.isBlocked || table.status === 'reserved') blocked += 1;
      else if (table.status === 'available') open += 1;
      else if (table.status === 'occupied') seated += 1;
      else if (table.status === 'dirty') dirty += 1;
    }
    return { open, seated, dirty, blocked };
  }, [visibleTablesFlat]);

  type GlobalTablePos = {
    table: (typeof visibleRooms)[number]['tables'][number];
    x: number;
    y: number;
    rotation?: number;
  };
  const positionedTables = useMemo<GlobalTablePos[]>(() => {
    if (mapSize.width === 0 || mapSize.height === 0) return [];
    const out: GlobalTablePos[] = [];
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
            x: left + (table.x ?? 0.5) * width,
            y: (table.y ?? 0.5) * mapSize.height,
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
              y: ((rowIdx + 0.5) / totalRows) * mapSize.height,
            });
          });
        });
      }
    }
    return out;
  }, [visibleRooms, mapSize]);

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
    return resolveWaiterForTable(routing, popover.tableId, liveTable.section);
  }, [liveTable, popover, routing]);

  useEffect(() => {
    setSeatWaiterId(null);
  }, [popover?.tableId]);

  const isRotationMode = routing?.mode === 'manual_rotation';
  const activeWaiterChips = useMemo(
    () => waiterChips.filter((chip) => chip.isActive),
    [waiterChips],
  );
  const seatWaiterIdEffective =
    seatWaiterId ??
    (popover && liveTable
      ? resolveWaiterIdForTable(routing, popover.tableId, liveTable.section)
      : null);
  const seatWaiterEffective = getWaiterById(routing, seatWaiterIdEffective);
  const canPickSeatWaiter = Boolean(
    isRotationMode && liveTable && liveTable.status === 'available' && !liveTable.isBlocked,
  );

  const handleTablePress = (tableId: string, ref: View | null | undefined) => {
    if (!ref) return;
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
    const waiterId = seatWaiterId ?? resolveWaiterIdForTable(routing, tableId, liveTable.section);
    if (selectedParty.source === 'reservations') {
      const commandId = createReservationSeatCommandId();
      try {
        await runReservationAction({
          reservationId: selectedParty.id,
          action: 'seat',
          input: waiterId ? { commandId, tableId, waiterId } : { commandId, tableId },
        });
        markPendingSeat(commandId, {
          entityId: selectedParty.id,
          tableId,
          source: selectedParty.source,
        });
        setSelectedPartyId(null);
        setPopover(null);
      } catch (error) {
        Alert.alert(
          'Unable to Seat Reservation',
          error instanceof Error ? error.message : 'Reservation could not be seated.',
        );
      }
      return;
    }
    const result = seatParty(tableId, toTableParty(selectedParty), waiterId ?? undefined);
    if (!result.ok) return;
    markPendingSeat(result.commandId, {
      entityId: selectedParty.id,
      tableId,
      source: selectedParty.source,
    });
    setSelectedPartyId(null);
    setPopover(null);
  };

  const handleSeatWalkIn = (size: number, name: string) => {
    if (!popover || !liveTable) return;
    const waiterId =
      seatWaiterId ?? resolveWaiterIdForTable(routing, liveTable.id, liveTable.section);
    const result = seatWalkIn(liveTable.id, name, size, waiterId ?? undefined);
    if (result.ok) setPopover(null);
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
    if (!liveTable || liveTable.status !== 'occupied') return;
    if (clearTable(liveTable.id).ok) setPopover(null);
  };

  const handleBlock = () => {
    if (!liveTable) return;
    const didDispatch = liveTable.isBlocked
      ? unblockTable(liveTable.id).ok
      : blockTable(liveTable.id).ok;
    if (didDispatch) setPopover(null);
  };

  const diagnosticsItems = [
    { label: 'Location', value: currentLocation?.name ?? 'Not selected' },
    { label: 'Floor', value: floorId || DEFAULT_FLOOR_ID },
    { label: 'Signed In As', value: userSession?.user?.email ?? 'Unknown' },
    { label: 'Connection', value: connectionLabel },
    { label: 'Snapshot Age', value: lastSnapshotAt ?? 'Never synced' },
    {
      label: 'Routing',
      value: routing?.updatedAt ?? (isRoutingLoading ? 'Loading' : 'Unavailable'),
    },
    { label: 'Device ID', value: getOrCreateDeviceId() },
    { label: 'App Version', value: getAppVersionLabel() },
    { label: 'API Error', value: syncError ?? 'None' },
  ];

  const leftParties = leftTab === 'waitlist' ? waitlistParties : reservationParties;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          {(
            [
              { icon: 'add-circle-outline' as const, onPress: () => setShowSeatPartyModal(true) },
              {
                icon: 'people-circle-outline' as const,
                onPress: () => setShowShiftSetup(true),
              },
              {
                icon: 'map-outline' as const,
                onPress: () => router.push('/floor-builder' as Href),
              },
              { icon: 'bug-outline' as const, onPress: () => setShowDiagnostics(true) },
              {
                icon: 'settings-outline' as const,
                onPress: () => router.push('/settings' as Href),
              },
            ]
          ).map((btn) => (
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

      {/* ===== SUMMARY STRIP ===== */}
      <View style={styles.summaryStrip}>
        <SummaryCard label="Open" value={floorMetrics.open} tone="good" />
        <SummaryCard label="Seated" value={floorMetrics.seated} />
        <SummaryCard label="Dirty" value={floorMetrics.dirty} tone="attention" />
        <SummaryCard label="Queue" value={waitlistParties.length} />
        <SummaryCard label="RSV" value={reservationParties.length} />
        <SummaryCard label="Blocked" value={floorMetrics.blocked} />
      </View>

      {/* ===== 3-PANEL BODY ===== */}
      <View style={styles.body}>
        {/* LEFT PANEL */}
        <Panel level="level2" style={styles.leftPanel}>
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
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowAddPartyModal(true)}
            style={[styles.addWalkIn, { borderColor: colors.border.strong }]}
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
          <View style={styles.mapContainer} onLayout={handleMapLayout}>
            {positionedTables.map(({ table, x, y, rotation }, idx) => {
              const mock = MOCK_WAITERS[idx % MOCK_WAITERS.length]!;
              return (
                <View
                  key={table.id}
                  ref={(ref) => {
                    tableRefs.current[table.id] = ref;
                  }}
                  collapsable={false}
                  style={{
                    position: 'absolute',
                    left: x - 32,
                    top: y - 32,
                    opacity: tableMatchesSizeFilters(table.capacity, sizeFilters) ? 1 : 0.28,
                    ...(rotation ? { transform: [{ rotate: `${rotation}deg` }] } : {}),
                  }}
                >
                  <Table
                    id={table.label}
                    status={table.status as StatusKey}
                    shape={table.shape}
                    capacity={table.capacity}
                    isBlocked={table.isBlocked}
                    server={
                      table.status === 'occupied'
                        ? { initials: mock.initials, color: mock.color }
                        : undefined
                    }
                    onPress={() =>
                      handleTablePress(table.id, tableRefs.current[table.id] ?? null)
                    }
                  />
                </View>
              );
            })}
            <View style={styles.mapOverlayBottomLeft} pointerEvents="box-none">
              <FloorRoomPill
                rooms={roomOptions}
                activeRoomId={activeFilter}
                onSelect={setActiveFilter}
                onManagePress={() => router.push('/floor-builder' as Href)}
              />
            </View>
            <View style={styles.mapOverlayBottomRight} pointerEvents="box-none">
              <FloorStatusBar tables={visibleTablesFlat} />
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

        {/* RIGHT PANEL */}
        <Panel level="level2" style={styles.rightPanel}>
          <ScrollView
            contentContainerStyle={styles.rightScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionHeading, { color: colors.text.muted }]}>Next Up</Text>
            {nextUpRotation.length === 0 ? (
              <View style={styles.nextUpList}>
                {MOCK_WAITERS.slice(0, 5).map((w, i) => (
                  <NextUpCard
                    key={w.id}
                    waiterId={w.id}
                    waiterName={w.name}
                    waiterColor={w.color}
                    tableLabels={[]}
                    isNext={i === 0}
                    onPress={() => {}}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.nextUpList}>
                {nextUpRotation.map((entry, idx) => {
                  const primaryTableId = entry.tables[0]?.id;
                  return (
                    <NextUpCard
                      key={entry.waiterId}
                      waiterId={entry.waiterId}
                      waiterName={entry.waiterName}
                      waiterColor={waiterColorMap[entry.waiterId]}
                      tableLabels={entry.tables.map((table) => table.label)}
                      isNext={idx === 0}
                      onPress={() => {
                        if (!primaryTableId) return;
                        handleTablePress(
                          primaryTableId,
                          tableRefs.current[primaryTableId] ?? null,
                        );
                      }}
                    />
                  );
                })}
              </View>
            )}

            <View style={styles.rightDivider} />
            <StatsPanel />

            <View style={styles.rightDivider} />
            <ActivityFeed />
          </ScrollView>
        </Panel>
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
              notes: '',
              quotedWaitMinutes: null,
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

      {popover && liveTable && (
        <TablePopover
          visible
          onClose={() => setPopover(null)}
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
          anchorLayout={popover.layout}
          selectedPartyName={selectedParty?.name ?? null}
          nextUpServer={
            popoverResolvedWaiter
              ? {
                  name: popoverResolvedWaiter.name,
                  color: waiterColorMap[popoverResolvedWaiter.id],
                }
              : null
          }
          routingModeLabel={routing?.mode === 'manual_rotation' ? 'rotation' : undefined}
          servers={canPickSeatWaiter ? activeWaiterChips : undefined}
          currentServerId={canPickSeatWaiter ? (seatWaiterIdEffective ?? undefined) : undefined}
          onChangeServer={canPickSeatWaiter ? (id) => setSeatWaiterId(id) : undefined}
          onMarkSeated={!selectedParty || liveTable.isBlocked ? undefined : handleSeat}
          onSeatWalkIn={liveTable.isBlocked ? undefined : handleSeatWalkIn}
          onMarkAvailable={handleMarkAvailable}
          onMarkDirty={handleMarkDirty}
          onBlock={handleBlock}
          seatWarning={seatWarning}
        />
      )}

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
      <HostDiagnosticsModal
        visible={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        items={diagnosticsItems}
        secondaryActionLabel="Edit Floor Map"
        onSecondaryAction={() => {
          setShowDiagnostics(false);
          router.push('/floor-builder' as Href);
        }}
        actionLabel="End Workday"
        onAction={() => {
          setShowDiagnostics(false);
          endWorkday();
          router.replace(workdayHref);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  // summary strip
  summaryStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  summaryValue: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 19,
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: { ...textStyles.sectionLabel, marginTop: 2 },
  // body
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  leftPanel: { width: 320, overflow: 'hidden' },
  leftTabs: { padding: spacing.md },
  leftScroll: { flex: 1 },
  leftScrollContent: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.md },
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
  },
  addWalkInText: { ...textStyles.bodyMedium },
  center: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapContainer: { flex: 1 },
  mapOverlayBottomLeft: { position: 'absolute', left: spacing.md, bottom: spacing.md, zIndex: 20 },
  mapOverlayBottomRight: { position: 'absolute', right: spacing.md, bottom: spacing.md },
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
  rightPanel: { width: 296, overflow: 'hidden' },
  rightScrollContent: { padding: spacing.lg, gap: spacing.sm },
  sectionHeading: { ...textStyles.sectionLabel, marginBottom: spacing.sm },
  nextUpList: { gap: spacing.sm },
  rightDivider: { height: spacing.lg },
});
