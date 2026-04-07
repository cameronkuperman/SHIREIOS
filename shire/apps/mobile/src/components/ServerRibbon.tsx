import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyles, spacing, borderRadius, shadows } from '@/theme';
import { useTheme } from '@/theme';
import { GlassSurface } from '@/components/GlassSurface';
import type { WaiterChipData as ServerChipData } from '@/features/routing';

type ServerRibbonProps = {
  servers: ServerChipData[];
  selectedServerId: string | null;
  onSelectServer: (serverId: string | null) => void;
  onEditSections: () => void;
  sectionEditMode: boolean;
  onNextServerLongPress?: () => void;
};

export function ServerRibbon({
  servers,
  selectedServerId,
  onSelectServer,
  onEditSections,
  sectionEditMode,
  onNextServerLongPress,
}: ServerRibbonProps) {
  const { colors, isDark } = useTheme();

  return (
    <GlassSurface intensity={30} borderRadius={borderRadius.xl} style={styles.container}>
      <Text style={[styles.label, { color: colors.text.muted }]}>SERVERS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {servers.map((server) => {
          const isSelected = selectedServerId === server.id;

          return (
            <View key={server.id} style={styles.chipWrapper}>
              {/* NEXT badge above chip */}
              {server.isNext && (
                <Pressable
                  onLongPress={onNextServerLongPress}
                  style={[
                    styles.nextBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(251, 191, 36, 0.20)'
                        : 'rgba(245, 158, 11, 0.12)',
                    },
                  ]}
                >
                  <Text style={[styles.nextBadgeText, { color: '#F59E0B' }]}>NEXT</Text>
                </Pressable>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelectServer(isSelected ? null : server.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'rgba(255, 255, 255, 0.5)',
                    borderColor: isSelected ? server.color : colors.glass.borderSubtle,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.colorDot, { backgroundColor: server.color }]} />
                <Text
                  style={[
                    styles.chipName,
                    { color: colors.text.primary },
                    isSelected && { color: server.color },
                  ]}
                  numberOfLines={1}
                >
                  {server.name}
                </Text>
                <Text style={[styles.chipCount, { color: colors.text.muted }]}>
                  {server.tableCount}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onEditSections}
        style={[
          styles.editButton,
          {
            backgroundColor: sectionEditMode
              ? (isDark ? 'rgba(251, 191, 36, 0.20)' : 'rgba(245, 158, 11, 0.12)')
              : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'),
            borderColor: sectionEditMode ? '#F59E0B' : colors.glass.borderSubtle,
          },
        ]}
      >
        <Ionicons
          name={sectionEditMode ? 'checkmark' : 'pencil'}
          size={16}
          color={sectionEditMode ? '#F59E0B' : colors.text.secondary}
        />
        {sectionEditMode && (
          <Text style={[styles.doneText, { color: '#F59E0B' }]}>Done</Text>
        )}
      </TouchableOpacity>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  label: {
    ...textStyles.sectionLabel,
    marginRight: spacing.md,
  },
  scrollContent: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  chipWrapper: {
    alignItems: 'center',
  },
  nextBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: 4,
  },
  nextBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipName: {
    ...textStyles.captionMedium,
  },
  chipCount: {
    ...textStyles.tiny,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    marginLeft: spacing.sm,
  },
  doneText: {
    ...textStyles.captionMedium,
    fontWeight: '700',
  },
});
