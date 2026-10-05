import '../global.css';
// Define la tarea del paseo en segundo plano apenas carga la app (Android puede despertarla solo para eso).
import '../lib/walkTracker';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppSidebar from '../components/AppSidebar';
import { AuthProvider, useAuth } from '../lib/auth';
import { useIsDesktop } from '../lib/layout';
import { startSync, stopSync } from '../lib/sync';
import { applyPageTheme, themeVars, useAccent, useScheme, useThemeColors } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, loading } = useAuth();
  const userId = session?.user.id;
  const isDesktop = useIsDesktop();
  const c = useThemeColors();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (userId) void startSync(userId);
    else stopSync();
  }, [userId]);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c['ink-950'] }}>
      {isDesktop && !!session && <AppSidebar />}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c['ink-950'] } }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      </View>
      {/* En web/PC no hay splash nativo: tapa el login un instante hasta saber si ya había sesión. */}
      {loading && <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c['ink-950'] }} />}
    </View>
  );
}

// Modo oscuro o claro (por dispositivo) y color de la app (de la cuenta): Ajustes → Apariencia; ver lib/theme.ts.
export default function RootLayout() {
  const scheme = useScheme();
  const accent = useAccent();
  const c = useThemeColors();

  useEffect(() => applyPageTheme(scheme, accent), [scheme, accent]);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: c['ink-950'], card: c['ink-900'], border: c['ink-800'], text: c['ink-100'], primary: c['shu-500'] } };
  }, [scheme, c]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Las variables van en un View (no en GestureHandlerRootView): en el celular NativeWind solo
          las lee en sus componentes; ahí se perdían y el texto quedaba negro sobre negro. */}
      <View style={[{ flex: 1 }, themeVars(scheme, accent)]}>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        </ThemeProvider>
      </View>
    </GestureHandlerRootView>
  );
}
