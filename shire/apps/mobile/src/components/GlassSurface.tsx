import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { shadows } from '@/theme';
import { useTheme } from '@/theme';

type GlassSurfaceProps = {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Translucent glass-morphism surface.
 * Uses a plain View with rgba background instead of expo-blur BlurView
 * to avoid "Unimplemented component" errors in Expo Go / new-arch builds.
 */
export function GlassSurface({
  children,
  intensity = 40,
  tint = 'light',
  borderRadius = 24,
  style,
}: GlassSurfaceProps) {
  const { colors, isDark } = useTheme();

  // Map intensity (0-100) to a translucent background
  const opacity = Math.min(intensity / 100, 1);
  let bgColor: string;
  if (isDark) {
    bgColor =
      tint === 'dark'
        ? `rgba(0, 0, 0, ${(opacity * 0.6).toFixed(2)})`
        : `rgba(255, 255, 255, ${(opacity * 0.12).toFixed(2)})`;
  } else {
    bgColor =
      tint === 'dark'
        ? `rgba(0, 0, 0, ${(opacity * 0.85).toFixed(2)})`
        : `rgba(255, 255, 255, ${(opacity * 0.85).toFixed(2)})`;
  }

  const containerStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glass.border,
    backgroundColor: bgColor,
    ...shadows.subtle,
  };

  return (
    <View style={[containerStyle, style]}>
      <View
        style={[
          innerStyles.highlight,
          { borderRadius, borderColor: colors.glass.innerHighlight },
        ]}
      />
      {children}
    </View>
  );
}

const innerStyles = StyleSheet.create({
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    pointerEvents: 'none',
  },
});
