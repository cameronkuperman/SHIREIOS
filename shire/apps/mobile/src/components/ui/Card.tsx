import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { borderRadius, shadows, spacing, useTheme } from '@/theme';

type CardProps = {
  children: React.ReactNode;
  selected?: boolean;
  padded?: boolean;
  style?: ViewStyle;
};

/** Elevated content card — radius 8, p16, hairline border, card shadow. */
export function Card({ children, selected, padded = true, style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface.level1,
          borderColor: selected ? colors.accent : colors.border.default,
          borderWidth: selected ? 1.5 : 1,
        },
        shadows.subtle,
        padded ? styles.padded : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.sm,
  },
  padded: {
    padding: spacing.lg,
  },
});
