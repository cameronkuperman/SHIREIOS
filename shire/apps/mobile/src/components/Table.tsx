import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { type StatusKey, shadows, borderRadius as br, textStyles } from '@/theme';
import { useTheme } from '@/theme';

type TableShape = 'circle' | 'square' | 'horizontal';

type TableProps = {
  id: string;
  status: StatusKey;
  shape?: TableShape;
  capacity?: number;
  onPress?: () => void;
};

const SHAPE_STYLES: Record<TableShape, ViewStyle> = {
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  square: {
    width: 64,
    height: 64,
    borderRadius: br.lg,
  },
  horizontal: {
    width: 140,
    height: 64,
    borderRadius: br.lg,
  },
};

export function Table({
  id,
  status,
  shape = 'circle',
  capacity,
  onPress,
}: TableProps) {
  const { colors, isDark } = useTheme();
  const statusColors = colors.status[status];
  const shapeStyle = SHAPE_STYLES[shape];

  const tableStyle: ViewStyle = {
    ...baseStyles.tableBase,
    ...shapeStyle,
    backgroundColor: statusColors.fill,
    borderColor: statusColors.border,
  };

  // Stronger fill for occupied/dirty so status is visible at arm's length
  const fillOverride: ViewStyle | undefined =
    status === 'occupied'
      ? { backgroundColor: isDark ? 'rgba(0, 122, 255, 0.22)' : 'rgba(0, 122, 255, 0.12)' }
      : status === 'dirty'
        ? { backgroundColor: isDark ? 'rgba(255, 59, 48, 0.22)' : 'rgba(255, 59, 48, 0.12)' }
        : status === 'reserved'
          ? { backgroundColor: isDark ? 'rgba(255, 149, 0, 0.20)' : 'rgba(255, 149, 0, 0.10)' }
          : undefined;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[tableStyle, fillOverride]}
    >
      <View
        style={[
          baseStyles.innerGlow,
          {
            borderRadius: shapeStyle.borderRadius,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
          },
        ]}
      />
      <Text style={[baseStyles.tableId, { color: colors.text.primary }]}>{id}</Text>
      {capacity != null && (
        <Text style={[baseStyles.tableCapacity, { color: colors.text.muted }]}>
          {capacity}p
        </Text>
      )}
    </TouchableOpacity>
  );
}

const baseStyles = StyleSheet.create({
  tableBase: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    ...shadows.medium,
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    pointerEvents: 'none',
  },
  tableId: {
    ...textStyles.tableId,
  },
  tableCapacity: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
