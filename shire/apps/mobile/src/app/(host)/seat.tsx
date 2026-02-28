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

const availableTables = [
  { tableId: '2', tableType: 'Round' as const, capacity: 2, server: 'Maria S.' },
  { tableId: '5', tableType: 'Square' as const, capacity: 2, server: 'James R.' },
  { tableId: '7', tableType: 'Round' as const, capacity: 2, server: 'Maria S.' },
  { tableId: '11', tableType: 'Round' as const, capacity: 4, server: 'Alex T.' },
  { tableId: 'P1', tableType: 'Square' as const, capacity: 4, server: 'Nina W.' },
  { tableId: 'P2', tableType: 'Square' as const, capacity: 4, server: 'Nina W.' },
  { tableId: 'P4', tableType: 'Square' as const, capacity: 2, server: 'Nina W.' },
];

export default function SeatPartyScreen() {
  const { colors } = useTheme();
  const [partyName, setPartyName] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

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
                key={table.tableId}
                activeOpacity={0.7}
                onPress={() =>
                  setSelectedTable(selectedTable === table.tableId ? null : table.tableId)
                }
              >
                <GlassSurface
                  intensity={50}
                  borderRadius={borderRadius.xl}
                  style={[
                    styles.tableCard,
                    selectedTable === table.tableId && {
                      borderColor: colors.accent,
                      backgroundColor: colors.accentLight,
                    },
                  ]}
                >
                  <Ionicons
                    name={table.tableType === 'Round' ? 'ellipse-outline' : 'square-outline'}
                    size={28}
                    color={
                      selectedTable === table.tableId ? colors.accent : colors.text.secondary
                    }
                  />
                  <Text style={[styles.tableCardId, { color: colors.text.primary }]}>
                    Table {table.tableId}
                  </Text>
                  <Text style={[styles.tableCardMeta, { color: colors.text.secondary }]}>
                    {table.tableType} • {table.capacity}p
                  </Text>
                  <Text style={[styles.tableCardServer, { color: colors.text.muted }]}>
                    {table.server}
                  </Text>
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
          >
            <Ionicons name="checkmark-circle" size={22} color={colors.white} />
            <Text style={styles.seatButtonText}>
              {selectedTable ? `Seat at Table ${selectedTable}` : 'Select a Table'}
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
