import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';

import { goToSub } from '../lib/nav';
import NavMenu from './NavMenu';

const SCREEN_FOR: Record<string, string> = { '/': 'index', '/mes': 'mes', '/ajustes': 'ajustes' };

// Menú ☰ del celular: las secciones principales cambian dentro del drawer y las
// subcategorías se abren encima (con su flecha para volver). Siempre cierra el panel.
export default function AppDrawerContent(props: DrawerContentComponentProps) {
  const { navigation } = props;

  const onNavigate = (href: string) => {
    const sub = /^\/c\/([^/]+)\/([^/]+)/.exec(href);
    if (sub) goToSub(sub[1], sub[2]);
    else navigation.navigate(SCREEN_FOR[href] as never);
    navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: '#1f1a16' }}>
      <NavMenu onNavigate={onNavigate} />
    </DrawerContentScrollView>
  );
}
