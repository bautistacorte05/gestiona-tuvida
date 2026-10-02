import { monthKey, monthRange, shiftDay, toISO, weekStart } from './dates';
import type { Check, DailyGoal } from './db';

/**
 * Cálculos de la grilla de hábitos de Hoy. Funciones puras: reciben los datos y la fecha de
 * hoy, no leen la base ni el reloj, así se pueden probar sueltas.
 *
 * Un hábito es una actividad de Hoy (Entrenamiento, Lectura…) o una meta diaria. Los dos guardan
 * el tilde de cada día en `checks`: las actividades con su id ('lectura') y las metas con `goal:<id>`.
 */

export interface Habit {
  /** categoryId del tilde en `checks`: id de la actividad o `goal:<id>` para una meta diaria. */
  key: string;
  title: string;
  icon: string;
  kind: 'activity' | 'goal';
  /** Primer día (YYYY-MM-DD) en que cuenta. Sin valor = desde siempre (actividades). */
  from?: string;
  /** Último día en que cuenta. Sin valor = sigue vigente. */
  until?: string;
}

/** Estado de un cuadradito de la grilla. */
export type CellState = 'done' | 'today' | 'missed' | 'future' | 'inactive';

export const goalKey = (id: string) => `goal:${id}`;

/**
 * Actividades primero (en el orden de Hoy) y después las metas diarias en el orden en que se crearon.
 * Una meta cuenta desde el día en que se creó hasta el día anterior a borrarla (misma regla que las
 * tareas fijas del Plan del día). Las borradas antes de que existiera `archivedAt` no se muestran:
 * no se sabe desde cuándo dejaron de contar.
 */
export function buildHabits(goals: DailyGoal[], activities: { id: string; name: string; icon: string }[]): Habit[] {
  const out: Habit[] = activities.map((a) => ({ key: a.id, title: a.name, icon: a.icon, kind: 'activity' }));
  for (const g of [...goals].sort((a, b) => a.createdAt - b.createdAt)) {
    if (g.archived && !g.archivedAt) continue;
    const from = toISO(new Date(g.createdAt));
    const until = g.archivedAt ? shiftDay(toISO(new Date(g.archivedAt)), -1) : undefined;
    if (until && until < from) continue; // creada y borrada el mismo día: nunca contó
    out.push({ key: goalKey(g.id), title: g.title, icon: '🎯', kind: 'goal', from, until });
  }
  return out;
}

export function isActiveOn(h: Habit, date: string) {
  return (!h.from || date >= h.from) && (!h.until || date <= h.until);
}

/** ¿El hábito contó al menos un día entre esas dos fechas (inclusive)? */
export function isActiveInRange(h: Habit, start: string, end: string) {
  return (!h.from || h.from <= end) && (!h.until || h.until >= start);
}

/** ¿El hábito contó al menos un día de ese mes? */
export function isActiveInMonth(h: Habit, month: string) {
  const { start, end } = monthRange(month);
  return isActiveInRange(h, start, end);
}

/** Los 7 días (lunes a domingo) de la semana que contiene la fecha; pueden caer en dos meses. */
export function weekDates(date: string) {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
}

/** Día que queda elegido al pasar a otro mes: hoy si es el mes actual, si no el 1. */
export function monthDefaultDate(month: string, today: string) {
  return monthKey(today) === month ? today : `${month}-01`;
}

/** Días con tilde de cada hábito. */
export function doneDatesByKey(checks: Check[], keys: string[]) {
  const out = new Map<string, Set<string>>(keys.map((k) => [k, new Set<string>()]));
  for (const c of checks) out.get(c.categoryId)?.add(c.date);
  return out;
}

/** Todas las fechas del mes ('YYYY-MM') en orden. */
export function monthDates(month: string) {
  const { days } = monthRange(month);
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** Semanas del mes de lunes a domingo; los días que caen en otro mes quedan en null. */
export function monthWeeks(month: string): (string | null)[][] {
  const dates = monthDates(month);
  const slots: (string | null)[] = [...Array<null>(weekdayIndex(dates[0])).fill(null), ...dates];
  while (slots.length % 7) slots.push(null);
  return Array.from({ length: slots.length / 7 }, (_, i) => slots.slice(i * 7, i * 7 + 7));
}

export function cellState(h: Habit, date: string, done: boolean, today: string): CellState {
  if (!isActiveOn(h, date)) return 'inactive';
  if (date > today) return 'future';
  if (done) return 'done';
  return date === today ? 'today' : 'missed';
}

export interface DayProgress {
  date: string;
  done: number;
  /** Hábitos que contaban ese día (0 en los días que todavía no llegaron). */
  active: number;
  /** done / active, o undefined si ese día no contaba nada (o es futuro). */
  ratio?: number;
}

/**
 * Resumen del mes: cuántos tildes se hicieron de los posibles hasta hoy (los días que faltan
 * no cuentan todavía) y el avance de cada día.
 */
export function monthSummary(habits: Habit[], done: Map<string, Set<string>>, month: string, today: string) {
  let doneTotal = 0;
  let possible = 0;
  const dates = monthDates(month);
  const byDay: DayProgress[] = dates.map((date) => {
    if (date > today) return { date, done: 0, active: 0 };
    let d = 0;
    let a = 0;
    for (const h of habits) {
      if (!isActiveOn(h, date)) continue;
      a++;
      if (done.get(h.key)?.has(date)) d++;
    }
    doneTotal += d;
    possible += a;
    return { date, done: d, active: a, ratio: a ? d / a : undefined };
  });
  return {
    done: doneTotal,
    possible,
    pct: possible ? doneTotal / possible : undefined,
    daysLeft: dates.filter((d) => d > today).length,
    byDay,
  };
}

/**
 * Rachas de días seguidos con tilde. La actual sigue la regla de computeStreak (lib/streak.ts):
 * si hoy todavía no está marcado, se cuenta desde ayer para no "romperla" antes de que termine el día.
 * La mejor es la más larga de toda la historia (sin contar días futuros).
 */
export function streaks(dates: Set<string>, today: string) {
  let cursor = dates.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (dates.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const d of [...dates].filter((x) => x <= today).sort()) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best };
}

/** Cumplimiento de un hábito en el mes (hasta hoy) y sus rachas. */
export function habitStats(h: Habit, dates: Set<string>, month: string, today: string) {
  let done = 0;
  let possible = 0;
  for (const date of monthDates(month)) {
    if (date > today || !isActiveOn(h, date)) continue;
    possible++;
    if (dates.has(date)) done++;
  }
  return { done, possible, pct: possible ? done / possible : undefined, ...streaks(dates, today) };
}

export type HabitRow = ReturnType<typeof habitStats> & { h: Habit };

/** Cada hábito con su cumplimiento del mes, de más a menos cumplido (los empates, en el orden de la grilla). */
export function habitRows(habits: Habit[], done: Map<string, Set<string>>, month: string, today: string): HabitRow[] {
  return habits
    .map((h) => ({ h, ...habitStats(h, done.get(h.key) ?? new Set<string>(), month, today) }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}

/** Hábitos hechos y hábitos que contaban un día puntual (cualquier fecha, también futura). */
export function dayProgress(habits: Habit[], done: Map<string, Set<string>>, date: string) {
  let d = 0;
  let active = 0;
  for (const h of habits) {
    if (!isActiveOn(h, date)) continue;
    active++;
    if (done.get(h.key)?.has(date)) d++;
  }
  return { done: d, active };
}
