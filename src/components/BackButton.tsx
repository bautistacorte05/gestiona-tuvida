import { useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import { Pressable, Text } from 'react-native';

import { useIsDesktop } from '../lib/layout';

/**
 * Flecha de las pantallas de categoría. En el celular abre el menú ☰ (con la categoría actual
 * desplegada) en vez de volver a otra pantalla, igual que el gesto de deslizar desde el borde.
 * En la PC no hace falta: la barra lateral está siempre a la vista.
 */
export default function BackButton() {
  const isDesktop = useIsDesktop();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, object | undefined>>>();
  if (isDesktop) return null;
  return (
    <Pressable onPress={() => navigation.openDrawer()} accessibilityLabel="Abrir menú" className="mr-1 h-9 w-9 items-center justify-center">
      <Text className="text-xl text-ink-300">‹</Text>
    </Pressable>
  );
}
