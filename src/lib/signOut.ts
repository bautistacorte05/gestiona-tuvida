import { confirm } from './confirm';
import { signOutSafely } from './sync';

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
