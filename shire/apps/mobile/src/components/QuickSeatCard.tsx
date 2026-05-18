import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { textStyles, spacing, shadows, borderRadius } from '@/theme';
import { useTheme } from '@/theme';

type QuickSeatCardProps = {
  tableId: string;
  tableLabel: string;
  tableType: 'Round' | 'Square' | 'Booth' | 'Bar';
  capacity: number;
  server?: string;
  label?: string;
  onPress?: () => void;
};

const TABLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Round: 'ellipse-outline',
  Square: 'square-outline',
  Booth: 'tablet-landscape-outline',
  Bar: 'wine-outline',
};

export function QuickSeatCard({
  tableId,
  tableLabel,
  tableType,
  capacity,
  server,
  label,
  onPress,
}: QuickSeatCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <GlassSurface
        intensity={50}
        borderRadius={borderRadius.lg}
        style={styles.card}
      >
        {label && (
          <View style={[styles.labelBadge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.labelText, { color: colors.accent }]}>{label}</Text>
          </View>
        )}
        <Ionicons
          name={TABLE_ICONS[tableType] || 'ellipse-outline'}
          size={22}
          color={colors.accent}
          style={styles.icon}
        />
        <Text style={[styles.tableId, { color: colors.text.primary }]}>
          Table {tableLabel}
        </Text>
        <Text style={[styles.meta, { color: colors.text.secondary }]}>
          {tableType} · {capacity}p
        </Text>
        {server && (
          <Text style={[styles.server, { color: colors.text.muted }]}>{server}</Text>
        )}
      </GlassSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 176,
    minHeight: 92,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-start',
    ...shadows.subtle,
  },
  labelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  labelText: {
    ...textStyles.tiny,
    fontWeight: '600',
  },
  icon: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
  },
  tableId: {
    ...textStyles.label,
    marginBottom: 2,
  },
  meta: {
    ...textStyles.caption,
  },
  server: {
    ...textStyles.tiny,
    marginTop: spacing.xs,
  },
});
