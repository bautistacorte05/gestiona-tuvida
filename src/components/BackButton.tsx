import { router, useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import { Pressable, Text } from 'react-native';

import { useIsDesktop } from '../lib/layout';

/**
 * Flecha de las pantallas de categoría. En el celular abre el menú ☰ (con la categoría actual
 * desplegada) en vez de volver a otra pantalla, igual que el gesto de deslizar desde el borde.
 * En la PC no hace falta: la barra lateral está siempre a la vista.
 *
 * Con `to`, en cambio, lleva a esa pantalla (en celular y PC): para pantallas que no están en el
 * menú y se abren desde otra (ej. Paseo en vivo → vuelve a Paseos).
 */
export default function BackButton({ to }: { to?: string }) {
  const isDesktop = useIsDesktop();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, object | undefined>>>();
  if (isDesktop && !to) return null;
  const onPress = () => (to ? router.navigate(to as never) : navigation.openDrawer());
  return (
    <Pressable onPress={onPress} accessibilityLabel={to ? 'Volver' : 'Abrir menú'} className="mr-1 h-9 w-9 items-center justify-center">
      <Text className="text-xl text-ink-300">‹</Text>
    </Pressable>
  );
}
