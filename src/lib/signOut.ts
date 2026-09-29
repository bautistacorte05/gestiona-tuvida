import { Alert, Platform } from 'react-native';

import { signOutSafely } from './sync';

function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Cierra sesión subiendo antes lo pendiente; si algo no se pudo subir, pregunta antes de perderlo. */
export async function signOutWithConfirm() {
  const { unsynced } = await signOutSafely();
  if (unsynced === 0) return;
  const ok = await confirm(
    'Hay cambios sin subir',
    `${unsynced} cambios todavía no se subieron a tu cuenta (probablemente no hay conexión). Si cerrás sesión ahora se pierden.`,
    'Cerrar igual',
  );
  if (ok) await signOutSafely(true);
}
