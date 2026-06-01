import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type {
  FloorMap,
  FloorMapSectionPlan,
  FloorMapTable,
  RoutingSetupApprovalRequest,
  RoutingWaiter,
  ShiftStartGroup,
  WaiterRoutingMode,
  WaiterRoutingState,
} from '@shire/shared';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';
import {
  applySectionPlanToFloorMap,
  buildSectionPlanFromCurrentSections,
  normalizeSectionName,
  sectionColorWithAlpha,
  sectionNamesForPlan,
  useFloorStore,
} from '@/features/floor';
import { saveFloorMapLayout, upsertHostFloorMap } from '@/features/floor-builder';
import {
  buildBeginningShiftRouting,
  getShiftSetupDraftKey,
  hasUsableLastShift,
  inferSetupModeFromRouting,
  summarizeShiftSetup,
  type LastShiftSetupMode,
  type ShiftSetupDraftSnapshot,
} from '@/features/routing/shiftSetupDraft';
import { storage } from '@/lib/storage';
import { TimeWheelField } from '@/components/TimeWheelField';
import {
  useWaiterColorMap,
  useWaiterRoutingActions,
  useWaiterRoutingState,
  useWaiters,
} from '@/features/routing';
import { useAuth } from '@/features/auth';
import { useReservationDayBook } from '@/features/host/hooks';
import { ShiftHourGrid, type ShiftHourSlot } from './ShiftHourGrid';

type ShiftSetupSheetProps = {
  visible: boolean;
  onClose: () => void;
  requireApproval?: boolean;
  onApproved?: (routing: WaiterRoutingState) => void;
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

type SetupMode = LastShiftSetupMode;
type SetupStep = 'entry' | 'review' | 'mode' | 'team' | 'starts' | 'sections';
type ThemeColors = ReturnType<typeof useTheme>['colors'];
type IoniconName = keyof typeof Ionicons.glyphMap;

const SETUP_MODE_OPTIONS: { value: SetupMode; label: string; detail: string }[] = [
  {
    value: 'rotation_sections',
    label: 'Rotation now',
    detail: 'Sections ready for later',
  },
  {
    value: 'sections_now',
    label: 'Sections now',
    detail: 'Start service in section mode',
  },
  {
    value: 'rotation_only',
    label: 'Rotation only',
    detail: 'Skip sections for this shift',
  },
];

const DEFAULT_SECTION_PLAN_NAME = 'TEST';

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

function withRosterWaiters(
  routing: WaiterRoutingState | null,
  roster: { id: string; name: string }[],
): WaiterRoutingState | null {
  if (!routing) return null;
  const existingIds = new Set(routing.waiters.map((waiter) => waiter.id));
  const inactiveRosterWaiters = roster
    .filter((waiter) => !existingIds.has(waiter.id))
    .map((waiter) => ({ ...makeRoutingWaiter(waiter.id, waiter.name), isActive: false }));

  return inactiveRosterWaiters.length > 0
    ? { ...routing, waiters: [...routing.waiters, ...inactiveRosterWaiters] }
    : routing;
}

function readShiftSetupDraft(key: string): ShiftSetupDraftSnapshot | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ShiftSetupDraftSnapshot>;
    if (!parsed.routing || !parsed.setupMode) return null;
    return {
      routing: parsed.routing,
      setupMode: parsed.setupMode,
      selectedSectionPlanId: parsed.selectedSectionPlanId ?? null,
      targetWaiterCountText: parsed.targetWaiterCountText ?? '',
    };
  } catch {
    storage.delete(key);
    return null;
  }
}

function writeShiftSetupDraft(key: string, snapshot: ShiftSetupDraftSnapshot): void {
  storage.set(key, JSON.stringify(snapshot));
}

function compactList(values: string[], emptyLabel: string, limit = 4): string {
  if (values.length === 0) return emptyLabel;
  if (values.length <= limit) return values.join(', ');
  return `${values.slice(0, limit).join(', ')} +${values.length - limit} more`;
}

function makeSectionPlanId(waiterCount: number): string {
  return `section-plan-${Math.max(1, Math.round(waiterCount))}-${Date.now().toString(36)}`;
}

// A brand-new preset, independent of any existing one: seeds one empty section
// per waiter so it has its own sections to fill (never falls back to the floor's
// current layout). This is the "create a second/third preset" path.
function buildBlankSectionPlan(waiterCount: number, name: string): FloorMapSectionPlan {
  const count = Math.max(1, Math.round(waiterCount));
  const now = new Date().toISOString();
  return {
    planId: makeSectionPlanId(count),
    name: name.trim() || `${count} Waiters`,
    waiterCount: count,
    sections: Array.from({ length: count }, (_, index) => ({
      sectionId: `Section ${index + 1}`,
      tableIds: [],
    })),
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

// A deep copy of an existing preset as a new, separate preset (new id, not default).
function duplicateSectionPlan(plan: FloorMapSectionPlan): FloorMapSectionPlan {
  const now = new Date().toISOString();
  return {
    ...plan,
    planId: makeSectionPlanId(plan.waiterCount),
    name: `${plan.name} copy`,
    sections: plan.sections.map((section) => ({
      sectionId: section.sectionId,
      tableIds: [...section.tableIds],
    })),
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function ShiftSetupSheet({
  visible,
  onClose,
  requireApproval = false,
  onApproved,
  presentation = 'modal',
}: ShiftSetupSheetProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const isInline = presentation === 'inline';
  const { currentLocation } = useAuth();
  const { routing, locationId, isSaving } = useWaiterRoutingState();
  const { persistRouting } = useWaiterRoutingActions();
  const { waiters: roster } = useWaiters(locationId);
  const waiterColorMap = useWaiterColorMap();
  const floorMap = useFloorStore((state) => state.floorMap);
  const setFloorMap = useFloorStore((state) => state.setFloorMap);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const reservations = useReservationDayBook(today);
  const draftLocationId = locationId ?? currentLocation?.id ?? null;
  const draftStorageKey = useMemo(
    () => getShiftSetupDraftKey(draftLocationId, today),
    [draftLocationId, today],
  );
  const initializedDraftKeyRef = useRef<string | null>(null);
  const hasChosenEntryRef = useRef(false);

  const [selectedSectionPlanId, setSelectedSectionPlanId] = useState<string | null>(
    floorMap.activeSectionPlanId ?? null,
  );
  const [targetWaiterCountText, setTargetWaiterCountText] = useState('');
  const [newGroupName, setNewGroupName] = useState('9am');
  const [newGroupTime, setNewGroupTime] = useState('09:00');
  const [draftRouting, setDraftRouting] = useState<WaiterRoutingState | null>(null);
  const [setupMode, setSetupMode] = useState<SetupMode>('rotation_sections');
  const [setupStep, setSetupStep] = useState<SetupStep>(requireApproval ? 'entry' : 'review');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planNameDraft, setPlanNameDraft] = useState('');
  const [newPlanSectionName, setNewPlanSectionName] = useState('');
  const modalBackgroundColor = isDark ? '#14181C' : '#F8FAFC';
  const seededRouting = useMemo(() => withRosterWaiters(routing, roster), [roster, routing]);
  const workingRouting = draftRouting ?? seededRouting;

  useEffect(() => {
    if (!visible) {
      initializedDraftKeyRef.current = null;
      hasChosenEntryRef.current = false;
      setDraftRouting(null);
      setSetupStep(requireApproval ? 'entry' : 'review');
      setIsCommitting(false);
      setIsEditingPlan(false);
      setNewPlanSectionName('');
      return;
    }

    if (!seededRouting) {
      return;
    }

    if (initializedDraftKeyRef.current === draftStorageKey) {
      return;
    }

    const previousDraftStorageKey = initializedDraftKeyRef.current;
    if (previousDraftStorageKey && previousDraftStorageKey !== draftStorageKey) {
      const migratedDraft = readShiftSetupDraft(previousDraftStorageKey);
      if (migratedDraft && !readShiftSetupDraft(draftStorageKey)) {
        writeShiftSetupDraft(draftStorageKey, migratedDraft);
        storage.delete(previousDraftStorageKey);
      }
    }

    if (hasChosenEntryRef.current) {
      initializedDraftKeyRef.current = draftStorageKey;
      return;
    }

    initializedDraftKeyRef.current = draftStorageKey;
    const savedDraft = requireApproval ? readShiftSetupDraft(draftStorageKey) : null;
    if (savedDraft) {
      setDraftRouting(withRosterWaiters(savedDraft.routing, roster));
      setSetupMode(savedDraft.setupMode);
      setSelectedSectionPlanId(savedDraft.selectedSectionPlanId);
      setTargetWaiterCountText(savedDraft.targetWaiterCountText);
      setSetupStep('review');
      return;
    }

    setDraftRouting(requireApproval ? null : seededRouting);
    setSetupMode(inferSetupModeFromRouting(seededRouting));
    setSelectedSectionPlanId(
      seededRouting.setupSectionPlanId ?? floorMap.activeSectionPlanId ?? null,
    );
    setSetupStep(requireApproval ? 'entry' : 'review');
  }, [
    draftStorageKey,
    floorMap.activeSectionPlanId,
    requireApproval,
    roster,
    seededRouting,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !requireApproval || !draftRouting || setupStep === 'entry') {
      return;
    }
    writeShiftSetupDraft(draftStorageKey, {
      routing: draftRouting,
      setupMode,
      selectedSectionPlanId,
      targetWaiterCountText,
    });
  }, [
    draftRouting,
    draftStorageKey,
    requireApproval,
    selectedSectionPlanId,
    setupMode,
    setupStep,
    targetWaiterCountText,
    visible,
  ]);

  const shiftWaiters = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; isActive: boolean; inRouting: boolean }
    >();
    workingRouting?.waiters.forEach((w) => {
      map.set(w.id, {
        id: w.id,
        name: w.name,
        isActive: workingRouting.activeWaiterIds.includes(w.id),
        inRouting: true,
      });
    });
    roster.forEach((w) => {
      if (!map.has(w.id)) {
        map.set(w.id, { id: w.id, name: w.name, isActive: false, inRouting: false });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [roster, workingRouting]);

  const activeWaiters = useMemo(() => shiftWaiters.filter((w) => w.isActive), [shiftWaiters]);
  const waiterNamesById = useMemo(
    () => new Map(shiftWaiters.map((waiter) => [waiter.id, waiter.name])),
    [shiftWaiters],
  );
  const startGroupByWaiterId = useMemo(() => {
    const map = new Map<string, ShiftStartGroup>();
    for (const group of workingRouting?.shiftStartGroups ?? []) {
      for (const waiterId of group.waiterIds) {
        map.set(waiterId, group);
      }
    }
    return map;
  }, [workingRouting?.shiftStartGroups]);
  const orderedActiveWaiters = useMemo(() => {
    const byId = new Map(activeWaiters.map((waiter) => [waiter.id, waiter]));
    const ordered = (workingRouting?.rotationOrder ?? [])
      .map((waiterId) => byId.get(waiterId))
      .filter((waiter): waiter is (typeof activeWaiters)[number] => Boolean(waiter));
    const orderedIds = new Set(ordered.map((waiter) => waiter.id));
    return [...ordered, ...activeWaiters.filter((waiter) => !orderedIds.has(waiter.id))];
  }, [activeWaiters, workingRouting?.rotationOrder]);
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

  // Keep the inline rename field in sync with whichever preset is selected.
  useEffect(() => {
    setPlanNameDraft(selectedSectionPlan?.name ?? '');
  }, [selectedSectionPlan?.planId, selectedSectionPlan?.name]);

  const allTables = useMemo(
    () =>
      Object.values(floorMap.tables).sort((left, right) =>
        left.tableNumber.localeCompare(right.tableNumber, undefined, { numeric: true }),
      ),
    [floorMap.tables],
  );

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
    if (workingRouting) {
      Object.keys(workingRouting.sectionAssignments).forEach((s) => set.add(s));
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [floorMap.tables, selectedSectionPlan, workingRouting]);

  const canContinueLastShift = useMemo(() => hasUsableLastShift(seededRouting), [seededRouting]);
  const compactSummary = useMemo(
    () => summarizeShiftSetup(workingRouting, setupMode, sections.length),
    [sections.length, setupMode, workingRouting],
  );
  const teamReviewSummary = useMemo(
    () =>
      compactList(
        activeWaiters.map((waiter) => waiter.name),
        'No active waiters',
      ),
    [activeWaiters],
  );
  const startGroupReviewSummary = useMemo(() => {
    const groups = workingRouting?.shiftStartGroups ?? [];
    return compactList(
      groups.map((group) => `${group.name} ${group.startTime} (${group.waiterIds.length})`),
      'No staggered starts',
      3,
    );
  }, [workingRouting?.shiftStartGroups]);
  const sectionAssignmentSummary = useMemo(() => {
    if (setupMode === 'rotation_only') return 'Skipped for this shift';
    if (!workingRouting) return 'Routing is loading';
    return compactList(
      sections.map((sectionId) => {
        const waiterId = workingRouting.sectionAssignments[sectionId];
        return `${sectionId}: ${waiterId ? (waiterNamesById.get(waiterId) ?? 'Assigned') : 'open'}`;
      }),
      'No sections',
      3,
    );
  }, [sections, setupMode, waiterNamesById, workingRouting]);

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

  const persistFloorMap = useCallback(
    async (map: FloorMap) => {
      if (!locationId) {
        setFloorMap(map);
        return map;
      }

      const result = await upsertHostFloorMap(locationId, map);
      const mapToPersist =
        result.floorId && result.floorId !== map.floorId
          ? { ...map, floorId: result.floorId }
          : map;
      setFloorMap(mapToPersist);
      await saveFloorMapLayout(locationId, mapToPersist.floorId, mapToPersist);
      return mapToPersist;
    },
    [locationId, setFloorMap],
  );

  const handleContinueLastShift = () => {
    if (!seededRouting) return;
    hasChosenEntryRef.current = true;
    setDraftRouting(seededRouting);
    setSetupMode(inferSetupModeFromRouting(seededRouting));
    setSelectedSectionPlanId(
      seededRouting.setupSectionPlanId ?? floorMap.activeSectionPlanId ?? null,
    );
    setSetupStep('review');
  };

  const handleStartFromBeginning = () => {
    if (!seededRouting) return;
    hasChosenEntryRef.current = true;
    setDraftRouting(buildBeginningShiftRouting(seededRouting));
    setSetupMode('rotation_sections');
    setSelectedSectionPlanId(floorMap.activeSectionPlanId ?? null);
    setTargetWaiterCountText('');
    setSetupStep('review');
  };

  const handleSetMode = (mode: WaiterRoutingMode) => {
    if (!workingRouting || workingRouting.mode === mode) return;
    setDraftRouting({ ...workingRouting, mode });
  };

  const handleToggleWaiter = (waiter: (typeof shiftWaiters)[number]) => {
    if (!workingRouting) return;
    setDraftRouting((current) => {
      const base = current ?? workingRouting;
      const isActive = !base.activeWaiterIds.includes(waiter.id);
      const activeWaiterIds = isActive
        ? [...base.activeWaiterIds, waiter.id]
        : base.activeWaiterIds.filter((id) => id !== waiter.id);
      const rotationOrder = isActive
        ? [...base.rotationOrder.filter((id) => id !== waiter.id), waiter.id]
        : base.rotationOrder.filter((id) => id !== waiter.id);
      const sectionAssignments = isActive
        ? base.sectionAssignments
        : Object.fromEntries(
            Object.entries(base.sectionAssignments).filter(
              ([, waiterId]) => waiterId !== waiter.id,
            ),
          );
      const tableAssignments = isActive
        ? base.tableAssignments
        : Object.fromEntries(
            Object.entries(base.tableAssignments).filter(([, waiterId]) => waiterId !== waiter.id),
          );
      const existingWaiter = base.waiters.find((item) => item.id === waiter.id);
      const nextWaiters: RoutingWaiter[] = existingWaiter
        ? base.waiters.map((item) =>
            item.id === waiter.id
              ? {
                  ...item,
                  isActive,
                  status: isActive
                    ? item.status === 'on_break'
                      ? 'available'
                      : item.status
                    : 'on_break',
                }
              : item,
          )
        : [...base.waiters, { ...makeRoutingWaiter(waiter.id, waiter.name), isActive }];

      return {
        ...base,
        waiters: nextWaiters,
        activeWaiterIds,
        rotationOrder,
        sectionAssignments,
        tableAssignments,
        shiftStartGroups: (base.shiftStartGroups ?? []).map((group) => ({
          ...group,
          waiterIds: isActive
            ? group.waiterIds
            : group.waiterIds.filter((waiterId) => waiterId !== waiter.id),
        })),
        nextWaiterId:
          isActive && !base.nextWaiterId
            ? waiter.id
            : base.nextWaiterId === waiter.id && !isActive
              ? (rotationOrder[0] ?? activeWaiterIds[0] ?? null)
              : base.nextWaiterId,
      };
    });
  };

  const handleMoveRotationWaiter = (waiterId: string, direction: 'up' | 'down') => {
    if (!workingRouting) return;
    const currentOrder = orderedActiveWaiters.map((waiter) => waiter.id);
    const currentIndex = currentOrder.indexOf(waiterId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    const [waiter] = nextOrder.splice(currentIndex, 1);
    if (!waiter) return;
    nextOrder.splice(targetIndex, 0, waiter);
    setDraftRouting({
      ...workingRouting,
      rotationOrder: nextOrder,
      nextWaiterId:
        workingRouting.nextWaiterId && nextOrder.includes(workingRouting.nextWaiterId)
          ? workingRouting.nextWaiterId
          : (nextOrder[0] ?? null),
    });
  };

  const handleStartWaiterNow = (waiterId: string) => {
    if (!workingRouting) return;
    setDraftRouting({
      ...workingRouting,
      shiftStartGroups: (workingRouting.shiftStartGroups ?? []).map((group) => ({
        ...group,
        waiterIds: group.waiterIds.filter((id) => id !== waiterId),
      })),
    });
  };

  const handleAssignSection = (sectionId: string, waiterId: string) => {
    if (!workingRouting) return;
    const current = workingRouting.sectionAssignments[sectionId];
    const sectionAssignments = { ...workingRouting.sectionAssignments };
    if (current === waiterId) {
      delete sectionAssignments[sectionId];
    } else {
      sectionAssignments[sectionId] = waiterId;
    }
    setDraftRouting({ ...workingRouting, sectionAssignments });
  };

  const handleSelectSectionPlan = useCallback(
    (plan: FloorMapSectionPlan) => {
      const appliedMap = applySectionPlanToFloorMap(floorMap, plan);
      setSelectedSectionPlanId(plan.planId);
      setTargetWaiterCountText(String(plan.waiterCount));

      persistFloorMap(appliedMap).catch(
        reportError('Could not save the section preset for today.'),
      );
    },
    [floorMap, persistFloorMap],
  );

  // Insert/replace a preset in the floor map and persist it. Selecting and
  // applying it keeps the floor + preview in sync. `makeDefault` is opt-in only
  // — saving a preset no longer silently steals the default badge from siblings.
  const commitSectionPlan = useCallback(
    (plan: FloorMapSectionPlan, options?: { makeDefault?: boolean }) => {
      const makeDefault = options?.makeDefault ?? false;
      const stamped: FloorMapSectionPlan = { ...plan, updatedAt: new Date().toISOString() };
      const others = (floorMap.sectionPlans ?? []).filter(
        (current) => current.planId !== stamped.planId,
      );
      const sectionPlans = [...others, stamped]
        .map((current) =>
          makeDefault && current.waiterCount === stamped.waiterCount
            ? { ...current, isDefault: current.planId === stamped.planId }
            : current,
        )
        .sort(
          (left, right) =>
            left.waiterCount - right.waiterCount || left.name.localeCompare(right.name),
        );
      const appliedMap = applySectionPlanToFloorMap({ ...floorMap, sectionPlans }, stamped);
      setSelectedSectionPlanId(stamped.planId);
      setTargetWaiterCountText(String(stamped.waiterCount));
      setFloorMap(appliedMap);
      persistFloorMap(appliedMap).catch(reportError('Could not save the section preset.'));
    },
    [floorMap, persistFloorMap, setFloorMap],
  );

  const handleCreatePreset = useCallback(() => {
    const base = selectedSectionPlan;
    const createBlank = () => {
      const presetNumber = (floorMap.sectionPlans ?? []).length + 1;
      commitSectionPlan(buildBlankSectionPlan(targetWaiterCount, `Preset ${presetNumber}`));
      setIsEditingPlan(true);
    };
    if (!base) {
      createBlank();
      return;
    }
    Alert.alert('New section preset', 'Start fresh, or duplicate the current preset to tweak it?', [
      { text: 'Blank', onPress: createBlank },
      {
        text: `Duplicate “${base.name}”`,
        onPress: () => {
          commitSectionPlan(duplicateSectionPlan(base));
          setIsEditingPlan(true);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [commitSectionPlan, floorMap.sectionPlans, selectedSectionPlan, targetWaiterCount]);

  const handleCommitPlanName = useCallback(() => {
    const plan = selectedSectionPlan;
    if (!plan) return;
    const name = planNameDraft.trim();
    if (!name || name === plan.name) return;
    commitSectionPlan({ ...plan, name });
  }, [commitSectionPlan, planNameDraft, selectedSectionPlan]);

  const handleToggleDefaultPlan = useCallback(() => {
    const plan = selectedSectionPlan;
    if (!plan) return;
    if (plan.isDefault) {
      commitSectionPlan({ ...plan, isDefault: false });
    } else {
      commitSectionPlan({ ...plan, isDefault: true }, { makeDefault: true });
    }
  }, [commitSectionPlan, selectedSectionPlan]);

  const handleAddPlanSection = useCallback(() => {
    const plan = selectedSectionPlan;
    if (!plan) return;
    const name = normalizeSectionName(newPlanSectionName);
    if (!name) return;
    if (
      plan.sections.some(
        (section) =>
          normalizeSectionName(section.sectionId).toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      Alert.alert('Section exists', `“${name}” is already in this preset.`);
      return;
    }
    commitSectionPlan({
      ...plan,
      sections: [...plan.sections, { sectionId: name, tableIds: [] }],
    });
    setNewPlanSectionName('');
  }, [commitSectionPlan, newPlanSectionName, selectedSectionPlan]);

  const handleRemovePlanSection = useCallback(
    (sectionId: string) => {
      const plan = selectedSectionPlan;
      if (!plan) return;
      commitSectionPlan({
        ...plan,
        sections: plan.sections.filter((section) => section.sectionId !== sectionId),
      });
      setDraftRouting((current) => {
        const base = current ?? workingRouting;
        if (!base || !base.sectionAssignments[sectionId]) return current;
        const sectionAssignments = { ...base.sectionAssignments };
        delete sectionAssignments[sectionId];
        return { ...base, sectionAssignments };
      });
    },
    [commitSectionPlan, selectedSectionPlan, workingRouting],
  );

  const handleTogglePlanTable = useCallback(
    (sectionId: string, tableId: string) => {
      const plan = selectedSectionPlan;
      if (!plan) return;
      const alreadyInSection = plan.sections
        .find((section) => section.sectionId === sectionId)
        ?.tableIds.includes(tableId);
      // A table belongs to at most one section: drop it everywhere, then add it
      // back to the target section unless we were toggling it off.
      const sections = plan.sections.map((section) => ({
        ...section,
        tableIds: section.tableIds.filter((id) => id !== tableId),
      }));
      if (!alreadyInSection) {
        const target = sections.find((section) => section.sectionId === sectionId);
        if (target) target.tableIds = [...target.tableIds, tableId];
      }
      commitSectionPlan({ ...plan, sections });
    },
    [commitSectionPlan, selectedSectionPlan],
  );

  const handleDeletePlan = useCallback(() => {
    const plan = selectedSectionPlan;
    if (!plan) return;
    Alert.alert('Delete preset', `Delete “${plan.name}”? This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const remaining = (floorMap.sectionPlans ?? []).filter(
            (current) => current.planId !== plan.planId,
          );
          const nextActive =
            remaining.find((current) => current.planId === floorMap.activeSectionPlanId) ??
            remaining[0] ??
            null;
          let nextMap: FloorMap = {
            ...floorMap,
            sectionPlans: remaining,
            activeSectionPlanId: nextActive?.planId ?? null,
          };
          if (nextActive) {
            nextMap = applySectionPlanToFloorMap(nextMap, nextActive);
          }
          setSelectedSectionPlanId(nextActive?.planId ?? null);
          setIsEditingPlan(false);
          setFloorMap(nextMap);
          persistFloorMap(nextMap).catch(reportError('Could not delete the preset.'));
        },
      },
    ]);
  }, [floorMap, persistFloorMap, selectedSectionPlan, setFloorMap]);

  const handleAddStartGroup = () => {
    if (!workingRouting) return;
    const name = newGroupName.trim();
    const startTime = newGroupTime.trim();
    if (!name || !startTime) {
      Alert.alert('Start group needs a name and start time.');
      return;
    }
    const group: ShiftStartGroup = {
      id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      startTime,
      waiterIds: [],
    };
    setDraftRouting({
      ...workingRouting,
      shiftStartGroups: [...(workingRouting.shiftStartGroups ?? []), group],
    });
  };

  const handleToggleGroupWaiter = (groupId: string, waiterId: string) => {
    if (!workingRouting) return;
    const groups = (workingRouting.shiftStartGroups ?? []).map((group) => {
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
    setDraftRouting({ ...workingRouting, shiftStartGroups: groups });
  };

  const handleOpenTeamSettings = () => {
    onClose();
    router.push('/settings/team' as Href);
  };

  const handleCommit = async () => {
    if (!workingRouting) {
      onClose();
      return;
    }

    setIsCommitting(true);
    try {
      let routingToSave = workingRouting;
      let setupApproval: RoutingSetupApprovalRequest | undefined;
      let sectionPlanForApproval = selectedSectionPlan;
      if (requireApproval) {
        if (activeWaiters.length === 0) {
          Alert.alert('Add today’s team', 'Select at least one waiter before approving the shift.');
          return;
        }

        const shouldPlanSections = setupMode !== 'rotation_only';
        let sectionIds = shouldPlanSections ? sections : [];
        if (shouldPlanSections) {
          if (sectionIds.length === 0) {
            Alert.alert(
              'Choose a section preset',
              'Pick the section preset for this shift before approving.',
            );
            return;
          }
          if (!sectionPlanForApproval && sectionPlans.length === 0) {
            const generatedPlan = buildSectionPlanFromCurrentSections(floorMap, {
              name: DEFAULT_SECTION_PLAN_NAME,
              waiterCount: targetWaiterCount,
              isDefault: true,
            });
            if (generatedPlan.sections.length === 0) {
              Alert.alert(
                'Choose a section preset',
                'Pick the section preset for this shift before approving.',
              );
              return;
            }
            const mapWithGeneratedPlan: FloorMap = {
              ...floorMap,
              sectionPlans: [generatedPlan],
              activeSectionPlanId: generatedPlan.planId,
            };
            await persistFloorMap(mapWithGeneratedPlan);
            setSelectedSectionPlanId(generatedPlan.planId);
            sectionPlanForApproval = generatedPlan;
            sectionIds = sectionNamesForPlan(generatedPlan);
          }
          if (!sectionPlanForApproval) {
            Alert.alert(
              'Choose a section preset',
              'Pick the section preset for this shift before approving.',
            );
            return;
          }
          const missingSections = sectionIds.filter(
            (sectionId) => !routingToSave.sectionAssignments[sectionId],
          );
          if (missingSections.length > 0) {
            Alert.alert(
              'Assign every section',
              `These sections still need waiters: ${missingSections.join(', ')}`,
            );
            return;
          }
        }

        const startingMode: WaiterRoutingMode =
          setupMode === 'sections_now' ? 'section' : 'manual_rotation';
        routingToSave = { ...routingToSave, mode: startingMode };
        setupApproval = {
          startingMode,
          plannedMode: shouldPlanSections ? 'section' : 'manual_rotation',
          sectionPlanId: shouldPlanSections ? (sectionPlanForApproval?.planId ?? null) : null,
          sectionIds,
        };
      }

      const canonical = await persistRouting(() => routingToSave, { setupApproval });
      if (requireApproval) {
        storage.delete(draftStorageKey);
      }
      onApproved?.(canonical);
      onClose();
    } catch (error) {
      reportError('Could not save the shift setup.')(error);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleFooterPress = () => {
    if (requireApproval && setupStep !== 'review') {
      setSetupStep('review');
      return;
    }
    void handleCommit();
  };

  const showEntry = requireApproval && setupStep === 'entry';
  const showReview = requireApproval && setupStep === 'review';
  const showModeEditor = !requireApproval || setupStep === 'mode';
  const showTeamEditor = !requireApproval || setupStep === 'team';
  const showStartEditor = !requireApproval || setupStep === 'starts';
  const showSectionEditor = !requireApproval || setupStep === 'sections';
  const footerLabel =
    isSaving || isCommitting
      ? 'Saving...'
      : requireApproval
        ? setupStep === 'review'
          ? 'Approve Shift'
          : 'Review'
        : 'Done';

  const content = (
    <View
      onStartShouldSetResponder={() => true}
      style={[
        styles.sheet,
        isInline && styles.inlineSheet,
        !isInline && styles.modalSheet,
        {
          backgroundColor: isInline ? colors.surface.level1 : modalBackgroundColor,
          borderColor: isInline ? colors.border.subtle : colors.glass.border,
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {requireApproval
              ? showEntry
                ? 'Start Shift'
                : showReview
                  ? 'Review Shift'
                  : 'Edit Shift'
              : 'Shift Setup'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            {requireApproval
              ? showEntry
                ? 'Continue from the last approved setup or build a clean shift.'
                : 'Confirm only what changed before the floor opens.'
              : "Pick the team, choose today's preset, assign the floor."}
          </Text>
        </View>
        {!isInline &&
          (requireApproval ? (
            // In the start-of-shift approval flow, give hosts a way out: from the
            // entry/review screens this closes the sheet (back to Start Workday);
            // from an inner edit step it steps back to the review screen.
            <TouchableOpacity
              onPress={() => (showEntry || showReview ? onClose() : setSetupStep('review'))}
              accessibilityLabel={showEntry || showReview ? 'Close' : 'Back'}
              hitSlop={8}
            >
              <Ionicons
                name={showEntry || showReview ? 'close' : 'chevron-back'}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ))}
      </View>

      <ScrollView
        style={isInline ? styles.body : styles.bodyModal}
        contentContainerStyle={styles.bodyInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {showEntry ? (
          <View style={styles.entryStack}>
            <View
              style={[
                styles.lastShiftCard,
                { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
              ]}
            >
              <View style={styles.entryIcon}>
                <Ionicons name="play-forward" size={22} color={colors.accent} />
              </View>
              <View style={styles.entryCopy}>
                <Text style={[styles.entryTitle, { color: colors.text.primary }]}>
                  Continue from last shift
                </Text>
                <Text style={[styles.entrySummary, { color: colors.text.muted }]}>
                  {canContinueLastShift
                    ? summarizeShiftSetup(
                        seededRouting,
                        inferSetupModeFromRouting(seededRouting),
                        sections.length,
                      )
                    : 'No approved shift setup is available yet.'}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={!canContinueLastShift || !seededRouting}
                activeOpacity={0.82}
                onPress={handleContinueLastShift}
                style={[
                  styles.entryAction,
                  {
                    backgroundColor: canContinueLastShift ? colors.accent : colors.surface.level1,
                    opacity: canContinueLastShift ? 1 : 0.5,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.entryActionText,
                    { color: canContinueLastShift ? colors.white : colors.text.muted },
                  ]}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              disabled={!seededRouting}
              activeOpacity={0.82}
              onPress={handleStartFromBeginning}
              style={[
                styles.beginningButton,
                { borderColor: colors.border.subtle, backgroundColor: colors.surface.level1 },
              ]}
            >
              <Ionicons name="create-outline" size={20} color={colors.text.secondary} />
              <View style={styles.entryCopy}>
                <Text style={[styles.beginningTitle, { color: colors.text.primary }]}>
                  Start from beginning
                </Text>
                <Text style={[styles.entrySummary, { color: colors.text.muted }]}>
                  Clear the team, starts, and section assignments for an unusual shift.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : !workingRouting ? (
          <Text style={[styles.empty, { color: colors.text.muted }]}>
            Waiter routing is still loading for this location.
          </Text>
        ) : showReview ? (
          <View style={styles.reviewStack}>
            <View
              style={[
                styles.reviewHero,
                { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
              ]}
            >
              <Text style={[styles.reviewHeroTitle, { color: colors.text.primary }]}>
                {compactSummary}
              </Text>
              <Text style={[styles.entrySummary, { color: colors.text.muted }]}>
                Tap a row to change only that part of today’s setup.
              </Text>
            </View>

            <ReviewRow
              icon="swap-horizontal-outline"
              label="Mode"
              value={
                SETUP_MODE_OPTIONS.find((option) => option.value === setupMode)?.label ??
                'Rotation now'
              }
              colors={colors}
              onPress={() => setSetupStep('mode')}
            />
            <ReviewRow
              icon="people-outline"
              label="Team"
              value={teamReviewSummary}
              colors={colors}
              onPress={() => setSetupStep('team')}
            />
            <ReviewRow
              icon="time-outline"
              label="Start times"
              value={startGroupReviewSummary}
              colors={colors}
              onPress={() => setSetupStep('starts')}
            />
            <ReviewRow
              icon="map-outline"
              label="Sections"
              value={sectionAssignmentSummary}
              colors={colors}
              onPress={() => setSetupStep('sections')}
            />
          </View>
        ) : (
          <>
            {showModeEditor && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
                  {requireApproval ? 'TODAY STARTS' : 'SEATING MODE'}
                </Text>
                {requireApproval ? (
                  <>
                    <View style={styles.setupModeGrid}>
                      {SETUP_MODE_OPTIONS.map((option) => {
                        const active = setupMode === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            activeOpacity={0.8}
                            onPress={() => setSetupMode(option.value)}
                            style={[
                              styles.setupModeButton,
                              {
                                backgroundColor: active ? colors.accent : colors.surface.level2,
                                borderColor: active ? colors.accent : colors.border.subtle,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.modeButtonText,
                                { color: active ? colors.white : colors.text.primary },
                              ]}
                            >
                              {option.label}
                            </Text>
                            <Text
                              style={[
                                styles.setupModeDetail,
                                { color: active ? 'rgba(255,255,255,0.82)' : colors.text.muted },
                              ]}
                            >
                              {option.detail}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[styles.helpText, { color: colors.text.muted }]}>
                      {setupMode === 'rotation_sections'
                        ? 'Seat in rotation now. Section assignments are saved for a fast switch later.'
                        : setupMode === 'sections_now'
                          ? 'Section routing becomes active as soon as this setup is approved.'
                          : 'Use fair rotation for this shift without requiring a section preset.'}
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.modeRow}>
                      {MODE_OPTIONS.map((option) => {
                        const active = workingRouting.mode === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            accessibilityRole="button"
                            accessibilityLabel={`Set seating mode to ${option.label}`}
                            accessibilityState={{ selected: active }}
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
                      {MODE_HELP[workingRouting.mode]}
                    </Text>
                  </>
                )}
              </>
            )}

            {showTeamEditor && (
              <>
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
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${waiter.isActive ? 'Remove' : 'Add'} ${waiter.name} from tonight`}
                    accessibilityState={{ checked: waiter.isActive }}
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
                {orderedActiveWaiters.length > 0 && (
                  <View style={styles.rotationPanel}>
                    <View style={styles.groupHeader}>
                      <Text style={[styles.sectionName, { color: colors.text.primary }]}>
                        Rotation order
                      </Text>
                      <Text style={[styles.countPill, { color: colors.text.secondary }]}>
                        Optional
                      </Text>
                    </View>
                    <Text style={[styles.helpText, { color: colors.text.muted }]}>
                      Reorder only if the open needs a specific first turn.
                    </Text>
                    {orderedActiveWaiters.map((waiter, index) => {
                      const startGroup = startGroupByWaiterId.get(waiter.id);
                      return (
                        <View
                          key={waiter.id}
                          style={[
                            styles.rotationRow,
                            {
                              borderColor: colors.border.subtle,
                              backgroundColor: colors.surface.level1,
                            },
                          ]}
                        >
                          <Text style={[styles.rotationRank, { color: colors.text.muted }]}>
                            {index + 1}
                          </Text>
                          <View
                            style={[
                              styles.waiterDot,
                              {
                                backgroundColor: waiterColorMap[waiter.id] ?? colors.border.default,
                              },
                            ]}
                          />
                          <View style={styles.rotationCopy}>
                            <Text style={[styles.waiterName, { color: colors.text.primary }]}>
                              {waiter.name}
                            </Text>
                            {startGroup ? (
                              <Text style={[styles.rotationMeta, { color: colors.text.muted }]}>
                                Starts at {startGroup.startTime}
                              </Text>
                            ) : (
                              <Text style={[styles.rotationMeta, { color: colors.text.muted }]}>
                                In rotation now
                              </Text>
                            )}
                          </View>
                          {startGroup ? (
                            <TouchableOpacity
                              activeOpacity={0.78}
                              onPress={() => handleStartWaiterNow(waiter.id)}
                              style={[
                                styles.startNowButton,
                                { backgroundColor: colors.accentLight, borderColor: colors.accent },
                              ]}
                            >
                              <Text style={[styles.startNowText, { color: colors.accent }]}>
                                Start now
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          <View style={styles.rotationControls}>
                            <TouchableOpacity
                              accessibilityLabel={`Move ${waiter.name} earlier in rotation`}
                              disabled={index === 0}
                              onPress={() => handleMoveRotationWaiter(waiter.id, 'up')}
                              style={styles.rotationIconButton}
                            >
                              <Ionicons
                                name="chevron-up"
                                size={18}
                                color={index === 0 ? colors.text.muted : colors.text.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              accessibilityLabel={`Move ${waiter.name} later in rotation`}
                              disabled={index === orderedActiveWaiters.length - 1}
                              onPress={() => handleMoveRotationWaiter(waiter.id, 'down')}
                              style={styles.rotationIconButton}
                            >
                              <Ionicons
                                name="chevron-down"
                                size={18}
                                color={
                                  index === orderedActiveWaiters.length - 1
                                    ? colors.text.muted
                                    : colors.text.primary
                                }
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                <TouchableOpacity style={styles.addLink} onPress={handleOpenTeamSettings}>
                  <Ionicons name="people-circle-outline" size={18} color={colors.accent} />
                  <Text style={[styles.addLinkText, { color: colors.accent }]}>
                    Manage team roster
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {showStartEditor && (
              <>
                <Text
                  style={[styles.sectionLabel, { color: colors.text.muted, marginTop: spacing.xl }]}
                >
                  START GROUPS
                </Text>
                {(workingRouting.shiftStartGroups ?? []).map((group) => (
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
                  <TimeWheelField
                    value={newGroupTime}
                    onChange={setNewGroupTime}
                    minuteInterval={15}
                    variant="compact"
                  />
                  <TouchableOpacity
                    style={[styles.addConfirm, { backgroundColor: colors.accent }]}
                    onPress={handleAddStartGroup}
                  >
                    <Ionicons name="add" size={20} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {showModeEditor && (
              <>
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
                  <Text style={[styles.sectionName, { color: colors.text.primary }]}>
                    Party size
                  </Text>
                  {[5, 6, 7, 8].map((threshold) => {
                    const active = (workingRouting.gratThreshold ?? 6) === threshold;
                    return (
                      <TouchableOpacity
                        key={threshold}
                        activeOpacity={0.75}
                        onPress={() =>
                          setDraftRouting({
                            ...workingRouting,
                            gratThreshold: threshold,
                          })
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
              </>
            )}

            {showSectionEditor ? (
              requireApproval && setupMode === 'rotation_only' ? (
                <View
                  style={[
                    styles.planEmpty,
                    {
                      borderColor: colors.border.subtle,
                      backgroundColor: colors.surface.level2,
                      marginTop: spacing.xl,
                    },
                  ]}
                >
                  <Text style={[styles.empty, { color: colors.text.muted }]}>
                    Sections are skipped for this shift. The floor will use rotation only.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Section plan */}
                  <View style={[styles.planHeaderRow, { marginTop: spacing.xl }]}>
                    <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
                      SECTION PLAN
                    </Text>
                    <TouchableOpacity
                      style={styles.newPlanButton}
                      onPress={handleCreatePreset}
                      accessibilityRole="button"
                      accessibilityLabel="Create new section preset"
                    >
                      <Ionicons name="add" size={16} color={colors.accent} />
                      <Text style={[styles.addLinkText, { color: colors.accent }]}>New preset</Text>
                    </TouchableOpacity>
                  </View>
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
                        {
                          borderColor: colors.border.subtle,
                          backgroundColor: colors.surface.level2,
                        },
                      ]}
                    >
                      <Text style={[styles.empty, { color: colors.text.muted }]}>
                        No saved section presets yet. Create one here for tonight, or build a
                        permanent layout in Floor Builder.
                      </Text>
                      <TouchableOpacity
                        style={[styles.createPresetButton, { backgroundColor: colors.accent }]}
                        onPress={handleCreatePreset}
                        accessibilityRole="button"
                      >
                        <Ionicons name="add" size={18} color={colors.white} />
                        <Text style={[styles.createPresetText, { color: colors.white }]}>
                          Create a preset
                        </Text>
                      </TouchableOpacity>
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
                                {plan.isDefault ? ' · default' : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {selectedSectionPlan ? (
                        <View style={styles.planToolbarRow}>
                          <TouchableOpacity
                            style={styles.planToolbarButton}
                            onPress={handleToggleDefaultPlan}
                            accessibilityRole="button"
                            accessibilityState={{ selected: selectedSectionPlan.isDefault }}
                          >
                            <Ionicons
                              name={selectedSectionPlan.isDefault ? 'star' : 'star-outline'}
                              size={16}
                              color={
                                selectedSectionPlan.isDefault ? colors.accent : colors.text.muted
                              }
                            />
                            <Text
                              style={[
                                styles.planToolbarText,
                                {
                                  color: selectedSectionPlan.isDefault
                                    ? colors.accent
                                    : colors.text.secondary,
                                },
                              ]}
                            >
                              {selectedSectionPlan.isDefault
                                ? `Default · ${selectedSectionPlan.waiterCount}`
                                : 'Set default'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.planToolbarButton}
                            onPress={() => setIsEditingPlan((value) => !value)}
                            accessibilityRole="button"
                          >
                            <Ionicons
                              name={isEditingPlan ? 'checkmark' : 'create-outline'}
                              size={16}
                              color={colors.accent}
                            />
                            <Text style={[styles.planToolbarText, { color: colors.accent }]}>
                              {isEditingPlan ? 'Done editing' : 'Edit sections'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      {isEditingPlan && selectedSectionPlan ? (
                        <View
                          style={[
                            styles.planEditor,
                            {
                              borderColor: colors.border.subtle,
                              backgroundColor: colors.surface.level2,
                            },
                          ]}
                        >
                          <View style={styles.planEditorHeader}>
                            <TextInput
                              value={planNameDraft}
                              onChangeText={setPlanNameDraft}
                              onEndEditing={handleCommitPlanName}
                              onSubmitEditing={handleCommitPlanName}
                              placeholder="Preset name"
                              placeholderTextColor={colors.text.muted}
                              style={[
                                styles.planNameInput,
                                {
                                  color: colors.text.primary,
                                  backgroundColor: colors.surface.level1,
                                  borderColor: colors.border.subtle,
                                },
                              ]}
                            />
                            <TouchableOpacity
                              style={styles.planDeleteButton}
                              onPress={handleDeletePlan}
                              accessibilityRole="button"
                              accessibilityLabel="Delete this preset"
                            >
                              <Ionicons
                                name="trash-outline"
                                size={18}
                                color={colors.status.dirty.text}
                              />
                            </TouchableOpacity>
                          </View>

                          {selectedSectionPlan.sections.length === 0 ? (
                            <Text style={[styles.empty, { color: colors.text.muted }]}>
                              No sections yet. Add one below, then tap tables to fill it.
                            </Text>
                          ) : null}

                          {selectedSectionPlan.sections.map((section) => (
                            <View
                              key={section.sectionId}
                              style={[
                                styles.planEditSection,
                                {
                                  borderColor: colors.border.subtle,
                                  backgroundColor: colors.surface.level1,
                                },
                              ]}
                            >
                              <View style={styles.planEditSectionHeader}>
                                <Text
                                  style={[
                                    styles.sectionName,
                                    { color: colors.text.primary, flex: 1 },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {section.sectionId}
                                </Text>
                                <Text style={[styles.countPill, { color: colors.text.muted }]}>
                                  {section.tableIds.length}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => handleRemovePlanSection(section.sectionId)}
                                  hitSlop={8}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${section.sectionId}`}
                                >
                                  <Ionicons
                                    name="close-circle"
                                    size={20}
                                    color={colors.text.muted}
                                  />
                                </TouchableOpacity>
                              </View>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.chipScroll}
                              >
                                {allTables.length === 0 ? (
                                  <Text style={[styles.chipEmpty, { color: colors.text.muted }]}>
                                    No tables on the floor yet.
                                  </Text>
                                ) : (
                                  allTables.map((table) => {
                                    const inSection = section.tableIds.includes(table.tableId);
                                    return (
                                      <TouchableOpacity
                                        key={table.tableId}
                                        activeOpacity={0.75}
                                        onPress={() =>
                                          handleTogglePlanTable(section.sectionId, table.tableId)
                                        }
                                        style={[
                                          styles.chip,
                                          {
                                            backgroundColor: inSection
                                              ? colors.accent
                                              : colors.surface.level2,
                                            borderColor: inSection
                                              ? colors.accent
                                              : colors.border.subtle,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.chipText,
                                            {
                                              color: inSection
                                                ? colors.white
                                                : colors.text.secondary,
                                            },
                                          ]}
                                        >
                                          {table.tableNumber}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })
                                )}
                              </ScrollView>
                            </View>
                          ))}

                          <View style={styles.addRow}>
                            <TextInput
                              value={newPlanSectionName}
                              onChangeText={setNewPlanSectionName}
                              onSubmitEditing={handleAddPlanSection}
                              placeholder="New section name"
                              placeholderTextColor={colors.text.muted}
                              style={[
                                styles.addInput,
                                {
                                  color: colors.text.primary,
                                  backgroundColor: colors.surface.level1,
                                  borderColor: colors.border.subtle,
                                },
                              ]}
                            />
                            <TouchableOpacity
                              style={[styles.addConfirm, { backgroundColor: colors.accent }]}
                              onPress={handleAddPlanSection}
                              accessibilityRole="button"
                              accessibilityLabel="Add section to preset"
                            >
                              <Ionicons name="add" size={20} color={colors.white} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : null}

                      <SectionFloorPreview
                        floorMap={floorMap}
                        routing={workingRouting}
                        selectedPlan={selectedSectionPlan}
                        activeWaiterCount={activeWaiters.length}
                        waiterColorMap={waiterColorMap}
                      />
                    </>
                  )}

                  {/* Sections */}
                  <Text
                    style={[
                      styles.sectionLabel,
                      { color: colors.text.muted, marginTop: spacing.xl },
                    ]}
                  >
                    SECTIONS
                  </Text>
                  {sections.length === 0 && (
                    <Text style={[styles.empty, { color: colors.text.muted }]}>
                      No sections on the floor map yet.
                    </Text>
                  )}
                  {sections.map((sectionId) => {
                    const assignedId = workingRouting.sectionAssignments[sectionId];
                    return (
                      <View
                        key={sectionId}
                        style={[
                          styles.sectionRow,
                          {
                            borderColor: colors.border.subtle,
                            backgroundColor: colors.surface.level2,
                          },
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
                </>
              )
            ) : null}

            {showStartEditor && (
              <>
                {/* Hour grid */}
                <Text
                  style={[styles.sectionLabel, { color: colors.text.muted, marginTop: spacing.xl }]}
                >
                  PROJECTED COVERS
                </Text>
                <ShiftHourGrid slots={hourSlots} />
              </>
            )}
          </>
        )}
      </ScrollView>

      {!isInline && !showEntry && (
        <View style={[styles.footer, { borderTopColor: colors.border.subtle }]}>
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            onPress={handleFooterPress}
          >
            <Text style={styles.doneButtonText}>{footerLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isInline) {
    return visible ? content : null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalScreen, { backgroundColor: modalBackgroundColor }]}
        onStartShouldSetResponder={() => true}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom', 'left', 'right']}>
          {content}
        </SafeAreaView>
      </View>
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

type ReviewRowProps = {
  icon: IoniconName;
  label: string;
  value: string;
  colors: ThemeColors;
  onPress: () => void;
};

function ReviewRow({ icon, label, value, colors, onPress }: ReviewRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.reviewRow,
        { borderColor: colors.border.subtle, backgroundColor: colors.surface.level2 },
      ]}
    >
      <View style={styles.reviewIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.reviewText}>
        <Text style={[styles.reviewLabel, { color: colors.text.primary }]}>{label}</Text>
        <Text style={[styles.entrySummary, { color: colors.text.muted }]}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
    </TouchableOpacity>
  );
}

function getPlanSectionByTable(plan: FloorMapSectionPlan | null, table: FloorMapTable): string {
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
              const tableBorder =
                waiterColor ?? (hasSection ? colors.text.muted : colors.border.subtle);
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
  modalScreen: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
  },
  sheet: {
    zIndex: 1,
    elevation: 1,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    borderWidth: 1,
    ...shadows.medium,
  },
  modalSheet: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
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
  bodyModal: {
    flex: 1,
  },
  bodyInner: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  entryStack: {
    gap: spacing.md,
  },
  lastShiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCopy: {
    flex: 1,
    minWidth: 0,
  },
  entryTitle: {
    ...textStyles.label,
    fontWeight: '800',
  },
  entrySummary: {
    ...textStyles.caption,
    marginTop: 2,
  },
  entryAction: {
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  entryActionText: {
    ...textStyles.label,
    fontWeight: '800',
  },
  beginningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  beginningTitle: {
    ...textStyles.label,
    fontWeight: '700',
  },
  reviewStack: {
    gap: spacing.sm,
  },
  reviewHero: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  reviewHeroTitle: {
    ...textStyles.subtitle,
    fontWeight: '800',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  reviewIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewText: {
    flex: 1,
    minWidth: 0,
  },
  reviewLabel: {
    ...textStyles.label,
    fontWeight: '800',
  },
  stepBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingBottom: spacing.md,
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
  setupModeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  setupModeButton: {
    flex: 1,
    minHeight: 72,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setupModeDetail: {
    ...textStyles.caption,
    marginTop: 4,
    textAlign: 'center',
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
  rotationPanel: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rotationRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rotationRank: {
    width: 22,
    ...textStyles.captionMedium,
    fontWeight: '800',
    textAlign: 'center',
  },
  rotationCopy: {
    flex: 1,
    minWidth: 0,
  },
  rotationMeta: {
    ...textStyles.tiny,
    marginTop: 1,
  },
  startNowButton: {
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  startNowText: {
    ...textStyles.tiny,
    fontWeight: '800',
  },
  rotationControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rotationIconButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  planEmpty: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  createPresetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  createPresetText: {
    ...textStyles.label,
    fontWeight: '800',
  },
  planToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  planToolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  planToolbarText: {
    ...textStyles.caption,
    fontWeight: '800',
  },
  planEditor: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  planEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planNameInput: {
    flex: 1,
    ...textStyles.body,
    fontWeight: '700',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  planDeleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planEditSection: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  planEditSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
