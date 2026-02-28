import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { textStyles, spacing, shadows, borderRadius } from '@/theme';
import { useTheme } from '@/theme';

export type WaitlistParty = {
  name: string;
  size: number;
  wait: string;
  status: 'Waiting' | 'Next' | 'Notified' | 'Seated';
};

type WaitlistCardProps = {
  party: WaitlistParty;
  index: number;
  onPress?: () => void;
  isSelected?: boolean;
};

export function WaitlistCard({ party, index, onPress, isSelected }: WaitlistCardProps) {
  const { colors } = useTheme();

  const statusColor =
    party.status === 'Next'
      ? colors.status.available.text
      : party.status === 'Notified'
        ? colors.status.occupied.text
        : colors.status.reserved.text;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface.level1,
          borderColor: colors.glass.border,
        },
        isSelected && {
          borderColor: colors.accent,
          backgroundColor: colors.accentLight,
        },
      ]}
    >
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text.primary }]}>
          {index + 1}. {party.name}
        </Text>
        <Text style={[styles.details, { color: colors.text.secondary }]}>
          {party.wait} • Party of {party.size}
        </Text>
      </View>
      <View style={styles.statusContainer}>
        <Text style={[styles.status, { color: statusColor }]}>{party.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    ...shadows.subtle,
  },
  info: {
    flex: 1,
  },
  name: {
    ...textStyles.label,
    marginBottom: spacing.xs,
  },
  details: {
    ...textStyles.caption,
  },
  statusContainer: {
    paddingLeft: spacing.md,
  },
  status: {
    ...textStyles.captionMedium,
  },
});
