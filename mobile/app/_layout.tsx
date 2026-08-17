import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from '../src/auth/AuthContext';
import { colors } from '../src/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Render nothing (splash stays up) until fonts settle one way or the
  // other — RN silently falls back to the system font for an unregistered
  // `fontFamily`, so a font *error* isn't fatal, just cosmetic.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surfaceRaised },
            headerTintColor: colors.textDefault,
            headerTitleStyle: { fontFamily: 'PlusJakartaSans_600SemiBold' },
            contentStyle: { backgroundColor: colors.bgCanvas },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="unlock" options={{ headerShown: false }} />
          <Stack.Screen name="channels/index" options={{ title: 'Channels' }} />
          <Stack.Screen name="channels/[channelId]" options={{ title: '' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
