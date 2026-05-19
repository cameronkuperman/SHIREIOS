import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/features/auth';
import { useReservationSettings } from '@/features/host/hooks';
import { useTemplates } from '@/features/messaging/hooks';
import { useBlackouts } from '@/features/blackouts/hooks';
import { useWaiters } from '@/features/routing';
import { useWorkdayStore } from '@/features/workday';
import { borderRadius, shadows, spacing, textStyles, useTheme } from '@/theme';

type SettingsRowProps = {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: Href;
  value?: string;
  destructive?: boolean;
  onPress?: () => void;
};

function SettingsRow({ label, sub, icon, href, value, destructive, onPress }: SettingsRowProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const toneColor = destructive ? colors.status.dirty.text : colors.text.secondary;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: destructive ? colors.status.dirty.fill : colors.surface.level1,
          borderColor: destructive ? colors.status.dirty.border : colors.border.subtle,
        },
      ]}
      activeOpacity={0.76}
      onPress={() => {
        if (onPress) {
          onPress();
          return;
        }
        if (href) {
          router.push(href);
        }
      }}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.surface.level2 }]}>
        <Ionicons name={icon} size={20} color={destructive ? colors.status.dirty.text : toneColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: destructive ? colors.status.dirty.text : colors.text.primary }]}>
          {label}
        </Text>
        <Text style={[styles.rowSub, { color: destructive ? colors.status.dirty.text : colors.text.muted }]}>
          {sub}
        </Text>
      </View>
      {value ? <Text style={[styles.rowValue, { color: colors.text.muted }]}>{value}</Text> : null}
      {(href || onPress) && (
        <Ionicons
          name={destructive ? 'warning-outline' : 'chevron-forward'}
          size={18}
          color={destructive ? colors.status.dirty.text : colors.text.muted}
        />
      )}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text.muted }]}>{title}</Text>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

export default function SettingsHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    currentLocation,
    locations,
    selectLocation,
    userSession,
    signOut,
    refetchLocations,
  } = useAuth();
  const endWorkday = useWorkdayStore((state) => state.endWorkday);
  const reservationSettings = useReservationSettings();
  const templates = useTemplates();
  const blackouts = useBlackouts(true);
  const waiters = useWaiters(currentLocation?.id);

  const activeTemplates = (templates.data ?? []).filter((template) => template.active).length;
  const activeBlackouts = (blackouts.data ?? []).filter((blackout) => !blackout.archivedAt).length;
  const bookingSummary = reservationSettings
    ? `${reservationSettings.bookingHorizonDays}d horizon`
    : 'Not loaded';

  const handleEndWorkday = () => {
    Alert.alert('End Workday?', 'This returns the host stand to the start-of-shift screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Workday',
        style: 'destructive',
        onPress: () => {
          endWorkday();
          router.replace('/workday' as Href);
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out?', 'This signs this device out of the host app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void signOut().finally(() => router.replace('/(auth)' as Href));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>
            {currentLocation?.name ?? 'No location selected'}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={refetchLocations}>
          <Ionicons name="refresh-outline" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.profileCard,
            { backgroundColor: colors.surface.level1, borderColor: colors.border.default },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>
              {(currentLocation?.name ?? 'S').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileBody}>
            <Text style={[styles.profileName, { color: colors.text.primary }]}>
              {currentLocation?.name ?? 'Select a location'}
            </Text>
            <Text style={[styles.profileSub, { color: colors.text.muted }]}>
              {userSession?.user?.email ?? 'Unknown host'} -{' '}
              {currentLocation?.timezone ?? 'Timezone unavailable'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.floorShortcut, { backgroundColor: colors.accentLight }]}
            activeOpacity={0.76}
            onPress={() => router.push('/(host)' as Href)}
          >
            <Ionicons name="map-outline" size={18} color={colors.accent} />
            <Text style={[styles.floorShortcutText, { color: colors.accent }]}>Floor</Text>
          </TouchableOpacity>
        </View>

        {locations.length > 1 && (
          <Section title="Locations">
            <View style={styles.locationGrid}>
              {locations.map((location) => {
                const isActive = location.id === currentLocation?.id;
                return (
                  <TouchableOpacity
                    key={location.id}
                    style={[
                      styles.locationChip,
                      {
                        backgroundColor: isActive ? colors.accentLight : colors.surface.level1,
                        borderColor: isActive ? colors.accent : colors.border.subtle,
                      },
                    ]}
                    activeOpacity={0.76}
                    onPress={() => selectLocation(location.id)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.locationChipText,
                        { color: isActive ? colors.accent : colors.text.primary },
                      ]}
                    >
                      {location.name}
                    </Text>
                    {isActive && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        )}

        <Section title="Service Setup">
          <SettingsRow
            label="Floor Builder"
            sub="Tables, rooms, sections, capacities"
            icon="map-outline"
            href="/floor-builder"
            value={currentLocation?.floorId ? 'Configured' : 'Starter'}
          />
          <SettingsRow
            label="Team / Waiters"
            sub="Create and manage the saved service roster"
            icon="people-circle-outline"
            href="/settings/team"
            value={`${waiters.waiters.length} saved`}
          />
          <SettingsRow
            label="Reservation Settings"
            sub="Booking horizon, grace period, lead time"
            icon="options-outline"
            href="/settings/reservation-settings"
            value={bookingSummary}
          />
          <SettingsRow
            label="Blackouts"
            sub="Closed dates and blocked service windows"
            icon="calendar-clear-outline"
            href="/settings/blackouts"
            value={`${activeBlackouts} active`}
          />
        </Section>

        <Section title="Guest Communication">
          <SettingsRow
            label="Message Templates"
            sub="SMS replies for waitlist and reservations"
            icon="chatbubble-ellipses-outline"
            href="/settings/templates"
            value={`${activeTemplates} active`}
          />
          <SettingsRow
            label="Inbox"
            sub="Guest conversations and follow-ups"
            icon="chatbubbles-outline"
            href="/(host)/inbox"
          />
        </Section>

        <Section title="Host Stand">
          <SettingsRow
            label="Queue"
            sub="Waitlist and reservation day book"
            icon="people-outline"
            href="/(host)/waitlist"
          />
          <SettingsRow
            label="End Workday"
            sub="Close the current device session"
            icon="stop-circle-outline"
            onPress={handleEndWorkday}
          />
        </Section>

        <Section title="Account">
          <SettingsRow
            label="Signed In"
            sub={userSession?.user?.email ?? 'Unknown account'}
            icon="person-circle-outline"
            value="Active"
          />
          <SettingsRow
            label="Sign Out"
            sub="Return this device to host login"
            icon="log-out-outline"
            destructive
            onPress={handleSignOut}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    paddingBottom: spacing.md,
  },
  headerText: {
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...textStyles.title,
  },
  subtitle: {
    ...textStyles.caption,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.subtle,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...textStyles.subtitle,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  profileBody: {
    flex: 1,
  },
  profileName: {
    ...textStyles.subtitle,
  },
  profileSub: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  floorShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  floorShortcutText: {
    ...textStyles.captionMedium,
    fontWeight: '800',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...textStyles.sectionLabel,
    paddingHorizontal: spacing.xs,
  },
  sectionRows: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.subtle,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...textStyles.label,
  },
  rowSub: {
    ...textStyles.caption,
    marginTop: 2,
  },
  rowValue: {
    ...textStyles.captionMedium,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  locationChip: {
    maxWidth: '48%',
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationChipText: {
    ...textStyles.captionMedium,
    flex: 1,
    fontWeight: '700',
  },
});
