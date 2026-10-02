import { Alert, Platform } from 'react-native';

// En web (PC) `Alert.alert` no hace nada (react-native-web no lo implementa): ahí se usan los
// carteles del navegador. Usar siempre estas funciones en vez de Alert.alert.

/** Pregunta "¿Seguro?" antes de algo que no se puede deshacer. Devuelve true si se eligió `action`. */
export function confirm(title: string, message: string | undefined, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: 'destructive', onPress: () => resolve(true) },
      ],
      // Android: cerrar el cartel tocando afuera o con "atrás" cuenta como Cancelar.
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

/** Aviso con un solo botón (ej. "Falta un dato"). */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
