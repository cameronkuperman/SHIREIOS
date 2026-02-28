import '../../global.css';

import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { queryClient } from '@/services/api/queryClient';
import { setupNetworkListener } from '@/lib/network';
import { validateEnv } from '@/config/env';
import { ThemeProvider } from '@/theme';

export default function RootLayout() {
  useEffect(() => {
    validateEnv();
    const unsubscribe = setupNetworkListener();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Stack>
            <Stack.Screen name="(host)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
