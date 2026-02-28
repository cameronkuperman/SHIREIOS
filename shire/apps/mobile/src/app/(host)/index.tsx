import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  type LayoutRectangle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import {
  textStyles,
  spacing,
  shadows,
  borderRadius,
  useTheme,
  type StatusKey,
} from '@/theme';
import { GlassSurface } from '@/components/GlassSurface';
import { Table } from '@/components/Table';
import { WaitlistCard, type WaitlistParty } from '@/components/WaitlistCard';
import { FilterPill } from '@/components/FilterPill';
import { QuickSeatCard } from '@/components/QuickSeatCard';
import { TablePopover } from '@/components/TablePopover';

// ── Mock Data ──────────────────────────────────────────────

const waitlistData: WaitlistParty[] = [
  { name: 'Sarah S.', size: 4, wait: '15m', status: 'Waiting' },
  { name: 'David M.', size: 6, wait: '20m', status: 'Waiting' },
  { name: 'Emily L.', size: 2, wait: 'Now', status: 'Next' },
  { name: 'John K.', size: 5, wait: '30m', status: 'Waiting' },
  { name: 'Anna P.', size: 8, wait: '45m', status: 'Waiting' },
  { name: 'Chris T.', size: 2, wait: '1h', status: 'Waiting' },
];

const reservationsData: WaitlistParty[] = [
  { name: 'Williams', size: 4, wait: '6:30 PM', status: 'Waiting' },
  { name: 'Thompson', size: 2, wait: '7:00 PM', status: 'Waiting' },
  { name: 'Garcia', size: 6, wait: '7:15 PM', status: 'Next' },
  { name: 'Chen', size: 8, wait: '7:30 PM', status: 'Waiting' },
  { name: 'Patel', size: 3, wait: '8:00 PM', status: 'Waiting' },
];

type TableData = {
  id: string;
  status: StatusKey;
  shape: 'circle' | 'square' | 'horizontal';
  capacity?: number;
  server?: string;
  partyName?: string;
  seatedTime?: string;
};

const mainDiningTables: TableData[][] = [
  [
    { id: '1', status: 'occupied', shape: 'circle', capacity: 4, server: 'Maria S.', partyName: 'Johnson', seatedTime: '42m' },
    { id: '2', status: 'available', shape: 'circle', capacity: 2 },
    { id: '3', status: 'reserved', shape: 'square', capacity: 4 },
    { id: '4', status: 'dirty', shape: 'circle', capacity: 6 },
  ],
  [
    { id: '5', status: 'available', shape: 'square', capacity: 2 },
    { id: '6', status: 'occupied', shape: 'square', capacity: 4, server: 'James R.', partyName: 'Lee', seatedTime: '18m' },
    { id: '7', status: 'available', shape: 'circle', capacity: 2 },
    { id: '8', status: 'occupied', shape: 'circle', capacity: 4, server: 'Maria S.', partyName: 'Kim', seatedTime: '55m' },
  ],
  [
    { id: '9', status: 'occupied', shape: 'horizontal', capacity: 8, server: 'Alex T.', partyName: 'Martinez', seatedTime: '25m' },
    { id: '10', status: 'reserved', shape: 'circle', capacity: 2 },
    { id: '11', status: 'available', shape: 'circle', capacity: 4 },
  ],
];

const patioTables: TableData[][] = [
  [
    { id: 'P1', status: 'available', shape: 'square', capacity: 4 },
    { id: 'P2', status: 'available', shape: 'square', capacity: 4 },
  ],
  [
    { id: 'P3', status: 'occupied', shape: 'square', capacity: 4, server: 'Nina W.', partyName: 'Davis', seatedTime: '10m' },
    { id: 'P4', status: 'available', shape: 'square', capacity: 2 },
  ],
];

const quickSeatSuggestions = [
  { tableId: '2', tableType: 'Round' as const, capacity: 2, server: 'Maria S.', label: 'Best Match' },
  { tableId: '5', tableType: 'Square' as const, capacity: 2, server: 'James R.' },
  { tableId: '7', tableType: 'Round' as const, capacity: 2, server: 'Maria S.' },
  { tableId: '11', tableType: 'Round' as const, capacity: 4, server: 'Alex T.' },
  { tableId: 'P1', tableType: 'Square' as const, capacity: 4, server: 'Nina W.' },
];

const FILTERS = ['Main Dining', 'Patio / Outside', 'Booths', 'Bar'] as const;

// ── Component ──────────────────────────────────────────────

export default function FloorPlanScreen() {
  const { colors, isDark } = useTheme();
  const [sidebarTab, setSidebarTab] = useState<'waitlist' | 'reservations'>('waitlist');
  const [activeFilter, setActiveFilter] = useState(0);
  const [selectedPartyIndex, setSelectedPartyIndex] = useState<number | null>(null);
  const [popover, setPopover] = useState<{ table: TableData; layout: LayoutRectangle } | null>(null);

  const tableRefs = useRef<Record<string, View | null>>({});

  const handleTablePress = useCallback((table: TableData, ref: View | null) => {
    if (!ref) return;
    ref.measureInWindow((x, y, width, height) => {
      setPopover({ table, layout: { x, y, width, height } });
    });
  }, []);

  const sidebarItems = sidebarTab === 'waitlist' ? waitlistData : reservationsData;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Warm ambient background with subtle vignette */}
      <View style={[styles.ambientBackground, { backgroundColor: colors.background }]}>
        <View style={styles.vignetteTop} />
        <View style={styles.vignetteBottom} />
      </View>

      {/* Top Navigation */}
      <View style={styles.topNav}>
        <Text style={[styles.logoText, { color: colors.text.primary }]}>SHIRE</Text>
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor: colors.surface.level1,
              borderColor: colors.glass.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Quick-Seat Strip */}
      <View style={styles.quickSeatStrip}>
        <GlassSurface intensity={30} borderRadius={borderRadius['2xl']} style={styles.quickSeatContainer}>
          <Text style={[styles.quickSeatLabel, { color: colors.text.muted }]}>QUICK SEAT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickSeatScroll}
          >
            {quickSeatSuggestions.map((s) => (
              <QuickSeatCard key={s.tableId} {...s} />
            ))}
          </ScrollView>
        </GlassSurface>
      </View>

      {/* Main Split Layout */}
      <View style={styles.splitLayout}>
        {/* Left Sidebar */}
        <GlassSurface intensity={45} style={styles.sidebar}>
          {/* Sidebar Toggle */}
          <View style={[styles.sidebarHeader, { borderBottomColor: colors.border.subtle }]}>
            <View style={[styles.segmentedControl, { backgroundColor: colors.surface.level3 }]}>
              <TouchableOpacity
                style={[
                  styles.segment,
                  sidebarTab === 'waitlist' && [
                    styles.segmentActive,
                    { backgroundColor: isDark ? colors.surface.level1 : colors.white },
                  ],
                ]}
                onPress={() => setSidebarTab('waitlist')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: colors.text.muted },
                    sidebarTab === 'waitlist' && { color: colors.text.primary, fontWeight: '600' },
                  ]}
                >
                  Waitlist ({waitlistData.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segment,
                  sidebarTab === 'reservations' && [
                    styles.segmentActive,
                    { backgroundColor: isDark ? colors.surface.level1 : colors.white },
                  ],
                ]}
                onPress={() => setSidebarTab('reservations')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: colors.text.muted },
                    sidebarTab === 'reservations' && { color: colors.text.primary, fontWeight: '600' },
                  ]}
                >
                  Reservations ({reservationsData.length})
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Sidebar Content */}
          <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
            <Animated.View layout={Layout.springify()} key={sidebarTab}>
              {sidebarItems.map((party, index) => (
                <Animated.View key={`${sidebarTab}-${index}`} entering={FadeIn.delay(index * 40).duration(300)}>
                  <WaitlistCard
                    party={party}
                    index={index}
                    isSelected={sidebarTab === 'waitlist' && selectedPartyIndex === index}
                    onPress={() => setSelectedPartyIndex(selectedPartyIndex === index ? null : index)}
                  />
                </Animated.View>
              ))}
            </Animated.View>
          </ScrollView>
        </GlassSurface>

        {/* Right - Floor Plan */}
        <View style={styles.mainArea}>
          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {FILTERS.map((filter, i) => (
              <FilterPill
                key={filter}
                label={filter}
                isActive={activeFilter === i}
                onPress={() => setActiveFilter(i)}
              />
            ))}
          </View>

          {/* Floor Plan Map */}
          <View style={styles.mapContainer}>
            {/* Subtle linen-like texture background */}
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

            {/* Main Dining Room */}
            <View
              style={[
                styles.roomOutline,
                {
                  borderColor: colors.border.default,
                  backgroundColor: colors.surface.level4,
                },
              ]}
            >
              <Text
                style={[
                  styles.roomLabel,
                  { backgroundColor: colors.background, color: colors.text.muted },
                ]}
              >
                MAIN DINING A
              </Text>
              {mainDiningTables.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.tableRow}>
                  {row.map((table) => (
                    <View
                      key={table.id}
                      ref={(ref) => { tableRefs.current[table.id] = ref; }}
                      collapsable={false}
                    >
                      <Table
                        id={table.id}
                        status={table.status}
                        shape={table.shape}
                        capacity={table.capacity}
                        onPress={() => handleTablePress(table, tableRefs.current[table.id])}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {/* Patio */}
            <View
              style={[
                styles.roomOutline,
                styles.roomPatio,
                {
                  borderColor: colors.border.default,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(230, 225, 215, 0.22)',
                },
              ]}
            >
              <Text
                style={[
                  styles.roomLabel,
                  { backgroundColor: colors.background, color: colors.text.muted },
                ]}
              >
                PATIO
              </Text>
              {patioTables.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.tableRow}>
                  {row.map((table) => (
                    <View
                      key={table.id}
                      ref={(ref) => { tableRefs.current[table.id] = ref; }}
                      collapsable={false}
                    >
                      <Table
                        id={table.id}
                        status={table.status}
                        shape={table.shape}
                        capacity={table.capacity}
                        onPress={() => handleTablePress(table, tableRefs.current[table.id])}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Table Popover */}
      {popover && (
        <TablePopover
          visible
          onClose={() => setPopover(null)}
          tableId={popover.table.id}
          status={popover.table.status}
          capacity={popover.table.capacity}
          server={popover.table.server}
          partyName={popover.table.partyName}
          seatedTime={popover.table.seatedTime}
          anchorLayout={popover.layout}
          onSeat={() => setPopover(null)}
          onClear={() => setPopover(null)}
          onBlock={() => setPopover(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  ambientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    opacity: 0.5,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    opacity: 0.3,
  },

  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...shadows.subtle,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 3,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm + 1,
  },
  segmentActive: {
    ...shadows.glass,
  },
  segmentText: {
    ...textStyles.captionMedium,
  },
  sidebarScroll: {
    padding: spacing.md,
  },

  mainArea: {
    flex: 1,
    flexDirection: 'column',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
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
