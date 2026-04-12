import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '@/components/GlassSurface';
import { useAuth } from '@/features/auth';
import { useIsWorkdayActive } from '@/features/workday';
import { borderRadius, spacing, textStyles, useTheme } from '@/theme';

const LOG_TAG = '[LocationSelect]';

export default function LocationSelectScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    isAuthenticated,
    currentLocation,
    locations,
    locationsLoading,
    locationsError,
    locationsErrorMessage,
    selectLocation,
    signOut,
    refetchLocations,
    createLocation,
  } = useAuth();
  const isWorkdayActive = useIsWorkdayActive(currentLocation?.id ?? null);
  const nextHref = (isWorkdayActive ? '/(host)' : '/workday') as Href;

  const [newLocationName, setNewLocationName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (!isAuthenticated) {
    console.log(LOG_TAG, 'Not authenticated, redirecting to auth');
    return <Redirect href="/(auth)" />;
  }

  if (currentLocation && locations.length <= 1) {
    console.log(LOG_TAG, 'Single location auto-selected:', currentLocation.name);
    return <Redirect href={nextHref} />;
  }

  const handleCreateLocation = async () => {
    const name = newLocationName.trim();
    if (!name) return;

    setIsCreating(true);
    setCreateError(null);
    console.log(LOG_TAG, 'Creating location:', name);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const location = await createLocation(name, timezone);
      console.log(LOG_TAG, 'Location created successfully:', location.id, location.name);
      setNewLocationName('');
      selectLocation(location.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create location';
      console.error(LOG_TAG, 'Failed to create location:', message);
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (locationsLoading) {
    console.log(LOG_TAG, 'Loading locations...');
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.statusText, { color: colors.text.secondary }]}>
          Loading locations...
        </Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (locationsError) {
    console.error(LOG_TAG, 'Failed to load locations', locationsErrorMessage);
    return (
      <SafeAreaView style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.text.muted} />
        <Text style={[styles.errorTitle, { color: colors.text.primary }]}>
          Unable to load locations
        </Text>
        <Text style={[styles.statusText, { color: colors.text.secondary }]}>
          {locationsErrorMessage ?? 'Check your connection and try again.'}
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.8}
          onPress={() => {
            console.log(LOG_TAG, 'Retrying locations fetch');
            refetchLocations();
          }}
        >
          <Text style={styles.actionButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.8}
          onPress={() => {
            console.log(LOG_TAG, 'Signing out from error state');
            void signOut();
          }}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text.secondary }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Empty state — no locations, allow creating one
  if (locations.length === 0) {
    console.log(LOG_TAG, 'No locations found, showing create form');
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Get Started</Text>
          <TouchableOpacity onPress={() => void signOut()}>
            <Ionicons name="log-out-outline" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.body, styles.centered]}>
          <Ionicons name="location-outline" size={48} color={colors.text.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
            No locations yet
          </Text>
          <Text style={[styles.statusText, { color: colors.text.secondary }]}>
            Create your first location to start managing your floor.
          </Text>

          <View style={styles.createForm}>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.surface.level1,
                  borderColor: colors.border.default,
                },
              ]}
              placeholder="Location name (e.g. Main Dining)"
              placeholderTextColor={colors.text.muted}
              value={newLocationName}
              onChangeText={setNewLocationName}
              editable={!isCreating}
              autoFocus
            />

            {createError && (
              <Text style={[styles.createErrorText, { color: colors.status.dirty.text }]}>
                {createError}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.accent },
                (!newLocationName.trim() || isCreating) && styles.disabledButton,
              ]}
              activeOpacity={0.8}
              disabled={!newLocationName.trim() || isCreating}
              onPress={() => void handleCreateLocation()}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>Create Location</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Normal state — show location cards
  console.log(LOG_TAG, 'Rendering', locations.length, 'location(s)');
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Choose Location</Text>
        <TouchableOpacity onPress={() => void signOut()}>
          <Ionicons name="log-out-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {locations.map((location) => (
          <TouchableOpacity
            key={location.id}
            activeOpacity={0.8}
            onPress={() => {
              console.log(LOG_TAG, 'Selected location:', location.id, location.name);
              selectLocation(location.id);
            }}
          >
            <GlassSurface
              intensity={40}
              borderRadius={borderRadius.xl}
              style={[
                styles.locationCard,
                currentLocation?.id === location.id && {
                  borderColor: colors.accent,
                  backgroundColor: colors.accentLight,
                },
              ]}
            >
              <View>
                <Text style={[styles.locationName, { color: colors.text.primary }]}>
                  {location.name}
                </Text>
                <Text style={[styles.locationMeta, { color: colors.text.secondary }]}>
                  {location.timezone}
                </Text>
              </View>
              {currentLocation?.id === location.id && (
                <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
              )}
            </GlassSurface>
          </TouchableOpacity>
        ))}

        {currentLocation && (
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.accent }]}
            activeOpacity={0.8}
            onPress={() => {
              console.log(LOG_TAG, 'Continuing to', nextHref, 'for', currentLocation.name);
              router.replace(nextHref);
            }}
          >
            <Text style={styles.continueText}>
              {isWorkdayActive ? 'Continue to Host Stand' : 'Continue to Pre-Shift'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
  },
  title: {
    ...textStyles.title,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  locationCard: {
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationName: {
    ...textStyles.label,
  },
  locationMeta: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  continueButton: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  continueText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
  statusText: {
    ...textStyles.body,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  errorTitle: {
    ...textStyles.subtitle,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    ...textStyles.subtitle,
    marginTop: spacing.lg,
  },
  actionButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    alignItems: 'center',
    marginTop: spacing.lg,
    minWidth: 160,
  },
  actionButtonText: {
    ...textStyles.label,
    color: '#FFFFFF',
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    ...textStyles.body,
  },
  createForm: {
    width: '100%',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  input: {
    ...textStyles.body,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  createErrorText: {
    ...textStyles.caption,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
