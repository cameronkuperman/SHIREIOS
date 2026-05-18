import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { shadows, useTheme } from '@/theme';

type GlassSurfaceProps = {
  children: React.ReactNode;
  /** Which solid surface level to render. */
  level?: 'level1' | 'level2';
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** @deprecated retained for call-site compatibility — ignored. */
  intensity?: number;
  /** @deprecated retained for call-site compatibility — ignored. */
  tint?: 'light' | 'dark' | 'default';
};

/**
 * A solid surface container. (Formerly a glass-morphism surface — the
 * "calm software" redesign uses opaque cream surfaces, no translucency.)
 * Props `intensity`/`tint` are kept in the signature so existing call sites
 * compile unchanged.
 */
export function GlassSurface({
  children,
  level = 'level1',
  borderRadius = 16,
  style,
}: GlassSurfaceProps) {
  const { colors } = useTheme();

  const containerStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface[level],
    ...shadows.subtle,
  };

  return <View style={[containerStyle, style]}>{children}</View>;
}
