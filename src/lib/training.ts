import { daysBetween, formatDay, monthKey, shiftDay, weekStart } from './dates'
import type { Check, Entry } from './db'
import { weekDates } from './habits'
import { tagsOf } from './stats'

/**
 * Cálculos de la hoja de Entrenamiento. Funciones puras: reciben los datos y la fecha de hoy
 * (no leen la base ni el reloj), así se pueden probar sueltas.
 *
 * Un día cuenta como entrenado si se tildó Entrenamiento en Hoy o si tiene un registro de Gimnasio.
 */

export type DayState = 'done' | 'today' | 'missed' | 'future'

export const isTraining = (e: Entry) => e.categoryId === 'entrenamiento' && e.subId === 'gimnasio'

/** Días con entrenamiento: tildados en Hoy o con un registro de Gimnasio. */
export function trainingDays(entries: Entry[], checks: Check[]): Set<string> {
  const out = new Set<string>()
  for (const c of checks) if (c.categoryId === 'entrenamiento') out.add(c.date)
  for (const e of entries) if (isTraining(e)) out.add(e.date)
  return out
}

/** Estado de un día en la semana y en el calendario (misma regla que la grilla de Hoy). */
export function dayState(date: string, done: Set<string>, today: string): DayState {
  if (date > today) return 'future'
  if (done.has(date)) return 'done'
  return date === today ? 'today' : 'missed'
}

/**
 * Minutos entrenados entre dos fechas (inclusive): los de los registros de cada día. Los días sin
 * registros suman los minutos que se cargaban a mano en Hoy (el viejo "⏱ Tiempo").
 */
export function trainingMinutes(entries: Entry[], checks: Check[], start: string, end: string) {
  const byDay = new Map<string, number>()
  for (const e of entries) {
    if (!isTraining(e) || e.date < start || e.date > end) continue
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + (Number(e.values.minutos) || 0))
  }
  let total = 0
  for (const m of byDay.values()) total += m
  for (const c of checks) {
    if (c.categoryId !== 'entrenamiento' || !c.minutos || c.date < start || c.date > end) continue
    if (!byDay.has(c.date)) total += c.minutos
  }
  return total
}

/** Resumen de la semana (lunes a domingo) que contiene `today`, contando hasta hoy. */
export function weekSummary(entries: Entry[], checks: Check[], today: string) {
  const days = weekDates(today)
  const done = trainingDays(entries, checks)
  return {
    days,
    done,
    trainedDays: days.filter((d) => d <= today && done.has(d)).length,
    minutes: trainingMinutes(entries, checks, days[0], today),
  }
}

export interface GroupStat {
  name: string
  /** Veces que se trabajó esta semana. */
  count: number
  /** Última vez (hasta hoy). */
  lastDate?: string
}

/** Por cada grupo muscular: cuántas veces esta semana y cuándo fue la última vez. */
export function groupStats(entries: Entry[], groups: string[], today: string): GroupStat[] {
  const start = weekStart(today)
  return groups.map((name) => {
    let count = 0
    let lastDate: string | undefined
    for (const e of entries) {
      if (!isTraining(e) || e.date > today || !tagsOf(e.values.grupo).includes(name)) continue
      if (e.date >= start) count++
      if (!lastDate || e.date > lastDate) lastDate = e.date
    }
    return { name, count, lastDate }
  })
}

/** "1 vez", "3 veces", "ayer", "hace 9 días" o "Nunca". */
export function groupHint(g: GroupStat, today: string) {
  if (g.count > 0) return g.count === 1 ? '1 vez' : `${g.count} veces`
  if (!g.lastDate) return 'Nunca'
  const n = daysBetween(g.lastDate, today)
  return n === 1 ? 'ayer' : `hace ${n} días`
}

/** "Pecho", "Pecho y Core", "Pecho, Core y Brazos". */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

/** Las últimas `n` semanas (lunes a domingo), la de hoy al final. */
export function lastWeeks(today: string, n = 5): string[][] {
  const first = shiftDay(weekStart(today), -7 * (n - 1))
  return Array.from({ length: n }, (_, w) => Array.from({ length: 7 }, (_, d) => shiftDay(first, w * 7 + d)))
}

/** "1–7 oct" o "28 sept – 4 oct". */
export function weekLabel(days: string[]) {
  const first = days[0]
  const last = days[days.length - 1]
  const end = formatDay(last, { day: 'numeric', month: 'short' })
  return monthKey(first) === monthKey(last) ? `${Number(first.slice(8))}–${end}` : `${formatDay(first, { day: 'numeric', month: 'short' })} – ${end}`
}

/** Tiempo corto para números grandes: "45 min", "2 h", "2 h 35". */
export function shortMinutes(min: number) {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r}` : `${h} h`
}

/** Más nuevos primero (por fecha y, el mismo día, por cuándo se cargaron). */
export const newestFirst = (a: Entry, b: Entry) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt

/** Fecha de una fila de lista: "Jueves, 1 de octubre"; de otro año, "1 de octubre de 2025". */
export function listDate(iso: string, today: string) {
  return iso.slice(0, 4) === today.slice(0, 4)
    ? formatDay(iso, { weekday: 'long', day: 'numeric', month: 'long' })
    : formatDay(iso, { day: 'numeric', month: 'long', year: 'numeric' })
}
