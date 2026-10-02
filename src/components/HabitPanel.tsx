import { Pressable, ScrollView, Text, View } from 'react-native';

import { confirm } from '../lib/confirm';
import { formatDay, formatMonth, monthKey, shiftDay, shiftMonth, today } from '../lib/dates';
import { useDb } from '../lib/db';
import {
  cellState,
  isActiveInMonth,
  isActiveInRange,
  monthDefaultDate,
  monthWeeks,
  weekDates,
  weekdayIndex,
  type CellState,
  type DayProgress,
  type Habit,
  type HabitRow,
} from '../lib/habits';
import { useIsDesktop } from '../lib/layout';
import { goToSub } from '../lib/nav';
import { formatMinutes } from '../lib/time';
import { Stepper } from './common';

/**
 * Piezas de la grilla de hábitos de Hoy: la grilla día por día, el progreso del mes, una barra
 * por día y el avance de cada hábito. No guardan nada propio: leen y marcan los mismos tildes
 * (`checks`) que las metas diarias.
 */

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const CARD = 'rounded-2xl border border-ink-800 bg-ink-900 p-4';
// Grilla del celular: una semana, columnas que se reparten el ancho.
const PHONE_NAME_W = 104;
const PHONE_CELL = 26;
// Grilla de la PC: el mes entero, con la columna de nombres fija y los días desplazables.
const DESK_NAME_W = 180;
const DESK_CELL = 28;
const DESK_GAP = 4;
const DESK_ROW_H = 34;
const DESK_HEAD_H = 58;

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

/** Marca o desmarca un hábito un día. Desmarcar una actividad con tiempo cargado a mano ese día lo borra: se pregunta antes. */
export async function toggleHabit(h: Habit, date: string) {
  const { checks, toggleCheck } = useDb.getState();
  const check = checks.find((c) => c.id === `${date}|${h.key}`);
  if (check?.minutos) {
    const when = formatDay(date, { day: 'numeric', month: 'long' });
    const ok = await confirm(`¿Desmarcar ${h.title} del ${when}?`, `Ese día tenía ${formatMinutes(check.minutos)} cargados a mano y se van a borrar.`, 'Desmarcar');
    if (!ok) return;
  }
  toggleCheck(date, h.key);
}

/** Cuadradito con tilde: el de la grilla y el de las tareas del Plan del día. */
export function CheckSquare({ state, size, label, onPress }: { state: CellState; size: number; label: string; onPress?: () => void }) {
  return (
    <Pressable
      disabled={!onPress || state === 'future' || state === 'inactive'}
      onPress={onPress}
      accessibilityLabel={label}
      className={`items-center justify-center rounded-lg ${CELL_CLASS[state]}`}
      style={{ width: size, height: size }}>
      {state === 'done' && <Text className="text-xs font-bold text-washi">✓</Text>}
      {state === 'inactive' && <Text className="text-xs text-ink-700">·</Text>}
    </Pressable>
  );
}

function Cell({ h, date, size, done, now }: { h: Habit; date: string; size: number; done: Map<string, Set<string>>; now: string }) {
  const state = cellState(h, date, !!done.get(h.key)?.has(date), now);
  return (
    <CheckSquare
      state={state}
      size={size}
      label={`${h.title}, ${formatDay(date, { weekday: 'long', day: 'numeric' })}: ${CELL_LABEL[state]}`}
      onPress={() => void toggleHabit(h, date)}
    />
  );
}

/** Encabezado de una columna: tocarlo elige ese día. El día elegido va resaltado; hoy, con el color de la app. */
function DayHeader({ date, selected, now, width, onSelect }: { date: string; selected: string; now: string; width?: number; onSelect: (d: string) => void }) {
  const isSelected = date === selected;
  return (
    <Pressable
      onPress={() => onSelect(date)}
      accessibilityLabel={`Ver ${formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}`}
      className={`items-center rounded-lg py-0.5 ${isSelected ? 'bg-ink-700' : 'active:bg-ink-800'}`}
      style={width ? { width } : { alignSelf: 'stretch', marginHorizontal: 2 }}>
      <Text className={`text-[10px] ${isSelected ? 'text-ink-100' : 'text-ink-500'}`}>{WEEKDAYS[weekdayIndex(date)]}</Text>
      <Text className={`text-xs ${date === now ? 'font-bold text-shu-400' : isSelected ? 'font-bold text-ink-100' : 'text-ink-300'}`}>{Number(date.slice(8))}</Text>
    </Pressable>
  );
}

function weekLabel(days: string[]) {
  const first = days[0];
  const last = days[days.length - 1];
  const end = formatDay(last, { day: 'numeric', month: 'short' });
  return monthKey(first) === monthKey(last) ? `${Number(first.slice(8))}–${end}` : `${formatDay(first, { day: 'numeric', month: 'short' })} – ${end}`;
}

type GridProps = { habits: Habit[]; done: Map<string, Set<string>>; selected: string; now: string; onSelect: (d: string) => void };

/**
 * Tarjeta "Día por día". Celular: la semana del día elegido (‹ › mueve una semana).
 * PC: el mes entero del día elegido (‹ › cambia de mes). Todo sale del día elegido.
 */
export function HabitGrid({ habits, done, date, onSelectDate }: { habits: Habit[]; done: Map<string, Set<string>>; date: string; onSelectDate: (d: string) => void }) {
  const isDesktop = useIsDesktop();
  const now = today();
  const month = monthKey(date);
  const week = weekDates(date);
  const shown = habits.filter((h) => (isDesktop ? isActiveInMonth(h, month) : isActiveInRange(h, week[0], week[6])));
  const props: GridProps = { habits: shown, done, selected: date, now, onSelect: onSelectDate };

  return (
    <View className={CARD}>
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-base font-bold text-ink-100">Día por día</Text>
        {isDesktop ? (
          <Stepper
            label={formatMonth(month)}
            onPrev={() => onSelectDate(monthDefaultDate(shiftMonth(month, -1), now))}
            onNext={() => onSelectDate(monthDefaultDate(shiftMonth(month, 1), now))}
          />
        ) : (
          <Stepper label={weekLabel(week)} onPrev={() => onSelectDate(shiftDay(date, -7))} onNext={() => onSelectDate(shiftDay(date, 7))} />
        )}
      </View>
      {isDesktop ? <MonthGrid {...props} weeks={monthWeeks(month)} /> : <WeekGrid {...props} days={week} />}
      <Text className="mt-3 text-xs text-ink-500">Tocá un cuadradito para marcarlo. Tocá un día de arriba para ver sus tareas.</Text>
    </View>
  );
}

/** Celular: una semana de lunes a domingo. */
function WeekGrid({ habits, done, selected, now, onSelect, days }: GridProps & { days: string[] }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-end">
        <View style={{ width: PHONE_NAME_W }} />
        {days.map((d) => (
          <View key={d} className="flex-1 items-center">
            <DayHeader date={d} selected={selected} now={now} onSelect={onSelect} />
          </View>
        ))}
      </View>
      {habits.map((h) => (
        <View key={h.key} className="flex-row items-center">
          <Text numberOfLines={2} className="pr-2 text-sm text-ink-200" style={{ width: PHONE_NAME_W }}>
            {h.icon} {h.title}
          </Text>
          {days.map((d) => (
            <View key={d} className="flex-1 items-center">
              <Cell h={h} date={d} size={PHONE_CELL} done={done} now={now} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** PC: el mes entero agrupado por semana, con los nombres fijos a la izquierda. */
function MonthGrid({ habits, done, selected, now, onSelect, weeks }: GridProps & { weeks: (string | null)[][] }) {
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
                    <DayHeader key={d} date={d} selected={selected} now={now} width={DESK_CELL} onSelect={onSelect} />
                  ))}
                </View>
              </View>
              {habits.map((h) => (
                <View key={h.key} style={{ height: DESK_ROW_H, gap: DESK_GAP }} className="flex-row items-center">
                  {days.map((d) => (
                    <Cell key={d} h={h} date={d} size={DESK_CELL} done={done} now={now} />
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

/** Cuánto se cumplió en el mes, hasta hoy. */
export function MonthProgress({ month, summary }: { month: string; summary: { done: number; possible: number; pct?: number; daysLeft: number } }) {
  return (
    <View className={CARD}>
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-2">
        <Text className="text-base font-bold text-ink-100">Progreso del mes</Text>
        <Text className="text-xs text-ink-500">{formatMonth(month)}</Text>
      </View>
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
  );
}

/** Una barra por día del mes: la altura es la parte de los hábitos de ese día que se cumplió (llena = todos). */
export function DayChart({ byDay, selected }: { byDay: DayProgress[]; selected: string }) {
  return (
    <View className={CARD}>
      <Text className="mb-3 text-base font-bold text-ink-100">Cada día</Text>
      <View className="h-28 flex-row items-end gap-[2px]">
        {byDay.map((d) => (
          <View key={d.date} className="h-full flex-1 justify-end">
            <View
              className={`w-full rounded-t-sm ${d.ratio ? 'bg-shu-500' : 'bg-ink-800'} ${d.date === selected ? 'border border-ink-100/60' : ''}`}
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

/** Cumplimiento del mes y rachas de cada hábito. */
export function HabitProgressList({ rows }: { rows: HabitRow[] }) {
  return (
    <View className={CARD}>
      <Text className="mb-3 text-base font-bold text-ink-100">Cómo vas con cada uno</Text>
      <View className="gap-3">
        {rows.map(({ h, done, possible, pct, current, best }) => (
          <View key={h.key}>
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
        ))}
      </View>
    </View>
  );
}

/** Aviso cuando todavía no hay metas diarias: lleva a crearlas. */
export function GoalsHint() {
  return (
    <Pressable onPress={() => goToSub('metas', 'diarias')} className="rounded-2xl border border-dashed border-ink-800 p-4">
      <Text className="text-center text-sm text-ink-400">
        Sumá tus propios hábitos (meditar, tomar agua…) en <Text className="font-semibold text-shu-400">Metas → Diarias ›</Text>
      </Text>
    </Pressable>
  );
}
