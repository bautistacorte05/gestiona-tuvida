import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDay, shiftDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { useFindSub } from '../../lib/names';
import {
  decimal,
  formatSleep,
  hoursBetween,
  lastDays,
  latestPerDay,
  moodLevel,
  MOODS,
  shortTime,
  SLEEP_QUALITY,
  sleepHours,
  sleepMoodInsight,
  stepHalfHour,
} from '../../lib/wellbeing';
import EntryForm from '../EntryForm';
import TimeField from '../TimeField';
import TrashButton from '../TrashButton';
import { Chip, Hero, NumberStepper, PrimaryButton, Section, SheetScreen, SmallButton } from './kit';

/**
 * Hoja de Bienestar: el ánimo de hoy con un toque, cuánto dormiste anoche, las últimas 2 semanas
 * y el historial. Usa los registros de siempre: Sueño (bienestar/sueno) y Ánimo (bienestar/animo).
 * Volver a guardar el mismo día actualiza el registro de ese día (no crea otro).
 */

const DEFAULT_HOURS = 7.5;
/** Ánimo 1 a 5: el mismo color de la app, cada vez más fuerte. */
const MOOD_BG = ['border border-ink-800', 'bg-shu-500/15', 'bg-shu-500/30', 'bg-shu-500/50', 'bg-shu-500/75', 'bg-shu-500'];

type Editing = { subId: 'sueno' | 'animo'; entry?: Entry };

/** Mensaje corto que se va solo ("Guardado ✓"). */
function useFlash(ms = 2200) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), ms);
    },
    [ms],
  );
  return [msg, show] as const;
}

const dayLabel = (date: string, now: string) =>
  date === now ? 'Hoy' : date === shiftDay(now, -1) ? 'Ayer' : formatDay(date, { weekday: 'short', day: 'numeric', month: 'short' });

const timeRange = (from: string, to: string) => `de ${shortTime(from)} a ${shortTime(to)}`;

export default function WellbeingSheet() {
  const entries = useDb((s) => s.entries);
  const saveEntry = useDb((s) => s.saveEntry);
  const suenoSub = useFindSub('bienestar', 'sueno');
  const animoSub = useFindSub('bienestar', 'animo');
  const now = today();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [moodFlash, showMoodFlash] = useFlash();

  const sleepEntries = useMemo(() => entries.filter((e) => e.categoryId === 'bienestar' && e.subId === 'sueno'), [entries]);
  const moodEntries = useMemo(() => entries.filter((e) => e.categoryId === 'bienestar' && e.subId === 'animo'), [entries]);
  const sleepByDay = useMemo(() => latestPerDay(sleepEntries), [sleepEntries]);
  const moodByDay = useMemo(() => latestPerDay(moodEntries), [moodEntries]);
  const days = useMemo(() => lastDays(sleepByDay, moodByDay, now), [sleepByDay, moodByDay, now]);
  const insight = useMemo(() => sleepMoodInsight(sleepByDay, moodByDay), [sleepByDay, moodByDay]);
  const history = useMemo(
    () => [...sleepEntries, ...moodEntries].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt),
    [sleepEntries, moodEntries],
  );
  /** Las últimas horas anotadas (para arrancar el +/− de un día nuevo). */
  const lastHours = useMemo(() => {
    const valid = sleepEntries.filter((e) => sleepHours(e.values.horas) !== undefined);
    valid.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
    return sleepHours(valid[0]?.values.horas);
  }, [sleepEntries]);

  const saveMood = (nivel: number) => {
    const date = today();
    const existing = moodByDay.get(date);
    if (existing) saveEntry({ id: existing.id, categoryId: 'bienestar', subId: 'animo', date: existing.date, values: { ...existing.values, nivel } });
    else saveEntry({ categoryId: 'bienestar', subId: 'animo', date, values: { nivel } });
    showMoodFlash(`Guardado ✓ · ${MOODS[nivel - 1].label}`);
  };

  const target = editing?.subId === 'animo' ? animoSub : suenoSub;

  return (
    <SheetScreen
      categoryId="bienestar"
      overlay={
        editing && target ? (
          <EntryForm
            key={editing.entry?.id ?? `new-${editing.subId}`}
            category={target.category}
            sub={target.sub}
            entry={editing.entry}
            defaultDate={now}
            onClose={() => setEditing(null)}
          />
        ) : null
      }>
      <Hero title="¿Cómo te sentís hoy?">
        <View className="flex-row gap-1.5">
          {MOODS.map((m) => {
            const selected = moodLevel(moodByDay.get(now)?.values.nivel) === m.level;
            return (
              <Pressable
                key={m.level}
                onPress={() => saveMood(m.level)}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                accessibilityState={{ selected }}
                className={`min-w-0 flex-1 items-center gap-1.5 rounded-2xl border px-0.5 pb-2 pt-2.5 active:opacity-80 ${
                  selected ? 'border-shu-500 bg-shu-500' : 'border-ink-700 bg-ink-950'
                }`}>
                <Text style={{ fontSize: 28, lineHeight: 34 }}>{m.emoji}</Text>
                <Text numberOfLines={1} className={`text-[11px] font-semibold ${selected ? 'text-washi' : 'text-ink-300'}`}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className={`text-xs ${moodFlash ? 'font-semibold text-shu-300' : 'text-ink-300'}`} accessibilityLiveRegion="polite">
          {moodFlash ?? 'Un toque y queda guardado.'}
        </Text>
      </Hero>

      <SleepCard todayEntry={sleepByDay.get(now)} lastHours={lastHours} />

      <Section title="Últimas 2 semanas" right={<Text className="text-xs text-ink-400">sueño y ánimo</Text>}>
        <TwoWeeks days={days} />
      </Section>

      <InsightCard insight={insight} />

      <Section
        title="Historial"
        right={
          <View className="flex-row gap-2">
            <SmallButton label="+ Sueño" onPress={() => setEditing({ subId: 'sueno' })} accessibilityLabel="Agregar sueño de otro día" />
            <SmallButton label="+ Ánimo" onPress={() => setEditing({ subId: 'animo' })} accessibilityLabel="Agregar ánimo de otro día" />
          </View>
        }>
        {history.length === 0 ? (
          <Text className="text-sm text-ink-400">Todavía no anotaste nada.</Text>
        ) : (
          <PagedList
            items={history}
            render={(e, first) => (
              <HistoryRow key={e.id} entry={e} now={now} first={first} onPress={() => setEditing({ subId: e.subId === 'animo' ? 'animo' : 'sueno', entry: e })} />
            )}
          />
        )}
      </Section>
    </SheetScreen>
  );
}

/** "¿Cuánto dormiste anoche?": +/− de a media hora, calidad y horario opcional. Guarda (o actualiza) el registro de hoy. */
function SleepCard({ todayEntry, lastHours }: { todayEntry?: Entry; lastHours?: number }) {
  const saveEntry = useDb((s) => s.saveEntry);
  const [flash, showFlash] = useFlash();
  // null = sin tocar: se muestra lo guardado hoy (o el último valor).
  const [draftHours, setDraftHours] = useState<number | null>(null);
  const [draftQuality, setDraftQuality] = useState<string | null>(null);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);

  const hours = draftHours ?? sleepHours(todayEntry?.values.horas) ?? lastHours ?? DEFAULT_HOURS;
  const quality = draftQuality ?? String(todayEntry?.values.calidad ?? '');
  const from = draftFrom ?? String(todayEntry?.values.acostarse ?? '');
  const to = draftTo ?? String(todayEntry?.values.levantarse ?? '');

  const changeTimes = (nextFrom: string, nextTo: string) => {
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    const h = hoursBetween(nextFrom, nextTo);
    if (h !== undefined) setDraftHours(h);
  };

  const save = () => {
    if (!(hours > 0)) return;
    const date = today();
    const existing = todayEntry?.date === date ? todayEntry : undefined;
    const values: Entry['values'] = { ...(existing?.values ?? {}), horas: Math.round(hours * 100) / 100 };
    for (const [key, v] of [
      ['calidad', quality],
      ['acostarse', from],
      ['levantarse', to],
    ] as const) {
      if (v) values[key] = v;
      else delete values[key];
    }
    saveEntry({ id: existing?.id, categoryId: 'bienestar', subId: 'sueno', date, values });
    setDraftHours(null);
    setDraftQuality(null);
    setDraftFrom(null);
    setDraftTo(null);
    showFlash('Guardado ✓');
  };

  return (
    <Section title="¿Cuánto dormiste anoche?" subtitle={todayEntry ? 'Ya lo anotaste hoy. Si lo cambiás, se actualiza.' : undefined}>
      <View>
        <NumberStepper
          big
          value={hours}
          // El +/− del kit suma 0,5 justo; acá se redondea a la media hora (7 h 50 + → 8 h). En el tope no cambia nada.
          onChange={(v) => {
            if (v !== hours) setDraftHours(stepHalfHour(hours, v > hours ? 1 : -1));
          }}
          min={0}
          max={24}
          step={0.5}
          format={formatSleep}
          lessLabel="Media hora menos"
          moreLabel="Media hora más"
        />
        {!!from && !!to && <Text className="mt-1 text-center text-xs text-ink-400">{timeRange(from, to)}</Text>}
      </View>

      <View className="flex-row flex-wrap gap-2">
        {SLEEP_QUALITY.map((q) => (
          <Chip key={q} label={q} selected={quality === q} onPress={() => setDraftQuality(quality === q ? '' : q)} />
        ))}
      </View>

      <View className="gap-2">
        <Text className="text-[13px] text-ink-400">Horario (opcional)</Text>
        <View className="flex-row gap-2">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-xs text-ink-500">Me acosté</Text>
            <TimeField value={from} onChange={(v) => changeTimes(v, to)} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-xs text-ink-500">Me levanté</Text>
            <TimeField value={to} onChange={(v) => changeTimes(from, v)} />
          </View>
        </View>
      </View>

      <PrimaryButton label={flash ?? 'Guardar sueño'} onPress={save} disabled={!(hours > 0)} />
    </Section>
  );
}

/** Barras de horas de sueño y, debajo, el ánimo de cada día (1 a 5). */
function TwoWeeks({ days }: { days: { date: string; hours?: number; mood?: number }[] }) {
  const slept = days.filter((d) => d.hours !== undefined);
  const moods = days.filter((d) => d.mood !== undefined);
  if (!slept.length && !moods.length) {
    return <Text className="text-sm text-ink-400">Cuando anotes tu sueño y tu ánimo, acá vas a ver cómo te fue cada día.</Text>;
  }
  const max = Math.max(9, ...slept.map((d) => d.hours!));
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const summary = [
    slept.length ? `dormiste ${formatSleep(avg(slept.map((d) => d.hours!)))} en promedio` : '',
    moods.length ? `tu ánimo promedió ${decimal(avg(moods.map((d) => d.mood!)))}` : '',
  ]
    .filter(Boolean)
    .join(' y ');

  return (
    <View className="gap-3">
      <View accessible accessibilityLabel={`Últimas 2 semanas: ${summary}.`}>
        <View className="h-[110px] flex-row items-end gap-1">
          {days.map((d) =>
            d.hours !== undefined ? (
              <View key={d.date} className="flex-1 rounded-t bg-shu-400" style={{ height: `${Math.max((d.hours / max) * 100, 4)}%` }} />
            ) : (
              <View key={d.date} className="h-1 flex-1 rounded-sm bg-ink-800" />
            ),
          )}
        </View>
        <View className="mt-1.5 flex-row gap-1">
          {days.map((d) => (
            <View key={d.date} className={`h-[22px] min-w-0 flex-1 items-center justify-center rounded-md ${MOOD_BG[d.mood ?? 0]}`}>
              {d.mood !== undefined && <Text className={`text-[11px] font-bold ${d.mood === 5 ? 'text-washi' : 'text-ink-100'}`}>{d.mood}</Text>}
            </View>
          ))}
        </View>
        <View className="mt-2 flex-row justify-between">
          <Text className="text-[11px] text-ink-500">{formatDay(days[0].date, { day: 'numeric', month: 'short' })}</Text>
          <Text className="text-[11px] text-ink-500">hoy</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-sm bg-shu-400" />
          <Text className="text-xs text-ink-300">Horas de sueño</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-sm bg-shu-500/50" />
          <Text className="text-xs text-ink-300">Ánimo (1 a 5)</Text>
        </View>
      </View>
    </View>
  );
}

/** Cómo se relacionan sueño y ánimo (con 5 días o más que tengan los dos datos). */
function InsightCard({ insight }: { insight: ReturnType<typeof sleepMoodInsight> }) {
  const strong = (n: number) => <Text className="font-bold text-shu-300">{decimal(n)}</Text>;
  return (
    <View className="flex-row items-start gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <Text className="text-xl">💡</Text>
      {!insight ? (
        <Text className="flex-1 text-sm leading-5 text-ink-400">
          Cuando tengas 5 días con sueño y ánimo anotados, acá vas a ver cómo se relacionan.
        </Text>
      ) : insight.enough !== undefined ? (
        <Text className="flex-1 text-sm leading-5 text-ink-200">
          Los días que dormiste 7 h o más, tu ánimo promedió {strong(insight.enough)}
          {insight.less !== undefined ? <>; con menos, {strong(insight.less)}.</> : '.'}
        </Text>
      ) : (
        <Text className="flex-1 text-sm leading-5 text-ink-200">
          Los días que dormiste menos de 7 h, tu ánimo promedió {strong(insight.less!)}.
        </Text>
      )}
    </View>
  );
}

function HistoryRow({ entry, now, first, onPress }: { entry: Entry; now: string; first: boolean; onPress: () => void }) {
  const when = dayLabel(entry.date, now);
  let icon: string;
  let main: string;
  let detail = '';
  if (entry.subId === 'animo') {
    const level = moodLevel(entry.values.nivel);
    const mood = level ? MOODS[level - 1] : undefined;
    icon = mood?.emoji ?? '🙂';
    main = mood ? `${mood.label} (${level})` : 'Ánimo';
    detail = String(entry.values.nota ?? '').trim();
  } else {
    const h = sleepHours(entry.values.horas);
    const from = String(entry.values.acostarse ?? '');
    const to = String(entry.values.levantarse ?? '');
    icon = '😴';
    main = [h !== undefined ? formatSleep(h) : 'Sueño', String(entry.values.calidad ?? '')].filter(Boolean).join(' · ');
    detail = from && to ? timeRange(from, to) : from ? `Me acosté ${shortTime(from)}` : to ? `Me levanté ${shortTime(to)}` : '';
  }
  const what = entry.subId === 'animo' ? 'el ánimo' : 'el sueño';
  return (
    <View className={`flex-row items-center ${first ? '' : 'border-t border-ink-800'}`}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${when}: ${main}${detail ? `, ${detail}` : ''}. Tocá para editar.`}
        className="min-w-0 flex-1 flex-row items-center gap-3 py-3 pr-1 active:opacity-70">
        <Text className="text-xl">{icon}</Text>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[15px] font-semibold text-ink-100">
            {main}
          </Text>
          {!!detail && (
            <Text numberOfLines={1} className="mt-0.5 text-xs text-ink-400">
              {detail}
            </Text>
          )}
        </View>
        <Text className="text-xs text-ink-500">{when}</Text>
      </Pressable>
      <TrashButton what={`${what} de ${when === 'Hoy' || when === 'Ayer' ? when.toLowerCase() : `el ${when}`}`} onDelete={() => useDb.getState().deleteEntry(entry.id)} />
    </View>
  );
}

/** Lista que muestra los primeros y suma más con "Ver más". */
function PagedList({ items, render }: { items: Entry[]; render: (item: Entry, first: boolean) => ReactNode }) {
  const [shown, setShown] = useState(6);
  return (
    <View>
      {items.slice(0, shown).map((item, i) => render(item, i === 0))}
      {items.length > shown && (
        <View className="mt-2">
          <SmallButton label="Ver más" onPress={() => setShown((n) => n + 10)} />
        </View>
      )}
    </View>
  );
}
