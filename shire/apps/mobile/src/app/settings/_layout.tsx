import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { flex: 1 },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="blackouts/index" />
      <Stack.Screen name="blackouts/new" />
      <Stack.Screen name="blackouts/[id]" />
      <Stack.Screen name="templates/index" />
      <Stack.Screen name="templates/new" />
      <Stack.Screen name="templates/[id]" />
      <Stack.Screen name="reservation-settings/index" />
      <Stack.Screen name="team/index" />
    </Stack>
  );
}
