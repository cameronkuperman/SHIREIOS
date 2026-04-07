import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { TableShape, TableType } from '@shire/shared';
import { borderRadius as br, shadows, textStyles, useTheme } from '@/theme';

type DraggableTableProps = {
  tableId: string;
  tableNumber: string;
  shape: TableShape;
  type: TableType;
  capacity: number;
  x: number; // normalized 0–1
  y: number; // normalized 0–1
  rotation?: number;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onMove: (tableId: string, x: number, y: number) => void;
  onSelect: (tableId: string) => void;
};

const SHAPE_SIZE: Record<TableShape, { w: number; h: number; radius: number }> = {
  circle: { w: 64, h: 64, radius: 32 },
  square: { w: 64, h: 64, radius: br.lg },
  horizontal: { w: 140, h: 64, radius: br.lg },
};

export function DraggableTable({
  tableId,
  tableNumber,
  shape,
  type,
  capacity,
  x,
  y,
  rotation = 0,
  isSelected,
  canvasWidth,
  canvasHeight,
  onMove,
  onSelect,
}: DraggableTableProps) {
  const { colors, isDark } = useTheme();
  const { w, h, radius } = SHAPE_SIZE[shape];

  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  const pixelX = x * canvasWidth;
  const pixelY = y * canvasHeight;

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)(tableId);
  });

  const dragGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      runOnJS(onSelect)(tableId);
    })
    .onUpdate((e) => {
      offsetX.value = e.translationX;
      offsetY.value = e.translationY;
    })
    .onEnd((e) => {
      const newPixelX = pixelX + e.translationX;
      const newPixelY = pixelY + e.translationY;
      const nx = Math.max(0, Math.min(1, newPixelX / canvasWidth));
      const ny = Math.max(0, Math.min(1, newPixelY / canvasHeight));
      offsetX.value = 0;
      offsetY.value = 0;
      runOnJS(onMove)(tableId, nx, ny);
    });

  const composed = Gesture.Exclusive(dragGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
    ],
  }));

  const containerStyle: ViewStyle = {
    position: 'absolute',
    left: pixelX - w / 2,
    top: pixelY - h / 2,
  };

  const tableStyle: ViewStyle = {
    width: w,
    height: h,
    borderRadius: radius,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: isSelected ? 2.5 : 1.5,
    borderColor: isSelected
      ? colors.accent
      : isDark
        ? 'rgba(255,255,255,0.2)'
        : 'rgba(0,0,0,0.12)',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
    ...(rotation ? { transform: [{ rotate: `${rotation}deg` }] } : {}),
    ...shadows.medium,
  };

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[containerStyle, animatedStyle]}>
        <View style={tableStyle}>
          <Text style={[styles.label, { color: colors.text.primary }]}>
            {tableNumber || '?'}
          </Text>
          <Text style={[styles.capacity, { color: colors.text.muted }]}>{capacity}p</Text>
        </View>
        {isSelected && (
          <View style={[styles.selectionRing, { borderColor: colors.accent, borderRadius: radius + 4 }]}>
            <View style={[styles.selectionCorner, styles.topLeft, { backgroundColor: colors.accent }]} />
            <View style={[styles.selectionCorner, styles.topRight, { backgroundColor: colors.accent }]} />
            <View style={[styles.selectionCorner, styles.bottomLeft, { backgroundColor: colors.accent }]} />
            <View style={[styles.selectionCorner, styles.bottomRight, { backgroundColor: colors.accent }]} />
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  label: {
    ...textStyles.tableId,
  },
  capacity: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  selectionRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderStyle: 'dashed',
    margin: -4,
  },
  selectionCorner: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  topLeft: { top: -4, left: -4 },
  topRight: { top: -4, right: -4 },
  bottomLeft: { bottom: -4, left: -4 },
  bottomRight: { bottom: -4, right: -4 },
});
