import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { shadows, useTheme } from '@/theme';

type GlassSurfaceProps = {
  children: React.ReactNode;
  /** Which solid surface level to render. */
  level?: 'level1' | 'level2';
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** Accepted for backwards compatibility — no longer used (BlurView removed). */
  intensity?: number;
  /** Accepted for backwards compatibility — no longer used (BlurView removed). */
  tint?: 'light' | 'dark' | 'default' | 'systemThinMaterialLight';
};

/**
 * A translucent surface container. Uses a plain View with a solid surface
 * colour — never BlurView (see CLAUDE.md: BlurView breaks rendering here).
 * The `style` prop is applied directly to the surface View so callers can
 * pass layout props such as `flex: 1`.
 */
export function GlassSurface({
  children,
  level = 'level1',
  borderRadius = 24,
  style,
}: GlassSurfaceProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.4)',
          backgroundColor: colors.surface[level],
          ...shadows.medium,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
