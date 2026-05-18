import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { borderRadius, useTheme } from '@/theme';

type PanelProps = {
  children: React.ReactNode;
  /** level2 (default panel surface) or level1 (brighter card surface). */
  level?: 'level1' | 'level2';
  style?: ViewStyle;
};

/** A flat panel surface — radius 12, hairline border, no shadow. */
export function Panel({ children, level = 'level2', style }: PanelProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.surface[level], borderColor: colors.border.default },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
});
