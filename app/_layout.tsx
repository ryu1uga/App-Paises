import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { warmUpGlobeTextures } from '@/globe/earthTexture';
import { palette } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync(palette.void);

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  React.useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  // Genera las texturas del globo mientras se muestra el splash, para que la
  // primera pantalla con globo no pague los ~50 ms de construcción.
  React.useEffect(() => {
    const id = setTimeout(warmUpGlobeTextures, 0);
    return () => clearTimeout(id);
  }, []);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.void }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.void },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="profile" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="country/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="game/setup" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="game/play" />
          <Stack.Screen name="game/locate" />
          <Stack.Screen name="game/results" options={{ animation: 'fade' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
