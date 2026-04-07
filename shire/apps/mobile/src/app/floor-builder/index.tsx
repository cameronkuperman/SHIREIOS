import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { FloorMapTable, FloorMapRoom } from '@shire/shared';
import { useBuilderStore, fetchFloorMapLayout, saveFloorMapLayout } from '@/features/floor-builder';
import { useFloorStore } from '@/features/floor';
import { useAuth } from '@/features/auth';
import { BuilderCanvas } from '@/components/BuilderCanvas';
import { BuilderToolbar } from '@/components/BuilderToolbar';
import { BuilderPropertyPanel } from '@/components/BuilderPropertyPanel';
import { DraggableTable } from '@/components/DraggableTable';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

let nextTableCounter = 100;

function generateTableId(): string {
  nextTableCounter += 1;
  return `t${nextTableCounter}`;
}

export default function FloorBuilderScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentLocation } = useAuth();

  const {
    draftMap,
    selectedTableId,
    isDirty,
    snapToGrid,
    loadMap,
    addTable,
    removeTable,
    renameTable,
    updateTable,
    moveTable,
    selectTable,
    addRoom,
    undo,
    redo,
    markClean,
    setSnapToGrid,
    undoStack,
    redoStack,
  } = useBuilderStore();

  const setFloorMap = useFloorStore((s) => s.setFloorMap);
  const currentFloorMap = useFloorStore((s) => s.floorMap);

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load map from Supabase or fall back to current floor map
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (currentLocation) {
          const saved = await fetchFloorMapLayout(currentLocation.id, currentFloorMap.floorId);
          if (!cancelled && saved) {
            loadMap(saved);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fall back to current map
      }
      if (!cancelled) {
        // Convert existing grid map to freeform-ready
        const map = structuredClone(currentFloorMap);
        // Assign x/y positions from grid layout if missing
        for (const room of map.rooms) {
          if (room.layoutMode !== 'freeform') {
            room.layoutMode = 'freeform';
            const totalRows = room.rows.length;
            room.rows.forEach((row, rowIdx) => {
              const totalCols = row.length;
              row.forEach((tableId, colIdx) => {
                const t = map.tables[tableId];
                if (t && t.x == null) {
                  t.x = totalCols > 1 ? (colIdx + 0.5) / (totalCols + 0.5) : 0.5;
                  t.y = totalRows > 1 ? (rowIdx + 0.5) / (totalRows + 0.5) : 0.5;
                }
              });
            });
          }
        }
        loadMap(map);
        setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentFloorMap, currentLocation, loadMap]);

  const selectedTable = useMemo(() => {
    if (!draftMap || !selectedTableId) return null;
    return draftMap.tables[selectedTableId] ?? null;
  }, [draftMap, selectedTableId]);

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
          // Duplicate — just update the number display
          updateTable(selectedTableId, { tableNumber: nextTableNumber });
          return;
        }
        if (newId !== selectedTableId) {
          renameTable(selectedTableId, newId, {
            ...updates,
            tableNumber: nextTableNumber,
          });
          return;
        }
      }
      updateTable(selectedTableId, updates);
    },
    [selectedTableId, draftMap, updateTable, renameTable],
  );

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
      // Bump map version
      const mapToSave = {
        ...draftMap,
        mapVersion: `builder-${Date.now()}`,
      };

      // Save to Supabase
      if (currentLocation) {
        await saveFloorMapLayout(currentLocation.id, mapToSave.floorId, mapToSave);
      }

      // Update live floor store
      setFloorMap(mapToSave);
      markClean();
      Alert.alert('Saved', 'Floor map layout saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Save Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [draftMap, currentLocation, setFloorMap, markClean, router]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      Alert.alert('Unsaved Changes', 'Discard changes to the floor map?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }, [isDirty, router]);

  if (isLoading || !draftMap) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>Loading floor map...</Text>
      </View>
    );
  }

  const allTables = Object.values(draftMap.tables);

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
          onDelete={handleDelete}
          onToggleGrid={() => setSnapToGrid(!snapToGrid)}
          snapToGrid={snapToGrid}
          hasSelection={selectedTableId != null}
        />

        <View style={styles.canvasContainer} onLayout={handleCanvasLayout}>
          <BuilderCanvas width={canvasSize.width} height={canvasSize.height}>
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
                isSelected={selectedTableId === table.tableId}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                onMove={moveTable}
                onSelect={selectTable}
              />
            ))}
          </BuilderCanvas>
        </View>

        <BuilderPropertyPanel
          table={selectedTable}
          rooms={draftMap.rooms}
          onUpdate={handleUpdateTable}
        />
      </View>
    </GestureHandlerRootView>
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
  },
});
