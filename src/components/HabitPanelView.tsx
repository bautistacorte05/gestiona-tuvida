import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DAILY_CATEGORIES } from '../config/categories';
import { confirm } from '../lib/confirm';
import { formatDay, formatMonth, monthKey, shiftMonth, today } from '../lib/dates';
import { useDb } from '../lib/db';
import {
  buildHabits,
  cellState,
  doneDatesByKey,
  habitStats,
  isActiveInMonth,
  monthSummary,
  monthWeeks,
  weekdayIndex,
  type CellState,
  type DayProgress,
  type Habit,
} from '../lib/habits';
import { useIsDesktop } from '../lib/layout';
import { useCategoryName } from '../lib/names';
import { goToSub } from '../lib/nav';
import { formatMinutes } from '../lib/time';
import BackButton from './BackButton';
import { Stepper } from './common';
import ScreenTitle from './ScreenTitle';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CARD = 'rounded-2xl border border-ink-800 bg-ink-900 p-4';
// Grilla del celular: una semana, columnas que se reparten el ancho.
const PHONE_NAME_W = 104;
const PHONE_CELL = 26;
// Grilla de la PC: el mes entero, con la columna de nombres fija y los días desplazables.
const DESK_NAME_W = 180;
const DESK_CELL = 28;
const DESK_GAP = 4;
const DESK_ROW_H = 34;
const DESK_HEAD_H = 52;

const CELL_CLASS: Record<CellState, string> = {
  done: 'bg-shu-500 active:opacity-70',
  today: 'border-2 border-shu-500 active:opacity-70',
  missed: 'border border-ink-700 bg-ink-800/50 active:opacity-70',
  future: 'border border-ink-800',
  inactive: '',
};
const CELL_LABEL: Record<CellState, string> = {
  done: 'hecho',
  today: 'sin marcar todavía',
  missed: 'sin hacer',
  future: 'todavía no llegó',
  inactive: 'no contaba',
};

const pctText = (pct?: number) => (pct === undefined ? '—' : `${Math.round(pct * 100)}%`);

/** Semana que se muestra primero en el celular: la de hoy en el mes actual, la primera en los demás. */
function initialWeek(month: string, t: string) {
  const i = monthWeeks(month).findIndex((w) => w.includes(t));
  return i < 0 ? 0 : i;
}

function weekLabel(slots: (string | null)[], index: number) {
  const days = slots.filter((d): d is string => !!d);
  const last = formatDay(days[days.length - 1], { day: 'numeric', month: 'short' });
  return `Semana ${index + 1} · ${days.length > 1 ? `${Number(days[0].slice(8))}–` : ''}${last}`;
}

type Toggle = (h: Habit, date: string) => void;
type HabitRow = ReturnType<typeof habitStats> & { h: Habit };

/**
 * Metas → Panel de hábitos: el mes entero de las actividades de Hoy y las metas diarias.
 * No guarda nada propio: lee y marca los mismos tildes (`checks`) que Hoy y Metas → Diarias.
 */
export default function HabitPanelView() {
  const t = today();
  const isDesktop = useIsDesktop();
  const nameOf = useCategoryName();
  const [month, setMonth] = useState(() => monthKey(t));
  const [week, setWeek] = useState(() => initialWeek(monthKey(t), t));
  const goals = useDb((s) => s.dailyGoals);
  const checks = useDb((s) => s.checks);

  const allHabits = useMemo(
    () => buildHabits(goals, DAILY_CATEGORIES.map((c) => ({ id: c.id, name: nameOf(c.id, c.name), icon: c.icon }))),
    [goals, nameOf],
  );
  const habits = useMemo(() => allHabits.filter((h) => isActiveInMonth(h, month)), [allHabits, month]);
  const done = useMemo(() => doneDatesByKey(checks, habits.map((h) => h.key)), [checks, habits]);
  const summary = useMemo(() => monthSummary(habits, done, month, t), [habits, done, month, t]);
  const rows = useMemo<HabitRow[]>(
    () => habits.map((h) => ({ h, ...habitStats(h, done.get(h.key)!, month, t) })).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)),
    [habits, done, month, t],
  );
  const weeks = monthWeeks(month);
  const shownWeek = Math.min(week, weeks.length - 1);
  const hasGoals = habits.some((h) => h.kind === 'goal');

  const changeMonth = (delta: number) => {
    const m = shiftMonth(month, delta);
    setMonth(m);
    setWeek(initialWeek(m, t));
  };
  // En el celular se pasa de a una semana; en el borde del mes sigue con el mes de al lado.
  const changeWeek = (delta: number) => {
    const next = shownWeek + delta;
    if (next >= 0 && next < weeks.length) return setWeek(next);
    const m = shiftMonth(month, delta);
    setMonth(m);
    setWeek(delta > 0 ? 0 : monthWeeks(m).length - 1);
  };

  const toggle: Toggle = async (h, date) => {
    const { checks: current, toggleCheck } = useDb.getState();
    const check = current.find((c) => c.id === `${date}|${h.key}`);
    // Desmarcar una actividad borra también el tiempo cargado ese día (igual que en Hoy): se pregunta antes.
    if (check?.minutos) {
      const when = formatDay(date, { day: 'numeric', month: 'long' });
      const ok = await confirm(`¿Desmarcar ${h.title} del ${when}?`, `Ese día tenía ${formatMinutes(check.minutos)} cargados en "Tiempo" y se van a borrar.`, 'Desmarcar');
      if (!ok) return;
    }
    toggleCheck(date, h.key);
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <BackButton />
            <ScreenTitle categoryId="metas" subId="panel" />
          </View>
          <Stepper label={formatMonth(month)} onPrev={() => changeMonth(-1)} onNext={() => changeMonth(1)} />
        </View>

        <View className={CARD}>
          <Text className="text-base font-bold text-ink-100">Progreso del mes</Text>
          {summary.possible === 0 ? (
            <Text className="mt-2 text-sm text-ink-400">Este mes todavía no empezó.</Text>
          ) : (
            <>
              <View className="mt-2 flex-row flex-wrap items-baseline gap-x-3">
                <Text className="text-4xl font-bold text-shu-400">{pctText(summary.pct)}</Text>
                <Text className="text-sm text-ink-400">
                  {summary.done} de {summary.possible} cumplidos{summary.daysLeft > 0 ? ' hasta hoy' : ''}
                </Text>
              </View>
              <View className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
                <View className="h-full rounded-full bg-shu-500" style={{ width: `${(summary.pct ?? 0) * 100}%` }} />
              </View>
              {summary.daysLeft > 0 && (
                <Text className="mt-2 text-xs text-ink-500">
                  Quedan {summary.daysLeft} {summary.daysLeft === 1 ? 'día' : 'días'} del mes.
                </Text>
              )}
            </>
          )}
        </View>

        <View className={CARD}>
          <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-base font-bold text-ink-100">Día por día</Text>
            {!isDesktop && <Stepper label={weekLabel(weeks[shownWeek], shownWeek)} onPrev={() => changeWeek(-1)} onNext={() => changeWeek(1)} />}
          </View>
          {isDesktop ? (
            <MonthGrid habits={habits} weeks={weeks} done={done} today={t} onToggle={toggle} />
          ) : (
            <WeekGrid habits={habits} days={weeks[shownWeek]} done={done} today={t} onToggle={toggle} />
          )}
          <Text className="mt-3 text-xs text-ink-500">Tocá un cuadradito para marcar o desmarcar un día que ya pasó.</Text>
        </View>

        <DayChart byDay={summary.byDay} today={t} />

        <View className={CARD}>
          <Text className="mb-3 text-base font-bold text-ink-100">Cómo vas con cada uno</Text>
          <View className="gap-3">
            {rows.map((r) => (
              <HabitProgress key={r.h.key} row={r} />
            ))}
          </View>
        </View>

        {!hasGoals && (
          <Pressable onPress={() => goToSub('metas', 'diarias')} className="rounded-2xl border border-dashed border-ink-800 p-4">
            <Text className="text-center text-sm text-ink-400">
              Sumá tus propios hábitos (meditar, tomar agua…) en <Text className="font-semibold text-shu-400">Metas → Diarias ›</Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({ h, date, size, state, onToggle }: { h: Habit; date: string; size: number; state: CellState; onToggle: Toggle }) {
  const disabled = state === 'future' || state === 'inactive';
  return (
    <Pressable
      disabled={disabled}
      onPress={() => onToggle(h, date)}
      accessibilityLabel={`${h.title}, ${formatDay(date, { weekday: 'long', day: 'numeric' })}: ${CELL_LABEL[state]}`}
      className={`items-center justify-center rounded-lg ${CELL_CLASS[state]}`}
      style={{ width: size, height: size }}>
      {state === 'done' && <Text className="text-xs font-bold text-washi">✓</Text>}
      {state === 'inactive' && <Text className="text-xs text-ink-700">·</Text>}
    </Pressable>
  );
}

type GridProps = { habits: Habit[]; done: Map<string, Set<string>>; today: string; onToggle: Toggle };

/** Celular: una semana (lunes a domingo); los días de otro mes quedan vacíos. */
function WeekGrid({ habits, days, done, today, onToggle }: GridProps & { days: (string | null)[] }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-end">
        <View style={{ width: PHONE_NAME_W }} />
        {days.map((date, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="text-[10px] text-ink-500">{WEEKDAYS[i]}</Text>
            <Text className={`text-xs ${date === today ? 'font-bold text-shu-400' : 'text-ink-300'}`}>{date ? Number(date.slice(8)) : ' '}</Text>
          </View>
        ))}
      </View>
      {habits.map((h) => (
        <View key={h.key} className="flex-row items-center">
          <Text numberOfLines={2} className="pr-2 text-sm text-ink-200" style={{ width: PHONE_NAME_W }}>
            {h.icon} {h.title}
          </Text>
          {days.map((date, i) => (
            <View key={i} className="flex-1 items-center">
              {!!date && <Cell h={h} date={date} size={PHONE_CELL} state={cellState(h, date, !!done.get(h.key)?.has(date), today)} onToggle={onToggle} />}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** PC: el mes entero agrupado por semana, con los nombres fijos a la izquierda. */
function MonthGrid({ habits, weeks, done, today, onToggle }: GridProps & { weeks: (string | null)[][] }) {
  return (
    <View className="flex-row">
      <View style={{ width: DESK_NAME_W }}>
        <View style={{ height: DESK_HEAD_H }} />
        {habits.map((h) => (
          <View key={h.key} style={{ height: DESK_ROW_H }} className="justify-center pr-3">
            <Text numberOfLines={1} className="text-sm text-ink-200">
              {h.icon} {h.title}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal className="flex-1" contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
        {weeks.map((slots, w) => {
          const days = slots.filter((d): d is string => !!d);
          return (
            <View key={w}>
              <View style={{ height: DESK_HEAD_H }} className="justify-end">
                <Text numberOfLines={1} className="mb-1 text-[11px] font-semibold text-ink-400">
                  {days.length >= 3 ? `Semana ${w + 1}` : `S${w + 1}`}
                </Text>
                <View className="flex-row" style={{ gap: DESK_GAP }}>
                  {days.map((d) => (
                    <View key={d} style={{ width: DESK_CELL }} className="items-center">
                      <Text className="text-[10px] text-ink-500">{WEEKDAYS[weekdayIndex(d)]}</Text>
                      <Text className={`text-xs ${d === today ? 'font-bold text-shu-400' : 'text-ink-300'}`}>{Number(d.slice(8))}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {habits.map((h) => (
                <View key={h.key} style={{ height: DESK_ROW_H, gap: DESK_GAP }} className="flex-row items-center">
                  {days.map((d) => (
                    <Cell key={d} h={h} date={d} size={DESK_CELL} state={cellState(h, d, !!done.get(h.key)?.has(d), today)} onToggle={onToggle} />
                  ))}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Una barra por día: la altura es la parte de los hábitos de ese día que se cumplió (llena = todos). */
function DayChart({ byDay, today }: { byDay: DayProgress[]; today: string }) {
  return (
    <View className={CARD}>
      <Text className="mb-3 text-base font-bold text-ink-100">Cada día</Text>
      <View className="h-28 flex-row items-end gap-[2px]">
        {byDay.map((d) => (
          <View key={d.date} className="h-full flex-1 justify-end">
            <View
              className={`w-full rounded-t-sm ${d.ratio ? 'bg-shu-500' : 'bg-ink-800'} ${d.date === today ? 'border border-ink-100/60' : ''}`}
              style={{ height: d.ratio ? `${Math.max(d.ratio * 100, 4)}%` : 3 }}
            />
          </View>
        ))}
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-[10px] text-ink-500">1</Text>
        <Text className="text-[10px] text-ink-500">{Math.ceil(byDay.length / 2)}</Text>
        <Text className="text-[10px] text-ink-500">{byDay.length}</Text>
      </View>
      <Text className="mt-2 text-xs text-ink-500">Barra llena = ese día hiciste todo lo que tocaba.</Text>
    </View>
  );
}

function HabitProgress({ row }: { row: HabitRow }) {
  const { h, done, possible, pct, current, best } = row;
  return (
    <View>
      <View className="mb-1 flex-row items-baseline justify-between gap-2">
        <Text numberOfLines={1} className="flex-1 text-sm text-ink-100">
          {h.icon} {h.title}
        </Text>
        <Text className="text-sm font-semibold text-ink-100">{pctText(pct)}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-ink-800">
        <View className="h-full rounded-full bg-shu-500" style={{ width: `${(pct ?? 0) * 100}%` }} />
      </View>
      <View className="mt-1 flex-row flex-wrap gap-x-3">
        <Text className="text-xs text-ink-500">
          {done} de {possible} {possible === 1 ? 'día' : 'días'}
        </Text>
        {current > 0 && <Text className="text-xs font-medium text-shu-400">🔥 {current} seguidos</Text>}
        {best > 0 && <Text className="text-xs text-ink-500">Mejor racha: {best}</Text>}
      </View>
    </View>
  );
}
