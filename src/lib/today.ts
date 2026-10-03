import { QUESTIONS, type Question } from '../config/questions';
import type { Entry, Note } from './db';
import { isActiveOn, streaks, type Habit } from './habits';

/**
 * Cuentas de las tarjetas nuevas de Hoy (rachas, pregunta del día, "¿Cómo estuvo tu día?").
 * Funciones puras: reciben los datos y la fecha de hoy, no leen la base ni el reloj.
 *
 * Las rachas siguen la regla de computeStreak (lib/streak.ts): si hoy todavía no está, se
 * cuenta desde ayer, así la racha no se "rompe" antes de que termine el día.
 */

/** Días seguidos con al menos un hábito tildado (actividades o metas diarias). */
export function habitDaysStreak(habits: Habit[], done: Map<string, Set<string>>, today: string) {
  const days = new Set<string>();
  for (const h of habits) {
    for (const d of done.get(h.key) ?? []) if (isActiveOn(h, d)) days.add(d);
  }
  return streaks(days, today).current;
}

/** Número de día (días desde 1970) de una fecha YYYY-MM-DD, sin depender de la zona horaria. */
function dayNumber(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Cuánto se avanza en la lista de un día al siguiente. No es 1 para que "Otra pregunta" (la que
 * sigue en la lista) no muestre la de mañana; al no tener divisores en común con el largo de la
 * lista, igual pasan todas antes de repetirse.
 */
function stride(length: number) {
  return [37, 41, 43, 47, 53, 59, 61, 67, 71].find((s) => gcd(s, length) === 1) ?? 1;
}

/** La pregunta del día de esa fecha (siempre la misma para la misma fecha). `skip`: cuántas veces se tocó "Otra pregunta". */
export function questionFor(date: string, skip = 0, list: readonly Question[] = QUESTIONS): Question {
  const n = list.length;
  const base = (((dayNumber(date) * stride(n)) % n) + n) % n;
  return list[(base + skip) % n];
}

/** La respuesta a la pregunta del día de esa fecha (si hubiera más de una, la última editada). */
export function questionAnswer(notes: Note[], date: string) {
  let found: Note | undefined;
  for (const n of notes) {
    if (n.kind === 'pregunta' && n.date === date && (!found || n.updatedAt > found.updatedAt)) found = n;
  }
  return found;
}

/** El ánimo anotado ese día (Bienestar → Ánimo); si hubiera más de uno, el último editado (como la hoja de Bienestar). */
export function moodEntryOf(entries: Entry[], date: string) {
  let found: Entry | undefined;
  for (const e of entries) {
    if (e.categoryId === 'bienestar' && e.subId === 'animo' && e.date === date && (!found || e.updatedAt > found.updatedAt)) found = e;
  }
  return found;
}
