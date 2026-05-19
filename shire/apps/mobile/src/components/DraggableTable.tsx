import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { TableShape, TableType } from '@shire/shared';
import { sectionColorWithAlpha } from '@/features/floor';
import { borderRadius as br, shadows, textStyles, useTheme } from '@/theme';
import { useCanvasScale } from './BuilderCanvas';

type DraggableTableProps = {
  tableId: string;
  tableNumber: string;
  shape: TableShape;
  type: TableType;
  capacity: number;
  x: number; // normalized 0–1
  y: number; // normalized 0–1
  rotation?: number;
  width?: number;
  height?: number;
  sectionLabel?: string;
  sectionColor?: string;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onMove: (tableId: string, x: number, y: number) => void;
  onResize: (tableId: string, width: number, height: number) => void;
  onSelect: (tableId: string) => void;
};

const SHAPE_SIZE: Record<TableShape, { w: number; h: number; radius: number }> = {
  circle: { w: 64, h: 64, radius: 32 },
  square: { w: 64, h: 64, radius: br.lg },
  horizontal: { w: 140, h: 64, radius: br.lg },
};

const MIN_TABLE_SIZE = 44;
const MAX_TABLE_SIZE = 320;

export function DraggableTable({
  tableId,
  tableNumber,
  shape,
  capacity,
  x,
  y,
  rotation = 0,
  width,
  height,
  sectionLabel,
  sectionColor,
  isSelected,
  canvasWidth,
  canvasHeight,
  onMove,
  onResize,
  onSelect,
}: DraggableTableProps) {
  const { colors, isDark } = useTheme();
  const shapeSize = SHAPE_SIZE[shape];
  const w = width ?? shapeSize.w;
  const h = height ?? shapeSize.h;
  const radius = shapeSize.radius;

  // Live canvas zoom — converts screen-space gestures to canvas space.
  const canvasScale = useCanvasScale();

  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const sizeW = useSharedValue(w);
  const sizeH = useSharedValue(h);
  const resizeStartW = useSharedValue(w);
  const resizeStartH = useSharedValue(h);

  const pixelX = x * canvasWidth;
  const pixelY = y * canvasHeight;

  // Resync the live size when the committed size changes (undo / load / duplicate).
  useEffect(() => {
    sizeW.value = w;
    sizeH.value = h;
  }, [w, h, sizeW, sizeH]);

  // Move + tap. Memoized so re-renders don't drop an in-progress drag.
  const composed = useMemo(() => {
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
        const s = canvasScale ? canvasScale.value : 1;
        offsetX.value = e.translationX / s;
        offsetY.value = e.translationY / s;
      })
      .onEnd((e) => {
        const s = canvasScale ? canvasScale.value : 1;
        const newPixelX = pixelX + e.translationX / s;
        const newPixelY = pixelY + e.translationY / s;
        const nx = Math.max(0, Math.min(1, newPixelX / canvasWidth));
        const ny = Math.max(0, Math.min(1, newPixelY / canvasHeight));
        offsetX.value = 0;
        offsetY.value = 0;
        runOnJS(onMove)(tableId, nx, ny);
      });

    return Gesture.Exclusive(dragGesture, tapGesture);
  }, [
    tableId,
    pixelX,
    pixelY,
    canvasWidth,
    canvasHeight,
    onMove,
    onSelect,
    offsetX,
    offsetY,
    canvasScale,
  ]);

  // Resize handles — right edge (width), bottom edge (height), corner (both).
  // Symmetric about the table centre, so x/y never change. Memoized like the
  // drag gesture so re-renders can't drop an in-progress resize.
  const resizeGestures = useMemo(() => {
    const horizontal = Gesture.Pan()
      .onStart(() => {
        resizeStartW.value = sizeW.value;
      })
      .onUpdate((e) => {
        const s = canvasScale ? canvasScale.value : 1;
        sizeW.value = Math.min(
          MAX_TABLE_SIZE,
          Math.max(MIN_TABLE_SIZE, resizeStartW.value + (2 * e.translationX) / s),
        );
      })
      .onEnd(() => {
        runOnJS(onResize)(tableId, sizeW.value, sizeH.value);
      });

    const vertical = Gesture.Pan()
      .onStart(() => {
        resizeStartH.value = sizeH.value;
      })
      .onUpdate((e) => {
        const s = canvasScale ? canvasScale.value : 1;
        sizeH.value = Math.min(
          MAX_TABLE_SIZE,
          Math.max(MIN_TABLE_SIZE, resizeStartH.value + (2 * e.translationY) / s),
        );
      })
      .onEnd(() => {
        runOnJS(onResize)(tableId, sizeW.value, sizeH.value);
      });

    const corner = Gesture.Pan()
      .onStart(() => {
        resizeStartW.value = sizeW.value;
        resizeStartH.value = sizeH.value;
      })
      .onUpdate((e) => {
        const s = canvasScale ? canvasScale.value : 1;
        sizeW.value = Math.min(
          MAX_TABLE_SIZE,
          Math.max(MIN_TABLE_SIZE, resizeStartW.value + (2 * e.translationX) / s),
        );
        sizeH.value = Math.min(
          MAX_TABLE_SIZE,
          Math.max(MIN_TABLE_SIZE, resizeStartH.value + (2 * e.translationY) / s),
        );
      })
      .onEnd(() => {
        runOnJS(onResize)(tableId, sizeW.value, sizeH.value);
      });

    return { horizontal, vertical, corner };
  }, [tableId, onResize, canvasScale, sizeW, sizeH, resizeStartW, resizeStartH]);

  // The wrapper carries position, live size, and the move offset.
  const wrapperAnimStyle = useAnimatedStyle(() => ({
    left: pixelX - sizeW.value / 2,
    top: pixelY - sizeH.value / 2,
    width: sizeW.value,
    height: sizeH.value,
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  // Counter-scale the number so it stays readable when zoomed out.
  const labelScaleStyle = useAnimatedStyle(() => {
    const s = canvasScale ? canvasScale.value : 1;
    return { transform: [{ scale: Math.min(2.2, Math.max(1, 1 / s)) }] };
  });

  // Counter-scale the resize handles so they stay grabbable when zoomed out.
  const handleScaleStyle = useAnimatedStyle(() => {
    const s = canvasScale ? canvasScale.value : 1;
    return { transform: [{ scale: Math.min(2.4, Math.max(1, 1 / s)) }] };
  });

  const tableStyle: ViewStyle = {
    width: '100%',
    height: '100%',
    borderRadius: radius,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: isSelected ? 2.5 : 1.5,
    borderColor: isSelected
      ? colors.accent
      : sectionColor
        ? sectionColor
        : isDark
          ? 'rgba(255,255,255,0.2)'
          : 'rgba(0,0,0,0.12)',
    backgroundColor: sectionColor
      ? sectionColorWithAlpha(sectionColor, 0.16)
      : isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.85)',
    ...(rotation ? { transform: [{ rotate: `${rotation}deg` }] } : {}),
    ...shadows.medium,
  };

  return (
    <Animated.View style={[styles.wrapper, { zIndex: isSelected ? 3 : 2 }, wrapperAnimStyle]}>
      <GestureDetector gesture={composed}>
        <View collapsable={false} style={tableStyle}>
          <Animated.View style={[styles.labelGroup, labelScaleStyle]}>
            <Text style={[styles.label, { color: colors.text.primary }]}>{tableNumber || '?'}</Text>
            <Text style={[styles.capacity, { color: colors.text.muted }]}>{capacity}p</Text>
          </Animated.View>
          {sectionLabel ? (
            <View style={[styles.sectionBadge, { backgroundColor: sectionColor }]}>
              <Text style={styles.sectionBadgeText} numberOfLines={1}>
                {sectionLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      {isSelected ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.selectionRing, { borderColor: colors.accent, borderRadius: radius + 4 }]}
          />
          <GestureDetector gesture={resizeGestures.horizontal}>
            <Animated.View style={[styles.handleHit, styles.handleRight, handleScaleStyle]}>
              <View style={[styles.handleDot, { backgroundColor: colors.accent }]} />
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={resizeGestures.vertical}>
            <Animated.View style={[styles.handleHit, styles.handleBottom, handleScaleStyle]}>
              <View style={[styles.handleDot, { backgroundColor: colors.accent }]} />
            </Animated.View>
          </GestureDetector>
          <GestureDetector gesture={resizeGestures.corner}>
            <Animated.View style={[styles.handleHit, styles.handleCorner, handleScaleStyle]}>
              <View style={[styles.handleDot, { backgroundColor: colors.accent }]} />
            </Animated.View>
          </GestureDetector>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
  labelGroup: {
    alignItems: 'center',
  },
  label: {
    ...textStyles.tableId,
  },
  capacity: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  sectionBadge: {
    position: 'absolute',
    bottom: -9,
    minWidth: 28,
    maxWidth: 76,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  selectionRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderStyle: 'dashed',
    margin: -4,
  },
  handleHit: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleRight: {
    right: -14,
    top: '50%',
    marginTop: -14,
  },
  handleBottom: {
    bottom: -14,
    left: '50%',
    marginLeft: -14,
  },
  handleCorner: {
    right: -14,
    bottom: -14,
  },
  handleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.subtle,
  },
});
