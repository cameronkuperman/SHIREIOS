import { ActivityIndicator, View } from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAuth } from '@/features/auth';
import { useTotalUnread } from '@/features/messaging/hooks';
import { useIsWorkdayActive } from '@/features/workday';
import { useTheme } from '@/theme';

export default function HostLayout() {
  const { colors } = useTheme();
  const { isInitializing, isAuthenticated, currentLocation } = useAuth();
  const isWorkdayActive = useIsWorkdayActive(currentLocation?.id ?? null);
  const totalUnread = useTotalUnread();
  const workdayHref = '/workday' as Href;

  if (isInitializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
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
    <NativeTabs
      backgroundColor={colors.surface.level1}
      tintColor={colors.accent}
      iconColor={{
        default: colors.text.muted,
        selected: colors.accent,
      }}
      labelStyle={{
        default: {
          color: colors.text.muted,
        },
        selected: {
          color: colors.accent,
          fontWeight: '600',
        },
      }}
    >
      <NativeTabs.Trigger name="index">
        <Label>Floor Plan</Label>
        <Icon sf="map.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="waitlist">
        <Label>Queue</Label>
        <Icon sf="person.2.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="seat">
        <Label>Seat Party</Label>
        <Icon sf="plus.circle.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reservations">
        <Label>Reservations</Label>
        <Icon sf="calendar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox">
        <Label>{totalUnread > 0 ? `Inbox (${totalUnread})` : 'Inbox'}</Label>
        <Icon sf="bubble.left.and.bubble.right.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
