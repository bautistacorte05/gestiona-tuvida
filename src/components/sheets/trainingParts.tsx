import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { Subcategory } from '../../config/categories';
import { formatDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { markDone } from '../../lib/sheets';
import { formatValue, tagsOf } from '../../lib/stats';
import { useThemeColors } from '../../lib/theme';
import { dayState, groupHint, joinNames, listDate, shortMinutes, weekLabel, type DayState, type GroupStat } from '../../lib/training';
import { parseNum } from '../ItemsEditor';
import { BigStat, Chip, Choice, Hero, PrimaryButton, Section, SmallButton } from './kit';

/** Piezas de la hoja de Entrenamiento (ver TrainingSheet). Todo el color sale del color de la app. */

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const DAY_LABEL: Record<DayState, string> = {
  done: 'entrenaste',
  today: 'hoy, todavía sin entrenar',
  missed: 'no entrenaste',
  future: 'todavía no llegó',
};

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

const CIRCLE: Record<DayState, string> = {
  done: 'bg-shu-500',
  today: 'border-2 border-shu-500',
  missed: 'border border-ink-700',
  future: 'border border-dashed border-ink-800',
};

export function TrainingWeekHero({
  days,
  done,
  now,
  trainedDays,
  minutes,
  streak,
}: {
  days: string[];
  done: Set<string>;
  now: string;
  trainedDays: number;
  minutes: number;
  streak: number;
}) {
  return (
    <Hero title="Esta semana" right={<Text className="text-[13px] text-ink-400">{weekLabel(days)}</Text>}>
      <View className="flex-row flex-wrap items-end gap-x-6 gap-y-3">
        <BigStat value={String(trainedDays)} label={trainedDays === 1 ? 'entrenamiento' : 'entrenamientos'} />
        <BigStat value={shortMinutes(minutes)} label="en total" />
        <BigStat value={String(streak)} label={streak === 1 ? 'día seguido' : 'días seguidos'} accent />
      </View>
      <View className="flex-row">
        {days.map((d, i) => {
          const state = dayState(d, done, now);
          return (
            <View key={d} className="flex-1 items-center gap-1.5" accessible accessibilityLabel={`${formatDay(d, { weekday: 'long' })}: ${DAY_LABEL[state]}`}>
              <Text className="text-[11px] text-ink-400">{WEEKDAYS[i]}</Text>
              <View className={`h-[34px] w-[34px] items-center justify-center rounded-full ${CIRCLE[state]}`}>
                {state === 'done' && <Text className="text-[13px] font-bold text-washi">✓</Text>}
                {state === 'today' && <Text className="text-[10px] font-bold text-shu-300">hoy</Text>}
              </View>
            </View>
          );
        })}
      </View>
    </Hero>
  );
}

// ——— Qué trabajaste esta semana ———

export function TrainingGroups({ stats, now }: { stats: GroupStat[]; now: string }) {
  const rows: GroupStat[][] = [];
  for (let i = 0; i < stats.length; i += 3) rows.push(stats.slice(i, i + 3));
  const missing = stats.filter((g) => g.count === 0).map((g) => g.name);

  return (
    <Section title="Qué trabajaste esta semana">
      <View className="gap-2">
        {rows.map((row) => (
          <View key={row[0].name} className="flex-row gap-2">
            {row.map((g) => {
              const hit = g.count > 0;
              const hint = groupHint(g, now);
              return (
                <View
                  key={g.name}
                  accessible
                  accessibilityLabel={`${g.name}: ${hit ? `${hint} esta semana` : hint.toLowerCase()}`}
                  className={`flex-1 gap-0.5 rounded-xl p-2.5 ${hit ? 'border border-shu-500/45 bg-shu-500/15' : 'border border-ink-800 bg-ink-950'}`}>
                  <Text numberOfLines={1} className={`text-sm font-bold ${hit ? 'text-ink-100' : 'text-ink-400'}`}>
                    {g.name}
                  </Text>
                  <Text numberOfLines={1} className={`text-xs ${hit ? 'text-shu-300' : 'text-ink-500'}`}>
                    {hint}
                  </Text>
                </View>
              );
            })}
            {/* Huecos para que la última fila no estire sus recuadros. */}
            {Array.from({ length: 3 - row.length }, (_, i) => (
              <View key={`gap${i}`} className="flex-1" />
            ))}
          </View>
        ))}
      </View>
      {missing.length > 0 && <Text className="text-[13px] text-shu-300">Esta semana todavía no trabajaste {joinNames(missing)}.</Text>}
    </Section>
  );
}

// ——— Tus días ———

const CELL: Record<DayState, string> = {
  done: 'bg-shu-500',
  today: 'border-2 border-shu-500',
  missed: 'bg-ink-800/60',
  future: 'border border-dashed border-ink-800',
};
const CELL_TEXT: Record<DayState, string> = {
  done: 'font-bold text-washi',
  today: 'font-bold text-shu-300',
  missed: 'text-ink-500',
  future: 'text-ink-600',
};

export function TrainingCalendar({ weeks, done, now }: { weeks: string[][]; done: Set<string>; now: string }) {
  return (
    <Section title="Tus días" right={<Text className="mt-1 text-xs text-ink-400">últimas {weeks.length} semanas</Text>}>
      <View className="gap-1.5">
        <View className="flex-row gap-1.5">
          {WEEKDAYS.map((w) => (
            <Text key={w} className="flex-1 text-center text-[11px] text-ink-500">
              {w}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} className="flex-row gap-1.5">
            {week.map((d) => {
              const state = dayState(d, done, now);
              return (
                <View
                  key={d}
                  accessible
                  accessibilityLabel={`${formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${DAY_LABEL[state]}`}
                  className={`h-9 flex-1 items-center justify-center rounded-lg ${CELL[state]}`}>
                  <Text className={`text-xs ${CELL_TEXT[state]}`}>{Number(d.slice(8))}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <Text className="text-xs text-ink-400">Sale de lo que tildás en Hoy. No hace falta cargar nada.</Text>
    </Section>
  );
}

// ——— Anotar el entrenamiento de hoy ———

const DURATIONS = [30, 45, 60, 90];
const INTENSITIES = [1, 2, 3, 4, 5];

export function TrainingQuickLog({ groups }: { groups: string[] }) {
  const c = useThemeColors();
  const [picked, setPicked] = useState<string[]>([]);
  const [duration, setDuration] = useState<number | 'otra' | null>(null);
  const [other, setOther] = useState('');
  const [intensity, setIntensity] = useState<number | null>(null);
  const [saved, flash] = useSavedFlash();

  const minutes = duration === 'otra' ? parseNum(other) : duration;
  const valid = picked.length > 0 && typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0;

  const toggleGroup = (g: string) => setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  const save = () => {
    if (!valid || !minutes) return;
    const date = today();
    const values: Entry['values'] = { grupo: groups.filter((g) => picked.includes(g)), minutos: minutes };
    if (intensity) values.intensidad = intensity;
    useDb.getState().saveEntry({ categoryId: 'entrenamiento', subId: 'gimnasio', date, values });
    // Anotar = hecho ese día (queda tildado en Hoy).
    markDone(date, 'entrenamiento');
    setPicked([]);
    setDuration(null);
    setOther('');
    setIntensity(null);
    flash();
  };

  return (
    <Section title="Anotar el entrenamiento de hoy" subtitle="Opcional: suma el tiempo y lo que trabajaste.">
      <View className="flex-row flex-wrap gap-2">
        {groups.map((g) => (
          <Chip key={g} label={g} selected={picked.includes(g)} onPress={() => toggleGroup(g)} />
        ))}
      </View>

      <View className="gap-2">
        <Text className="text-[13px] text-ink-400">Duración</Text>
        <View className="flex-row gap-2">
          {DURATIONS.map((m) => (
            <Choice key={m} label={`${m} min`} accessibilityLabel={`${m} minutos`} selected={duration === m} onPress={() => setDuration(duration === m ? null : m)} />
          ))}
          <Choice label="Otra" accessibilityLabel="Otra duración" selected={duration === 'otra'} onPress={() => setDuration(duration === 'otra' ? null : 'otra')} />
        </View>
        {duration === 'otra' && (
          <TextInput
            className="h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
            keyboardType="number-pad"
            value={other}
            onChangeText={setOther}
            placeholder="Minutos"
            placeholderTextColor={c['ink-500']}
            accessibilityLabel="Duración en minutos"
            autoFocus
          />
        )}
      </View>

      <View className="gap-2">
        <Text className="text-[13px] text-ink-400">¿Qué tan intenso fue?</Text>
        <View className="flex-row gap-2">
          {INTENSITIES.map((n) => {
            const selected = intensity === n;
            return (
              <Pressable
                key={n}
                onPress={() => setIntensity(selected ? null : n)}
                accessibilityRole="button"
                accessibilityLabel={`Intensidad ${n}`}
                accessibilityState={{ selected }}
                className={`h-11 w-11 items-center justify-center rounded-full ${selected ? 'bg-shu-500' : 'border border-ink-700'}`}>
                <Text className={`text-[15px] ${selected ? 'font-bold text-washi' : 'text-ink-300'}`}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <PrimaryButton label="Guardar entrenamiento" onPress={save} disabled={!valid} />
      {saved && (
        <Text accessibilityLiveRegion="polite" className="text-center text-sm font-semibold text-shu-300">
          Guardado ✓
        </Text>
      )}
    </Section>
  );
}

// ——— Últimos entrenamientos ———

export function TrainingRecent({
  entries,
  sub,
  now,
  onOpen,
  onAdd,
}: {
  entries: Entry[];
  sub: Subcategory;
  now: string;
  onOpen: (e: Entry) => void;
  onAdd: () => void;
}) {
  const [shown, setShown] = useState(5);
  const minutosField = sub.fields.find((f) => f.key === 'minutos');
  const intensityField = sub.fields.find((f) => f.key === 'intensidad');

  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[17px] font-bold text-ink-100">Últimos entrenamientos</Text>
        <SmallButton label="+ Agregar" onPress={onAdd} accessibilityLabel="Agregar un entrenamiento (podés elegir la fecha)" />
      </View>
      {entries.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-ink-800 p-5">
          <Text className="text-center text-sm text-ink-500">Todavía no anotaste entrenamientos.</Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
          {entries.slice(0, shown).map((e, i, list) => {
            const title = tagsOf(e.values.grupo).join(' · ') || 'Entrenamiento';
            const hasMinutes = e.values.minutos !== undefined && e.values.minutos !== '';
            const hasIntensity = e.values.intensidad !== undefined && e.values.intensidad !== '';
            return (
              <Pressable
                key={e.id}
                onPress={() => onOpen(e)}
                accessibilityRole="button"
                accessibilityHint="Abre el registro para cambiarlo o borrarlo"
                className={`flex-row justify-between gap-3 px-4 py-3.5 active:bg-ink-800/60 ${i < list.length - 1 ? 'border-b border-ink-800' : ''}`}>
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-semibold text-ink-100">{title}</Text>
                  <Text className="mt-0.5 text-xs text-ink-400">{listDate(e.date, now)}</Text>
                </View>
                <View className="items-end">
                  {hasMinutes && !!minutosField && <Text className="text-[15px] font-bold text-ink-100">{formatValue(minutosField, e.values.minutos)}</Text>}
                  {hasIntensity && !!intensityField && (
                    <Text className="mt-0.5 text-xs text-shu-300">intensidad {formatValue(intensityField, e.values.intensidad)}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {entries.length > shown && <SmallButton label="Ver más" onPress={() => setShown((s) => s + 10)} accessibilityLabel="Ver más entrenamientos" />}
    </View>
  );
}
