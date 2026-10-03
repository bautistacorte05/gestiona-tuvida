import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Con la app abierta, los avisos del paseo se muestran como cartel arriba. El del temporizador
// no: si la app está a la vista, la propia pantalla del temporizador ya vibra y pregunta.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const focus = n.request.content.data?.kind === 'focus';
    return { shouldShowBanner: !focus, shouldShowList: !focus, shouldPlaySound: false, shouldSetBadge: false };
  },
});

const FOCUS_ID = 'focus-timer-end';
let webTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Deja programado el aviso de fin del temporizador de enfoque, para que llegue aunque el celular
 * esté bloqueado o la app en segundo plano (en la PC: con la ventana minimizada o tapada).
 * Si no hay permiso para avisar, no pasa nada: al volver a la app igual vibra y pregunta.
 */
export async function scheduleFocusAlarm(endAt: number, taskTitle: string) {
  await cancelFocusAlarm();
  const title = '⏱ ¡Tiempo!';
  const body = `Terminó tu rato de enfoque en "${taskTitle}". Entrá para tildar la tarea.`;

  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    webTimer = setTimeout(() => {
      webTimer = undefined;
      if (document.visibilityState === 'hidden' || !document.hasFocus()) new Notification(title, { body });
    }, Math.max(0, endAt - Date.now()));
    return;
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: FOCUS_ID,
      content: { title, body, sound: true, data: { kind: 'focus' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endAt },
    });
  } catch {
    // Sin aviso programado: el temporizador sigue funcionando igual.
  }
}

/** Saca el aviso programado (pausa, cierre, o terminó con la app a la vista). */
export async function cancelFocusAlarm() {
  if (webTimer) {
    clearTimeout(webTimer);
    webTimer = undefined;
  }
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(FOCUS_ID);
  } catch {
    // No había nada programado.
  }
}
