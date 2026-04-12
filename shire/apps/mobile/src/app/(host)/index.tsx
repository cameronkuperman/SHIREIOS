import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  LayoutRectangle,
  Pressable,
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
import { HostDiagnosticsModal } from '@/components/HostDiagnosticsModal';
import { FilterPill } from '@/components/FilterPill';
import { GlassSurface } from '@/components/GlassSurface';
import { QuickSeatCard } from '@/components/QuickSeatCard';
import { Table } from '@/components/Table';
import { TablePopover } from '@/components/TablePopover';
import { WaitlistCard } from '@/components/WaitlistCard';
import { getAppVersionLabel, getOrCreateDeviceId } from '@/lib/device';
import {
  type HostSidebarParty,
  useFloorSidebarParties,
  useReservationMutations,
} from '@/features/host/hooks';
import { usePendingSeatStore } from '@/features/host/pendingSeatStore';
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

function createReservationSeatCommandId(): string {
  return `reservation-seat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatConnectionLabel(
  connectionState: string,
  hasSnapshot: boolean,
) {
  if (connectionState === 'error' || connectionState === 'disconnected') {
    return 'Manual';
  }
  if (connectionState === 'connected' && hasSnapshot) {
    return 'Live';
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
  const { seatParty, clearTable, markClean, blockTable, unblockTable } = useFloorActions();
  const { connectionState, syncError, lastSnapshotAt, floorId } = useFloorConnectionState();
  const hostParties = useFloorSidebarParties();
  const { runReservationAction } = useReservationMutations();
  const markPendingSeat = usePendingSeatStore((state) => state.markPendingSeat);

  const [activeFilter, setActiveFilter] = useState('All Rooms');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ tableId: string; layout: LayoutRectangle } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [roomSizes, setRoomSizes] = useState<Record<string, { width: number; height: number }>>({});

  const handleRoomLayout = useCallback((roomId: string, e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setRoomSizes((prev) => {
      if (prev[roomId]?.width === width && prev[roomId]?.height === height) return prev;
      return { ...prev, [roomId]: { width, height } };
    });
  }, []);

  const tableRefs = useRef<Record<string, View | null>>({});
  const liveTable = useTableDetails(popover?.tableId ?? null);
  const filters = useMemo(
    () => ['All Rooms', ...new Set(floorMap.rooms.map((room) => room.filterLabel))],
    [floorMap.rooms],
  );
  const visibleRooms =
    activeFilter === 'All Rooms'
      ? rooms
      : rooms.filter((room) => room.filterLabel === activeFilter);
  const isUsingStarterMap =
    floorMap.floorId === DEFAULT_FLOOR_MAP.floorId &&
    floorMap.mapVersion === DEFAULT_FLOOR_MAP.mapVersion;

  const hasSnapshot = Boolean(lastSnapshotAt);
  const connectionLabel = formatConnectionLabel(connectionState, hasSnapshot);
  const connectionColor =
    connectionLabel === 'Manual'
      ? colors.status.dirty.text
      : connectionLabel === 'Live'
        ? colors.status.available.text
        : colors.status.reserved.text;

  const selectedParty = selectedPartyId
    ? (hostParties.find((party) => party.id === selectedPartyId) ?? null)
    : null;

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

  const handleClear = () => {
    if (!liveTable) {
      return;
    }

    const didDispatch =
      liveTable.status === 'occupied'
        ? clearTable(liveTable.id).ok
        : liveTable.status === 'dirty'
          ? markClean(liveTable.id).ok
          : false;

    if (didDispatch) {
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
    { label: 'Routing', value: routing?.updatedAt ?? (isRoutingLoading ? 'Loading' : 'Unavailable') },
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

      {(syncError || connectionLabel !== 'Live' || routingError || isRoutingSaving) && (
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
          <View style={[styles.sidebarHeader, { borderBottomColor: colors.border.subtle }]}>
            <Text style={[styles.sidebarTitle, { color: colors.text.primary }]}>
              Host Queue ({hostParties.length})
            </Text>
            <Text style={[styles.sidebarSubtitle, { color: colors.text.muted }]}>
              Select a waitlist party or reservation, then tap an open table to seat them.
            </Text>
          </View>

          <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
            {hostParties.map((party, index) => (
              <WaitlistCard
                key={party.id}
                party={party}
                index={index}
                isSelected={selectedPartyId === party.id}
                onPress={() => setSelectedPartyId(selectedPartyId === party.id ? null : party.id)}
              />
            ))}
          </ScrollView>
        </GlassSurface>

        <View style={styles.mainArea}>
          <View style={styles.filterRow}>
            {filters.map((filter) => (
              <FilterPill
                key={filter}
                label={filter}
                isActive={activeFilter === filter}
                onPress={() => setActiveFilter(filter)}
              />
            ))}
          </View>

          <View style={styles.mapContainer}>
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

            {visibleRooms.map((room) => (
              <Pressable
                key={room.roomId}
                onLayout={(e) => handleRoomLayout(room.roomId, e)}
                style={[
                  styles.roomOutline,
                  room.variant === 'patio' && styles.roomPatio,
                  room.layoutMode === 'freeform' && styles.roomFreeform,
                  {
                    flex: room.flex,
                    borderColor: colors.border.default,
                    backgroundColor:
                      room.variant === 'patio'
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.02)'
                          : 'rgba(230, 225, 215, 0.22)'
                        : colors.surface.level4,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roomLabel,
                    { backgroundColor: colors.background, color: colors.text.muted },
                  ]}
                >
                  {room.label}
                </Text>
                {room.layoutMode === 'freeform' ? (
                  // Freeform: absolute position each table
                  room.tables.map((table) => {
                    const size = roomSizes[room.roomId];
                    const cw = size?.width ?? 600;
                    const ch = size?.height ?? 400;
                    return (
                      <View
                        key={table.id}
                        ref={(ref) => {
                          tableRefs.current[table.id] = ref;
                        }}
                        collapsable={false}
                        style={{
                          position: 'absolute',
                          left: (table.x ?? 0.5) * cw - 32,
                          top: (table.y ?? 0.5) * ch - 32,
                          ...(table.rotation
                            ? { transform: [{ rotate: `${table.rotation}deg` }] }
                            : {}),
                        }}
                      >
                        <Table
                          id={table.label}
                          status={table.status}
                          shape={table.shape}
                          capacity={table.capacity}
                          onPress={() =>
                            handleTablePress(table.id, tableRefs.current[table.id] ?? null)
                          }
                        />
                      </View>
                    );
                  })
                ) : (
                  // Grid: row-based flexbox (existing behavior)
                  room.rows.map((row, rowIdx) => (
                    <View key={`${room.roomId}-${rowIdx}`} style={styles.tableRow}>
                      {row.map((table) => (
                        <View
                          key={table.id}
                          ref={(ref) => {
                            tableRefs.current[table.id] = ref;
                          }}
                          collapsable={false}
                        >
                          <Table
                            id={table.label}
                            status={table.status}
                            shape={table.shape}
                            capacity={table.capacity}
                            onPress={() =>
                              handleTablePress(table.id, tableRefs.current[table.id] ?? null)
                            }
                          />
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </Pressable>
            ))}
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
          server={
            liveTable.currentWaiterName ?? popoverResolvedWaiter?.name ?? liveTable.server
          }
          serverColor={
            popoverResolvedWaiter?.id
              ? waiterColorMap[popoverResolvedWaiter.id]
              : liveTable.serverId
                ? waiterColorMap[liveTable.serverId]
                : undefined
          }
          partyName={liveTable.partyName}
          seatedTime={liveTable.seatedTime}
          anchorLayout={popover.layout}
          onSeat={!selectedParty || liveTable.isBlocked ? undefined : handleSeat}
          onClear={handleClear}
          onBlock={handleBlock}
          blockActionLabel={liveTable.isBlocked ? 'Unblock' : 'Block'}
          seatWarning={seatWarning}
        />
      )}

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
  sidebarHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  sidebarTitle: {
    ...textStyles.label,
  },
  sidebarSubtitle: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  sidebarScroll: {
    padding: spacing.md,
  },
  mainArea: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  mapContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.lg,
  },
  floorTexture: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius['2xl'],
  },
  roomOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
  },
  roomPatio: {
    flex: 0.4,
  },
  roomFreeform: {
    position: 'relative',
    minHeight: 300,
  },
  roomLabel: {
    position: 'absolute',
    top: -10,
    left: spacing['2xl'],
    paddingHorizontal: spacing.sm,
    ...textStyles.sectionLabel,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing['3xl'],
    marginTop: spacing.lg,
  },
});
