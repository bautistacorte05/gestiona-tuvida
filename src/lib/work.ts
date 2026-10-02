import { monthKey } from './dates'
import type { Check, Entry } from './db'

/**
 * Cálculos de la hoja de Trabajo. Funciones puras: reciben los datos y la fecha de hoy
 * (no leen la base ni el reloj), así se pueden probar sueltas.
 */

/** Meta de horas por semana si el usuario no eligió otra (Ajustes no la tiene: se cambia en la hoja). */
export const DEFAULT_WEEKLY_GOAL = 40

export const TASK_STATES = ['Pendiente', 'En curso', 'Hecha'] as const
export type TaskState = (typeof TASK_STATES)[number]

export const isJornada = (e: Entry) => e.categoryId === 'trabajo' && e.subId === 'jornada'
export const isTask = (e: Entry) => e.categoryId === 'trabajo' && e.subId === 'tareas'

const dec1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
/** Horas con coma decimal: "8", "7,5". */
export const formatHours = (h: number) => dec1.format(h)

/**
 * Horas trabajadas en cada uno de esos días: las de las jornadas cargadas. Los días sin jornada
 * suman los minutos que se cargaban a mano en Hoy (el viejo "⏱ Tiempo").
 */
export function hoursByDay(entries: Entry[], checks: Check[], days: string[]): number[] {
  const wanted = new Set(days)
  const byDay = new Map<string, number>()
  for (const e of entries) {
    if (!isJornada(e) || !wanted.has(e.date)) continue
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + (Number(e.values.horas) || 0))
  }
  const legacy = new Map<string, number>()
  for (const c of checks) {
    if (c.categoryId === 'trabajo' && c.minutos && wanted.has(c.date) && !byDay.has(c.date)) legacy.set(c.date, c.minutos / 60)
  }
  return days.map((d) => byDay.get(d) ?? legacy.get(d) ?? 0)
}

/** Total de la semana (hasta hoy), cuánto falta y el alto de referencia de las barras. */
export function weekProgress(days: string[], hours: number[], goal: number, today: string) {
  const total = hours.reduce((sum, h, i) => (days[i] <= today ? sum + h : sum), 0)
  const remaining = Math.max(0, goal - total)
  return {
    total,
    remaining,
    reached: total >= goal,
    pct: goal > 0 ? Math.min(1, total / goal) : 0,
    // Una barra llena = un día "normal" de la meta (40 h → 8 h), o el día más largo si se pasó.
    scale: Math.max(...hours, goal / 5, 1),
  }
}

/** La jornada de hoy (la última que se tocó, si por algún motivo hay más de una). */
export function todayJornada(entries: Entry[], today: string): Entry | undefined {
  let found: Entry | undefined
  for (const e of entries) if (isJornada(e) && e.date === today && (!found || e.updatedAt > found.updatedAt)) found = e
  return found
}

/** Nombre del mes en minúscula, para el medio de una frase: "octubre". */
export function monthName(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
}

/** Días del mes en cada modalidad (Oficina, Remoto, Híbrido). Solo las que tienen algún día. */
export function modalityDays(entries: Entry[], month: string, options: string[]) {
  const seen = new Map(options.map((o) => [o, new Set<string>()]))
  for (const e of entries) {
    if (!isJornada(e) || monthKey(e.date) !== month) continue
    const m = e.values.modalidad
    if (typeof m === 'string') seen.get(m)?.add(e.date)
  }
  return options.map((name) => ({ name, days: seen.get(name)!.size })).filter((x) => x.days > 0)
}

/** Estado de una tarea; sin estado (registros viejos) cuenta como pendiente. */
export function taskState(e: Entry): TaskState {
  const s = e.values.estado
  return s === 'En curso' || s === 'Hecha' ? s : 'Pendiente'
}

/** El botón de cada tarea según su estado y a qué estado la pasa. */
export const NEXT_STEP: Record<TaskState, { label: string; to: TaskState }> = {
  Pendiente: { label: 'Empezar', to: 'En curso' },
  'En curso': { label: 'Terminar', to: 'Hecha' },
  Hecha: { label: 'Reabrir', to: 'Pendiente' },
}

const PRIORITY: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 }
const priorityOf = (e: Entry) => PRIORITY[String(e.values.prioridad)] ?? 3

/**
 * Tareas separadas por estado. Pendientes y en curso: primero las de prioridad alta y, a igual
 * prioridad, las más viejas primero (la nueva queda al final, junto a donde se escribe).
 * Hechas: la última que se terminó primero.
 */
export function tasksByState(entries: Entry[]): Record<TaskState, Entry[]> {
  const out: Record<TaskState, Entry[]> = { Pendiente: [], 'En curso': [], Hecha: [] }
  for (const e of entries) if (isTask(e)) out[taskState(e)].push(e)
  const open = (a: Entry, b: Entry) => priorityOf(a) - priorityOf(b) || a.createdAt - b.createdAt
  out.Pendiente.sort(open)
  out['En curso'].sort(open)
  out.Hecha.sort((a, b) => b.updatedAt - a.updatedAt)
  return out
}
