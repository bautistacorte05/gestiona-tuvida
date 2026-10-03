import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirm, notify } from '../lib/confirm';
import { today } from '../lib/dates';
import { setTaskDone } from '../lib/dayTasks';
import { useDb } from '../lib/db';
import { cancelFocusAlarm, scheduleFocusAlarm } from '../lib/notifications';
import { useThemeColors } from '../lib/theme';
import { formatMinutes } from '../lib/time';

const PRESETS = [15, 25, 45, 60];
const MAX_MINUTES = 180;

/** Mientras corre el temporizador, la pantalla no se apaga (en la PC, si el navegador lo permite). */
function KeepScreenOn() {
  useKeepAwake('focus-timer', { suppressDeactivateWarnings: true });
  return null;
}

/**
 * Aro de progreso hecho con dos mitades recortadas (sin librerías de dibujo): muestra la parte
 * `frac` (0 a 1) del círculo, desde arriba y en el sentido de las agujas del reloj.
 */
function ProgressRing({ size, stroke, frac, color, track }: { size: number; stroke: number; frac: number; color: string; track: string }) {
  const angle = 360 * Math.min(1, Math.max(0, frac));
  const half = size / 2;
  const ring = { position: 'absolute' as const, top: 0, width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: 'transparent' };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[ring, { left: 0, borderColor: track }]} />
      {angle > 0 && (
        // Mitad derecha (de las 12 a las 6).
        <View style={{ position: 'absolute', top: 0, left: half, width: half, height: size, overflow: 'hidden' }}>
          <View style={[ring, { left: -half, borderTopColor: color, borderRightColor: color, transform: [{ rotate: `${45 + Math.min(angle, 180) - 180}deg` }] }]} />
        </View>
      )}
      {angle > 180 && (
        // Mitad izquierda (de las 6 a las 12).
        <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: size, overflow: 'hidden' }}>
          <View style={[ring, { left: 0, borderBottomColor: color, borderLeftColor: color, transform: [{ rotate: `${45 + angle - 360}deg` }] }]} />
        </View>
      )}
    </View>
  );
}

const clock = (ms: number) => {
  const secs = Math.ceil(ms / 1000);
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
};

/**
 * Temporizador de enfoque para una tarea (pantalla completa). La cuenta se hace contra la hora
 * de fin, así sigue bien aunque el celular se bloquee o la app quede en segundo plano.
 * Al terminar: vibra, guarda la tanda (`focusSessions`) y pregunta si tilda la tarea. Si la app no
 * está a la vista, avisa con una notificación (lib/notifications.ts).
 */
export default function FocusTimer({ date, taskKey, title, onClose }: { date: string; taskKey: string; title: string; onClose: () => void }) {
  const c = useThemeColors();
  const { width, height } = useWindowDimensions();
  const [minutes, setMinutes] = useState(25);
  /** Hora de fin (ms) mientras corre; null = parado. */
  const [endAt, setEndAt] = useState<number | null>(null);
  /** Lo que falta cuando está parado. */
  const [leftMs, setLeftMs] = useState(25 * 60000);
  const [now, setNow] = useState(0);
  const [askCustom, setAskCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  // Para no terminar dos veces la misma vuelta (los tics pueden llegar mientras está el cartel).
  const finishedFor = useRef<number | null>(null);

  const sessions = useDb((s) => s.focusSessions);
  const t = today();
  const todayMinutes = useMemo(() => sessions.filter((s) => s.date === t).reduce((sum, s) => sum + s.minutes, 0), [sessions, t]);

  const running = endAt !== null;
  const totalMs = minutes * 60000;
  const left = endAt !== null ? Math.max(0, endAt - now) : leftMs;
  const started = running || leftMs < totalMs;
  const status = running ? 'concentrado…' : started ? 'en pausa' : 'listo para empezar';
  const custom = !PRESETS.includes(minutes);
  const ringSize = Math.max(180, Math.min(280, width - 80, height * 0.4));

  const saveSession = (mins: number) => useDb.getState().addFocusSession({ date: today(), minutes: mins, taskKey, title });

  const finish = async (runEnd: number) => {
    if (finishedFor.current === runEnd) return;
    finishedFor.current = runEnd;
    void cancelFocusAlarm();
    setEndAt(null);
    setLeftMs(0);
    Vibration.vibrate();
    saveSession(minutes);
    if (await confirm('¡Tiempo!', '¿La tarea quedó hecha?', 'Sí, tildarla')) {
      setTaskDone(useDb.getState(), date, taskKey, true);
      onClose();
    } else {
      // Queda listo para otra vuelta.
      setLeftMs(minutes * 60000);
    }
  };

  const onTick = useEffectEvent(() => {
    if (endAt === null) return;
    const n = Date.now();
    if (n >= endAt) void finish(endAt);
    else setNow(n);
  });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => onTick(), 250);
    // Al volver a la app (después de bloquear el celular o cambiar de app) se pone al día enseguida.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') onTick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running]);

  // Al cerrar el temporizador (cortado o tarea terminada) no tiene que quedar un aviso pendiente.
  useEffect(() => () => void cancelFocusAlarm(), []);

  const startOrPause = () => {
    const n = Date.now();
    if (endAt !== null) {
      setLeftMs(Math.max(0, endAt - n));
      setEndAt(null);
      void cancelFocusAlarm();
    } else {
      setNow(n);
      setEndAt(n + leftMs);
      // Aviso para cuando termine, por si el celular está bloqueado o la app quedó atrás.
      void scheduleFocusAlarm(n + leftMs, title);
    }
  };

  const pick = (m: number) => {
    setMinutes(m);
    setLeftMs(m * 60000);
  };

  const applyCustom = () => {
    const n = Number(customText.trim());
    if (!Number.isInteger(n) || n < 1 || n > MAX_MINUTES) {
      notify('Poné cuántos minutos', `Un número entero de 1 a ${MAX_MINUTES}.`);
      return;
    }
    pick(n);
    setAskCustom(false);
    setCustomText('');
  };

  const taskDone = () => {
    const remaining = endAt !== null ? Math.max(0, endAt - Date.now()) : leftMs;
    const mins = Math.round((totalMs - remaining) / 60000);
    if (mins >= 1) saveSession(mins);
    setTaskDone(useDb.getState(), date, taskKey, true);
    onClose();
  };

  const requestClose = async () => {
    if (started && !(await confirm('¿Cortar el temporizador?', 'Lo que llevás de esta vuelta no se guarda.', 'Cortar'))) return;
    onClose();
  };

  return (
    <Modal animationType="slide" visible onRequestClose={() => void requestClose()}>
      {running && <KeepScreenOn />}
      <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 items-center gap-6 px-5 pb-6 pt-2" style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
            <View className="flex-row items-center justify-between self-stretch">
              <Pressable onPress={() => void requestClose()} accessibilityRole="button" accessibilityLabel="Cerrar" className="h-11 w-11 items-center justify-center rounded-xl active:bg-ink-800">
                <Text className="text-xl text-ink-300">✕</Text>
              </Pressable>
              <Text className="text-base font-bold text-ink-100">Enfoque</Text>
              <View className="w-11" />
            </View>

            <View className="items-center">
              <Text className="text-sm text-ink-400">Trabajando en</Text>
              <Text className="mt-1 text-center text-[22px] font-bold text-ink-100" numberOfLines={3}>
                {title}
              </Text>
            </View>

            <View style={{ width: ringSize, height: ringSize }}>
              <ProgressRing size={ringSize} stroke={14} frac={totalMs ? left / totalMs : 0} color={c['shu-500']} track={c['ink-800']} />
              <View className="absolute inset-0 items-center justify-center">
                <Text
                  accessibilityRole="timer"
                  accessibilityLabel={`Faltan ${clock(left)}`}
                  className="font-extrabold text-ink-100"
                  style={{ fontSize: Math.round(ringSize * 0.21), letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
                  {clock(left)}
                </Text>
                <Text className="text-sm text-ink-400">{status}</Text>
              </View>
            </View>

            <View className="items-center gap-3 self-stretch">
              <View className={`flex-row flex-wrap justify-center gap-2 ${started ? 'opacity-40' : ''}`}>
                {PRESETS.map((m) => {
                  const on = m === minutes;
                  return (
                    <Pressable
                      key={m}
                      disabled={started}
                      onPress={() => pick(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on, disabled: started }}
                      className={`h-11 min-w-14 items-center justify-center rounded-full px-3.5 ${on ? 'bg-shu-500' : 'border border-ink-700 bg-ink-900'}`}>
                      <Text className={`text-[15px] font-semibold ${on ? 'text-washi' : 'text-ink-300'}`}>{m} min</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  disabled={started}
                  onPress={() => setAskCustom((a) => !a)}
                  accessibilityRole="button"
                  accessibilityLabel="Otro tiempo"
                  accessibilityState={{ selected: custom, disabled: started }}
                  className={`h-11 min-w-14 items-center justify-center rounded-full px-3.5 ${custom ? 'bg-shu-500' : 'border border-dashed border-ink-600'}`}>
                  <Text className={`text-[15px] font-semibold ${custom ? 'text-washi' : 'text-ink-400'}`}>{custom ? `${minutes} min` : 'Otro'}</Text>
                </Pressable>
              </View>

              {askCustom && !started && (
                <View className="flex-row items-center gap-2">
                  <TextInput
                    className="h-11 w-32 rounded-xl border border-ink-700 bg-ink-900 px-3 text-base text-ink-100"
                    placeholder={`1 a ${MAX_MINUTES} min`}
                    placeholderTextColor={c['ink-500']}
                    keyboardType="number-pad"
                    maxLength={3}
                    value={customText}
                    onChangeText={setCustomText}
                    onSubmitEditing={applyCustom}
                    returnKeyType="done"
                    autoFocus
                    accessibilityLabel="Minutos"
                  />
                  <Pressable onPress={applyCustom} accessibilityRole="button" className="h-11 items-center justify-center rounded-xl bg-shu-500 px-4">
                    <Text className="font-semibold text-washi">Usar</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View className="mt-auto gap-2.5 self-stretch">
              <Pressable onPress={startOrPause} accessibilityRole="button" className="h-14 items-center justify-center rounded-2xl bg-shu-500 active:bg-shu-600">
                <Text className="text-lg font-bold text-washi">{running ? 'Pausar' : started ? 'Seguir' : 'Empezar'}</Text>
              </Pressable>
              <Pressable onPress={taskDone} accessibilityRole="button" className="h-12 items-center justify-center rounded-xl border border-ink-700 active:bg-ink-800">
                <Text className="text-[15px] text-ink-300">Terminé la tarea</Text>
              </Pressable>
              <Text className="text-center text-sm text-ink-500">
                Hoy llevás {formatMinutes(todayMinutes)} de enfoque
              </Text>
              <Text className="text-center text-xs text-ink-500">
                Cuando termine el tiempo te avisa (aunque tengas el celular bloqueado) y te pregunta si la tarea quedó hecha.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
