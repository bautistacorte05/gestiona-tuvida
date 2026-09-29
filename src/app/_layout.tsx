import '../global.css';

import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppSidebar from '../components/AppSidebar';
import { AuthProvider, useAuth } from '../lib/auth';
import { useIsDesktop } from '../lib/layout';
import { startSync, stopSync } from '../lib/sync';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, loading } = useAuth();
  const userId = session?.user.id;
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (userId) void startSync(userId);
    else stopSync();
  }, [userId]);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#16120f' }}>
      {isDesktop && !!session && <AppSidebar />}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#16120f' } }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="c/[categoryId]/[subId]" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      </View>
      {/* En web/PC no hay splash nativo: tapa el login un instante hasta saber si ya había sesión. */}
      {loading && <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#16120f' }} />}
    </View>
  );
}

// La app siempre es oscura (paleta "Shu no Michi"), igual que la web.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
