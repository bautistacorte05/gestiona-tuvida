import { shiftDay } from './dates'
import type { Entry } from './db'

/**
 * Cuentas de la hoja de Bienestar (sin React, para poder probarlas sueltas).
 * Sueño = bienestar/sueno (horas, calidad, acostarse, levantarse). Ánimo = bienestar/animo (nivel 1 a 5, nota).
 */

export const MOODS = [
  { level: 1, emoji: '😣', label: 'Muy mal' },
  { level: 2, emoji: '🙁', label: 'Mal' },
  { level: 3, emoji: '😐', label: 'Normal' },
  { level: 4, emoji: '🙂', label: 'Bien' },
  { level: 5, emoji: '😄', label: 'Genial' },
] as const

export const SLEEP_QUALITY = ['Muy buena', 'Buena', 'Regular', 'Mala'] as const

/** Ánimo redondeado a 1–5 (los registros viejos pueden tener cualquier número). Inválido = undefined. */
export function moodLevel(v: unknown) {
  const n = Number(v)
  if (v === undefined || v === '' || !Number.isFinite(n)) return undefined
  return Math.min(5, Math.max(1, Math.round(n)))
}

/** Horas de sueño válidas (número mayor a 0) o undefined. */
export function sleepHours(v: unknown) {
  const n = Number(v)
  return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : undefined
}

/** 7,5 → "7 h 30"; 7 → "7 h". */
export function formatSleep(hours: number) {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** Media hora más o menos, cayendo en la media hora justa (7 h 50 + → 8 h; 7 h 50 − → 7 h 30). Entre 0 y 24. */
export function stepHalfHour(hours: number, dir: 1 | -1) {
  const halves = hours * 2
  const next = dir > 0 ? Math.floor(halves + 1e-9) + 1 : Math.ceil(halves - 1e-9) - 1
  return Math.min(24, Math.max(0, next / 2))
}

const toMinutes = (hhmm: unknown) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim())
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : undefined
}

/** Horas entre "me acosté" y "me levanté", pasando la medianoche (23:30 → 7:00 = 7,5). Sin las dos horas = undefined. */
export function hoursBetween(from: unknown, to: unknown) {
  const a = toMinutes(from)
  const b = toMinutes(to)
  if (a === undefined || b === undefined) return undefined
  const diff = (b - a + 1440) % 1440
  return diff ? Math.round((diff / 60) * 100) / 100 : undefined
}

/** "07:00" → "7:00" (como se lee en voz alta). */
export const shortTime = (hhmm: unknown) => String(hhmm ?? '').replace(/^0(\d)/, '$1')

/** El registro más reciente de cada día (el que edita la hoja cuando se vuelve a guardar ese día). */
export function latestPerDay(entries: Entry[]) {
  const map = new Map<string, Entry>()
  for (const e of entries) {
    const prev = map.get(e.date)
    if (!prev || e.updatedAt > prev.updatedAt) map.set(e.date, e)
  }
  return map
}

/** Los últimos `days` días terminando en `end`, con las horas de sueño y el ánimo de cada uno. */
export function lastDays(sleep: Map<string, Entry>, mood: Map<string, Entry>, end: string, days = 14) {
  const start = shiftDay(end, -(days - 1))
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDay(start, i)
    return { date, hours: sleepHours(sleep.get(date)?.values.horas), mood: moodLevel(mood.get(date)?.values.nivel) }
  })
}

/**
 * Ánimo promedio de los días con 7 h de sueño o más y de los días con menos (mismo día).
 * Solo si hay al menos `minDays` días con los dos datos; si no, undefined.
 */
export function sleepMoodInsight(sleep: Map<string, Entry>, mood: Map<string, Entry>, minDays = 5, threshold = 7) {
  const enough: number[] = []
  const less: number[] = []
  for (const [date, s] of sleep) {
    const h = sleepHours(s.values.horas)
    const m = moodLevel(mood.get(date)?.values.nivel)
    if (h === undefined || m === undefined) continue
    if (h >= threshold) enough.push(m)
    else less.push(m)
  }
  if (enough.length + less.length < minDays) return undefined
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined)
  return { days: enough.length + less.length, enough: avg(enough), less: avg(less) }
}

const oneDecimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
/** 4.14 → "4,1". */
export const decimal = (n: number) => oneDecimal.format(n)
