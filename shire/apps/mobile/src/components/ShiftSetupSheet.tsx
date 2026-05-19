import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type {
  FloorMap,
  FloorMapSectionPlan,
  FloorMapTable,
  RoutingWaiter,
  ShiftStartGroup,
  WaiterRoutingMode,
  WaiterRoutingState,
} from '@shire/shared';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';
import {
  applySectionPlanToFloorMap,
  normalizeSectionName,
  sectionColorWithAlpha,
  sectionNamesForPlan,
  useFloorStore,
} from '@/features/floor';
import { saveFloorMapLayout, upsertHostFloorMap } from '@/features/floor-builder';
import {
  useWaiterColorMap,
  useWaiterRoutingActions,
  useWaiterRoutingState,
  useWaiters,
} from '@/features/routing';
import { useReservationDayBook } from '@/features/host/hooks';
import { ShiftHourGrid, type ShiftHourSlot } from './ShiftHourGrid';

type ShiftSetupSheetProps = {
  visible: boolean;
  onClose: () => void;
  presentation?: 'modal' | 'inline';
};

const MODE_OPTIONS: { value: WaiterRoutingMode; label: string }[] = [
  { value: 'manual_rotation', label: 'Rotation' },
  { value: 'section', label: 'Section' },
];

const MODE_HELP: Record<WaiterRoutingMode, string> = {
  manual_rotation: 'Next waiter in the rotation order takes the next table.',
  section: 'Each waiter owns a section; new tables route to that section.',
};

function makeRoutingWaiter(id: string, name: string): RoutingWaiter {
  return {
    id,
    name,
    isTemporary: false,
    status: 'available',
    isActive: true,
    assignedSectionIds: [],
    assignedTableIds: [],
    currentTableIds: [],
    servedTableIds: [],
    liveTables: 0,
    servedSeatingCount: 0,
    lastAssignedAt: null,
  };
}

export function ShiftSetupSheet({
  visible,
  onClose,
  presentation = 'modal',
}: ShiftSetupSheetProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const isInline = presentation === 'inline';
  const { routing, locationId, isSaving } = useWaiterRoutingState();
  const {
    persistRouting,
    setWaiterActive,
    assignSection,
    setRoutingMode,
    setShiftStartGroups,
    setGratThreshold,
  } = useWaiterRoutingActions();
  const { waiters: roster } = useWaiters(locationId);
  const waiterColorMap = useWaiterColorMap();
  const floorMap = useFloorStore((state) => state.floorMap);
  const setFloorMap = useFloorStore((state) => state.setFloorMap);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const reservations = useReservationDayBook(today);

  const [selectedSectionPlanId, setSelectedSectionPlanId] = useState<string | null>(
    floorMap.activeSectionPlanId ?? null,
  );
  const [targetWaiterCountText, setTargetWaiterCountText] = useState('');
  const [newGroupName, setNewGroupName] = useState('9am');
  const [newGroupTime, setNewGroupTime] = useState('09:00');

  const shiftWaiters = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; isActive: boolean; inRouting: boolean }
    >();
    routing?.waiters.forEach((w) => {
      map.set(w.id, {
        id: w.id,
        name: w.name,
        isActive: routing.activeWaiterIds.includes(w.id),
        inRouting: true,
      });
    });
    roster.forEach((w) => {
      if (!map.has(w.id)) {
        map.set(w.id, { id: w.id, name: w.name, isActive: false, inRouting: false });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [routing, roster]);

  const activeWaiters = useMemo(() => shiftWaiters.filter((w) => w.isActive), [shiftWaiters]);
  const targetWaiterCount = useMemo(() => {
    const parsed = Number.parseInt(targetWaiterCountText, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Math.max(1, activeWaiters.length);
  }, [activeWaiters.length, targetWaiterCountText]);

  const sectionPlans = useMemo(() => floorMap.sectionPlans ?? [], [floorMap.sectionPlans]);
  const selectedSectionPlan = useMemo(() => {
    return (
      sectionPlans.find((plan) => plan.planId === selectedSectionPlanId) ??
      sectionPlans.find((plan) => plan.waiterCount === targetWaiterCount && plan.isDefault) ??
      sectionPlans.find((plan) => plan.waiterCount === targetWaiterCount) ??
      sectionPlans.find((plan) => plan.planId === floorMap.activeSectionPlanId) ??
      sectionPlans[0] ??
      null
    );
  }, [floorMap.activeSectionPlanId, sectionPlans, selectedSectionPlanId, targetWaiterCount]);

  useEffect(() => {
    if (selectedSectionPlan?.planId && selectedSectionPlan.planId !== selectedSectionPlanId) {
      setSelectedSectionPlanId(selectedSectionPlan.planId);
    }
  }, [selectedSectionPlan?.planId, selectedSectionPlanId]);

  const sections = useMemo(() => {
    const planSections = sectionNamesForPlan(selectedSectionPlan);
    if (planSections.length > 0) {
      return planSections;
    }

    const set = new Set<string>();
    Object.values(floorMap.tables).forEach((table) => {
      const section = normalizeSectionName(table.section);
      if (section) set.add(section);
    });
    if (routing) {
      Object.keys(routing.sectionAssignments).forEach((s) => set.add(s));
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [floorMap.tables, routing, selectedSectionPlan]);

  const hourSlots = useMemo<ShiftHourSlot[]>(() => {
    const byHour = new Map<number, { parties: number; covers: number }>();
    reservations.forEach((reservation) => {
      const hour = Number.parseInt(reservation.timeSlot.slice(0, 2), 10);
      if (Number.isNaN(hour)) return;
      const entry = byHour.get(hour) ?? { parties: 0, covers: 0 };
      entry.parties += 1;
      entry.covers += reservation.partySize;
      byHour.set(hour, entry);
    });
    const slots: ShiftHourSlot[] = [];
    for (let hour = 11; hour <= 23; hour += 1) {
      const entry = byHour.get(hour) ?? { parties: 0, covers: 0 };
      slots.push({
        time: `${String(hour).padStart(2, '0')}:00`,
        parties: entry.parties,
        covers: entry.covers,
      });
    }
    return slots;
  }, [reservations]);

  const reportError = (fallback: string) => (error: unknown) => {
    Alert.alert('Shift update failed', error instanceof Error ? error.message : fallback);
  };

  const handleSetMode = (mode: WaiterRoutingMode) => {
    if (!routing || routing.mode === mode) return;
    setRoutingMode(mode).catch(reportError('Could not change the seating mode.'));
  };

  const handleToggleWaiter = (waiter: (typeof shiftWaiters)[number]) => {
    if (!routing) return;
    if (waiter.isActive) {
      setWaiterActive(waiter.id, false).catch(reportError('Could not update the waiter.'));
      return;
    }
    if (waiter.inRouting) {
      setWaiterActive(waiter.id, true).catch(reportError('Could not update the waiter.'));
      return;
    }
    persistRouting((current) => {
      const next = makeRoutingWaiter(waiter.id, waiter.name);
      return {
        ...current,
        waiters: [...current.waiters, next],
        activeWaiterIds: [...current.activeWaiterIds, next.id],
        rotationOrder: [...current.rotationOrder, next.id],
        nextWaiterId: current.nextWaiterId ?? next.id,
      };
    }).catch(reportError('Could not add the waiter to the shift.'));
  };

  const handleAssignSection = (sectionId: string, waiterId: string) => {
    if (!routing) return;
    const current = routing.sectionAssignments[sectionId];
    assignSection(sectionId, current === waiterId ? null : waiterId).catch(
      reportError('Could not assign the section.'),
    );
  };

  const handleSelectSectionPlan = useCallback(
    (plan: FloorMapSectionPlan) => {
      const appliedMap = applySectionPlanToFloorMap(floorMap, plan);
      setSelectedSectionPlanId(plan.planId);
      setTargetWaiterCountText(String(plan.waiterCount));
      setFloorMap(appliedMap);

      if (!locationId) return;
      upsertHostFloorMap(locationId, appliedMap)
        .then((result) => {
          const mapToPersist =
            result.floorId && result.floorId !== appliedMap.floorId
              ? { ...appliedMap, floorId: result.floorId }
              : appliedMap;
          setFloorMap(mapToPersist);
          return saveFloorMapLayout(locationId, mapToPersist.floorId, mapToPersist);
        })
        .catch(reportError('Could not save the section preset for today.'));
    },
    [floorMap, locationId, setFloorMap],
  );

  const handleAddStartGroup = () => {
    if (!routing) return;
    const name = newGroupName.trim();
    const startTime = newGroupTime.trim();
    if (!name || !/^\d{2}:\d{2}$/.test(startTime)) {
      Alert.alert('Start group needs a name and HH:MM time.');
      return;
    }
    const group: ShiftStartGroup = {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      startTime,
      waiterIds: [],
    };
    setShiftStartGroups([...(routing.shiftStartGroups ?? []), group]).catch(
      reportError('Could not add the start group.'),
    );
  };

  const handleToggleGroupWaiter = (groupId: string, waiterId: string) => {
    if (!routing) return;
    const groups = (routing.shiftStartGroups ?? []).map((group) => {
      const waiterIds = new Set(group.waiterIds);
      if (group.id === groupId && waiterIds.has(waiterId)) {
        waiterIds.delete(waiterId);
      } else if (group.id === groupId) {
        waiterIds.add(waiterId);
      } else {
        waiterIds.delete(waiterId);
      }
      return { ...group, waiterIds: [...waiterIds] };
    });
    setShiftStartGroups(groups).catch(reportError('Could not update the start group.'));
  };

  const handleOpenTeamSettings = () => {
    onClose();
    router.push('/settings/team' as Href);
  };

  const content = (
    <View
      style={[
        styles.sheet,
        isInline && styles.inlineSheet,
        {
          backgroundColor: isInline
            ? colors.surface.level1
            : isDark
              ? 'rgba(20, 24, 28, 0.97)'
              : 'rgba(248, 250, 252, 0.98)',
          borderColor: isInline ? colors.border.subtle : colors.glass.border,
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Shift Setup</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            Pick the team, choose today's preset, assign the floor.
          </Text>
        </View>
        {!isInline && (
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyInner}
        showsVerticalScrollIndicator={false}
      >
        {!routing ? (
          <Text style={[styles.empty, { color: colors.text.muted }]}>
            Waiter routing is still loading for this location.
          </Text>
        ) : (
          <>
            {/* Mode toggle */}
            <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>SEATING MODE</Text>
            <View style={styles.modeRow}>
              {MODE_OPTIONS.map((option) => {
                const active = routing.mode === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.8}
                    onPress={() => handleSetMode(option.value)}
                    style={[
                      styles.modeButton,
                      {
                        backgroundColor: active ? colors.accent : colors.surface.level2,
                        borderColor: active ? colors.accent : colors.border.subtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        { color: active ? colors.white : colors.text.secondary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.helpText, { color: colors.text.muted }]}>
              {MODE_HELP[routing.mode]}
            </Text>

            {/* Waiters */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
                WAITERS ON TONIGHT
              </Text>
              <Text style={[styles.countPill, { color: colors.text.secondary }]}>
                {activeWaiters.length}/{shiftWaiters.length}
              </Text>
            </View>
            {shiftWaiters.length === 0 && (
              <Text style={[styles.empty, { color: colors.text.muted }]}>
                No waiters yet. Add your team below.
              </Text>
            )}
            {shiftWaiters.map((waiter) => (
              <TouchableOpacity
                key={waiter.id}
                activeOpacity={0.7}
                onPress={() => handleToggleWaiter(waiter)}
                style={[
                  styles.waiterRow,
                  { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
                ]}
              >
                <Ionicons
                  name={waiter.isActive ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={waiter.isActive ? colors.accent : colors.text.muted}
                />
                <View
                  style={[
                    styles.waiterDot,
                    { backgroundColor: waiterColorMap[waiter.id] ?? colors.border.default },
                  ]}
                />
                <Text style={[styles.waiterName, { color: colors.text.primary }]}>
                  {waiter.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addLink} onPress={handleOpenTeamSettings}>
              <Ionicons name="people-circle-outline" size={18} color={colors.accent} />
              <Text style={[styles.addLinkText, { color: colors.accent }]}>
                Manage team roster
              </Text>
            </TouchableOpacity>

            <Text
              style={[styles.sectionLabel, { color: colors.text.muted, marginTop: spacing.xl }]}
            >
              START GROUPS
            </Text>
            {(routing.shiftStartGroups ?? []).map((group) => (
              <View
                key={group.id}
                style={[
                  styles.groupRow,
                  { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
                ]}
              >
                <View style={styles.groupHeader}>
                  <Text style={[styles.sectionName, { color: colors.text.primary }]}>
                    {group.name}
                  </Text>
                  <Text style={[styles.countPill, { color: colors.text.secondary }]}>
                    {group.startTime}
                  </Text>
                </View>
                <View style={styles.groupChips}>
                  {activeWaiters.map((waiter) => {
                    const assigned = group.waiterIds.includes(waiter.id);
                    return (
                      <TouchableOpacity
                        key={waiter.id}
                        activeOpacity={0.75}
                        onPress={() => handleToggleGroupWaiter(group.id, waiter.id)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: assigned
                              ? (waiterColorMap[waiter.id] ?? colors.accent)
                              : colors.surface.level1,
                            borderColor: assigned
                              ? (waiterColorMap[waiter.id] ?? colors.accent)
                              : colors.border.subtle,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: assigned ? colors.white : colors.text.secondary },
                          ]}
                        >
                          {waiter.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.groupInput,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.surface.level2,
                    borderColor: colors.border.subtle,
                  },
                ]}
                placeholder="Group"
                placeholderTextColor={colors.text.muted}
                value={newGroupName}
                onChangeText={setNewGroupName}
              />
              <TextInput
                style={[
                  styles.timeInput,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.surface.level2,
                    borderColor: colors.border.subtle,
                  },
                ]}
                placeholder="09:00"
                placeholderTextColor={colors.text.muted}
                value={newGroupTime}
                onChangeText={setNewGroupTime}
              />
              <TouchableOpacity
                style={[styles.addConfirm, { backgroundColor: colors.accent }]}
                onPress={handleAddStartGroup}
              >
                <Ionicons name="add" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>

            <Text
              style={[styles.sectionLabel, { color: colors.text.muted, marginTop: spacing.xl }]}
            >
              GRATUITY
            </Text>
            <View
              style={[
                styles.sectionRow,
                { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
              ]}
            >
              <Text style={[styles.sectionName, { color: colors.text.primary }]}>Party size</Text>
              {[5, 6, 7, 8].map((threshold) => {
                const active = (routing.gratThreshold ?? 6) === threshold;
                return (
                  <TouchableOpacity
                    key={threshold}
                    activeOpacity={0.75}
                    onPress={() =>
                      setGratThreshold(threshold).catch(
                        reportError('Could not update the gratuity threshold.'),
                      )
                    }
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.accent : colors.surface.level1,
                        borderColor: active ? colors.accent : colors.border.subtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.white : colors.text.secondary },
                      ]}
                    >
                      {threshold}+
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section plan */}
            <Text
              style={[styles.sectionLabel, { color: colors.text.muted, marginTop: spacing.xl }]}
            >
              SECTION PLAN
            </Text>
            <View style={styles.planCountRow}>
              <Text style={[styles.helpText, { color: colors.text.muted }]}>
                Staffing count
              </Text>
              <TextInput
                value={targetWaiterCountText}
                onChangeText={setTargetWaiterCountText}
                placeholder={String(Math.max(1, activeWaiters.length))}
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                style={[
                  styles.planCountInput,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.surface.level2,
                    borderColor: colors.border.subtle,
                  },
                ]}
              />
            </View>
            {sectionPlans.length === 0 ? (
              <View
                style={[
                  styles.planEmpty,
                  { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
                ]}
              >
                <Text style={[styles.empty, { color: colors.text.muted }]}>
                  No saved section presets yet. Build permanent presets in Floor Builder.
                </Text>
                <TouchableOpacity
                  style={styles.addLink}
                  onPress={() => {
                    onClose();
                    router.push('/floor-builder' as Href);
                  }}
                >
                  <Ionicons name="map-outline" size={18} color={colors.accent} />
                  <Text style={[styles.addLinkText, { color: colors.accent }]}>
                    Open Floor Builder
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.planChipScroll}
                >
                  {sectionPlans.map((plan) => {
                    const active = plan.planId === selectedSectionPlan?.planId;
                    return (
                      <TouchableOpacity
                        key={plan.planId}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => handleSelectSectionPlan(plan)}
                        style={[
                          styles.planChip,
                          {
                            backgroundColor: active ? colors.accent : colors.surface.level2,
                            borderColor: active ? colors.accent : colors.border.subtle,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.planChipTitle,
                            { color: active ? colors.white : colors.text.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {plan.name}
                        </Text>
                        <Text
                          style={[
                            styles.planChipMeta,
                            { color: active ? 'rgba(255,255,255,0.82)' : colors.text.muted },
                          ]}
                        >
                          {plan.waiterCount} waiters · {plan.sections.length} sections
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <SectionFloorPreview
                  floorMap={floorMap}
                  routing={routing}
                  selectedPlan={selectedSectionPlan}
                  activeWaiterCount={activeWaiters.length}
                  waiterColorMap={waiterColorMap}
                />
              </>
            )}

            {/* Sections */}
            <Text
              style={[styles.sectionLabel, { color: colors.text.muted, marginTop: spacing.xl }]}
            >
              SECTIONS
            </Text>
            {sections.length === 0 && (
              <Text style={[styles.empty, { color: colors.text.muted }]}>
                No sections on the floor map yet.
              </Text>
            )}
            {sections.map((sectionId) => {
              const assignedId = routing.sectionAssignments[sectionId];
              return (
                <View
                  key={sectionId}
                  style={[
                    styles.sectionRow,
                    { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
                  ]}
                >
                  <Text style={[styles.sectionName, { color: colors.text.primary }]}>
                    {sectionId}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipScroll}
                  >
                    {activeWaiters.length === 0 ? (
                      <Text style={[styles.chipEmpty, { color: colors.text.muted }]}>
                        Activate a waiter to assign
                      </Text>
                    ) : (
                      activeWaiters.map((waiter) => {
                        const assigned = assignedId === waiter.id;
                        return (
                          <TouchableOpacity
                            key={waiter.id}
                            activeOpacity={0.75}
                            onPress={() => handleAssignSection(sectionId, waiter.id)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: assigned
                                  ? (waiterColorMap[waiter.id] ?? colors.accent)
                                  : colors.surface.level1,
                                borderColor: assigned
                                  ? (waiterColorMap[waiter.id] ?? colors.accent)
                                  : colors.border.subtle,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                { color: assigned ? colors.white : colors.text.secondary },
                              ]}
                            >
                              {waiter.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              );
            })}

            {/* Hour grid */}
            <Text
              style={[styles.sectionLabel, { color: colors.text.muted, marginTop: spacing.xl }]}
            >
              PROJECTED COVERS
            </Text>
            <ShiftHourGrid slots={hourSlots} />
          </>
        )}
      </ScrollView>

      {!isInline && (
        <View style={[styles.footer, { borderTopColor: colors.border.subtle }]}>
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={onClose}
          >
            <Text style={styles.doneButtonText}>{isSaving ? 'Saving…' : 'Done'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isInline) {
    return visible ? content : null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View onStartShouldSetResponder={() => true}>{content}</View>
      </Pressable>
    </Modal>
  );
}

type SectionFloorPreviewProps = {
  floorMap: FloorMap;
  routing: WaiterRoutingState;
  selectedPlan: FloorMapSectionPlan | null;
  activeWaiterCount: number;
  waiterColorMap: Record<string, string>;
};

function getPlanSectionByTable(
  plan: FloorMapSectionPlan | null,
  table: FloorMapTable,
): string {
  if (!plan) return normalizeSectionName(table.section);
  for (const section of plan.sections) {
    if (section.tableIds.includes(table.tableId)) {
      return normalizeSectionName(section.sectionId);
    }
  }
  return '';
}

function SectionFloorPreview({
  floorMap,
  routing,
  selectedPlan,
  activeWaiterCount,
  waiterColorMap,
}: SectionFloorPreviewProps) {
  const { colors } = useTheme();
  const planSections = sectionNamesForPlan(selectedPlan);
  const assignedSectionCount = planSections.filter(
    (sectionId) => routing.sectionAssignments[sectionId],
  ).length;
  const unassignedSectionCount = Math.max(0, planSections.length - assignedSectionCount);
  const roomTables = useMemo(() => {
    const tablesByRoom = new Map<string, FloorMapTable[]>();
    for (const table of Object.values(floorMap.tables)) {
      const list = tablesByRoom.get(table.roomId) ?? [];
      list.push(table);
      tablesByRoom.set(table.roomId, list);
    }
    return floorMap.rooms.map((room) => ({
      room,
      tables: (tablesByRoom.get(room.roomId) ?? []).sort((left, right) =>
        left.tableNumber.localeCompare(right.tableNumber, undefined, { numeric: true }),
      ),
    }));
  }, [floorMap.rooms, floorMap.tables]);

  return (
    <View
      style={[
        styles.floorPreview,
        { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
      ]}
    >
      <View style={styles.previewLegendRow}>
        <Text style={[styles.previewLegendText, { color: colors.text.secondary }]}>
          {assignedSectionCount} assigned
        </Text>
        <Text style={[styles.previewLegendText, { color: colors.text.muted }]}>
          {unassignedSectionCount} unassigned
        </Text>
        <Text style={[styles.previewLegendText, { color: colors.text.muted }]}>
          {activeWaiterCount} active waiters
        </Text>
      </View>

      {roomTables.map(({ room, tables }) => (
        <View key={room.roomId} style={styles.previewRoom}>
          <Text style={[styles.previewRoomLabel, { color: colors.text.muted }]}>
            {room.filterLabel || room.label}
          </Text>
          <View style={styles.previewTableGrid}>
            {tables.map((table) => {
              const sectionId = getPlanSectionByTable(selectedPlan, table);
              const assignedWaiterId = sectionId ? routing.sectionAssignments[sectionId] : null;
              const waiterColor = assignedWaiterId ? waiterColorMap[assignedWaiterId] : null;
              const hasSection = Boolean(sectionId);
              const tableBorder = waiterColor ?? (hasSection ? colors.text.muted : colors.border.subtle);
              return (
                <View
                  key={table.tableId}
                  style={[
                    styles.previewTable,
                    {
                      backgroundColor: waiterColor
                        ? sectionColorWithAlpha(waiterColor, 0.18)
                        : colors.surface.level1,
                      borderColor: tableBorder,
                      borderStyle: hasSection && !waiterColor ? 'dashed' : 'solid',
                      opacity: hasSection ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={[styles.previewTableNumber, { color: colors.text.primary }]}>
                    {table.tableNumber}
                  </Text>
                  {sectionId ? (
                    <Text
                      style={[styles.previewTableSection, { color: colors.text.muted }]}
                      numberOfLines={1}
                    >
                      {sectionId}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '94%',
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    borderWidth: 1,
    ...shadows.medium,
  },
  inlineSheet: {
    maxHeight: undefined,
    borderRadius: borderRadius['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    ...textStyles.subtitle,
    fontWeight: '800',
  },
  subtitle: {
    ...textStyles.caption,
    marginTop: 2,
  },
  body: {
    flexGrow: 0,
  },
  bodyInner: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  empty: {
    ...textStyles.caption,
    paddingVertical: spacing.sm,
  },
  sectionLabel: {
    ...textStyles.tiny,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  countPill: {
    ...textStyles.captionMedium,
    fontWeight: '700',
    fontVariant: ['tabular-nums' as const],
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeButtonText: {
    ...textStyles.label,
    fontWeight: '700',
  },
  helpText: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  waiterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  waiterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  waiterName: {
    ...textStyles.label,
    fontWeight: '600',
  },
  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  addLinkText: {
    ...textStyles.label,
    fontWeight: '700',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addInput: {
    flex: 1,
    ...textStyles.body,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  groupInput: {
    flex: 1,
    ...textStyles.body,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeInput: {
    width: 88,
    ...textStyles.body,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  planEmpty: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  planCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  planCountInput: {
    width: 64,
    height: 38,
    ...textStyles.body,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    fontWeight: '800',
  },
  planChipScroll: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  planChip: {
    width: 156,
    minHeight: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  planChipTitle: {
    ...textStyles.label,
    fontWeight: '800',
  },
  planChipMeta: {
    ...textStyles.tiny,
    fontWeight: '700',
    marginTop: 2,
  },
  floorPreview: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  previewLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  previewLegendText: {
    ...textStyles.tiny,
    fontWeight: '800',
    fontVariant: ['tabular-nums' as const],
  },
  previewRoom: {
    gap: spacing.xs,
  },
  previewRoomLabel: {
    ...textStyles.tiny,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewTableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  previewTable: {
    width: 54,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  previewTableNumber: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  previewTableSection: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
    maxWidth: 46,
  },
  addConfirm: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  sectionName: {
    ...textStyles.label,
    fontWeight: '700',
    minWidth: 44,
  },
  groupRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipScroll: {
    gap: spacing.xs,
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...textStyles.caption,
    fontWeight: '700',
  },
  chipEmpty: {
    ...textStyles.caption,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
  },
  doneButton: {
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  doneButtonText: {
    ...textStyles.label,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
