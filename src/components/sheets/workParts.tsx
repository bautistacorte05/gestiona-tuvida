import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { markDone } from '../../lib/sheets';
import { useThemeColors } from '../../lib/theme';
import { listDate } from '../../lib/training';
import { formatHours, NEXT_STEP, TASK_STATES, todayJornada, weekProgress, type TaskState } from '../../lib/work';
import { parseNum } from '../ItemsEditor';
import TrashButton from '../TrashButton';
import { Choice, Hero, PrimaryButton, Section, Segmented, SmallButton } from './kit';

/** Piezas de la hoja de Trabajo (ver WorkSheet). Todo el color sale del color de la app. */

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const INPUT = 'h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100';

/** "Guardado ✓" por un rato después de guardar. */
function useSavedFlash(ms = 2500) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(() => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, flash] as const;
}

// ——— Esta semana ———

// Alto máximo de una barra (px): entra junto con el número de arriba y la letra del día.
const BAR_MAX = 72;

export function WorkWeekHero({ days, hours, now, goal, onEditGoal }: { days: string[]; hours: number[]; now: string; goal: number; onEditGoal: () => void }) {
  const p = weekProgress(days, hours, goal, now);
  return (
    <Hero
      title="Esta semana"
      right={
        <Pressable
          onPress={onEditGoal}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Meta: ${formatHours(goal)} horas por semana. Tocá para cambiarla.`}
          className="flex-row items-center gap-1 rounded-lg active:opacity-60">
          <Text className="text-[13px] text-ink-400">meta: {formatHours(goal)} h</Text>
          <Text className="text-[11px] opacity-60">✏️</Text>
        </Pressable>
      }>
      <View className="flex-row flex-wrap items-baseline gap-x-2">
        <Text className="text-4xl font-extrabold text-ink-100">{formatHours(p.total)} h</Text>
        <Text className={`text-sm ${p.reached ? 'font-semibold text-shu-300' : 'text-ink-300'}`}>
          {p.reached ? '¡Cumpliste la meta!' : `te faltan ${formatHours(p.remaining)} h`}
        </Text>
      </View>
      <View
        className="h-2.5 overflow-hidden rounded-full bg-ink-800"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Avance de la meta de la semana"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(p.pct * 100) }}>
        <View className="h-full rounded-full bg-shu-500" style={{ width: `${p.pct * 100}%` }} />
      </View>
      <View className="h-[118px] flex-row items-end gap-2">
        {days.map((d, i) => {
          const h = hours[i];
          const isToday = d === now;
          const future = d > now;
          let bar = 'bg-ink-800';
          let height = 4;
          let value = '';
          if (future) height = 6;
          else if (h > 0) {
            bar = 'bg-shu-500';
            height = Math.max(4, Math.round((h / p.scale) * BAR_MAX));
            value = formatHours(h);
          } else if (isToday) {
            bar = 'border-2 border-dashed border-shu-500';
            height = 18;
            value = 'hoy';
          }
          const said = future ? 'todavía no llegó' : h > 0 ? `${formatHours(h)} horas` : isToday ? 'hoy, sin horas cargadas' : 'sin horas';
          return (
            <View key={d} accessible accessibilityLabel={`${formatDay(d, { weekday: 'long' })}: ${said}`} className="h-full flex-1 items-center justify-end gap-1.5">
              {!!value && <Text className="text-[11px] text-ink-300">{value}</Text>}
              <View className={`w-full rounded-b-[3px] rounded-t-md ${bar}`} style={{ height }} />
              <Text className={`text-[11px] ${isToday ? 'font-bold text-shu-300' : 'text-ink-400'}`}>{WEEKDAYS[i]}</Text>
            </View>
          );
        })}
      </View>
    </Hero>
  );
}

/** Ventana para cambiar la meta de horas por semana (se guarda en el perfil: viaja con la cuenta). */
export function WorkGoalModal({ goal, onClose }: { goal: number; onClose: () => void }) {
  const c = useThemeColors();
  const [text, setText] = useState(() => String(goal).replace('.', ','));
  const value = parseNum(text);
  const valid = Number.isFinite(value) && value > 0 && value <= 168;

  const save = () => {
    if (!valid) return;
    useDb.getState().updateUserProfile({ metaHorasSemana: value });
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="gap-3 rounded-t-3xl border border-ink-800 bg-ink-900 px-5 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-ink-100">Meta de la semana</Text>
              <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <View>
              <Text className="mb-1 text-sm text-ink-400">Horas por semana</Text>
              <TextInput
                className={INPUT}
                keyboardType="decimal-pad"
                value={text}
                onChangeText={setText}
                placeholder="40"
                placeholderTextColor={c['ink-500']}
                accessibilityLabel="Horas por semana"
                onSubmitEditing={save}
                autoFocus
              />
            </View>
            <Text className="text-xs text-ink-500">Es la barra de “Esta semana”. Se guarda en tu cuenta.</Text>
            <PrimaryButton label="Guardar" onPress={save} disabled={!valid} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ——— ¿Cuánto trabajaste hoy? ———

const PRESETS = [6, 7, 8, 9];

interface TodayDraft {
  preset: number | 'otra' | null;
  other: string;
  modalidad: string;
}

/** Lo que ya está cargado hoy, para mostrarlo elegido. */
function draftFrom(entry: Entry | undefined): TodayDraft {
  const h = Number(entry?.values.horas) || 0;
  const m = entry?.values.modalidad;
  return {
    preset: !h ? null : PRESETS.includes(h) ? h : 'otra',
    other: h && !PRESETS.includes(h) ? String(h).replace('.', ',') : '',
    modalidad: typeof m === 'string' ? m : '',
  };
}

export function WorkTodayLog({ existing, modalities, categoryName }: { existing?: Entry; modalities: string[]; categoryName: string }) {
  const c = useThemeColors();
  // Sin tocar nada se ve lo que ya está cargado hoy; al tocar algo pasa a ser un borrador propio.
  const [draft, setDraft] = useState<TodayDraft | null>(null);
  const [saved, flash] = useSavedFlash();
  const shown = draft ?? draftFrom(existing);
  const change = (patch: Partial<TodayDraft>) => setDraft({ ...shown, ...patch });

  const hours = shown.preset === 'otra' ? parseNum(shown.other) : shown.preset;
  const valid = typeof hours === 'number' && Number.isFinite(hours) && hours > 0 && hours <= 24;

  const save = () => {
    if (!valid || !hours) return;
    const date = today();
    const { entries, saveEntry } = useDb.getState();
    // Si hoy ya hay una jornada, se actualiza (no se duplica). Se conserva la nota.
    const current = todayJornada(entries, date);
    const values: Entry['values'] = { ...(current?.values ?? {}), horas: hours };
    if (shown.modalidad) values.modalidad = shown.modalidad;
    else delete values.modalidad;
    saveEntry({ id: current?.id, categoryId: 'trabajo', subId: 'jornada', date, values });
    // Anotar = hecho ese día (queda tildado en Hoy).
    markDone(date, 'trabajo');
    setDraft(null);
    flash();
  };

  return (
    <Section title="¿Cuánto trabajaste hoy?" subtitle={`Si solo tildás ${categoryName} en Hoy, el día cuenta igual. Las horas son opcionales.`}>
      <View className="flex-row gap-2">
        {PRESETS.map((h) => (
          <Choice key={h} label={`${h} h`} accessibilityLabel={`${h} horas`} selected={shown.preset === h} onPress={() => change({ preset: shown.preset === h ? null : h })} />
        ))}
        <Choice label="Otra" accessibilityLabel="Otra cantidad de horas" selected={shown.preset === 'otra'} onPress={() => change({ preset: shown.preset === 'otra' ? null : 'otra' })} />
      </View>
      {shown.preset === 'otra' && (
        <TextInput
          className={INPUT}
          keyboardType="decimal-pad"
          value={shown.other}
          onChangeText={(t) => change({ other: t })}
          placeholder="Horas (ej. 7,5)"
          placeholderTextColor={c['ink-500']}
          accessibilityLabel="Horas trabajadas hoy"
        />
      )}
      <Segmented<string>
        options={modalities.map((m) => ({ value: m, label: m }))}
        value={shown.modalidad}
        onChange={(v) => change({ modalidad: v === shown.modalidad ? '' : v })}
      />
      <PrimaryButton label="Guardar jornada" onPress={save} disabled={!valid} />
      {saved && (
        <Text accessibilityLiveRegion="polite" className="text-center text-sm font-semibold text-shu-300">
          Guardado ✓
        </Text>
      )}
    </Section>
  );
}

// ——— Dónde trabajaste ———

// Un tono del color de la app por modalidad (se distinguen por lo claro/oscuro, no por el color).
const SHADES = ['bg-shu-500', 'bg-shu-500/60', 'bg-shu-500/30'];

export function WorkModality({ monthName, data, options }: { monthName: string; data: { name: string; days: number }[]; options: string[] }) {
  if (!data.length) return null;
  const shade = (name: string) => SHADES[options.indexOf(name)] ?? 'bg-ink-600';
  const daysText = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
  return (
    <Section title={`Dónde trabajaste en ${monthName}`}>
      <View
        accessible
        accessibilityLabel={data.map((m) => `${m.name}: ${daysText(m.days)}`).join(', ')}
        className="h-3.5 flex-row gap-0.5 overflow-hidden rounded-full">
        {data.map((m) => (
          <View key={m.name} className={shade(m.name)} style={{ flex: m.days }} />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-3.5 gap-y-1.5">
        {data.map((m) => (
          <View key={m.name} className="flex-row items-center gap-1.5">
            <View className={`h-2.5 w-2.5 rounded-[3px] ${shade(m.name)}`} />
            <Text className="text-[13px] text-ink-300">
              {m.name} · {daysText(m.days)}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

// ——— Tareas ———

const TAB_LABEL: Record<TaskState, string> = { Pendiente: 'Pendientes', 'En curso': 'En curso', Hecha: 'Hechas' };
const EMPTY: Record<TaskState, string> = {
  Pendiente: 'No hay tareas pendientes.',
  'En curso': 'No hay tareas en curso.',
  Hecha: 'Todavía no terminaste ninguna tarea.',
};

export function WorkTasks({ tasks, onOpen }: { tasks: Record<TaskState, Entry[]>; onOpen: (e: Entry) => void }) {
  const c = useThemeColors();
  const [tab, setTab] = useState<TaskState>('Pendiente');
  // Pendientes y en curso se ven todas; las hechas (que solo crecen) de a poco.
  const [shownDone, setShownDone] = useState(5);
  const [text, setText] = useState('');
  const list = tasks[tab];
  const visible = tab === 'Hecha' ? list.slice(0, shownDone) : list;

  const move = (e: Entry, estado: TaskState) => useDb.getState().saveEntry({ ...e, values: { ...e.values, estado } });

  const add = () => {
    const tarea = text.trim();
    if (!tarea) return;
    useDb.getState().saveEntry({ categoryId: 'trabajo', subId: 'tareas', date: today(), values: { tarea, estado: 'Pendiente' } });
    setText('');
    setTab('Pendiente');
  };

  return (
    <Section title="Tareas">
      <Segmented<TaskState>
        options={TASK_STATES.map((s) => ({ value: s, label: `${TAB_LABEL[s]} ${tasks[s].length}` }))}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setShownDone(5);
        }}
      />
      {visible.length === 0 ? (
        <Text className="py-2 text-center text-sm text-ink-500">{EMPTY[tab]}</Text>
      ) : (
        <View className="gap-2">
          {visible.map((e) => {
            const tarea = String(e.values.tarea ?? '');
            const prio = ['Alta', 'Media', 'Baja'].includes(String(e.values.prioridad)) ? String(e.values.prioridad) : '';
            const step = NEXT_STEP[tab];
            return (
              <View key={e.id} className="flex-row items-center gap-2.5 rounded-xl border border-ink-800 bg-ink-950 p-3">
                <Pressable
                  onPress={() => onOpen(e)}
                  accessibilityRole="button"
                  accessibilityHint="Abre la tarea para cambiarla o borrarla"
                  className="min-w-0 flex-1 active:opacity-70">
                  <Text className="text-[15px] font-semibold text-ink-100">{tarea || 'Tarea sin nombre'}</Text>
                  {!!prio && (
                    <View className={`mt-1.5 self-start rounded-full px-2 py-0.5 ${prio === 'Alta' ? 'bg-shu-500/15' : 'bg-ink-800'}`}>
                      <Text className={`text-[11px] font-bold ${prio === 'Alta' ? 'text-shu-300' : prio === 'Media' ? 'text-ink-300' : 'text-ink-400'}`}>
                        Prioridad {prio.toLowerCase()}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => move(e, step.to)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`${step.label}: ${tarea}`}
                  className="h-9 items-center justify-center rounded-[10px] border border-shu-400 px-3 active:bg-shu-500/15">
                  <Text className="text-[13px] font-semibold text-shu-300">{step.label}</Text>
                </Pressable>
                <TrashButton what={`la tarea "${tarea || 'sin nombre'}"`} onDelete={() => useDb.getState().deleteEntry(e.id)} />
              </View>
            );
          })}
        </View>
      )}
      {tab === 'Hecha' && list.length > shownDone && <SmallButton label="Ver más" onPress={() => setShownDone((n) => n + 10)} accessibilityLabel="Ver más tareas hechas" />}
      <View className="flex-row gap-2">
        <TextInput
          className={`${INPUT} flex-1`}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder="Nueva tarea…"
          placeholderTextColor={c['ink-500']}
          accessibilityLabel="Nueva tarea"
        />
        <Pressable
          onPress={add}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Agregar tarea"
          accessibilityState={{ disabled: !text.trim() }}
          className={`h-11 w-11 items-center justify-center rounded-xl bg-shu-500 ${text.trim() ? 'active:opacity-80' : 'opacity-40'}`}>
          <Text className="text-2xl text-washi">+</Text>
        </Pressable>
      </View>
    </Section>
  );
}

// ——— Últimas jornadas (para ver, cambiar o borrar las de otros días) ———

export function WorkRecentDays({ entries, now, onOpen, onAdd }: { entries: Entry[]; now: string; onOpen: (e: Entry) => void; onAdd: () => void }) {
  const [shown, setShown] = useState(5);
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[17px] font-bold text-ink-100">Últimas jornadas</Text>
        <SmallButton label="+ Agregar" onPress={onAdd} accessibilityLabel="Agregar una jornada (podés elegir la fecha y una nota)" />
      </View>
      {entries.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-ink-800 p-5">
          <Text className="text-center text-sm text-ink-500">Todavía no anotaste jornadas.</Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
          {entries.slice(0, shown).map((e, i, list) => {
            const h = Number(e.values.horas) || 0;
            const modalidad = typeof e.values.modalidad === 'string' ? e.values.modalidad : '';
            const nota = typeof e.values.nota === 'string' ? e.values.nota : '';
            return (
              <View key={e.id} className={`flex-row items-center pr-1 ${i < list.length - 1 ? 'border-b border-ink-800' : ''}`}>
                <Pressable
                  onPress={() => onOpen(e)}
                  accessibilityRole="button"
                  accessibilityHint="Abre la jornada para cambiarla"
                  className="min-w-0 flex-1 py-3.5 pl-4 pr-2 active:bg-ink-800/60">
                  <Text className="text-[15px] font-semibold text-ink-100">
                    {h ? `${formatHours(h)} h` : 'Jornada'}
                    {modalidad ? ` · ${modalidad}` : ''}
                  </Text>
                  <Text className="mt-0.5 text-xs text-ink-400">{listDate(e.date, now)}</Text>
                  {!!nota && (
                    <Text numberOfLines={1} className="mt-0.5 text-xs text-ink-500">
                      {nota}
                    </Text>
                  )}
                </Pressable>
                <TrashButton what={`la jornada del ${listDate(e.date, now)}`} onDelete={() => useDb.getState().deleteEntry(e.id)} />
              </View>
            );
          })}
        </View>
      )}
      {entries.length > shown && <SmallButton label="Ver más" onPress={() => setShown((s) => s + 10)} accessibilityLabel="Ver más jornadas" />}
    </View>
  );
}
