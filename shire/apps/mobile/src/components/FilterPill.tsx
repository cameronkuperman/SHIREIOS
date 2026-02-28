import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { textStyles, spacing, shadows, borderRadius } from '@/theme';
import { useTheme } from '@/theme';

type FilterPillProps = {
  label: string;
  isActive?: boolean;
  onPress?: () => void;
};

export function FilterPill({ label, isActive = false, onPress }: FilterPillProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <GlassSurface
        intensity={isActive ? 60 : 30}
        borderRadius={borderRadius.pill}
        style={[
          styles.pill,
          isActive && {
            backgroundColor: colors.white,
            borderColor: colors.border.warm,
          },
        ]}
      >
        <Text
          style={[
            styles.pillText,
            { color: colors.text.secondary },
            isActive && { color: colors.text.primary, fontWeight: '600' },
          ]}
        >
          {label}
        </Text>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    ...shadows.glass,
  },
  pillText: {
    ...textStyles.bodyMedium,
  },
});
