import { Pressable, Text } from 'react-native';

import { confirm } from '../lib/confirm';

/**
 * 🗑️ para borrar algo mal cargado sin abrir el formulario. Pregunta antes ("¿Borrar …?").
 * `what` arma la pregunta y la etiqueta accesible (ej. "el partido del 26 de septiembre").
 */
export default function TrashButton({ what, detail, onDelete }: { what: string; detail?: string; onDelete: () => void }) {
  const press = async () => {
    if (await confirm(`¿Borrar ${what}?`, detail ?? 'No se puede deshacer.', 'Borrar')) onDelete();
  };
  return (
    <Pressable onPress={press} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Borrar ${what}`} className="h-11 w-11 items-center justify-center rounded-lg active:bg-ink-800">
      <Text className="text-base opacity-60">🗑️</Text>
    </Pressable>
  );
}
