import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useIsDesktop } from '../lib/layout';

/** Flecha para volver de una pantalla de categoría. En la PC no hace falta: la barra lateral está siempre a la vista. */
export default function BackButton() {
  const isDesktop = useIsDesktop();
  if (isDesktop) return null;
  return (
    <Pressable onPress={() => router.back()} accessibilityLabel="Volver" className="mr-1 h-9 w-9 items-center justify-center">
      <Text className="text-xl text-ink-300">‹</Text>
    </Pressable>
  );
}
