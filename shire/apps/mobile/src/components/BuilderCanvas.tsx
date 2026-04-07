import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

type BuilderCanvasProps = {
  children: ReactNode;
  width: number;
  height: number;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

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

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.wrapper, { backgroundColor: isDark ? '#1a1a1e' : '#eae4da' }]}>
        {/* Grid dots */}
        <View style={StyleSheet.absoluteFill}>
          <GridDots width={width} height={height} isDark={isDark} />
        </View>
        <Animated.View
          style={[
            styles.canvas,
            { width, height },
            animatedStyle,
          ]}
        >
          {children}
        </Animated.View>
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
});
