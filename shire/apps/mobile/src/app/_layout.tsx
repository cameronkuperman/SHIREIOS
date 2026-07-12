import '../../global.css';

import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenOrientation from 'expo-screen-orientation';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { queryClient } from '@/services/api/queryClient';
import { setupNetworkListener } from '@/lib/network';
import { validateEnv } from '@/config/env';
import { AuthProvider, PreviewAuthProvider } from '@/features/auth';
import { FloorRealtimeProvider } from '@/features/floor';
import { WaiterRoutingProvider } from '@/features/routing';
import { ThemeProvider } from '@/theme';
import { installHostPreviewTransport, isHostPreviewRuntime } from '@/preview/runtime';

const previewRuntime = isHostPreviewRuntime();
if (previewRuntime) installHostPreviewTransport();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InstrumentSerif_400Regular,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  useEffect(() => {
    if (!previewRuntime) validateEnv();
    if (Platform.OS !== 'web') {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(
        (error) => console.warn('[orientation] landscape lock unavailable:', error),
      );
    }
    const unsubscribe = setupNetworkListener();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // Do not wrap the app in GestureHandlerRootView — it breaks TouchableOpacity on iPad host UI.
  const SessionProvider = previewRuntime ? PreviewAuthProvider : AuthProvider;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ThemeProvider>
            <WaiterRoutingProvider>
              <FloorRealtimeProvider>
                <Stack>
                  <Stack.Screen name="(host)" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="reservation-modal"
                    options={{
                      headerShown: false,
                      presentation: 'fullScreenModal',
                      // Swipe-to-dismiss steals vertical drags from the form ScrollView on iPad.
                      gestureEnabled: false,
                      contentStyle:
                        Platform.OS === 'web' ? { flex: 1, height: '100%' } : { flex: 1 },
                    }}
                  />
                  <Stack.Screen
                    name="settings"
                    options={{
                      headerShown: false,
                      presentation: 'fullScreenModal',
                      // Swipe-to-dismiss steals vertical drags from settings ScrollView on iPad.
                      gestureEnabled: false,
                      contentStyle: { flex: 1 },
                    }}
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
          </ThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
