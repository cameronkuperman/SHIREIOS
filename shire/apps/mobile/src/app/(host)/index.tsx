import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  LayoutRectangle,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_FLOOR_MAP,
  DEFAULT_FLOOR_ID,
  useFloorActions,
  useFloorConnectionState,
  useFloorStore,
  useFloorTablesByRoom,
  useQuickSeatSuggestions,
  useTableDetails,
} from '@/features/floor';
import { useAuth } from '@/features/auth';
import { AddPartyModal } from '@/components/AddPartyModal';
import { HostDiagnosticsModal } from '@/components/HostDiagnosticsModal';
import { FloorRoomPill, type FloorRoomOption } from '@/components/FloorRoomPill';
import { FloorStatusBar } from '@/components/FloorStatusBar';
import { GlassSurface } from '@/components/GlassSurface';
import { HostPersonDetailSheet } from '@/components/HostPersonDetailSheet';
import { QuickSeatCard } from '@/components/QuickSeatCard';
import { Table } from '@/components/Table';
import { TablePopover } from '@/components/TablePopover';
import { WaitlistCard } from '@/components/WaitlistCard';
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
  resolveWaiterForTable,
  resolveWaiterIdForTable,
  useWaiterColorMap,
  useWaiterRoutingState,
} from '@/features/routing';
import { useWorkdayStore } from '@/features/workday';
import type { TableParty } from '@shire/shared';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

function toTableParty(party: HostSidebarParty): TableParty {
  return {
    id: party.id,
    name: party.name,
    size: party.size,
    source: party.source,
  };
}

function SizeBucket({ label, count }: { label: string; count: number }) {
  const { colors } = useTheme();
  const dimmed = count === 0;
  return (
    <View
      style={[
        sizeBucketStyles.bucket,
        {
          backgroundColor: colors.surface.level2,
          borderColor: colors.border.subtle,
          opacity: dimmed ? 0.55 : 1,
        },
      ]}
    >
      <Text style={[sizeBucketStyles.label, { color: colors.text.muted }]}>{label}</Text>
      <Text style={[sizeBucketStyles.count, { color: colors.text.primary }]}>×{count}</Text>
    </View>
  );
}

const sizeBucketStyles = StyleSheet.create({
  bucket: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  label: {
    ...textStyles.captionMedium,
    fontWeight: '600',
  },
  count: {
    ...textStyles.label,
    fontWeight: '700',
  },
});

function createReservationSeatCommandId(): string {
  return `reservation-seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatConnectionLabel(connectionState: string, hasSnapshot: boolean) {
  if (connectionState === 'error' || connectionState === 'disconnected') {
    return 'Manual';
  }
  if (connectionState === 'connected' && hasSnapshot) {
    return 'Synced';
  }

  return 'Syncing';
}

export default function FloorPlanScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { currentLocation, userSession } = useAuth();
  const {
    routing,
    error: routingError,
    isLoading: isRoutingLoading,
    isSaving: isRoutingSaving,
  } = useWaiterRoutingState();
  const waiterColorMap = useWaiterColorMap();
  const endWorkday = useWorkdayStore((state) => state.endWorkday);
  const workdayHref = '/workday' as Href;
  const rooms = useFloorTablesByRoom();
  const quickSeatSuggestions = useQuickSeatSuggestions();
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
  const markPendingSeat = usePendingSeatStore((state) => state.markPendingSeat);

  const [activeFilter, setActiveFilter] = useState('All Rooms');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<{
    source: HostSidebarParty['source'];
    id: string;
  } | null>(null);
  const [popover, setPopover] = useState<{ tableId: string; layout: LayoutRectangle } | null>(null);
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
  const waitlistSizeBuckets = useMemo(() => {
    let small = 0;
    let medium = 0;
    let large = 0;
    for (const party of waitlistParties) {
      if (party.size <= 2) small += 1;
      else if (party.size <= 4) medium += 1;
      else large += 1;
    }
    return { small, medium, large };
  }, [waitlistParties]);
  const visibleTablesFlat = useMemo(
    () => visibleRooms.flatMap((room) => room.tables),
    [visibleRooms],
  );

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
    if (!detailTarget) {
      return;
    }

    if (detailTarget.source === 'waitlist' && !selectedWaitlistEntry) {
      setDetailTarget(null);
      return;
    }

    if (detailTarget.source === 'reservations' && !selectedReservation) {
      setDetailTarget(null);
    }
  }, [detailTarget, selectedReservation, selectedWaitlistEntry]);

  const seatWarning = useMemo(() => {
    if (!popover || !selectedParty || selectedParty.seatingPreference === 'none') {
      return undefined;
    }

    const mapTable = floorMap.tables[popover.tableId];
    if (!mapTable) {
      return undefined;
    }

    const pref = selectedParty.seatingPreference;
    const isMatch =
      (pref === 'booth' && mapTable.type === 'booth') ||
      (pref === 'bar' && (mapTable.type === 'bar' || mapTable.type === 'counter')) ||
      (pref === 'patio' && mapTable.type === 'outdoor') ||
      (pref === 'window' && mapTable.type === 'regular');

    return isMatch ? undefined : `Guest prefers ${pref} seating`;
  }, [floorMap.tables, popover, selectedParty]);

  const popoverResolvedWaiter = useMemo(() => {
    if (!popover || !liveTable) {
      return null;
    }

    return resolveWaiterForTable(routing, popover.tableId, liveTable.section);
  }, [liveTable, popover, routing]);

  const handleTablePress = (tableId: string, ref: View | null | undefined) => {
    if (!ref) {
      return;
    }

    ref.measureInWindow((x, y, width, height) => {
      setPopover({ tableId, layout: { x, y, width, height } });
    });
  };

  const handleSeat = async () => {
    if (!popover || !liveTable) {
      return;
    }

    if (!selectedParty) {
      Alert.alert('Select a Party', 'Choose a host party before seating from the floor plan.');
      return;
    }

    const tableId = popover.tableId;
    const waiterId = resolveWaiterIdForTable(routing, tableId, liveTable.section);

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

    if (!result.ok) {
      return;
    }

    markPendingSeat(result.commandId, {
      entityId: selectedParty.id,
      tableId,
      source: selectedParty.source,
    });
    setSelectedPartyId(null);
    setPopover(null);
  };

  const handleSeatWalkIn = (size: number, name: string) => {
    if (!popover || !liveTable) {
      return;
    }

    const waiterId = resolveWaiterIdForTable(routing, liveTable.id, liveTable.section);
    const result = seatWalkIn(liveTable.id, name, size, waiterId ?? undefined);

    if (result.ok) {
      setPopover(null);
    }
  };

  const handleMarkAvailable = () => {
    if (!liveTable) {
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
    if (!liveTable || liveTable.status !== 'occupied') {
      return;
    }
    if (clearTable(liveTable.id).ok) {
      setPopover(null);
    }
  };

  const handleBlock = () => {
    if (!liveTable) {
      return;
    }

    const didDispatch = liveTable.isBlocked
      ? unblockTable(liveTable.id).ok
      : blockTable(liveTable.id).ok;

    if (didDispatch) {
      setPopover(null);
    }
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.ambientBackground, { backgroundColor: colors.background }]} />

      <View style={styles.topNav}>
        <View>
          <Text style={[styles.logoText, { color: colors.text.primary }]}>SHIRE</Text>
          {currentLocation && (
            <Text style={[styles.locationText, { color: colors.text.muted }]}>
              {currentLocation.name}
            </Text>
          )}
        </View>
        <View style={styles.topNavRight}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => router.push('/floor-builder' as Href)}
          >
            <Ionicons name="map-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <View
            style={[
              styles.connectionBadge,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
              },
            ]}
          >
            <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
            <Text style={[styles.connectionText, { color: colors.text.secondary }]}>
              {connectionLabel}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => setShowDiagnostics(true)}
          >
            <Ionicons name="bug-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => router.push('/settings' as Href)}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {isUsingStarterMap && (
        <View style={styles.bannerRow}>
          <GlassSurface intensity={35} borderRadius={borderRadius.xl} style={styles.bannerCard}>
            <Ionicons name="construct-outline" size={18} color={colors.text.secondary} />
            <Text style={[styles.bannerText, { color: colors.text.secondary }]}>
              This location is still using the starter floor map. Open the builder to create a
              restaurant-specific layout before service.
            </Text>
            <TouchableOpacity
              style={[
                styles.bannerAction,
                {
                  borderColor: colors.border.default,
                  backgroundColor: colors.surface.level2,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => router.push('/floor-builder' as Href)}
            >
              <Text style={[styles.bannerActionText, { color: colors.text.primary }]}>
                Edit Map
              </Text>
            </TouchableOpacity>
          </GlassSurface>
        </View>
      )}

      {(syncError || connectionLabel !== 'Synced' || routingError || isRoutingSaving) && (
        <View style={styles.bannerRow}>
          <GlassSurface intensity={35} borderRadius={borderRadius.xl} style={styles.bannerCard}>
            <Ionicons
              name={
                syncError || routingError || connectionLabel === 'Manual'
                  ? 'alert-circle-outline'
                  : 'sync-outline'
              }
              size={18}
              color={
                syncError || routingError || connectionLabel === 'Manual'
                  ? colors.status.dirty.text
                  : colors.text.secondary
              }
            />
            <Text
              style={[
                styles.bannerText,
                {
                  color:
                    syncError || routingError || connectionLabel === 'Manual'
                      ? colors.status.dirty.text
                      : colors.text.secondary,
                },
              ]}
            >
              {syncError
                ? syncError
                : routingError
                  ? routingError
                  : isRoutingSaving
                    ? 'Saving waiter routing changes to the backend.'
                    : connectionLabel === 'Manual'
                      ? 'Manual mode is active. Floor sync resumes automatically when the connection recovers.'
                      : 'Syncing live floor and waiter routing.'}
            </Text>
          </GlassSurface>
        </View>
      )}

      <View style={styles.quickSeatStrip}>
        <GlassSurface
          intensity={30}
          borderRadius={borderRadius['2xl']}
          style={styles.quickSeatContainer}
        >
          <Text style={[styles.quickSeatLabel, { color: colors.text.muted }]}>QUICK SEAT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickSeatScroll}
          >
            {quickSeatSuggestions.map((suggestion) => (
              <QuickSeatCard
                key={suggestion.tableId}
                {...suggestion}
                onPress={() => setPopover(null)}
              />
            ))}
          </ScrollView>
        </GlassSurface>
      </View>

      <View style={styles.splitLayout}>
        <GlassSurface intensity={45} style={styles.sidebar}>
          <AddPartyModal
            visible={showAddPartyModal}
            presentation="inline"
            onClose={() => setShowAddPartyModal(false)}
            onAdd={async (data) => {
              try {
                await createWaitlistEntry({
                  guestName: data.name,
                  guestPhone: data.phone,
                  partySize: data.size,
                  seatingPreference: data.seatingPreference,
                  notes: '',
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

          <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Reservations
              </Text>
              <Text style={[styles.sectionCount, { color: colors.text.muted }]}>
                {reservationParties.length}
              </Text>
            </View>
            {reservationParties.length === 0 ? (
              <Text style={[styles.sectionEmpty, { color: colors.text.muted }]}>
                No upcoming reservations.
              </Text>
            ) : (
              reservationParties.map((party, index) => (
                <WaitlistCard
                  key={party.id}
                  party={party}
                  index={index}
                  isSelected={selectedPartyId === party.id}
                  onPress={() => setDetailTarget({ source: party.source, id: party.id })}
                />
              ))
            )}

            <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Waitlist
              </Text>
              <View style={styles.sectionHeaderRight}>
                <Text style={[styles.sectionCount, { color: colors.text.muted }]}>
                  {waitlistParties.length}
                </Text>
                <TouchableOpacity
                  style={[styles.addPartyButton, { backgroundColor: colors.accent }]}
                  activeOpacity={0.8}
                  onPress={() => setShowAddPartyModal(true)}
                  accessibilityLabel="Add party to waitlist"
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.bucketRow}>
              <SizeBucket label="1-2" count={waitlistSizeBuckets.small} />
              <SizeBucket label="3-4" count={waitlistSizeBuckets.medium} />
              <SizeBucket label="5+" count={waitlistSizeBuckets.large} />
            </View>
            {waitlistParties.length === 0 ? (
              <Text style={[styles.sectionEmpty, { color: colors.text.muted }]}>
                No parties on the waitlist.
              </Text>
            ) : (
              waitlistParties.map((party, index) => (
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
        </GlassSurface>

        <View style={styles.mainArea}>
          <View style={styles.mapContainer} onLayout={handleMapLayout}>
            <View
              style={[
                styles.floorTexture,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(232, 226, 216, 0.15)',
                },
              ]}
            />

            {positionedTables.map(({ table, x, y, rotation }) => (
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
                  ...(rotation ? { transform: [{ rotate: `${rotation}deg` }] } : {}),
                }}
              >
                <Table
                  id={table.label}
                  status={table.status}
                  shape={table.shape}
                  capacity={table.capacity}
                  onPress={() => handleTablePress(table.id, tableRefs.current[table.id] ?? null)}
                />
              </View>
            ))}

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
        </View>
      </View>

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
          server={liveTable.currentWaiterName ?? popoverResolvedWaiter?.name ?? liveTable.server}
          serverColor={
            popoverResolvedWaiter?.id
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
  container: {
    flex: 1,
  },
  ambientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingTop: 48,
    paddingBottom: spacing.sm,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
  },
  locationText: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    ...textStyles.captionMedium,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...shadows.subtle,
  },
  bannerRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bannerText: {
    ...textStyles.caption,
    flex: 1,
  },
  bannerAction: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerActionText: {
    ...textStyles.label,
  },
  quickSeatStrip: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  quickSeatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingVertical: spacing.sm,
  },
  quickSeatLabel: {
    ...textStyles.sectionLabel,
    marginRight: spacing.md,
  },
  quickSeatScroll: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  sidebar: {
    width: 310,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  addPartyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarScroll: {
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sectionHeaderSpaced: {
    marginTop: spacing.lg,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...textStyles.label,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCount: {
    ...textStyles.captionMedium,
    fontWeight: '700',
  },
  sectionEmpty: {
    ...textStyles.caption,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  bucketRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  mainArea: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    minHeight: 300,
  },
  floorTexture: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius['2xl'],
  },
  mapOverlayBottomLeft: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
  },
  mapOverlayBottomRight: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
  },
});
