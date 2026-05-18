import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoutingWaiter, WaiterRoutingMode } from '@shire/shared';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';
import { useFloorStore } from '@/features/floor';
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
  const isInline = presentation === 'inline';
  const { routing, locationId, isSaving } = useWaiterRoutingState();
  const { persistRouting, setWaiterActive, assignSection } = useWaiterRoutingActions();
  const { waiters: roster, addWaiter } = useWaiters(locationId);
  const waiterColorMap = useWaiterColorMap();
  const floorMap = useFloorStore((state) => state.floorMap);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const reservations = useReservationDayBook(today);

  const [newWaiterName, setNewWaiterName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [extraSections, setExtraSections] = useState<string[]>([]);
  const [showAddWaiter, setShowAddWaiter] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

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

  const sections = useMemo(() => {
    const set = new Set<string>();
    Object.values(floorMap.tables).forEach((table) => {
      if (table.section) set.add(table.section);
    });
    if (routing) {
      Object.keys(routing.sectionAssignments).forEach((s) => set.add(s));
    }
    extraSections.forEach((s) => set.add(s));
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [floorMap.tables, routing, extraSections]);

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
    persistRouting((current) => ({ ...current, mode })).catch(
      reportError('Could not change the seating mode.'),
    );
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

  const handleAddWaiter = async () => {
    const name = newWaiterName.trim();
    if (!name) return;
    setNewWaiterName('');
    setShowAddWaiter(false);
    try {
      const created = await addWaiter({ name });
      await persistRouting((current) => {
        if (current.waiters.some((w) => w.id === created.id)) {
          return {
            ...current,
            activeWaiterIds: [...current.activeWaiterIds, created.id],
            rotationOrder: [...current.rotationOrder, created.id],
          };
        }
        const next = makeRoutingWaiter(created.id, created.name);
        return {
          ...current,
          waiters: [...current.waiters, next],
          activeWaiterIds: [...current.activeWaiterIds, next.id],
          rotationOrder: [...current.rotationOrder, next.id],
          nextWaiterId: current.nextWaiterId ?? next.id,
        };
      });
    } catch {
      // Backend roster unavailable — fall back to a temporary waiter so the
      // shift can still be set up. It just won't persist past this session.
      try {
        await persistRouting((current) => {
          const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const next = { ...makeRoutingWaiter(tempId, name), isTemporary: true };
          return {
            ...current,
            waiters: [...current.waiters, next],
            activeWaiterIds: [...current.activeWaiterIds, next.id],
            rotationOrder: [...current.rotationOrder, next.id],
            nextWaiterId: current.nextWaiterId ?? next.id,
          };
        });
      } catch (error) {
        reportError('Could not add the waiter.')(error);
      }
    }
  };

  const handleAssignSection = (sectionId: string, waiterId: string) => {
    if (!routing) return;
    const current = routing.sectionAssignments[sectionId];
    assignSection(sectionId, current === waiterId ? null : waiterId).catch(
      reportError('Could not assign the section.'),
    );
  };

  const handleAddSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    setExtraSections((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewSectionName('');
    setShowAddSection(false);
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
            Pick the team, build sections, set the seating mode.
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
            {showAddWaiter ? (
              <View style={styles.addRow}>
                <TextInput
                  style={[
                    styles.addInput,
                    {
                      color: colors.text.primary,
                      backgroundColor: colors.surface.level2,
                      borderColor: colors.border.subtle,
                    },
                  ]}
                  placeholder="Waiter name"
                  placeholderTextColor={colors.text.muted}
                  value={newWaiterName}
                  onChangeText={setNewWaiterName}
                  autoFocus
                  onSubmitEditing={handleAddWaiter}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addConfirm, { backgroundColor: colors.accent }]}
                  onPress={handleAddWaiter}
                >
                  <Ionicons name="checkmark" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addLink} onPress={() => setShowAddWaiter(true)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={[styles.addLinkText, { color: colors.accent }]}>Add waiter</Text>
              </TouchableOpacity>
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
            {showAddSection ? (
              <View style={styles.addRow}>
                <TextInput
                  style={[
                    styles.addInput,
                    {
                      color: colors.text.primary,
                      backgroundColor: colors.surface.level2,
                      borderColor: colors.border.subtle,
                    },
                  ]}
                  placeholder="Section name"
                  placeholderTextColor={colors.text.muted}
                  value={newSectionName}
                  onChangeText={setNewSectionName}
                  autoFocus
                  onSubmitEditing={handleAddSection}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addConfirm, { backgroundColor: colors.accent }]}
                  onPress={handleAddSection}
                >
                  <Ionicons name="checkmark" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addLink} onPress={() => setShowAddSection(true)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={[styles.addLinkText, { color: colors.accent }]}>Add section</Text>
              </TouchableOpacity>
            )}

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
      <View style={styles.backdrop}>{content}</View>
    </Modal>
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
