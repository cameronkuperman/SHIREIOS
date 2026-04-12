import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { textStyles, spacing, shadows, borderRadius, useTheme } from '@/theme';
import { GlassSurface } from '@/components/GlassSurface';
import { SeatingPreferencePicker, type SeatingPref } from '@/components/SeatingPreferencePicker';
import { useAvailableTables, useFloorActions, useFloorStore } from '@/features/floor';
import { resolveWaiterIdForTable, useWaiterRoutingState } from '@/features/routing';

function toTableType(shape: 'circle' | 'square' | 'horizontal', type: string): 'Round' | 'Square' | 'Booth' | 'Bar' {
  if (type === 'booth' || shape === 'horizontal') {
    return 'Booth';
  }

  if (type === 'bar' || type === 'counter') {
    return 'Bar';
  }

  return shape === 'square' ? 'Square' : 'Round';
}

export default function SeatPartyScreen() {
  const { colors } = useTheme();
  const availableTables = useAvailableTables();
  const floorMap = useFloorStore((state) => state.floorMap);
  const { seatWalkIn } = useFloorActions();
  const { routing } = useWaiterRoutingState();
  const [partyName, setPartyName] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [seatingPref, setSeatingPref] = useState<SeatingPref>('none');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const handleSeat = () => {
    if (!selectedTable) return;
    const sectionId = floorMap.tables[selectedTable]?.section ?? null;
    const waiterId = resolveWaiterIdForTable(routing, selectedTable, sectionId);

    const result = seatWalkIn(
      selectedTable,
      partyName,
      parseInt(partySize, 10) || 2,
      waiterId ?? undefined,
    );
    if (!result.ok) {
      return;
    }
    setPartyName('');
    setPartySize('2');
    setSeatingPref('none');
    setSelectedTable(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Seat Party</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Party Info */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <GlassSurface intensity={40} borderRadius={borderRadius.xl} style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Party Details
            </Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Name</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.surface.level2,
                      borderColor: colors.glass.borderSubtle,
                    },
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color={colors.text.muted} />
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="Guest name"
                    placeholderTextColor={colors.text.muted}
                    value={partyName}
                    onChangeText={setPartyName}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 0.4 }]}>
                <Text style={[styles.inputLabel, { color: colors.text.muted }]}>Party Size</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.surface.level2,
                      borderColor: colors.glass.borderSubtle,
                    },
                  ]}
                >
                  <Ionicons name="people-outline" size={18} color={colors.text.muted} />
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="2"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="number-pad"
                    value={partySize}
                    onChangeText={setPartySize}
                  />
                </View>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text.muted, marginTop: spacing.lg }]}>
              Seating Preference
            </Text>
            <SeatingPreferencePicker value={seatingPref} onChange={setSeatingPref} />
          </GlassSurface>
        </Animated.View>

        {/* Available Tables */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={[styles.availableTitle, { color: colors.text.primary }]}>
            Available Tables
          </Text>
          <View style={styles.tableGrid}>
            {availableTables.map((table) => (
              <TouchableOpacity
                key={table.id}
                activeOpacity={0.7}
                onPress={() =>
                  setSelectedTable(selectedTable === table.id ? null : table.id)
                }
              >
                <GlassSurface
                  intensity={50}
                  borderRadius={borderRadius.xl}
                  style={[
                    styles.tableCard,
                    selectedTable === table.id && {
                      borderColor: colors.accent,
                      backgroundColor: colors.accentLight,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      toTableType(table.shape, table.type) === 'Round'
                        ? 'ellipse-outline'
                        : toTableType(table.shape, table.type) === 'Booth'
                          ? 'tablet-landscape-outline'
                          : toTableType(table.shape, table.type) === 'Bar'
                            ? 'wine-outline'
                            : 'square-outline'
                    }
                    size={28}
                    color={
                      selectedTable === table.id ? colors.accent : colors.text.secondary
                    }
                  />
                  <Text style={[styles.tableCardId, { color: colors.text.primary }]}>
                    Table {table.label}
                  </Text>
                  <Text style={[styles.tableCardMeta, { color: colors.text.secondary }]}>
                    {toTableType(table.shape, table.type)} • {table.capacity}p
                  </Text>
                  {table.server && (
                    <Text style={[styles.tableCardServer, { color: colors.text.muted }]}>
                      {table.server}
                    </Text>
                  )}
                </GlassSurface>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Seat Button */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <TouchableOpacity
            style={[
              styles.seatButton,
              { backgroundColor: colors.accent },
              !selectedTable && styles.seatButtonDisabled,
            ]}
            activeOpacity={0.8}
            disabled={!selectedTable}
            onPress={handleSeat}
          >
            <Ionicons name="checkmark-circle" size={22} color={colors.white} />
            <Text style={styles.seatButtonText}>
              {selectedTable
                ? `Seat at Table ${availableTables.find((table) => table.id === selectedTable)?.label ?? selectedTable}`
                : 'Select a Table'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
  },
  title: {
    ...textStyles.title,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  formCard: {
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  sectionTitle: {
    ...textStyles.label,
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    ...textStyles.caption,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    ...textStyles.body,
    padding: 0,
  },
  availableTitle: {
    ...textStyles.label,
    marginBottom: spacing.lg,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  tableCard: {
    width: 190,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  tableCardId: {
    ...textStyles.label,
    marginTop: spacing.sm,
  },
  tableCardMeta: {
    ...textStyles.caption,
    marginTop: 2,
  },
  tableCardServer: {
    ...textStyles.tiny,
    marginTop: spacing.xs,
  },
  seatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  seatButtonDisabled: {
    opacity: 0.4,
  },
  seatButtonText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
});
