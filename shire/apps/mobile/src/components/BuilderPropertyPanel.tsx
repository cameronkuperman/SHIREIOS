import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FloorMapTable, TableShape, TableType, FloorMapRoom } from '@shire/shared';
import { GlassSurface } from './GlassSurface';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type BuilderPropertyPanelProps = {
  table: FloorMapTable | null;
  rooms: FloorMapRoom[];
  onUpdate: (updates: Partial<FloorMapTable>) => void;
};

const SHAPES: { value: TableShape; icon: string; label: string }[] = [
  { value: 'circle', icon: 'ellipse-outline', label: 'Round' },
  { value: 'square', icon: 'square-outline', label: 'Square' },
  { value: 'horizontal', icon: 'remove-outline', label: 'Long' },
];

const TYPES: { value: TableType; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'booth', label: 'Booth' },
  { value: 'high-top', label: 'High-Top' },
  { value: 'bar', label: 'Bar' },
  { value: 'counter', label: 'Counter' },
  { value: 'outdoor', label: 'Outdoor' },
];

const CAPACITIES = [1, 2, 4, 6, 8, 10, 12];

export function BuilderPropertyPanel({ table, rooms, onUpdate }: BuilderPropertyPanelProps) {
  const { colors, isDark } = useTheme();
  const [tableNumberDraft, setTableNumberDraft] = React.useState('');

  React.useEffect(() => {
    setTableNumberDraft(table?.tableNumber ?? '');
  }, [table?.tableId, table?.tableNumber]);

  const commitTableNumber = React.useCallback(() => {
    if (!table) return;
    const nextTableNumber = tableNumberDraft.trim();
    if (
      !nextTableNumber ||
      (nextTableNumber === table.tableNumber && nextTableNumber === table.tableId)
    ) {
      return;
    }
    onUpdate({ tableNumber: nextTableNumber, tableId: nextTableNumber });
  }, [onUpdate, table, tableNumberDraft]);

  if (!table) {
    return (
      <GlassSurface intensity={45} borderRadius={borderRadius['2xl']} style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="hand-left-outline" size={28} color={colors.text.muted} />
          <Text style={[styles.emptyText, { color: colors.text.muted }]}>
            Tap a table to edit its properties
          </Text>
        </View>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface intensity={45} borderRadius={borderRadius['2xl']} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>PROPERTIES</Text>

        {/* Table Number */}
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Table Number</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.text.primary,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: colors.border.default,
            },
          ]}
          value={tableNumberDraft}
          onChangeText={(text) => {
            setTableNumberDraft(text);
            onUpdate({ tableNumber: text });
          }}
          onBlur={commitTableNumber}
          onSubmitEditing={commitTableNumber}
          placeholder="e.g. 7"
          placeholderTextColor={colors.text.muted}
          returnKeyType="done"
        />

        {/* Section */}
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Section</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.text.primary,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: colors.border.default,
            },
          ]}
          value={table.section}
          onChangeText={(text) => onUpdate({ section: text })}
          placeholder="e.g. A1"
          placeholderTextColor={colors.text.muted}
          returnKeyType="done"
        />

        {/* Room Assignment */}
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Room</Text>
        <View style={styles.roomGrid}>
          {rooms.map((room) => (
            <ChipButton
              key={room.roomId}
              label={room.label}
              compact
              isActive={table.roomId === room.roomId}
              onPress={() => onUpdate({ roomId: room.roomId })}
            />
          ))}
        </View>

        {/* Shape */}
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Shape</Text>
        <View style={styles.chipRow}>
          {SHAPES.map((s) => (
            <TouchableOpacity
              key={s.value}
              style={[
                styles.shapeChip,
                {
                  backgroundColor: table.shape === s.value ? colors.accentLight : 'transparent',
                  borderColor: table.shape === s.value ? colors.accent : colors.border.default,
                },
              ]}
              onPress={() => onUpdate({ shape: s.value })}
            >
              <Ionicons
                name={s.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={table.shape === s.value ? colors.accent : colors.text.secondary}
              />
              <Text
                style={[
                  styles.shapeLabel,
                  {
                    color: table.shape === s.value ? colors.accent : colors.text.secondary,
                  },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Type */}
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Type</Text>
        <View style={styles.chipRow}>
          {TYPES.map((t) => (
            <ChipButton
              key={t.value}
              label={t.label}
              isActive={table.type === t.value}
              onPress={() => onUpdate({ type: t.value })}
            />
          ))}
        </View>

        {/* Capacity */}
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Capacity</Text>
        <View style={styles.chipRow}>
          {CAPACITIES.map((cap) => (
            <ChipButton
              key={cap}
              label={`${cap}`}
              isActive={table.capacity === cap}
              onPress={() => onUpdate({ capacity: cap })}
            />
          ))}
        </View>

        {/* Server */}
        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Assigned Server</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.text.primary,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: colors.border.default,
            },
          ]}
          value={table.assignedServer ?? ''}
          onChangeText={(text) => onUpdate({ assignedServer: text || null })}
          placeholder="e.g. Maria S."
          placeholderTextColor={colors.text.muted}
          returnKeyType="done"
        />
      </ScrollView>
    </GlassSurface>
  );
}

function ChipButton({
  label,
  isActive,
  compact,
  onPress,
}: {
  label: string;
  isActive: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        compact ? styles.roomChip : styles.chip,
        {
          backgroundColor: isActive ? colors.accentLight : 'transparent',
          borderColor: isActive ? colors.accent : colors.border.default,
        },
      ]}
      onPress={onPress}
    >
      <Text
        numberOfLines={1}
        style={[
          compact ? styles.roomChipLabel : styles.chipLabel,
          { color: isActive ? colors.accent : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 260,
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['3xl'],
    gap: spacing.md,
  },
  emptyText: {
    ...textStyles.caption,
    textAlign: 'center',
  },
  sectionLabel: {
    ...textStyles.sectionLabel,
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  textInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  roomChip: {
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '48%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  roomChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  shapeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  shapeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
