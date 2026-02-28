import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '@/theme';

export default function HostLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      tabBarActiveTintColor={colors.accent}
      tabBarInactiveTintColor={colors.text.muted}
      tabBarStyle={{
        backgroundColor: colors.surface.level1,
        borderTopColor: colors.border.subtle,
      }}
    >
      <NativeTabs.Trigger name="index">
        <Label>Floor Plan</Label>
        <Icon sf="map.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="waitlist">
        <Label>Waitlist</Label>
        <Icon sf="person.2.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="seat">
        <Label>Seat Party</Label>
        <Icon sf="plus.circle.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
