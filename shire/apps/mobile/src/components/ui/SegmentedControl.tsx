import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { borderRadius, fontFamily, shadows, useTheme } from '@/theme';

type Option<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Pill-grouped segmented control — track surface, active segment lifts. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surface.level4 }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active
                ? [{ backgroundColor: colors.surface.level1 }, shadows.subtle]
                : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.text.primary : colors.text.muted },
              ]}
            >
              {opt.label}
            </Text>
            {opt.count != null && (
              <Text
                style={[
                  styles.count,
                  { color: active ? colors.text.secondary : colors.text.muted },
                ]}
              >
                {opt.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: borderRadius.sm + 2,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: borderRadius.sm - 1,
  },
  label: {
    fontFamily: fontFamily.sansSemibold,
    fontWeight: '600',
    fontSize: 13,
  },
  count: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
  },
});
