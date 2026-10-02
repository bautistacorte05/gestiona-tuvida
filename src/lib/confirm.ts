import { Alert, Platform } from 'react-native';

/**
 * Pregunta "¿Seguro?" antes de algo que no se puede deshacer, en el celular y en la PC.
 * En web (PC) `Alert.alert` no hace nada (react-native-web no lo implementa): ahí se usa el
 * cartel del navegador. Devuelve true si se eligió `action`.
 */
export function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
