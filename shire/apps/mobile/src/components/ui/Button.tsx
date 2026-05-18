import React from 'react';
import { Pressable, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { borderRadius, fontFamily, shadows, useTheme } from '@/theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'success'
  | 'warning'
  | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

// SHIRE-FRONTEND Button sizes: sm px12/py6/12pt, md px16/py8/14pt, lg px24/py12/16pt.
const SIZES: Record<ButtonSize, { padH: number; padV: number; font: number }> = {
  sm: { padH: 12, padV: 7, font: 12 },
  md: { padH: 16, padV: 9, font: 14 },
  lg: { padH: 24, padV: 13, font: 16 },
};

// Solid design-system colors (SHIRE-FRONTEND --accent-*).
const SOLID = {
  green: '#4BA05A',
  yellow: '#BE9B28',
  red: '#BE5555',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  fullWidth,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const s = SIZES[size];

  let bg = colors.accent;
  let fg = colors.white;
  let borderColor = 'transparent';
  let elevated = true;

  switch (variant) {
    case 'secondary':
      bg = colors.surface.level1;
      fg = colors.text.secondary;
      borderColor = colors.border.default;
      elevated = false;
      break;
    case 'ghost':
      bg = 'transparent';
      fg = colors.text.secondary;
      elevated = false;
      break;
    case 'success':
      bg = SOLID.green;
      break;
    case 'warning':
      bg = SOLID.yellow;
      fg = colors.text.primary;
      break;
    case 'danger':
      bg = SOLID.red;
      break;
    default:
      break;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          paddingHorizontal: s.padH,
          paddingVertical: s.padV,
          backgroundColor: bg,
          borderColor,
          borderWidth: borderColor === 'transparent' ? 0 : 1,
        },
        elevated && !disabled ? shadows.subtle : null,
        fullWidth ? styles.fullWidth : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label as TextStyle, { color: fg, fontSize: s.font }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: borderRadius.sm, // 8
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontFamily: fontFamily.sansSemibold,
    fontWeight: '600',
  },
});
