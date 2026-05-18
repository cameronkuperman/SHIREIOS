import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth';
import { useIsWorkdayActive } from '@/features/workday';
import { useTheme } from '@/theme';

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
      <View className="flex-1 items-center justify-center bg-shire-background">
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
    <View className="flex-1 flex-row bg-shire-background">
      <View
        className="w-20 border-r border-shire-border bg-shire-surface items-center z-10"
        style={{
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.04,
          shadowRadius: 16,
          elevation: 5,
        }}
      >
        <View className="items-center mb-8">
          <Text className="text-[30px] text-shire-accent font-[Fraunces_600SemiBold]">S</Text>
        </View>

        <View className="w-full items-center gap-1.5">
          {RAIL_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.76}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`w-[60px] py-2.5 rounded-[14px] items-center justify-center gap-1 ${
                  active ? 'bg-shire-accentLight' : ''
                }`}
                onPress={() => router.push(item.href)}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={active ? colors.accent : colors.text.secondary}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  className={`text-[11px] font-[Inter_600SemiBold] ${
                    active ? 'text-shire-accent' : 'text-shire-secondary'
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="mt-auto w-full items-center">
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityRole="button"
            className="w-[60px] py-2.5 rounded-[14px] items-center justify-center gap-1"
            onPress={() => router.push('/settings' as Href)}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text.secondary} />
            <Text className="text-[11px] font-[Inter_600SemiBold] text-shire-secondary">
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1">
        <Slot />
      </View>
    </View>
  );
}