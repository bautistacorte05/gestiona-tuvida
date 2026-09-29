import { Drawer } from 'expo-router/drawer';

import AppDrawerContent from '../../components/AppDrawerContent';
import { useIsDesktop } from '../../lib/layout';

// Riel lateral en vez de la barra de abajo: colapsado no ocupa lugar, se abre
// con el botón ☰ del header (lo agrega expo-router automáticamente) y se
// cierra solo al elegir una sección o tocar afuera. Contenido propio del
// drawer (AppDrawerContent) en vez de la lista default: además de
// Hoy/Mes/Ajustes muestra todas las categorías con acordeón para sus
// subcategorías (reemplaza a la antigua pantalla "Menú"). Swipe apagado a
// propósito para no pisar otros gestos horizontales de la app.
export default function DrawerLayout() {
  // En la PC el menú es la barra lateral fija (AppSidebar): sin encabezado ni botón ☰.
  const isDesktop = useIsDesktop();
  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: !isDesktop,
        headerStyle: { backgroundColor: '#1f1a16' },
        headerShadowVisible: false,
        headerTintColor: '#ede3d3',
        headerTitleStyle: { fontSize: 16, fontWeight: '600' },
        swipeEnabled: false,
        drawerType: 'front',
        drawerStyle: { backgroundColor: '#1f1a16', width: 280 },
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="index" options={{ title: 'Hoy' }} />
      <Drawer.Screen name="mes" options={{ title: 'Mes' }} />
      <Drawer.Screen name="ajustes" options={{ title: 'Ajustes' }} />
    </Drawer>
  );
}
