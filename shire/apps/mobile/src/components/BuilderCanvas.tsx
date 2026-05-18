import React, { type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { shadows, spacing, useTheme } from '@/theme';

type BuilderCanvasProps = {
  children: ReactNode;
  width: number;
  height: number;
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const ZOOM_STEP = 1.35;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function BuilderCanvas({ children, width, height }: BuilderCanvasProps) {
  const { colors, isDark } = useTheme();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const nextScale = savedScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const zoomBy = (factor: number) => {
    scale.value = withSpring(clampScale(scale.value * factor));
  };

  const resetView = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  const controlStyle = {
    backgroundColor: isDark ? 'rgba(30, 30, 34, 0.94)' : 'rgba(255,255,255,0.96)',
    borderColor: colors.glass.border,
  };

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.wrapper, { backgroundColor: isDark ? '#1a1a1e' : '#eae4da' }]}>
        {/* Grid dots */}
        <View style={StyleSheet.absoluteFill}>
          <GridDots width={width} height={height} isDark={isDark} />
        </View>
        <Animated.View style={[styles.canvas, { width, height }, animatedStyle]}>
          {children}
        </Animated.View>

        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, controlStyle]}
            activeOpacity={0.7}
            onPress={() => zoomBy(ZOOM_STEP)}
            accessibilityLabel="Zoom in"
          >
            <Ionicons name="add" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomButton, controlStyle]}
            activeOpacity={0.7}
            onPress={resetView}
            accessibilityLabel="Reset zoom"
          >
            <Ionicons name="scan-outline" size={18} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomButton, controlStyle]}
            activeOpacity={0.7}
            onPress={() => zoomBy(1 / ZOOM_STEP)}
            accessibilityLabel="Zoom out"
          >
            <Ionicons name="remove" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </GestureDetector>
  );
}

function GridDots({ width, height, isDark }: { width: number; height: number; isDark: boolean }) {
  const dotColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const step = 40;
  const dots: React.ReactElement[] = [];

  for (let x = step; x < width; x += step) {
    for (let y = step; y < height; y += step) {
      dots.push(
        <View
          key={`${x}-${y}`}
          style={[
            styles.gridDot,
            {
              left: x,
              top: y,
              backgroundColor: dotColor,
            },
          ]}
        />,
      );
    }
  }

  return <>{dots}</>;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
  },
  canvas: {
    position: 'relative',
  },
  gridDot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  zoomControls: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.xs,
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
});
