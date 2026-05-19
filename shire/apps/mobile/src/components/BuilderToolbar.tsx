import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

type BuilderToolbarProps = {
  onAddTable: () => void;
  onAddRoom: () => void;
  onDelete: () => void;
  onToggleGrid: () => void;
  mode: 'layout' | 'sections';
  onChangeMode: (mode: 'layout' | 'sections') => void;
  snapToGrid: boolean;
  hasSelection: boolean;
};

export function BuilderToolbar({
  onAddTable,
  onAddRoom,
  onDelete,
  onToggleGrid,
  mode,
  onChangeMode,
  snapToGrid,
  hasSelection,
}: BuilderToolbarProps) {
  const { colors } = useTheme();

  return (
    <GlassSurface intensity={45} borderRadius={borderRadius['2xl']} style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>TOOLS</Text>

      <ToolButton
        icon="add-circle-outline"
        label="Table"
        onPress={onAddTable}
        color={colors.text.primary}
      />
      <ToolButton
        icon="albums-outline"
        label="Room"
        onPress={onAddRoom}
        color={colors.text.primary}
      />

      <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

      <ToolButton
        icon="move-outline"
        label="Layout"
        onPress={() => onChangeMode('layout')}
        color={mode === 'layout' ? colors.accent : colors.text.muted}
        active={mode === 'layout'}
      />
      <ToolButton
        icon="color-palette-outline"
        label="Sections"
        onPress={() => onChangeMode('sections')}
        color={mode === 'sections' ? colors.accent : colors.text.muted}
        active={mode === 'sections'}
      />

      <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

      <ToolButton
        icon="grid-outline"
        label="Grid"
        onPress={onToggleGrid}
        color={snapToGrid ? colors.accent : colors.text.muted}
        active={snapToGrid}
      />

      <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

      <ToolButton
        icon="trash-outline"
        label="Delete"
        onPress={onDelete}
        color={hasSelection ? colors.status.dirty.text : colors.text.muted}
        disabled={!hasSelection}
      />
    </GlassSurface>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
  color,
  active,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.toolButton,
        active && { backgroundColor: colors.accentLight },
      ]}
      activeOpacity={0.6}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.toolLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionLabel: {
    ...textStyles.sectionLabel,
    fontSize: 10,
    marginBottom: spacing.sm,
  },
  toolButton: {
    width: 64,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  toolLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    width: 48,
    height: 1,
    marginVertical: spacing.xs,
  },
});
