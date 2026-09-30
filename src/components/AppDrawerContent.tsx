import { usePathname } from 'expo-router';
import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';

import { goToSub } from '../lib/nav';
import { useThemeColors } from '../lib/theme';
import NavMenu from './NavMenu';

const SCREEN_FOR: Record<string, string> = { '/': 'index', '/mes': 'mes', '/ajustes': 'ajustes' };

// Menú ☰ del celular: todas las pantallas (también las categorías) cambian dentro del drawer.
// Siempre cierra el panel. La key reinicia el acordeón al cambiar de pantalla, así al abrir el
// menú desde una categoría aparece esa categoría desplegada.
export default function AppDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const c = useThemeColors();
  const pathname = usePathname();

  const onNavigate = (href: string) => {
    const sub = /^\/c\/([^/]+)\/([^/]+)/.exec(href);
    if (sub) goToSub(sub[1], sub[2]);
    else navigation.navigate(SCREEN_FOR[href] as never);
    navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: c['ink-900'] }}>
      <NavMenu key={pathname} onNavigate={onNavigate} />
    </DrawerContentScrollView>
  );
}
