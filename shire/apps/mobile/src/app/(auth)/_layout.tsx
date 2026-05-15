import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  const { isInitializing } = useAuth();

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

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="location" options={{ headerShown: false }} />
    </Stack>
  );
}
