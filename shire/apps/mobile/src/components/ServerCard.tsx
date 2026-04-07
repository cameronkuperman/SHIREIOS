import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { textStyles, spacing, borderRadius, shadows } from '@/theme';
import { useTheme } from '@/theme';

export type ServerStatus = 'available' | 'busy' | 'on_break';

export type ServerData = {
  id: string;
  name: string;
  status: ServerStatus;
  sections: string[];
  liveTables: number;
  skills?: string[];
  servedSeatingCount?: number;
  isTemporary?: boolean;
  isNext?: boolean;
};

type ServerCardProps = {
  server: ServerData;
  isSelected?: boolean;
  onPress?: () => void;
};

export function ServerCard({ server, isSelected, onPress }: ServerCardProps) {
  const { colors } = useTheme();

  const statusColor =
    server.status === 'available'
      ? colors.status.available.text
      : server.status === 'busy'
        ? colors.status.occupied.text
        : colors.status.reserved.text;

  const statusLabel =
    server.status === 'available'
      ? 'Available'
      : server.status === 'busy'
        ? 'Busy'
        : 'On Break';
  const sectionsLabel =
    server.sections.length > 0 ? server.sections.join(', ') : 'No sections assigned';
  const skillBadges = [
    ...(server.isTemporary ? ['Temp'] : []),
    ...(server.isNext ? ['Next Up'] : []),
    ...(server.skills ?? []),
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface.level1,
          borderColor: isSelected ? colors.accent : colors.glass.border,
        },
        isSelected && { backgroundColor: colors.accentLight },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.name, { color: colors.text.primary }]}>{server.name}</Text>
        </View>
        <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: colors.text.secondary }]}>
          {sectionsLabel} | {server.liveTables} live
        </Text>
        <Text style={[styles.meta, { color: colors.text.muted }]}>
          {server.servedSeatingCount ?? 0} seated this shift
        </Text>
      </View>

      {skillBadges.length > 0 && (
        <View style={styles.skillsRow}>
          {skillBadges.map((skill) => (
            <View
              key={skill}
              style={[styles.skillBadge, { backgroundColor: colors.surface.level3 }]}
            >
              <Text style={[styles.skillText, { color: colors.text.muted }]}>{skill}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    ...shadows.subtle,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    ...textStyles.label,
  },
  statusLabel: {
    ...textStyles.captionMedium,
  },
  metaRow: {
    marginBottom: spacing.sm,
  },
  meta: {
    ...textStyles.caption,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  skillText: {
    ...textStyles.tiny,
    fontWeight: '500',
  },
});
