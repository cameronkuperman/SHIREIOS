import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, borderRadius, shadows, useTheme } from '@/theme';
import { GlassSurface } from '@/components/GlassSurface';
import { ServerCard } from '@/components/ServerCard';
import { useFloorStore } from '@/features/floor';
import {
  useWaiterCards,
  useWaiterColorMap,
  useWaiterRoutingActions,
  useWaiterRoutingState,
} from '@/features/routing';

export default function ShiftManagementScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const floorMap = useFloorStore((state) => state.floorMap);
  const waiterCards = useWaiterCards();
  const waiterColorMap = useWaiterColorMap();
  const { routing, error, isLoading, isSaving } = useWaiterRoutingState();
  const {
    addTemporaryWaiter,
    assignSection,
    moveWaiter,
    removeTemporaryWaiter,
    setNextWaiter,
    setWaiterActive,
  } = useWaiterRoutingActions();
  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);
  const [newWaiterName, setNewWaiterName] = useState('');

  const selectedWaiter = waiterCards.find((waiter) => waiter.id === selectedWaiterId) ?? null;
  const sections = useMemo(
    () =>
      [...new Set(Object.values(floorMap.tables).map((table) => table.section).filter(Boolean))].sort(),
    [floorMap.tables],
  );
  const totalActiveWaiters = waiterCards.filter((waiter) => waiter.isActive).length;
  const totalLiveTables = waiterCards.reduce((sum, waiter) => sum + waiter.tableCount, 0);
  const totalServedTables = waiterCards.reduce(
    (sum, waiter) => sum + waiter.servedSeatingCount,
    0,
  );
  const uncoveredSections = sections.filter((sectionId) => !routing?.sectionAssignments[sectionId]);
  const rotationOrder = routing?.rotationOrder ?? [];
  const orderedWaiters = rotationOrder
    .map((waiterId) => waiterCards.find((waiter) => waiter.id === waiterId) ?? null)
    .filter((waiter): waiter is NonNullable<typeof waiter> => waiter != null);

  const handleSectionPress = async (sectionId: string) => {
    if (!selectedWaiterId) {
      return;
    }

    const assignedWaiterId = routing?.sectionAssignments[sectionId] ?? null;
    try {
      await assignSection(sectionId, assignedWaiterId === selectedWaiterId ? null : selectedWaiterId);
    } catch (err) {
      Alert.alert(
        'Unable to Save Section',
        err instanceof Error ? err.message : 'Section routing could not be updated.',
      );
    }
  };

  const handleAddTemporaryWaiter = async () => {
    try {
      await addTemporaryWaiter(newWaiterName);
      setNewWaiterName('');
    } catch (err) {
      Alert.alert(
        'Unable to Add Waiter',
        err instanceof Error ? err.message : 'Temporary waiter could not be added.',
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Shift Management</Text>
        <View style={{ width: 28 }} />
      </View>

      {error && (
        <View style={styles.noticeRow}>
          <GlassSurface intensity={35} borderRadius={borderRadius.lg} style={styles.noticeCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.status.dirty.text} />
            <Text style={[styles.noticeText, { color: colors.status.dirty.text }]}>{error}</Text>
          </GlassSurface>
        </View>
      )}

      <View style={styles.body}>
        {/* Left panel — Server list */}
        <ScrollView
          style={styles.leftPanel}
          contentContainerStyle={styles.leftPanelContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>WAITERS</Text>
          <GlassSurface intensity={30} borderRadius={borderRadius.lg} style={styles.addWaiterCard}>
            <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Add shift waiter</Text>
            <View style={styles.addWaiterRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.surface.level2,
                    borderColor: colors.glass.borderSubtle,
                  },
                ]}
                placeholder="Name"
                placeholderTextColor={colors.text.muted}
                value={newWaiterName}
                onChangeText={setNewWaiterName}
                editable={!isSaving}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                style={[
                  styles.addButton,
                  { backgroundColor: colors.accent },
                  (!newWaiterName.trim() || isSaving) && styles.disabledButton,
                ]}
                disabled={!newWaiterName.trim() || isSaving}
                onPress={() => void handleAddTemporaryWaiter()}
              >
                <Ionicons name="add" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          </GlassSurface>

          {isLoading && waiterCards.length === 0 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
                Loading waiter routing...
              </Text>
            </View>
          ) : null}

          {waiterCards.map((waiter) => (
            <ServerCard
              key={waiter.id}
              server={{
                id: waiter.id,
                name: waiter.name,
                status: waiter.status,
                sections: waiter.sectionIds,
                liveTables: waiter.tableCount,
                servedSeatingCount: waiter.servedSeatingCount,
                isTemporary: waiter.isTemporary,
                isNext: waiter.isNext,
              }}
              isSelected={selectedWaiterId === waiter.id}
              onPress={() =>
                setSelectedWaiterId(selectedWaiterId === waiter.id ? null : waiter.id)
              }
            />
          ))}
        </ScrollView>

        {/* Right panel — Section map */}
        <View style={styles.rightPanel}>
          <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>ROUTING</Text>

          {selectedWaiter && (
            <GlassSurface intensity={30} borderRadius={borderRadius.lg} style={styles.controlCard}>
              <View style={styles.controlHeader}>
                <View>
                  <Text style={[styles.controlTitle, { color: colors.text.primary }]}>
                    {selectedWaiter.name}
                  </Text>
                  <Text style={[styles.controlSubtitle, { color: colors.text.muted }]}>
                    {selectedWaiter.isActive ? 'On shift' : 'Off shift'} ·{' '}
                    {selectedWaiter.servedSeatingCount} seated today
                  </Text>
                </View>
                <View style={styles.controlActions}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.controlButton, { borderColor: colors.border.default }]}
                    onPress={() => void setNextWaiter(selectedWaiter.id)}
                  >
                    <Text style={[styles.controlButtonText, { color: colors.text.primary }]}>
                      Set Next
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.controlButton, { borderColor: colors.border.default }]}
                    onPress={() => void setWaiterActive(selectedWaiter.id, !selectedWaiter.isActive)}
                  >
                    <Text style={[styles.controlButtonText, { color: colors.text.primary }]}>
                      {selectedWaiter.isActive ? 'End Shift' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  {selectedWaiter.isTemporary && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.controlButton, { borderColor: colors.status.dirty.border }]}
                      onPress={() => void removeTemporaryWaiter(selectedWaiter.id)}
                    >
                      <Text
                        style={[styles.controlButtonText, { color: colors.status.dirty.text }]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </GlassSurface>
          )}

          {sections.length > 0 ? (
            <View style={styles.sectionGrid}>
              {sections.map((sectionId) => {
                const assignedWaiterId = routing?.sectionAssignments[sectionId] ?? null;
                const assignedWaiter = waiterCards.find((waiter) => waiter.id === assignedWaiterId) ?? null;
                const isHighlighted = selectedWaiterId != null && assignedWaiterId === selectedWaiterId;
                const color = assignedWaiterId ? waiterColorMap[assignedWaiterId] : null;

                return (
                  <TouchableOpacity
                    key={sectionId}
                    activeOpacity={0.7}
                    onPress={() => void handleSectionPress(sectionId)}
                    style={[
                      styles.sectionBlock,
                      {
                        backgroundColor: assignedWaiterId
                          ? isDark
                            ? `${color}33`
                            : `${color}22`
                          : isDark
                            ? 'rgba(255, 59, 48, 0.15)'
                            : 'rgba(255, 59, 48, 0.08)',
                        borderColor: isHighlighted
                          ? colors.accent
                          : assignedWaiterId
                            ? `${color}66`
                            : colors.status.dirty.border,
                        borderWidth: isHighlighted ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.sectionId, { color: colors.text.primary }]}>
                      {sectionId}
                    </Text>
                    <Text
                      style={[
                        styles.sectionServer,
                        {
                          color: assignedWaiter
                            ? colors.text.secondary
                            : colors.status.dirty.text,
                        },
                      ]}
                    >
                      {assignedWaiter?.name ?? '--'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <GlassSurface intensity={30} borderRadius={borderRadius.lg} style={styles.emptySectionsCard}>
              <Text style={[styles.emptySectionsTitle, { color: colors.text.primary }]}>
                No sections on this floor
              </Text>
              <Text style={[styles.emptySectionsText, { color: colors.text.secondary }]}>
                Use table-level waiter overrides from the host stand. Rotation and next-up still route seats.
              </Text>
            </GlassSurface>
          )}

          <GlassSurface intensity={40} borderRadius={borderRadius.lg} style={styles.rotationCard}>
            <Text style={[styles.rotationTitle, { color: colors.text.primary }]}>Rotation Order</Text>
            <View style={styles.rotationList}>
              {orderedWaiters.map((waiter, index) => {
                const isSelected = waiter.id === selectedWaiterId;
                return (
                  <TouchableOpacity
                    key={waiter.id}
                    activeOpacity={0.7}
                    onPress={() => setSelectedWaiterId(waiter.id)}
                    style={[
                      styles.rotationRow,
                      {
                        borderColor: isSelected ? colors.accent : colors.border.subtle,
                        backgroundColor: isSelected ? colors.accentLight : colors.surface.level1,
                      },
                    ]}
                  >
                    <View style={[styles.rotationDot, { backgroundColor: waiterColorMap[waiter.id] }]} />
                    <Text style={[styles.rotationIndex, { color: colors.text.muted }]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.rotationName, { color: colors.text.primary }]}>
                      {waiter.name}
                    </Text>
                    {waiter.isNext && (
                      <Text style={[styles.rotationBadge, { color: '#C96F1A' }]}>Next</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedWaiter && rotationOrder.includes(selectedWaiter.id) && (
              <View style={styles.rotationButtons}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.controlButton, { borderColor: colors.border.default }]}
                  onPress={() => void moveWaiter(selectedWaiter.id, 'up')}
                >
                  <Text style={[styles.controlButtonText, { color: colors.text.primary }]}>
                    Move Up
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.controlButton, { borderColor: colors.border.default }]}
                  onPress={() => void moveWaiter(selectedWaiter.id, 'down')}
                >
                  <Text style={[styles.controlButtonText, { color: colors.text.primary }]}>
                    Move Down
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassSurface>

          {/* Summary */}
          <GlassSurface intensity={40} borderRadius={borderRadius.lg} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {totalActiveWaiters}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>
                  Active Waiters
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                  {totalLiveTables}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>
                  Live Tables
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color: colors.text.primary,
                    },
                  ]}
                >
                  {totalServedTables}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>
                  Seated Today
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.coverageText,
                {
                  color:
                    uncoveredSections.length > 0
                      ? colors.status.dirty.text
                      : colors.status.available.text,
                },
              ]}
            >
              {sections.length === 0
                ? 'No section map configured for this floor.'
                : uncoveredSections.length > 0
                  ? `Uncovered sections: ${uncoveredSections.join(', ')}`
                  : 'All sections covered'}
            </Text>
          </GlassSurface>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
  },
  title: {
    ...textStyles.subtitle,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  leftPanel: {
    flex: 1,
  },
  leftPanelContent: {
    paddingRight: spacing.sm,
  },
  noticeRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noticeText: {
    ...textStyles.caption,
    flex: 1,
  },
  rightPanel: {
    flex: 1,
  },
  sectionLabel: {
    ...textStyles.sectionLabel,
    marginBottom: spacing.md,
  },
  addWaiterCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...textStyles.captionMedium,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  addWaiterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...textStyles.body,
  },
  addButton: {
    width: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...textStyles.caption,
  },
  controlCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  controlHeader: {
    gap: spacing.md,
  },
  controlTitle: {
    ...textStyles.label,
  },
  controlSubtitle: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  controlActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  controlButton: {
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  controlButtonText: {
    ...textStyles.captionMedium,
  },
  sectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionBlock: {
    width: '31%',
    aspectRatio: 1.3,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sectionId: {
    ...textStyles.label,
  },
  sectionServer: {
    ...textStyles.captionMedium,
    textAlign: 'center',
  },
  emptySectionsCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  emptySectionsTitle: {
    ...textStyles.label,
    marginBottom: spacing.xs,
  },
  emptySectionsText: {
    ...textStyles.body,
  },
  rotationCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  rotationTitle: {
    ...textStyles.label,
    marginBottom: spacing.md,
  },
  rotationList: {
    gap: spacing.sm,
  },
  rotationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rotationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rotationIndex: {
    ...textStyles.caption,
    width: 16,
  },
  rotationName: {
    ...textStyles.captionMedium,
    flex: 1,
  },
  rotationBadge: {
    ...textStyles.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rotationButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryCard: {
    padding: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryValue: {
    ...textStyles.subtitle,
  },
  summaryLabel: {
    ...textStyles.tiny,
    textTransform: 'uppercase',
  },
  coverageText: {
    ...textStyles.caption,
    marginTop: spacing.md,
  },
});
