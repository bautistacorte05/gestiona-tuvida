import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, shiftDay, shiftMonth, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { useFindSub } from '../../lib/names';
import {
  DEFAULT_SLEEP_GOAL,
  decimal,
  ENERGY,
  HABITS,
  STRESS,
  weekCompare,
  type WeekStats,
  formatSleep,
  hoursBetween,
  lastDays,
  latestPerDay,
  monthCells,
  moodLevel,
  MOODS,
  scoreLabel,
  shortTime,
  SLEEP_QUALITY,
  sleepHours,
  sleepMoodInsight,
  sleepScore,
  sleepStreak,
  stepHalfHour,
} from '../../lib/wellbeing';
import { useThemeColors } from '../../lib/theme';
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
  const sleepGoal = useDb((s) => s.userProfile[0]?.sleepGoal) ?? DEFAULT_SLEEP_GOAL;

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

  const diaryByDay = useMemo(
    () => latestPerDay(entries.filter((e) => e.categoryId === 'bienestar' && e.subId === 'diario')),
    [entries],
  );
  const week = useMemo(() => weekCompare(sleepByDay, moodByDay, diaryByDay, now), [sleepByDay, moodByDay, diaryByDay, now]);
  const streak = useMemo(() => sleepStreak(sleepByDay, now), [sleepByDay, now]);
  const weekAvg = useMemo(() => {
    const hs = days.slice(-7).map((d) => d.hours).filter((h): h is number => h !== undefined);
    return hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : undefined;
  }, [days]);

  const saveMood = (nivel: number) => {
    const date = today();
    const existing = moodByDay.get(date);
    if (existing) saveEntry({ id: existing.id, categoryId: 'bienestar', subId: 'animo', date: existing.date, values: { ...existing.values, nivel } });
    else saveEntry({ categoryId: 'bienestar', subId: 'animo', date, values: { nivel } });
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
      <SleepScoreCard entry={sleepByDay.get(now)} goal={sleepGoal} streak={streak} weekAvg={weekAvg} />

      <DailyCheckin key={now} entry={diaryByDay.get(now)} date={now} mood={moodLevel(moodByDay.get(now)?.values.nivel)} onMood={saveMood} />

      <SleepCard todayEntry={sleepByDay.get(now)} lastHours={lastHours} />

      <WeekSummary cur={week.cur} prev={week.prev} />

      <MoodCalendar moodByDay={moodByDay} now={now} />

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

/** Energía, estrés, hábitos de autocuidado y nota del día. Cada toque se guarda solo; la nota al salir del campo. */
function DailyCheckin({ entry, date, mood, onMood }: { entry?: Entry; date: string; mood?: number; onMood: (n: number) => void }) {
  const c = useThemeColors();
  const [note, setNote] = useState(String(entry?.values.nota ?? ''));
  const energy = moodLevel(entry?.values.energia);
  const stress = moodLevel(entry?.values.estres);
  const habits = Array.isArray(entry?.values.habitos) ? (entry!.values.habitos as string[]) : [];

  const update = (patch: Record<string, unknown>) => {
    const values: Entry['values'] = { ...(entry?.values ?? {}), ...patch } as Entry['values'];
    for (const k of Object.keys(values)) {
      const v = values[k];
      if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete values[k];
    }
    useDb.getState().saveEntry({ id: entry?.id, categoryId: 'bienestar', subId: 'diario', date, values });
  };

  const scale = (title: string, items: readonly { level: number; emoji: string; label: string }[], value: number | undefined, key: string) => (
    <View className="gap-2">
      <Text className="text-[13px] text-ink-400">{title}</Text>
      <View className="flex-row gap-1.5">
        {items.map((it) => {
          const sel = value === it.level;
          return (
            <Pressable
              key={it.level}
              onPress={() => (key === 'nivel' ? onMood(it.level) : update({ [key]: sel ? undefined : it.level }))}
              accessibilityRole="button"
              accessibilityLabel={`${title}: ${it.label}`}
              accessibilityState={{ selected: sel }}
              className={`min-w-0 flex-1 items-center gap-1 rounded-xl border px-0.5 py-2 ${sel ? 'border-shu-500 bg-shu-500' : 'border-ink-700 bg-ink-950'}`}>
              <Text style={{ fontSize: 22, lineHeight: 28 }}>{it.emoji}</Text>
              <Text numberOfLines={1} className={`text-[10px] font-semibold ${sel ? 'text-washi' : 'text-ink-300'}`}>
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Section title="Tu día" subtitle="¿Cómo te sentís hoy? Un toque y queda guardado.">
      {scale('Ánimo', MOODS, mood, 'nivel')}
      {scale('Energía', ENERGY, energy, 'energia')}
      {scale('Estrés', STRESS, stress, 'estres')}
      <View className="gap-2">
        <Text className="text-[13px] text-ink-400">Hábitos de hoy</Text>
        <View className="flex-row flex-wrap gap-2">
          {HABITS.map((h) => (
            <Chip
              key={h.id}
              label={`${h.emoji} ${h.label}`}
              selected={habits.includes(h.id)}
              onPress={() => update({ habitos: habits.includes(h.id) ? habits.filter((x) => x !== h.id) : [...habits, h.id] })}
            />
          ))}
        </View>
      </View>
      <View className="gap-1.5">
        <Text className="text-[13px] text-ink-400">Nota del día</Text>
        <TextInput
          className="min-h-[60px] rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-[15px] text-ink-100"
          multiline
          value={note}
          onChangeText={setNote}
          onBlur={() => note.trim() !== String(entry?.values.nota ?? '') && update({ nota: note.trim() })}
          placeholder="¿Algo para recordar de hoy?"
          placeholderTextColor={c['ink-600']}
        />
      </View>
    </Section>
  );
}

/** Esta semana contra la anterior, con frases simples. */
function WeekSummary({ cur, prev }: { cur: WeekStats; prev: WeekStats }) {
  const arrow = (a?: number, b?: number, fmt: (n: number) => string = decimal) => {
    if (a === undefined || b === undefined || Math.abs(a - b) < 0.05) return '';
    return `${a > b ? '▲' : '▼'} ${fmt(Math.abs(a - b))}`;
  };
  const tiles = [
    { label: 'Sueño', value: cur.sleep !== undefined ? formatSleep(cur.sleep) : '—', delta: arrow(cur.sleep, prev.sleep, (n) => formatSleep(n)) },
    { label: 'Ánimo', value: cur.mood !== undefined ? decimal(cur.mood) : '—', delta: arrow(cur.mood, prev.mood) },
    { label: 'Energía', value: cur.energy !== undefined ? decimal(cur.energy) : '—', delta: arrow(cur.energy, prev.energy) },
    { label: 'Estrés', value: cur.stress !== undefined ? decimal(cur.stress) : '—', delta: arrow(cur.stress, prev.stress) },
  ];

  const lines: string[] = [];
  if (cur.sleep !== undefined) {
    if (prev.sleep !== undefined && Math.abs(cur.sleep - prev.sleep) >= 0.25) {
      lines.push(`Dormiste ${formatSleep(Math.abs(cur.sleep - prev.sleep))} ${cur.sleep > prev.sleep ? 'más' : 'menos'} por noche que la semana pasada.`);
    } else lines.push(`Dormiste ${formatSleep(cur.sleep)} por noche en promedio.`);
  }
  if (cur.mood !== undefined && prev.mood !== undefined && Math.abs(cur.mood - prev.mood) >= 0.3) {
    lines.push(`Tu ánimo ${cur.mood > prev.mood ? 'subió' : 'bajó'} de ${decimal(prev.mood)} a ${decimal(cur.mood)}.`);
  }
  if (cur.stress !== undefined && prev.stress !== undefined && Math.abs(cur.stress - prev.stress) >= 0.3) {
    lines.push(`Tu estrés ${cur.stress < prev.stress ? 'bajó' : 'subió'} respecto de la semana pasada.`);
  }
  if (cur.habits > 0) lines.push(`Hiciste ${cur.habits} ${cur.habits === 1 ? 'hábito' : 'hábitos'} de autocuidado en la semana.`);

  return (
    <Section title="Tu semana" subtitle="Últimos 7 días, comparados con los 7 anteriores">
      <View className="flex-row gap-2">
        {tiles.map((t) => (
          <View key={t.label} className="min-w-0 flex-1 rounded-xl border border-ink-800 bg-ink-950 p-2.5">
            <Text className="text-base font-bold text-ink-100" style={{ fontVariant: ['tabular-nums'] }}>
              {t.value}
            </Text>
            <Text className="text-[11px] text-ink-400">{t.label}</Text>
            {!!t.delta && <Text className="mt-0.5 text-[11px] text-shu-300">{t.delta}</Text>}
          </View>
        ))}
      </View>
      {lines.length === 0 ? (
        <Text className="text-sm text-ink-400">Cuando anotes algunos días, acá te cuento cómo viene tu semana.</Text>
      ) : (
        <View className="gap-1.5">
          {lines.map((l) => (
            <Text key={l} className="text-sm leading-5 text-ink-200">
              • {l}
            </Text>
          ))}
        </View>
      )}
    </Section>
  );
}

/** Lo primero que se ve: el puntaje de la noche contra tu meta, la racha y el promedio de la semana. */
function SleepScoreCard({ entry, goal, streak, weekAvg }: { entry?: Entry; goal: number; streak: number; weekAvg?: number }) {
  const c = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(goal));
  const hours = sleepHours(entry?.values.horas);
  const quality = String(entry?.values.calidad ?? '');
  const from = String(entry?.values.acostarse ?? '');
  const to = String(entry?.values.levantarse ?? '');
  const score = hours !== undefined ? sleepScore(hours, goal, quality) : undefined;

  const saveGoal = () => {
    const n = Number(text.replace(',', '.'));
    if (n > 0) useDb.getState().updateUserProfile({ sleepGoal: Math.min(14, n) });
    setEditing(false);
  };

  return (
    <Hero title="Tu sueño" right={<SmallButton label="Meta" onPress={() => setEditing((o) => !o)} accessibilityLabel="Cambiar la meta de sueño" />}>
      {score !== undefined && hours !== undefined ? (
        <>
          <View className="flex-row items-end justify-between gap-3">
            <View>
              <Text className="text-4xl font-bold text-ink-100" style={{ fontVariant: ['tabular-nums'] }}>
                {formatSleep(hours)}
              </Text>
              <Text className="mt-0.5 text-xs text-ink-300">
                {scoreLabel(score)}
                {from && to ? ` · ${timeRange(from, to)}` : ''}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-3xl font-bold text-shu-300" style={{ fontVariant: ['tabular-nums'] }}>
                {score}
              </Text>
              <Text className="text-[11px] text-ink-400">de 100</Text>
            </View>
          </View>
          <View className="h-2.5 overflow-hidden rounded-full bg-ink-800">
            <View className="h-full rounded-full bg-shu-500" style={{ width: `${score}%` }} />
          </View>
          <Text className="text-xs text-ink-400">Sale de tus horas contra la meta de {formatSleep(goal)} y de la calidad.</Text>
        </>
      ) : (
        <Text className="text-sm text-ink-300">Todavía no anotaste cuánto dormiste anoche. Hacelo abajo y te muestro tu puntaje.</Text>
      )}
      <View className="flex-row gap-2">
        <View className="flex-1 rounded-xl bg-ink-950/60 p-3">
          <Text className="text-lg font-bold text-ink-100">{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
          <Text className="text-xs text-ink-400">{streak === 1 ? 'noche de 7 h o más' : 'noches seguidas de 7 h o más'}</Text>
        </View>
        <View className="flex-1 rounded-xl bg-ink-950/60 p-3">
          <Text className="text-lg font-bold text-ink-100">{weekAvg !== undefined ? formatSleep(weekAvg) : '—'}</Text>
          <Text className="text-xs text-ink-400">promedio de 7 días</Text>
        </View>
      </View>
      {editing && (
        <View className="flex-row items-center gap-2 border-t border-ink-800 pt-3">
          <Text className="flex-1 text-xs text-ink-400">Horas por noche</Text>
          <TextInput
            className="h-9 w-20 rounded-lg border border-ink-700 bg-ink-950 px-2 text-center text-[15px] text-ink-100"
            keyboardType="decimal-pad"
            value={text}
            onChangeText={setText}
            placeholderTextColor={c['ink-600']}
          />
          <SmallButton label="Guardar" strong onPress={saveGoal} />
        </View>
      )}
    </Hero>
  );
}

/** El mes entero con cada día pintado según el ánimo (como los "años en píxeles"). */
function MoodCalendar({ moodByDay, now }: { moodByDay: Map<string, Entry>; now: string }) {
  const [month, setMonth] = useState(now.slice(0, 7));
  const cells = useMemo(() => monthCells(moodByDay, month), [moodByDay, month]);
  const rated = cells.filter((x): x is { date: string; mood: number } => !!x && x.mood !== undefined);
  const avg = rated.length ? rated.reduce((s, x) => s + x.mood, 0) / rated.length : undefined;
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const label = formatDay(`${month}-01`, { month: 'long', year: 'numeric' });

  return (
    <Section
      title="Tu ánimo del mes"
      right={
        <View className="flex-row items-center">
          <Pressable onPress={() => setMonth(shiftMonth(month, -1))} className="px-2 py-1" accessibilityLabel="Mes anterior">
            <Text className="text-xl text-ink-300">‹</Text>
          </Pressable>
          <Pressable onPress={() => setMonth(shiftMonth(month, 1))} className="px-2 py-1" accessibilityLabel="Mes siguiente">
            <Text className="text-xl text-ink-300">›</Text>
          </Pressable>
        </View>
      }>
      <Text className="-mt-1 text-sm capitalize text-ink-300">
        {label}
        {avg !== undefined ? ` · promedio ${decimal(avg)}` : ''}
      </Text>
      <View className="gap-1.5">
        <View className="flex-row gap-1.5">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((w, i) => (
            <Text key={i} className="flex-1 text-center text-[11px] text-ink-500">
              {w}
            </Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} className="flex-row gap-1.5">
            {Array.from({ length: 7 }, (_, i) => {
              const cell = week[i];
              if (!cell) return <View key={i} className="h-9 flex-1" />;
              const m = cell.mood ?? 0;
              return (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${formatDay(cell.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${m ? MOODS[m - 1].label : 'sin anotar'}`}
                  className={`h-9 flex-1 items-center justify-center rounded-lg ${MOOD_BG[m]} ${cell.date === now ? 'border border-shu-400' : ''}`}>
                  <Text className={`text-[11px] ${m === 5 ? 'font-bold text-washi' : 'text-ink-100'}`}>{Number(cell.date.slice(8))}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View className="flex-row items-center gap-1.5">
        <Text className="text-[11px] text-ink-500">Muy mal</Text>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} className={`h-3 w-6 rounded-sm ${MOOD_BG[n]}`} />
        ))}
        <Text className="text-[11px] text-ink-500">Genial</Text>
      </View>
    </Section>
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
