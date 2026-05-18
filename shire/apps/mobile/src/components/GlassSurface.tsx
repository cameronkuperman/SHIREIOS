import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { shadows, useTheme } from '@/theme';

type GlassSurfaceProps = {
  children: React.ReactNode;
  /** Which solid surface level to render. */
  level?: 'level1' | 'level2';
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** Optional intensity for the blur effect (default 80) */
  intensity?: number;
  /** Optional tint for the blur effect (default light) */
  tint?: 'light' | 'dark' | 'default' | 'systemThinMaterialLight';
};

/**
 * A frosted glass surface container leveraging native iOS blur materials.
 */
export function GlassSurface({
  children,
  level = 'level1',
  borderRadius = 24,
  style,
  intensity = 80,
  tint = 'systemThinMaterialLight',
}: GlassSurfaceProps) {
  const { colors } = useTheme();

  const containerStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...shadows.medium,
  };

  return (
    <View style={[containerStyle, style]}>
      <BlurView
        intensity={intensity}
        tint={tint as any}
        style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
      >
        {children}
      </BlurView>
    </View>
  );
}
