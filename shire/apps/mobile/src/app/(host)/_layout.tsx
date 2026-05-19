import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth';
import { useIsWorkdayActive } from '@/features/workday';
import { useTotalUnread } from '@/features/messaging/hooks';
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
    label: 'Stats',
    icon: 'stats-chart-outline',
    href: '/(host)/analytics' as Href,
    match: (pathname) => pathname.includes('/analytics'),
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
];

export default function HostLayout() {
  const { colors } = useTheme();
  const { isInitializing, isAuthenticated, currentLocation } = useAuth();
  const isWorkdayActive = useIsWorkdayActive(currentLocation?.id ?? null);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const workdayHref = '/workday' as Href;
  const unreadCount = useTotalUnread();
  const inboxActive = pathname.includes('/inbox');

  if (isInitializing) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
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
      {/*
        TOUCH CONTRACT — HOST SHELL (do not regress):
        Expo Router screens can paint full-window; without zIndex on the rail and
        overflow:'hidden' on content, the floor map intercepts rail/footer taps.
        Keep rail above content. Do not add GestureHandlerRootView at app root.
      */}
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
                style={[styles.navItem, active ? { backgroundColor: colors.accentLight } : null]}
                onPress={() => router.push(item.href)}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={active ? colors.accent : colors.text.muted}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.navLabel, { color: active ? colors.accent : colors.text.muted }]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.footer} pointerEvents="auto">
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Inbox, ${unreadCount} unread` : 'Inbox'}
            accessibilityState={{ selected: inboxActive }}
            hitSlop={12}
            style={[styles.navItem, inboxActive ? { backgroundColor: colors.accentLight } : null]}
            onPress={() => router.push('/(host)/inbox' as Href)}
          >
            <View>
              <Ionicons
                name="chatbubble-outline"
                size={22}
                color={inboxActive ? colors.accent : colors.text.muted}
              />
              {unreadCount > 0 ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: colors.accent,
                      borderColor: colors.surface.level2,
                    },
                  ]}
                >
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={12}
            style={styles.navItem}
            onPress={() => router.push('/settings' as Href)}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content} pointerEvents="box-none">
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shell: { flex: 1, flexDirection: 'row' },
  // Rail must stay above the floor Slot so inbox/settings/footer taps always land.
  rail: {
    width: 80,
    borderRightWidth: 1,
    alignItems: 'center',
    zIndex: 20,
    elevation: 20,
  },
  // Clip host screens so absolute floor tables cannot spill over the rail.
  content: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 0,
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
  footer: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 30,
    elevation: 30,
  },
  navLabel: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
});
