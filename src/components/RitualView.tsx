import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GRATITUDE_COUNT, GRATITUDE_PLACEHOLDERS, RITUAL_MINUTES, RITUAL_STEPS, RITUAL_WORDS, type RitualStepId } from '../config/ritual';
import { notify } from '../lib/confirm';
import { weekdayDayMonth } from '../lib/dateLabels';
import { today } from '../lib/dates';
import { useDb, type RitualDay } from '../lib/db';
import { useIsDesktop } from '../lib/layout';
import { answersOf, doneStepIds, enabledSteps, putFirst, ritualStreak, streakLabel, togglePaso, type RitualAnswers } from '../lib/ritual';
import { useThemeColors } from '../lib/theme';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

const INPUT = 'h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100';
/** Lo que se escribe se guarda solo, un ratito después de dejar de tipear. */
const SAVE_DELAY_MS = 500;

/** Ritual de la mañana: siempre el de hoy. */
export default function RitualView() {
  const date = today();
  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      {/* La key arranca de cero si la pantalla quedó abierta de un día para el otro. */}
      <RitualScreen key={date} date={date} />
    </SafeAreaView>
  );
}

/**
 * "Terminé el ritual": marca el día como hecho (si ya estaba, conserva la hora), limpia los
 * espacios de lo escrito y pasa "Lo más importante" a las tareas de hoy. La primera vez crea la
 * tarea y la pone primera en el orden del día; después solo le actualiza el título si se cambió
 * (respeta el orden que haya elegido). Si la tarea se borró, la vuelve a crear.
 */
function completeRitual(date: string, focus: string) {
  const db = useDb.getState();
  const current = db.rituals.find((r) => r.id === date);
  let focusTaskId = current?.focusTaskId;
  let addedTask = false;
  if (focus) {
    const existing = focusTaskId ? db.dayTasks.find((t) => t.id === focusTaskId) : undefined;
    if (existing) {
      if (existing.title !== focus) db.updateDayTask(existing.id, { title: focus });
    } else {
      focusTaskId = db.addDayTask(date, focus);
      db.setDayOrder(date, putFirst(useDb.getState().dayOrders.find((o) => o.id === date)?.keys, `day:${focusTaskId}`));
      addedTask = true;
    }
  }
  db.saveRitual(date, {
    doneAt: current?.doneAt ?? Date.now(),
    focusTaskId,
    gratitude: current?.gratitude?.map((g) => g.trim()),
    word: current?.word?.trim(),
    focus: current?.focus?.trim(),
  });
  return { addedTask };
}

/** Guarda lo que cambió (`draft`) encima de lo guardado, y recalcula los pasos hechos. */
function saveDraft(date: string, draft: Partial<RitualAnswers>) {
  const db = useDb.getState();
  const merged = { ...answersOf(db.rituals.find((r) => r.id === date), GRATITUDE_COUNT), ...draft };
  const patch: Partial<Omit<RitualDay, 'id' | 'updatedAt'>> = { steps: doneStepIds(merged) };
  // El texto se guarda tal cual (con espacios): si se recortara mientras escribe, se le comería
  // el espacio entre palabras. Se limpia al terminar el ritual.
  if (draft.gratitude) patch.gratitude = draft.gratitude;
  if (draft.word !== undefined) patch.word = draft.word;
  if (draft.focus !== undefined) patch.focus = draft.focus;
  db.saveRitual(date, patch);
}

function RitualScreen({ date }: { date: string }) {
  const c = useThemeColors();
  const ritual = useDb((s) => s.rituals.find((r) => r.id === date));
  const rituals = useDb((s) => s.rituals);
  const pasos = useDb((s) => s.userProfile[0]?.ritualPasos);
  const steps = useMemo(() => enabledSteps(pasos), [pasos]);
  const streak = useMemo(() => ritualStreak(rituals, date), [rituals, date]);

  // Lo que se ve = lo guardado + lo que está cambiando y todavía no se guardó (`draft`). Así, si
  // los datos llegan después (al abrir la app o desde el otro dispositivo), aparecen solos.
  const stored = useMemo(() => answersOf(ritual, GRATITUDE_COUNT), [ritual]);
  const [draft, setDraft] = useState<Partial<RitualAnswers>>({});
  const answers: RitualAnswers = { ...stored, ...draft };
  const [otherOpen, setOtherOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stepsSheet, setStepsSheet] = useState(false);

  // Guardado: lo escrito espera un ratito (no se guarda en cada letra); los toques, enseguida.
  const draftRef = useRef<Partial<RitualAnswers>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const d = draftRef.current;
    if (!Object.keys(d).length) return;
    draftRef.current = {};
    saveDraft(date, d);
    setDraft({});
  }, [date]);
  // Al salir de la pantalla, guardar lo último que se escribió.
  useEffect(() => flush, [flush]);

  const update = (patch: Partial<RitualAnswers>, now: boolean) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
    if (now) flush();
    else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    }
  };

  const enabledIds = steps.map((s) => s.id);
  const doneIds = doneStepIds(answers).filter((id) => enabledIds.includes(id));
  const doneCount = doneIds.length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const wasDone = !!ritual?.doneAt;

  // "Otra" palabra: abierta si la tocó o si la palabra guardada no es una de las sugeridas.
  const showOther = otherOpen || (!!answers.word && !RITUAL_WORDS.includes(answers.word));
  const pickWord = (w: string) => {
    setOtherOpen(false);
    update({ word: !showOther && answers.word === w ? '' : w }, true);
  };
  const toggleOther = () => {
    if (showOther) {
      setOtherOpen(false);
      update({ word: '' }, true);
    } else {
      setOtherOpen(true);
      if (answers.word) update({ word: '' }, true);
    }
  };

  const finish = () => {
    if (!doneCount) {
      notify('Todavía no hiciste ningún paso', 'Hacé al menos uno y después tocá "Terminé el ritual".');
      return;
    }
    flush();
    const focus = enabledIds.includes('importante') ? answers.focus.trim() : '';
    const { addedTask } = completeRitual(date, focus);
    setEditing(false);
    // Si estaba editando un ritual ya terminado, solo se guarda: no hace falta festejar de nuevo.
    if (wasDone) return;
    const n = ritualStreak(useDb.getState().rituals, date);
    const lines = [n > 1 ? `Ya llevás ${streakLabel(n)} 🔥` : 'Arrancaste tu racha 🔥 ¡Mañana seguimos!'];
    if (addedTask) lines.push(`"${focus}" quedó primera en tus tareas de hoy.`);
    notify('¡Listo!', lines.join('\n\n'));
    router.navigate('/');
  };

  return (
    <>
      <ScrollView
        className="flex-1 px-4"
        contentContainerClassName="w-full max-w-2xl self-center gap-4 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="ritual" subId="manana" />
        </View>

        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-sm text-ink-400">
            {weekdayDayMonth(date)} · unos {RITUAL_MINUTES} minutos
          </Text>
          {streak > 0 && (
            <View className="rounded-full bg-shu-500/15 px-2.5 py-1">
              <Text className="text-[13px] font-bold text-shu-300">🔥 {streakLabel(streak)}</Text>
            </View>
          )}
        </View>

        {wasDone && !editing ? (
          <DoneSummary answers={answers} enabledIds={enabledIds} onEdit={() => setEditing(true)} />
        ) : (
          <>
            <View className="gap-1.5">
              <View className="flex-row justify-between">
                <Text className="text-[13px] text-ink-300">
                  {doneCount} de {steps.length} {steps.length === 1 ? 'paso' : 'pasos'}
                </Text>
                <Text className="text-[13px] font-bold text-shu-400">{pct}%</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-ink-800">
                <View className="h-full rounded-full bg-shu-500" style={{ width: `${pct}%` }} />
              </View>
            </View>

            {steps.map((step, i) => {
              const done = doneIds.includes(step.id);
              const common = { n: i + 1, done, title: step.title, hint: step.hint };
              if (step.id === 'agua') {
                return (
                  <StepCard
                    key={step.id}
                    {...common}
                    right={
                      <Pressable
                        onPress={() => update({ agua: !answers.agua }, true)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: answers.agua }}
                        accessibilityLabel={answers.agua ? 'Agua: hecho. Tocá para desmarcar' : 'Marcar el vaso de agua como hecho'}
                        className={`h-11 items-center justify-center rounded-xl px-3.5 ${answers.agua ? 'bg-shu-500' : 'border border-ink-700'}`}>
                        <Text className={`text-sm font-semibold ${answers.agua ? 'text-washi' : 'text-ink-300'}`}>{answers.agua ? 'Hecho' : 'Listo'}</Text>
                      </Pressable>
                    }
                  />
                );
              }
              if (step.id === 'agradecer') {
                return (
                  <StepCard key={step.id} {...common}>
                    {answers.gratitude.map((g, gi) => (
                      <View key={gi} className="gap-1">
                        <Text className="text-xs text-ink-400">{gi + 1}</Text>
                        <TextInput
                          className={INPUT}
                          value={g}
                          onChangeText={(v) => update({ gratitude: answers.gratitude.map((x, xi) => (xi === gi ? v : x)) }, false)}
                          onBlur={flush}
                          placeholder={GRATITUDE_PLACEHOLDERS[gi]}
                          placeholderTextColor={c['ink-500']}
                          accessibilityLabel={`Cosa que agradecés, número ${gi + 1}`}
                        />
                      </View>
                    ))}
                  </StepCard>
                );
              }
              if (step.id === 'palabra') {
                return (
                  <StepCard key={step.id} {...common}>
                    <View className="flex-row flex-wrap gap-2">
                      {RITUAL_WORDS.map((w) => {
                        const on = !showOther && answers.word === w;
                        return (
                          <Pressable
                            key={w}
                            onPress={() => pickWord(w)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            className={`h-11 justify-center rounded-full px-3.5 ${on ? 'bg-shu-500' : 'border border-ink-700 bg-ink-800'}`}>
                            <Text className={`text-sm font-semibold ${on ? 'text-washi' : 'text-ink-300'}`}>{w}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={toggleOther}
                        accessibilityRole="button"
                        accessibilityState={{ selected: showOther }}
                        accessibilityLabel="Otra palabra: escribir la tuya"
                        className={`h-11 justify-center rounded-full px-3.5 ${showOther ? 'bg-shu-500' : 'border border-dashed border-ink-600'}`}>
                        <Text className={`text-sm font-semibold ${showOther ? 'text-washi' : 'text-ink-400'}`}>+ Otra</Text>
                      </Pressable>
                    </View>
                    {showOther && (
                      <TextInput
                        className={INPUT}
                        value={answers.word}
                        onChangeText={(v) => update({ word: v }, false)}
                        onBlur={flush}
                        placeholder="Escribí tu palabra"
                        placeholderTextColor={c['ink-500']}
                        maxLength={24}
                        // Solo al tocar "Otra" (si ya estaba escrita, no abrir el teclado al entrar).
                        autoFocus={otherOpen}
                        accessibilityLabel="Tu palabra guía"
                      />
                    )}
                  </StepCard>
                );
              }
              return (
                <StepCard key={step.id} {...common}>
                  <TextInput
                    className={INPUT}
                    value={answers.focus}
                    onChangeText={(v) => update({ focus: v }, false)}
                    onBlur={flush}
                    placeholder="Ej: mandar el presupuesto"
                    placeholderTextColor={c['ink-500']}
                    accessibilityLabel="Lo más importante de hoy"
                  />
                </StepCard>
              );
            })}

            <Pressable onPress={finish} accessibilityRole="button" className="h-[54px] items-center justify-center rounded-2xl bg-shu-500 active:opacity-80">
              <Text className="text-[17px] font-bold text-washi">{wasDone ? 'Guardar cambios' : 'Terminé el ritual'}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => setStepsSheet(true)} accessibilityRole="button" className="h-11 items-center justify-center self-center px-3">
          <Text className="text-sm text-ink-400">Cambiar los pasos del ritual</Text>
        </Pressable>
      </ScrollView>

      {stepsSheet && <StepsSheet onClose={() => setStepsSheet(false)} />}
    </>
  );
}

/** Tarjeta de un paso: hecha = borde y fondo del color de la app con ✓; pendiente = número. */
function StepCard({ n, done, title, hint, right, children }: { n: number; done: boolean; title: string; hint: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <View className={`gap-2.5 rounded-2xl border px-4 py-3.5 ${done ? 'border-shu-500/40 bg-shu-500/10' : 'border-ink-800 bg-ink-900'}`}>
      <View className="flex-row items-center gap-3">
        <View
          className={`h-8 w-8 items-center justify-center rounded-full ${done ? 'bg-shu-500' : 'bg-ink-800'}`}
          accessible
          accessibilityLabel={done ? `Paso ${n}: hecho` : `Paso ${n}: pendiente`}>
          <Text className={`text-sm font-extrabold ${done ? 'text-washi' : 'text-ink-300'}`}>{done ? '✓' : n}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink-100">{title}</Text>
          <Text className="text-[13px] text-ink-400">{hint}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Ritual de hoy ya terminado: lo que respondió, tranquilo, con "Editar". */
function DoneSummary({ answers, enabledIds, onEdit }: { answers: RitualAnswers; enabledIds: RitualStepId[]; onEdit: () => void }) {
  const gratitude = answers.gratitude.map((g) => g.trim()).filter(Boolean);
  const rows: { id: RitualStepId; icon: string; label: string; value: string }[] = [];
  if (enabledIds.includes('agua') && answers.agua) rows.push({ id: 'agua', icon: '💧', label: 'Agua', value: 'Tomaste tu vaso de agua' });
  if (enabledIds.includes('agradecer') && gratitude.length) rows.push({ id: 'agradecer', icon: '🙏', label: 'Agradeciste', value: gratitude.join(' · ') });
  if (enabledIds.includes('palabra') && answers.word.trim()) rows.push({ id: 'palabra', icon: '🧭', label: 'Tu palabra guía', value: answers.word.trim() });
  if (enabledIds.includes('importante') && answers.focus.trim()) rows.push({ id: 'importante', icon: '⭐', label: 'Lo más importante', value: answers.focus.trim() });

  return (
    <View className="gap-4 rounded-2xl border border-shu-500/40 bg-shu-500/10 p-4">
      <View className="gap-0.5">
        <Text className="text-[17px] font-bold text-ink-100">
          Ya hiciste tu ritual de hoy <Text className="text-shu-300">✓</Text>
        </Text>
        <Text className="text-[13px] text-ink-400">Que tengas un lindo día. Mañana te espera uno nuevo.</Text>
      </View>
      {rows.map((r) => (
        <View key={r.id} className="flex-row gap-3">
          <Text className="text-base">{r.icon}</Text>
          <View className="flex-1">
            <Text className="text-xs text-ink-400">{r.label}</Text>
            <Text className="text-[15px] text-ink-100">{r.value}</Text>
          </View>
        </View>
      ))}
      <Pressable onPress={onEdit} accessibilityRole="button" className="h-11 items-center justify-center self-start rounded-xl border border-ink-700 px-4 active:bg-ink-800">
        <Text className="text-[15px] font-semibold text-ink-200">Editar</Text>
      </Pressable>
    </View>
  );
}

/** Interruptor visual (prendido = color de la app). */
function TogglePill({ on }: { on: boolean }) {
  return (
    <View className={`h-7 w-12 justify-center rounded-full px-0.5 ${on ? 'items-end bg-shu-500' : 'items-start bg-ink-700'}`}>
      <View className="h-6 w-6 rounded-full bg-washi" />
    </View>
  );
}

/** "Cambiar los pasos del ritual": prender o apagar cada paso (al menos uno queda prendido). */
function StepsSheet({ onClose }: { onClose: () => void }) {
  const isDesktop = useIsDesktop();
  const pasos = useDb((s) => s.userProfile[0]?.ritualPasos);
  const on = enabledSteps(pasos).map((s) => s.id);

  const toggle = (id: RitualStepId) => {
    const next = togglePaso(pasos, id);
    if (next === null) {
      notify('Tiene que quedar al menos un paso', 'Prendé otro antes de apagar este.');
      return;
    }
    useDb.getState().updateUserProfile({ ritualPasos: next });
  };

  return (
    <Modal transparent animationType={isDesktop ? 'fade' : 'slide'} visible onRequestClose={onClose}>
      <Pressable className={`flex-1 bg-black/60 ${isDesktop ? 'items-center justify-center px-4' : 'justify-end'}`} onPress={onClose}>
        <Pressable
          className={`gap-3 border border-ink-800 bg-ink-900 px-5 pb-8 pt-4 ${isDesktop ? 'w-full max-w-md rounded-3xl' : 'rounded-t-3xl'}`}
          onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink-100">Pasos del ritual</Text>
            <Pressable onPress={onClose} className="h-11 w-11 items-center justify-center" accessibilityLabel="Cerrar">
              <Text className="text-ink-300">✕</Text>
            </Pressable>
          </View>
          <Text className="text-sm text-ink-400">Elegí qué pasos querés hacer cada mañana. Se guarda en tu cuenta.</Text>
          {RITUAL_STEPS.map((s) => {
            const checked = on.includes(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => toggle(s.id)}
                accessibilityRole="switch"
                accessibilityState={{ checked }}
                accessibilityLabel={s.title}
                className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-ink-800 bg-ink-950 px-3 py-2 active:opacity-80">
                <Text className="text-lg">{s.icon}</Text>
                <Text className={`flex-1 text-[15px] ${checked ? 'text-ink-100' : 'text-ink-500'}`}>{s.title}</Text>
                <TogglePill on={checked} />
              </Pressable>
            );
          })}
          <Pressable onPress={onClose} accessibilityRole="button" className="mt-1 h-12 items-center justify-center rounded-xl bg-shu-500 active:opacity-80">
            <Text className="text-base font-bold text-washi">Listo</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
