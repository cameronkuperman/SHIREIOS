import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, borderRadius, shadows } from '@/theme';
import { useTheme } from '@/theme';

export type SeatingPref = 'window' | 'bar' | 'booth' | 'patio' | 'none';

const PREFS: { key: SeatingPref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'window', label: 'Window', icon: 'sunny-outline' },
  { key: 'bar', label: 'Bar', icon: 'wine-outline' },
  { key: 'booth', label: 'Booth', icon: 'tablet-landscape-outline' },
  { key: 'patio', label: 'Patio', icon: 'leaf-outline' },
  { key: 'none', label: 'No Pref', icon: 'remove-outline' },
];

type SeatingPreferencePickerProps = {
  value: SeatingPref;
  onChange: (pref: SeatingPref) => void;
};

export function SeatingPreferencePicker({ value, onChange }: SeatingPreferencePickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {PREFS.map((pref) => {
        const isActive = value === pref.key;
        return (
          <TouchableOpacity
            key={pref.key}
            activeOpacity={0.7}
            onPress={() => onChange(pref.key)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.accentLight : colors.surface.level2,
                borderColor: isActive ? colors.accent : colors.glass.borderSubtle,
              },
            ]}
          >
            <Ionicons
              name={pref.icon}
              size={16}
              color={isActive ? colors.accent : colors.text.muted}
            />
            <Text
              style={[
                styles.chipText,
                { color: isActive ? colors.accent : colors.text.secondary },
              ]}
            >
              {pref.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function seatingPrefIcon(pref: SeatingPref): keyof typeof Ionicons.glyphMap {
  return PREFS.find((p) => p.key === pref)?.icon ?? 'remove-outline';
}

export function seatingPrefLabel(pref: SeatingPref): string {
  return PREFS.find((p) => p.key === pref)?.label ?? 'None';
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  chipText: {
    ...textStyles.captionMedium,
  },
});
