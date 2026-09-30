import { Drawer } from 'expo-router/drawer';

import AppDrawerContent from '../../components/AppDrawerContent';
import { useIsDesktop } from '../../lib/layout';
import { useThemeColors } from '../../lib/theme';

// Menú lateral del celular (en la PC se usa la barra fija AppSidebar). Todas las pantallas
// viven acá adentro, también las de categoría (c/[categoryId]/[subId]), así que el gesto de
// deslizar desde el borde izquierdo y la flecha "‹" (BackButton) abren el menú con la
// categoría actual desplegada, en vez de volver a otra pantalla. Se abre también con el ☰
// del encabezado y se cierra al elegir una sección o tocar afuera.
export default function DrawerLayout() {
  // En la PC el menú es la barra lateral fija (AppSidebar): sin encabezado ni botón ☰.
  const isDesktop = useIsDesktop();
  const c = useThemeColors();
  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: !isDesktop,
        headerStyle: { backgroundColor: c['ink-900'] },
        headerShadowVisible: false,
        headerTintColor: c['ink-100'],
        headerTitleStyle: { fontSize: 16, fontWeight: '600' },
        swipeEnabled: !isDesktop,
        drawerType: 'front',
        drawerStyle: { backgroundColor: c['ink-900'], width: 280 },
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="index" options={{ title: 'Hoy' }} />
      <Drawer.Screen name="mes" options={{ title: 'Mes' }} />
      <Drawer.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      {/* Las categorías tienen su propio título y flecha: sin encabezado del menú. */}
      <Drawer.Screen name="c/[categoryId]/[subId]" options={{ headerShown: false }} />
    </Drawer>
  );
}
