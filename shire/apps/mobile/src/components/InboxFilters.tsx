import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export type InboxFilter = 'all' | 'unread' | 'waitlist' | 'reservations' | 'archived';

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'waitlist', label: 'Waitlist' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'archived', label: 'Archived' },
];

type InboxFiltersProps = {
  value: InboxFilter;
  onChange: (value: InboxFilter) => void;
};

export function InboxFilters({ value, onChange }: InboxFiltersProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FILTERS.map((filter) => {
        const selected = value === filter.key;
        return (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.accentLight : colors.surface.level2,
                borderColor: selected ? colors.accent : colors.glass.borderSubtle,
              },
            ]}
            onPress={() => onChange(filter.key)}
          >
            <Text
              style={[styles.label, { color: selected ? colors.accent : colors.text.secondary }]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    ...textStyles.captionMedium,
  },
});
