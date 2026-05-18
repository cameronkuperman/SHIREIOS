import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth';
import { useIsWorkdayActive } from '@/features/workday';
import { borderRadius, fontFamily, spacing, useTheme } from '@/theme';

type RailItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  match: (pathname: string) => boolean;
};

const RAIL_ITEMS: RailItem[] = [
  {
    label: 'Floor',
    icon: 'grid-outline',
    href: '/(host)' as Href,
    match: (pathname) => pathname === '/' || pathname === '/index',
  },
  {
    label: 'Queue',
    icon: 'people-outline',
    href: '/(host)/waitlist' as Href,
    match: (pathname) => pathname.includes('/waitlist'),
  },
  {
    label: 'RSV',
    icon: 'calendar-outline',
    href: '/(host)/reservations' as Href,
    match: (pathname) => pathname.includes('/reservations'),
  },
  {
    label: 'Inbox',
    icon: 'chatbubble-outline',
    href: '/(host)/inbox' as Href,
    match: (pathname) => pathname.includes('/inbox'),
  },
];

export default function HostLayout() {
  const { colors } = useTheme();
  const { isInitializing, isAuthenticated, currentLocation } = useAuth();
  const isWorkdayActive = useIsWorkdayActive(currentLocation?.id ?? null);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const workdayHref = '/workday' as Href;

  if (isInitializing) {
    return (
      <View
        style={[styles.fill, styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }
  if (!currentLocation) {
    return <Redirect href="/(auth)/location" />;
  }
  if (!isWorkdayActive) {
    return <Redirect href={workdayHref} />;
  }

  return (
    <View style={[styles.shell, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.rail,
          {
            backgroundColor: colors.surface.level2,
            borderRightColor: colors.border.default,
            paddingTop: Math.max(insets.top, spacing['2xl']),
            paddingBottom: Math.max(insets.bottom, spacing['2xl']),
          },
        ]}
      >
        <Text style={[styles.brand, { color: colors.accent }]}>S</Text>

        <View style={styles.navItems}>
          {RAIL_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.76}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.navItem,
                  active ? { backgroundColor: colors.accentLight } : null,
                ]}
                onPress={() => router.push(item.href)}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={active ? colors.accent : colors.text.muted}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.navLabel,
                    { color: active ? colors.accent : colors.text.muted },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.76}
          accessibilityRole="button"
          style={[styles.navItem, styles.settings]}
          onPress={() => router.push('/settings' as Href)}
        >
          <Ionicons name="settings-outline" size={22} color={colors.text.muted} />
          <Text style={[styles.navLabel, { color: colors.text.muted }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fill}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  shell: { flex: 1, flexDirection: 'row' },
  rail: {
    width: 80,
    borderRightWidth: 1,
    alignItems: 'center',
  },
  brand: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    marginBottom: spacing.xl,
  },
  navItems: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  navItem: {
    width: 62,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  settings: {
    marginTop: 'auto',
  },
  navLabel: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 11,
    fontWeight: '600',
  },
});
