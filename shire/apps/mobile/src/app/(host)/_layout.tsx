import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

export default function HostLayout() {
  return (
    <NativeTabs>
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
