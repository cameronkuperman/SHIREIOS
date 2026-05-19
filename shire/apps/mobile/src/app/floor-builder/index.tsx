import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { FloorMapTable, FloorMapRoom } from '@shire/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  useBuilderStore,
  fetchFloorMapLayout,
  saveFloorMapLayout,
  upsertHostFloorMap,
} from '@/features/floor-builder';
import { useFloorStore, getSectionColor, normalizeSectionName } from '@/features/floor';
import { useWaiterRoutingActions } from '@/features/routing';
import { useAuth } from '@/features/auth';
import { queryKeys } from '@/services/api/queryKeys';
import { resolveFloorId } from '@/features/floor/floorId';
import { normalizeFloorMap } from '@/features/floor/mapContract';
import { BuilderCanvas } from '@/components/BuilderCanvas';
import { BuilderToolbar } from '@/components/BuilderToolbar';
import { BuilderPropertyPanel } from '@/components/BuilderPropertyPanel';
import { DraggableTable } from '@/components/DraggableTable';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

let nextTableCounter = 100;

function generateTableId(): string {
  nextTableCounter += 1;
  return `draft-table-${nextTableCounter}`;
}

function sortTablesByLabel(a: FloorMapTable, b: FloorMapTable): number {
  return a.tableNumber.localeCompare(b.tableNumber, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

type BuilderMode = 'layout' | 'sections';

function prepareMapForBuilder(map: ReturnType<typeof normalizeFloorMap>) {
  const builderMap = structuredClone(map);

  for (const room of builderMap.rooms) {
    const rowIds = room.rows.flat();
    const roomTableIds = [
      ...rowIds,
      ...Object.values(builderMap.tables)
        .filter((table) => table.roomId === room.roomId && !rowIds.includes(table.tableId))
        .map((table) => table.tableId),
    ];
    const rows = room.rows.length > 0 ? room.rows : [roomTableIds];
    const totalRows = Math.max(1, rows.length);

    room.layoutMode = 'freeform';

    rows.forEach((row, rowIdx) => {
      const totalCols = Math.max(1, row.length);
      row.forEach((tableId, colIdx) => {
        const table = builderMap.tables[tableId];
        if (!table) return;
        if (table.x == null) {
          table.x = totalCols > 1 ? (colIdx + 0.5) / totalCols : 0.5;
        }
        if (table.y == null) {
          table.y = totalRows > 1 ? (rowIdx + 0.5) / totalRows : 0.5;
        }
      });
    });
  }

  return builderMap;
}

export default function FloorBuilderScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { currentLocation } = useAuth();

  const draftMap = useBuilderStore((state) => state.draftMap);
  const selectedTableId = useBuilderStore((state) => state.selectedTableId);
  const isDirty = useBuilderStore((state) => state.isDirty);
  const snapToGrid = useBuilderStore((state) => state.snapToGrid);
  const loadMap = useBuilderStore((state) => state.loadMap);
  const addTable = useBuilderStore((state) => state.addTable);
  const removeTable = useBuilderStore((state) => state.removeTable);
  const renameTable = useBuilderStore((state) => state.renameTable);
  const updateTable = useBuilderStore((state) => state.updateTable);
  const setTableSection = useBuilderStore((state) => state.setTableSection);
  const clearSection = useBuilderStore((state) => state.clearSection);
  const saveCurrentSectionPlan = useBuilderStore((state) => state.saveCurrentSectionPlan);
  const applySectionPlan = useBuilderStore((state) => state.applySectionPlan);
  const deleteSectionPlan = useBuilderStore((state) => state.deleteSectionPlan);
  const moveTable = useBuilderStore((state) => state.moveTable);
  const selectTable = useBuilderStore((state) => state.selectTable);
  const addRoom = useBuilderStore((state) => state.addRoom);
  const undo = useBuilderStore((state) => state.undo);
  const redo = useBuilderStore((state) => state.redo);
  const markClean = useBuilderStore((state) => state.markClean);
  const setSnapToGrid = useBuilderStore((state) => state.setSnapToGrid);
  const setMapZoom = useBuilderStore((state) => state.setMapZoom);
  const undoStack = useBuilderStore((state) => state.undoStack);
  const redoStack = useBuilderStore((state) => state.redoStack);

  const setFloorMap = useFloorStore((s) => s.setFloorMap);
  const currentFloorMap = useFloorStore((s) => s.floorMap);
  const currentFloorId = resolveFloorId(currentFloorMap?.floorId, currentLocation?.floorId);
  const { assignSection } = useWaiterRoutingActions();

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sectionDraft, setSectionDraft] = useState('');
  const [activeSectionName, setActiveSectionName] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('layout');
  const [selectedSectionPlanId, setSelectedSectionPlanId] = useState<string | null>(null);
  const [sectionPlanName, setSectionPlanName] = useState('');
  const [sectionPlanWaiterCount, setSectionPlanWaiterCount] = useState('5');
  const loadedBuilderFloorRef = useRef<string | null>(null);

  // Load map from Supabase or fall back to current floor map
  useEffect(() => {
    const loadKey = `${currentLocation?.id ?? 'local'}:${currentFloorId}`;
    if (loadedBuilderFloorRef.current === loadKey) {
      return;
    }
    loadedBuilderFloorRef.current = loadKey;

    let cancelled = false;
    async function load() {
      try {
        if (currentLocation) {
          const saved = await fetchFloorMapLayout(currentLocation.id, currentFloorId);
          if (!cancelled && saved) {
            loadMap(prepareMapForBuilder(normalizeFloorMap(saved)));
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fall back to current map
      }
      if (!cancelled) {
        loadMap(prepareMapForBuilder(normalizeFloorMap(currentFloorMap)));
        setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentFloorId, currentFloorMap, currentLocation?.id, loadMap]);

  const selectedTable = useMemo(() => {
    if (!draftMap || !selectedTableId) return null;
    return draftMap.tables[selectedTableId] ?? null;
  }, [draftMap, selectedTableId]);

  const sectionPlans = useMemo(() => draftMap?.sectionPlans ?? [], [draftMap?.sectionPlans]);
  const selectedSectionPlan = useMemo(
    () =>
      sectionPlans.find((plan) => plan.planId === selectedSectionPlanId) ??
      sectionPlans.find((plan) => plan.planId === draftMap?.activeSectionPlanId) ??
      null,
    [draftMap?.activeSectionPlanId, sectionPlans, selectedSectionPlanId],
  );

  const editingSectionName = useMemo(() => {
    const draftSection = normalizeSectionName(sectionDraft);
    return activeSectionName ?? (draftSection || null);
  }, [activeSectionName, sectionDraft]);

  const sectionSummaries = useMemo(() => {
    if (!draftMap) return [];
    const counts = new Map<string, number>();
    for (const table of Object.values(draftMap.tables)) {
      const section = normalizeSectionName(table.section);
      if (!section) continue;
      counts.set(section, (counts.get(section) ?? 0) + 1);
    }

    for (const section of selectedSectionPlan?.sections ?? []) {
      const sectionName = normalizeSectionName(section.sectionId);
      if (sectionName && !counts.has(sectionName)) {
        counts.set(sectionName, 0);
      }
    }

    for (const sectionName of [editingSectionName, activeSectionName]) {
      if (sectionName && !counts.has(sectionName)) {
        counts.set(sectionName, 0);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        color: getSectionColor(name) ?? '#322D23',
      }))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  }, [activeSectionName, draftMap, editingSectionName, selectedSectionPlan?.sections]);

  useEffect(() => {
    if (builderMode !== 'sections') return;
    const plan =
      selectedSectionPlan ??
      sectionPlans.find((current) => current.planId === draftMap?.activeSectionPlanId) ??
      sectionPlans[0] ??
      null;
    if (!plan) {
      if (!sectionPlanName) {
        setSectionPlanName(`${sectionPlanWaiterCount || '5'} Waiters`);
      }
      return;
    }
    if (selectedSectionPlanId !== plan.planId) {
      setSelectedSectionPlanId(plan.planId);
    }
    if (sectionPlanName !== plan.name) {
      setSectionPlanName(plan.name);
    }
    const nextCount = String(plan.waiterCount);
    if (sectionPlanWaiterCount !== nextCount) {
      setSectionPlanWaiterCount(nextCount);
    }
  }, [
    builderMode,
    draftMap?.activeSectionPlanId,
    sectionPlanName,
    sectionPlanWaiterCount,
    sectionPlans,
    selectedSectionPlan,
    selectedSectionPlanId,
  ]);

  useEffect(() => {
    if (
      !activeSectionName ||
      sectionSummaries.some((section) => section.name === activeSectionName)
    ) {
      return;
    }
    setActiveSectionName(null);
  }, [activeSectionName, sectionSummaries]);

  const handleCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
    }
  }, []);

  const handleAddTable = useCallback(() => {
    const firstRoom = draftMap?.rooms[0];
    if (!draftMap || !firstRoom) return;
    const roomId = firstRoom.roomId;
    const id = generateTableId();
    const newTable: FloorMapTable = {
      tableId: id,
      tableNumber: '',
      roomId,
      section: '',
      capacity: 4,
      shape: 'circle',
      type: 'regular',
      x: 0.5,
      y: 0.5,
    };
    addTable(newTable);
  }, [draftMap, addTable]);

  const handleDuplicate = useCallback(() => {
    if (!draftMap || !selectedTableId) return;
    const source = draftMap.tables[selectedTableId];
    if (!source) return;
    addTable({
      ...source,
      tableId: generateTableId(),
      tableNumber: '',
      x: Math.min(1, (source.x ?? 0.5) + 0.04),
      y: Math.min(1, (source.y ?? 0.5) + 0.04),
    });
  }, [draftMap, selectedTableId, addTable]);

  const handleResize = useCallback(
    (tableId: string, width: number, height: number) => {
      updateTable(tableId, { width, height });
    },
    [updateTable],
  );

  const handleAddRoom = useCallback(() => {
    if (!draftMap) return;
    const roomCount = draftMap.rooms.length + 1;
    const newRoom: FloorMapRoom = {
      roomId: `room-${roomCount}`,
      label: `ROOM ${roomCount}`,
      filterLabel: `Room ${roomCount}`,
      flex: 1,
      variant: 'default',
      rows: [],
      layoutMode: 'freeform',
    };
    addRoom(newRoom);
  }, [draftMap, addRoom]);

  const handleChangeMode = useCallback((mode: BuilderMode) => {
    setBuilderMode(mode);
    if (mode === 'layout') {
      setActiveSectionName(null);
      setSectionDraft('');
    }
  }, []);

  const handleCreateSection = useCallback(() => {
    const nextSectionName = normalizeSectionName(sectionDraft);
    if (!nextSectionName) {
      Alert.alert('Section Name Required', 'Enter a section name before creating it.');
      return;
    }

    const existingSection = sectionSummaries.find(
      (section) => section.name.toLocaleLowerCase() === nextSectionName.toLocaleLowerCase(),
    );
    setActiveSectionName(existingSection?.name ?? nextSectionName);
    setSectionDraft('');
  }, [sectionDraft, sectionSummaries]);

  const handleSaveSectionPlan = useCallback(() => {
    const parsedWaiterCount = Number.parseInt(sectionPlanWaiterCount, 10);
    const waiterCount =
      Number.isFinite(parsedWaiterCount) && parsedWaiterCount > 0 ? parsedWaiterCount : 1;
    const name = sectionPlanName.trim() || `${waiterCount} Waiters`;

    saveCurrentSectionPlan({
      planId: selectedSectionPlanId ?? undefined,
      name,
      waiterCount,
      isDefault: true,
    });
  }, [saveCurrentSectionPlan, sectionPlanName, sectionPlanWaiterCount, selectedSectionPlanId]);

  const handleNewSectionPlan = useCallback(() => {
    const parsedWaiterCount = Number.parseInt(sectionPlanWaiterCount, 10);
    const waiterCount =
      Number.isFinite(parsedWaiterCount) && parsedWaiterCount > 0 ? parsedWaiterCount : 1;
    setSelectedSectionPlanId(null);
    setSectionPlanName(`${waiterCount} Waiters`);
    setSectionPlanWaiterCount(String(waiterCount));
    setActiveSectionName(null);
    setSectionDraft('');
  }, [sectionPlanWaiterCount]);

  const handleSelectSectionPlan = useCallback(
    (planId: string) => {
      const plan = sectionPlans.find((current) => current.planId === planId);
      if (!plan) return;
      setSelectedSectionPlanId(plan.planId);
      setSectionPlanName(plan.name);
      setSectionPlanWaiterCount(String(plan.waiterCount));
      setActiveSectionName(null);
      setSectionDraft('');
      applySectionPlan(plan.planId);
    },
    [applySectionPlan, sectionPlans],
  );

  const handleDeleteSectionPlan = useCallback(() => {
    if (!selectedSectionPlanId) return;
    deleteSectionPlan(selectedSectionPlanId);
    setSelectedSectionPlanId(null);
    setActiveSectionName(null);
    setSectionDraft('');
  }, [deleteSectionPlan, selectedSectionPlanId]);

  const handleToggleTableSection = useCallback(
    (tableId: string) => {
      if (!editingSectionName || !draftMap) return;
      const table = draftMap.tables[tableId];
      if (!table) return;
      if (!activeSectionName) {
        setActiveSectionName(editingSectionName);
      }
      setTableSection(
        tableId,
        normalizeSectionName(table.section) === editingSectionName ? '' : editingSectionName,
      );
    },
    [activeSectionName, draftMap, editingSectionName, setTableSection],
  );

  const handleCanvasTableSelect = useCallback(
    (tableId: string) => {
      if (builderMode === 'sections' && editingSectionName) {
        handleToggleTableSection(tableId);
        return;
      }
      selectTable(tableId);
    },
    [builderMode, editingSectionName, handleToggleTableSection, selectTable],
  );

  const handleDeleteSection = useCallback(
    (sectionName: string) => {
      Alert.alert('Delete Section', `Remove ${sectionName} from all tables?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            clearSection(sectionName);
            if (activeSectionName === sectionName) {
              setActiveSectionName(null);
            }
            assignSection(sectionName, null).catch(() => {
              // The floor-map save is the source of truth for section membership;
              // routing cleanup can be retried from shift setup if routing is offline.
            });
          },
        },
      ]);
    },
    [activeSectionName, assignSection, clearSection],
  );

  const handleDelete = useCallback(() => {
    if (selectedTableId) {
      removeTable(selectedTableId);
    }
  }, [selectedTableId, removeTable]);

  const handleUpdateTable = useCallback(
    (updates: Partial<FloorMapTable>) => {
      if (!selectedTableId || !draftMap) return;
      const oldTable = draftMap.tables[selectedTableId];
      if (!oldTable) return;

      // Table numbers are used as table ids, so renames must update both atomically.
      if (updates.tableNumber != null && updates.tableId != null) {
        const nextTableNumber = updates.tableNumber.trim();
        const newId = updates.tableId.trim();
        if (!newId) {
          updateTable(selectedTableId, { tableNumber: nextTableNumber });
          return;
        }
        if (newId !== selectedTableId && draftMap.tables[newId]) {
          Alert.alert('Duplicate Table Number', `Table ${nextTableNumber} already exists.`);
          return;
        }
        if (newId !== selectedTableId) {
          renameTable(selectedTableId, newId, {
            ...updates,
            tableId: newId,
            tableNumber: nextTableNumber,
          });
          return;
        }
        updateTable(selectedTableId, {
          ...updates,
          tableId: selectedTableId,
          tableNumber: nextTableNumber,
        });
        return;
      }
      updateTable(selectedTableId, updates);
    },
    [selectedTableId, draftMap, updateTable, renameTable],
  );

  const leaveBuilder = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/workday');
    }
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!draftMap) return;

    // Validation
    const tableNumbers = Object.values(draftMap.tables).map((t) => t.tableNumber.trim());
    const emptyNumbers = tableNumbers.filter((n) => !n);
    if (emptyNumbers.length > 0) {
      Alert.alert('Missing Table Numbers', 'All tables must have a number assigned before saving.');
      return;
    }
    const duplicates = tableNumbers.filter((n, i) => tableNumbers.indexOf(n) !== i);
    if (duplicates.length > 0) {
      Alert.alert(
        'Duplicate Table Numbers',
        `These table numbers are used more than once: ${[...new Set(duplicates)].join(', ')}`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const mapToSave = normalizeFloorMap({
        ...draftMap,
        floorId: resolveFloorId(draftMap.floorId, currentFloorId),
        mapVersion: `builder-${Date.now()}`,
        // Record the canvas the layout was designed against so the live Floor
        // screen can render it with matching proportions (not crammed).
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
      });

      let persistedMap = mapToSave;

      if (currentLocation) {
        // Persist to host_floor_maps via backend so /me/locations sees the new floor.
        // Backend assigns the canonical floor_id; align the local map to it before
        // writing the Supabase floor_maps row used by the live floor service.
        const result = await upsertHostFloorMap(currentLocation.id, mapToSave);
        if (result.floorId && result.floorId !== mapToSave.floorId) {
          persistedMap = normalizeFloorMap({ ...mapToSave, floorId: result.floorId });
        }
        await saveFloorMapLayout(currentLocation.id, persistedMap.floorId, persistedMap);
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.locations() });
      }

      setFloorMap(persistedMap);
      markClean();
      Alert.alert('Saved', 'Floor map layout saved successfully.', [
        { text: 'OK', onPress: () => leaveBuilder() },
      ]);
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [
    currentFloorId,
    draftMap,
    canvasSize,
    currentLocation,
    setFloorMap,
    markClean,
    queryClient,
    leaveBuilder,
  ]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      Alert.alert('Unsaved Changes', 'Discard changes to the floor map?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => leaveBuilder() },
      ]);
    } else {
      leaveBuilder();
    }
  }, [isDirty, leaveBuilder]);

  if (isLoading || !draftMap) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>Loading floor map...</Text>
      </View>
    );
  }

  const allTables = Object.values(draftMap.tables).sort(sortTablesByLabel);

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          <Text style={[styles.backLabel, { color: colors.text.primary }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text.primary }]}>FLOOR MAP BUILDER</Text>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[
              styles.topBarButton,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
              },
            ]}
            onPress={undo}
            disabled={undoStack.length === 0}
          >
            <Ionicons
              name="arrow-undo"
              size={18}
              color={undoStack.length > 0 ? colors.text.primary : colors.text.muted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.topBarButton,
              {
                backgroundColor: colors.surface.level1,
                borderColor: colors.glass.border,
              },
            ]}
            onPress={redo}
            disabled={redoStack.length === 0}
          >
            <Ionicons
              name="arrow-redo"
              size={18}
              color={redoStack.length > 0 ? colors.text.primary : colors.text.muted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: isDirty ? colors.accent : colors.surface.level1,
                borderColor: isDirty ? colors.accent : colors.glass.border,
              },
            ]}
            onPress={handleSave}
            disabled={isSaving || !isDirty}
          >
            <Ionicons
              name="save-outline"
              size={18}
              color={isDirty ? colors.white : colors.text.muted}
            />
            <Text style={[styles.saveLabel, { color: isDirty ? colors.white : colors.text.muted }]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Layout */}
      <View style={styles.body}>
        <BuilderToolbar
          onAddTable={handleAddTable}
          onAddRoom={handleAddRoom}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onToggleGrid={() => setSnapToGrid(!snapToGrid)}
          mode={builderMode}
          onChangeMode={handleChangeMode}
          snapToGrid={snapToGrid}
          hasSelection={selectedTableId != null}
        />

        <View style={styles.canvasContainer} onLayout={handleCanvasLayout}>
          <BuilderCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            initialZoom={draftMap.zoom ?? 1}
            onZoomChange={setMapZoom}
          >
            {allTables.map((table) => (
              <DraggableTable
                key={table.tableId}
                tableId={table.tableId}
                tableNumber={table.tableNumber}
                shape={table.shape}
                type={table.type}
                capacity={table.capacity}
                x={table.x ?? 0.5}
                y={table.y ?? 0.5}
                rotation={table.rotation}
                width={table.width}
                height={table.height}
                sectionLabel={
                  builderMode === 'sections' ? normalizeSectionName(table.section) : undefined
                }
                sectionColor={
                  builderMode === 'sections' ? getSectionColor(table.section) : undefined
                }
                isSelected={selectedTableId === table.tableId}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                onMove={moveTable}
                onResize={handleResize}
                onSelect={handleCanvasTableSelect}
              />
            ))}
          </BuilderCanvas>
        </View>

        <View style={styles.sideRail}>
          {builderMode === 'sections' ? (
            <SectionManagerPanel
              plans={sectionPlans.map((plan) => ({
                planId: plan.planId,
                name: plan.name,
                waiterCount: plan.waiterCount,
                sectionCount: plan.sections.length,
                isDefault: plan.isDefault,
              }))}
              selectedPlanId={selectedSectionPlan?.planId ?? null}
              planName={sectionPlanName}
              waiterCount={sectionPlanWaiterCount}
              sections={sectionSummaries}
              tables={allTables}
              editingSectionName={editingSectionName}
              sectionDraft={sectionDraft}
              onPlanNameChange={setSectionPlanName}
              onWaiterCountChange={setSectionPlanWaiterCount}
              onSavePlan={handleSaveSectionPlan}
              onNewPlan={handleNewSectionPlan}
              onSelectPlan={handleSelectSectionPlan}
              onDeletePlan={handleDeleteSectionPlan}
              onSectionDraftChange={setSectionDraft}
              onCreateSection={handleCreateSection}
              onSelectSection={setActiveSectionName}
              onToggleTable={handleToggleTableSection}
              onDeleteSection={handleDeleteSection}
            />
          ) : (
            <BuilderPropertyPanel
              table={selectedTable}
              rooms={draftMap.rooms}
              onUpdate={handleUpdateTable}
            />
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

type SectionSummary = {
  name: string;
  count: number;
  color: string;
};

type SectionPlanSummary = {
  planId: string;
  name: string;
  waiterCount: number;
  sectionCount: number;
  isDefault?: boolean;
};

type SectionManagerPanelProps = {
  plans: SectionPlanSummary[];
  selectedPlanId: string | null;
  planName: string;
  waiterCount: string;
  sections: SectionSummary[];
  tables: FloorMapTable[];
  editingSectionName: string | null;
  sectionDraft: string;
  onPlanNameChange: (value: string) => void;
  onWaiterCountChange: (value: string) => void;
  onSavePlan: () => void;
  onNewPlan: () => void;
  onSelectPlan: (planId: string) => void;
  onDeletePlan: () => void;
  onSectionDraftChange: (value: string) => void;
  onCreateSection: () => void;
  onSelectSection: (sectionName: string | null) => void;
  onToggleTable: (tableId: string) => void;
  onDeleteSection: (sectionName: string) => void;
};

function SectionManagerPanel({
  plans,
  selectedPlanId,
  planName,
  waiterCount,
  sections,
  tables,
  editingSectionName,
  sectionDraft,
  onPlanNameChange,
  onWaiterCountChange,
  onSavePlan,
  onNewPlan,
  onSelectPlan,
  onDeletePlan,
  onSectionDraftChange,
  onCreateSection,
  onSelectSection,
  onToggleTable,
  onDeleteSection,
}: SectionManagerPanelProps) {
  const { colors, isDark } = useTheme();
  const editingSection = sections.find((section) => section.name === editingSectionName) ?? null;

  return (
    <View
      style={[
        styles.sectionPanel,
        {
          backgroundColor: colors.surface.level1,
          borderColor: colors.border.default,
        },
      ]}
    >
      <View style={styles.sectionPanelTop}>
      <View style={styles.sectionPlanHeader}>
        <View>
          <Text style={[styles.sectionPanelTitle, { color: colors.text.primary }]}>
            Section Presets
          </Text>
          <Text style={[styles.sectionPlanMeta, { color: colors.text.muted }]}>
            Save one permanent layout per staffing count.
          </Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="New section preset"
          activeOpacity={0.75}
          style={[styles.sectionPlanIconButton, { borderColor: colors.border.default }]}
          onPress={onNewPlan}
        >
          <Ionicons name="add" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionPlanInputRow}>
        <TextInput
          value={planName}
          onChangeText={onPlanNameChange}
          placeholder="Preset name"
          placeholderTextColor={colors.text.muted}
          returnKeyType="done"
          style={[
            styles.sectionPlanNameInput,
            {
              color: colors.text.primary,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface.level4,
              borderColor: colors.border.default,
            },
          ]}
        />
        <TextInput
          value={waiterCount}
          onChangeText={onWaiterCountChange}
          placeholder="#"
          placeholderTextColor={colors.text.muted}
          keyboardType="number-pad"
          returnKeyType="done"
          style={[
            styles.sectionPlanCountInput,
            {
              color: colors.text.primary,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface.level4,
              borderColor: colors.border.default,
            },
          ]}
        />
      </View>

      <View style={styles.sectionPlanActions}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.sectionPlanAction, { backgroundColor: colors.accent }]}
          onPress={onSavePlan}
        >
          <Ionicons name="save-outline" size={15} color={colors.white} />
          <Text style={styles.sectionPlanActionText}>Save Preset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={selectedPlanId ? 0.75 : 1}
          disabled={!selectedPlanId}
          style={[
            styles.sectionPlanIconButton,
            {
              borderColor: colors.border.default,
              opacity: selectedPlanId ? 1 : 0.45,
            },
          ]}
          onPress={onDeletePlan}
        >
          <Ionicons name="trash-outline" size={15} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {plans.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sectionPlanChipRow}
        >
          {plans.map((plan) => {
            const isActive = plan.planId === selectedPlanId;
            return (
              <TouchableOpacity
                key={plan.planId}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.sectionPlanChip,
                  {
                    backgroundColor: isActive ? colors.accent : 'transparent',
                    borderColor: isActive ? colors.accent : colors.border.default,
                  },
                ]}
                onPress={() => onSelectPlan(plan.planId)}
              >
                <Text
                  style={[
                    styles.sectionPlanChipTitle,
                    { color: isActive ? colors.white : colors.text.primary },
                  ]}
                  numberOfLines={1}
                >
                  {plan.name}
                </Text>
                <Text
                  style={[
                    styles.sectionPlanChipMeta,
                    { color: isActive ? 'rgba(255,255,255,0.82)' : colors.text.muted },
                  ]}
                >
                  {plan.waiterCount} waiters · {plan.sectionCount} sections
                  {plan.isDefault ? ' · default' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.sectionPanelHeader}>
        <Text style={[styles.sectionPanelTitle, { color: colors.text.primary }]}>Sections</Text>
        {editingSection ? (
          <TouchableOpacity
            accessibilityLabel="Delete section"
            activeOpacity={0.75}
            style={[styles.sectionDeleteButton, { borderColor: colors.border.default }]}
            onPress={() => onDeleteSection(editingSection.name)}
          >
            <Ionicons name="trash-outline" size={15} color={colors.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sectionCreateRow}>
        <TextInput
          value={sectionDraft}
          onChangeText={onSectionDraftChange}
          placeholder="Section name"
          placeholderTextColor={colors.text.muted}
          returnKeyType="done"
          onSubmitEditing={onCreateSection}
          style={[
            styles.sectionInput,
            {
              color: colors.text.primary,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface.level4,
              borderColor: colors.border.default,
            },
          ]}
        />
        <TouchableOpacity
          accessibilityLabel="Create section"
          activeOpacity={0.8}
          style={[styles.sectionCreateButton, { backgroundColor: colors.accent }]}
          onPress={onCreateSection}
        >
          <Ionicons name="add" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      {sections.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sectionChipRow}
        >
          {sections.map((section) => {
            const isActive = section.name === editingSectionName;
            return (
              <TouchableOpacity
                key={section.name}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.sectionChip,
                  {
                    backgroundColor: isActive ? section.color : 'transparent',
                    borderColor: isActive ? section.color : colors.border.default,
                  },
                ]}
                onPress={() => {
                  onSectionDraftChange(isActive ? '' : section.name);
                  onSelectSection(isActive ? null : section.name);
                }}
              >
                <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
                <Text
                  style={[
                    styles.sectionChipText,
                    { color: isActive ? colors.white : colors.text.secondary },
                  ]}
                  numberOfLines={1}
                >
                  {section.name}
                </Text>
                <Text
                  style={[
                    styles.sectionChipCount,
                    { color: isActive ? 'rgba(255,255,255,0.8)' : colors.text.muted },
                  ]}
                >
                  {section.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
      </View>

      <View style={styles.sectionTableArea}>
        <Text style={[styles.sectionTableHint, { color: colors.text.muted }]}>
          {editingSectionName
            ? `Tap chips or floor tables to add/remove from ${editingSectionName}`
            : 'Type a section name above, then tap tables'}
        </Text>

        <ScrollView
          style={styles.sectionTableScroll}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sectionTableGrid}
        >
        {tables.map((table) => {
          const isInEditingSection =
            editingSectionName != null &&
            normalizeSectionName(table.section) === editingSectionName;
          const otherSection = normalizeSectionName(table.section);
          const otherSectionColor =
            otherSection && otherSection !== editingSectionName
              ? getSectionColor(otherSection)
              : undefined;
          const chipColor = editingSection?.color ?? getSectionColor(editingSectionName ?? '');
          return (
            <TouchableOpacity
              key={table.tableId}
              activeOpacity={editingSectionName ? 0.8 : 1}
              disabled={!editingSectionName}
              accessibilityRole="button"
              accessibilityState={{ selected: isInEditingSection }}
              accessibilityLabel={`Table ${table.tableNumber || table.tableId}${
                isInEditingSection && editingSectionName ? `, in section ${editingSectionName}` : ''
              }`}
              style={[
                styles.sectionTableChip,
                {
                  backgroundColor: isInEditingSection ? chipColor : colors.surface.level4,
                  borderColor: isInEditingSection
                    ? chipColor
                    : (otherSectionColor ?? colors.border.default),
                  borderWidth: isInEditingSection ? 2 : 1,
                  opacity: editingSectionName ? 1 : 0.55,
                },
              ]}
              onPress={() => onToggleTable(table.tableId)}
            >
              <Text
                style={[
                  styles.sectionTableText,
                  { color: isInEditingSection ? colors.white : colors.text.primary },
                ]}
                numberOfLines={1}
              >
                {table.tableNumber || table.tableId}
              </Text>
              {otherSectionColor && !isInEditingSection ? (
                <View style={[styles.sectionTableMark, { backgroundColor: otherSectionColor }]} />
              ) : null}
            </TouchableOpacity>
          );
        })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    ...textStyles.body,
    textAlign: 'center',
    marginTop: 100,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingTop: 52,
    paddingBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    ...textStyles.body,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topBarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...shadows.subtle,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    ...shadows.subtle,
  },
  saveLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  canvasContainer: {
    flex: 1,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    position: 'relative',
  },
  sideRail: {
    width: 260,
    alignSelf: 'stretch',
    gap: spacing.md,
    minHeight: 0,
  },
  sectionPanel: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.subtle,
  },
  sectionPanelTop: {
    gap: spacing.sm,
    flexShrink: 0,
  },
  sectionTableArea: {
    flex: 1,
    minHeight: 0,
    gap: spacing.xs,
  },
  sectionTableScroll: {
    flex: 1,
    minHeight: 0,
  },
  sectionPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionPlanMeta: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  sectionPlanInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sectionPlanNameInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 13,
  },
  sectionPlanCountInput: {
    width: 54,
    height: 36,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
    textAlign: 'center',
  },
  sectionPlanActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionPlanAction: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sectionPlanActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionPlanIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionPlanChipRow: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  sectionPlanChip: {
    width: 142,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  sectionPlanChipTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionPlanChipMeta: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionPanelTitle: {
    ...textStyles.sectionLabel,
    fontSize: 11,
  },
  sectionDeleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCreateRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sectionInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 13,
  },
  sectionCreateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionChipRow: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  sectionChip: {
    height: 32,
    maxWidth: 140,
    borderWidth: 1,
    borderRadius: 16,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionChipText: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 78,
  },
  sectionChipCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTableHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  sectionTableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  sectionTableChip: {
    minWidth: 42,
    height: 32,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTableText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTableMark: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 3,
    height: 3,
    borderRadius: 2,
  },
});
