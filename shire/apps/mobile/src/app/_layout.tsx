import '../../global.css';

import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { queryClient } from '@/services/api/queryClient';
import { setupNetworkListener } from '@/lib/network';
import { validateEnv } from '@/config/env';
import { AuthProvider } from '@/features/auth';
import { FloorRealtimeProvider } from '@/features/floor';
import { WaiterRoutingProvider } from '@/features/routing';
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
          <AuthProvider>
            <WaiterRoutingProvider>
              <FloorRealtimeProvider>
                <Stack>
                  <Stack.Screen name="(host)" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="reservation-modal"
                    options={{ headerShown: false, presentation: 'fullScreenModal' }}
                  />
                  <Stack.Screen name="workday" options={{ headerShown: false }} />
                  <Stack.Screen name="shift" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="floor-builder"
                    options={{ headerShown: false, presentation: 'fullScreenModal' }}
                  />
                </Stack>
              </FloorRealtimeProvider>
            </WaiterRoutingProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
