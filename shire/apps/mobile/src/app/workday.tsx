import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '@/components/GlassSurface';
import { ShiftSetupSheet } from '@/components/ShiftSetupSheet';
import { useAuth } from '@/features/auth';
import { resolveFloorId } from '@/features/floor/floorId';
import { floorRealtimeRepository } from '@/features/floor/repository';
import { useFloorStore } from '@/features/floor/store';
import { useIsWorkdayActive, useWorkdayStore } from '@/features/workday';
import { queryKeys } from '@/services/api/queryKeys';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

export default function WorkdayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { isAuthenticated, currentLocation, userSession, signOut } = useAuth();
  const startWorkday = useWorkdayStore((state) => state.startWorkday);
  const applySnapshot = useFloorStore((state) => state.applySnapshot);
  const isWorkdayActive = useIsWorkdayActive(currentLocation?.id ?? null);
  const [isStarting, setIsStarting] = useState(false);
  const [showShiftSetup, setShowShiftSetup] = useState(false);
  const floorId = resolveFloorId(currentLocation?.floorId);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  if (!currentLocation) {
    return <Redirect href="/(auth)/location" />;
  }

  if (isWorkdayActive) {
    return <Redirect href="/(host)" />;
  }

  const hasFloorMap = !!currentLocation.floorId;

  const handleStartWorkday = async () => {
    if (isStarting) {
      return;
    }

    setIsStarting(true);
    try {
      const result = await floorRealtimeRepository.startServiceDay(currentLocation.id, floorId);
      applySnapshot(result.snapshot);
      startWorkday(currentLocation.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bootstrap.location(currentLocation.id),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.waitlist.list(currentLocation.id),
      });
      router.replace('/(host)');
    } catch (error) {
      Alert.alert(
        'Could not start workday',
        error instanceof Error
          ? error.message
          : 'The floor state could not be prepared. Try again before opening the host floor.',
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.text.muted }]}>PRE-SHIFT</Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>Start Workday</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Connect the host stand to live floor state and waitlist updates for {currentLocation.name}.
        </Text>

        <GlassSurface intensity={45} borderRadius={borderRadius['2xl']} style={styles.card}>
          <View style={styles.locationHeader}>
            <View>
              <Text style={[styles.locationName, { color: colors.text.primary }]}>
                {currentLocation.name}
              </Text>
              <Text style={[styles.locationMeta, { color: colors.text.muted }]}>
                {currentLocation.timezone}
              </Text>
            </View>
            <Ionicons name="radio-outline" size={28} color={colors.accent} />
          </View>

          <View style={[styles.detailRow, { borderTopColor: colors.border.subtle }]}>
            <Text style={[styles.detailLabel, { color: colors.text.muted }]}>Signed in as</Text>
            <Text style={[styles.detailValue, { color: colors.text.primary }]}>
              {userSession?.user?.email ?? 'Unknown'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.text.muted }]}>Floor</Text>
            <Text style={[styles.detailValue, { color: colors.text.primary }]}>
              {hasFloorMap ? floorId : 'Not set up yet'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: colors.accent },
              !hasFloorMap && styles.disabledButton,
            ]}
            activeOpacity={0.8}
            onPress={() => void handleStartWorkday()}
            disabled={isStarting || !hasFloorMap}
          >
            {isStarting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="play-circle" size={20} color={colors.white} />
                <Text style={styles.startButtonText}>Start Workday</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mapBuilderButton,
              {
                borderColor: colors.border.default,
                backgroundColor: colors.surface.level2,
              },
            ]}
            activeOpacity={0.8}
            onPress={() => setShowShiftSetup(true)}
          >
            <Ionicons name="people-circle-outline" size={18} color={colors.text.primary} />
            <Text style={[styles.mapBuilderButtonText, { color: colors.text.primary }]}>
              Set Up Shift
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mapBuilderButton,
              {
                borderColor: colors.border.default,
                backgroundColor: colors.surface.level2,
              },
            ]}
            activeOpacity={0.8}
            onPress={() => router.push('/floor-builder')}
          >
            <Ionicons name="construct-outline" size={18} color={colors.text.primary} />
            <Text style={[styles.mapBuilderButtonText, { color: colors.text.primary }]}>
              Build / Edit Floor Map
            </Text>
          </TouchableOpacity>
          <Text style={[styles.helperText, { color: colors.text.muted }]}>
            {hasFloorMap
              ? 'Use this if the imported map is missing, outdated, or you want to lay out tables yourself before service starts.'
              : 'This location has no floor plan yet. Build one before starting the workday.'}
          </Text>
        </GlassSurface>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border.default }]}
            activeOpacity={0.8}
            onPress={() => router.replace('/(auth)/location')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text.primary }]}>
              Change Location
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border.default }]}
            activeOpacity={0.8}
            onPress={() => void signOut()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text.primary }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ShiftSetupSheet visible={showShiftSetup} onClose={() => setShowShiftSetup(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.lg,
  },
  eyebrow: {
    ...textStyles.sectionLabel,
  },
  title: {
    ...textStyles.title,
  },
  subtitle: {
    ...textStyles.body,
    maxWidth: 420,
  },
  card: {
    padding: spacing.xl,
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationName: {
    ...textStyles.subtitle,
  },
  locationMeta: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  detailRow: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  detailLabel: {
    ...textStyles.captionMedium,
    textTransform: 'uppercase',
  },
  detailValue: {
    ...textStyles.body,
  },
  startButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  startButtonText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.4,
  },
  mapBuilderButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mapBuilderButtonText: {
    ...textStyles.label,
  },
  helperText: {
    ...textStyles.caption,
    maxWidth: 420,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...textStyles.label,
  },
});
