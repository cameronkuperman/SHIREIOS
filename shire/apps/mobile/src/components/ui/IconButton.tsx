import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { borderRadius, useTheme } from '@/theme';

type IconButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  /** A filled square (surface) vs. a bare icon. */
  filled?: boolean;
  size?: number;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/** 32×32 icon button — radius 8. */
export function IconButton({
  children,
  onPress,
  filled,
  size = 32,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        filled
          ? { backgroundColor: colors.surface.level1, borderWidth: 1, borderColor: colors.border.default }
          : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
