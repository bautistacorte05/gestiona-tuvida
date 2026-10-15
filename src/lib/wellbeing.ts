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

// ——— Puntaje, racha y calendario ———

export const DEFAULT_SLEEP_GOAL = 8
/** Una noche "buena" para la racha: 7 h o más. */
export const SLEEP_OK_HOURS = 7

const QUALITY_FACTOR: Record<string, number> = { 'Muy buena': 1, Buena: 0.85, Regular: 0.55, Mala: 0.25 }

/** Puntaje 0–100: 70 % horas contra tu meta (pasarse mucho resta un poco) y 30 % calidad (sin calidad cuenta como "buena"). */
export function sleepScore(hours: number, goal: number, quality?: string) {
  const dur = hours <= goal ? hours / goal : Math.max(0.7, 1 - Math.max(0, hours - goal - 1) * 0.1)
  const q = QUALITY_FACTOR[quality ?? ''] ?? 0.8
  return Math.round(100 * (0.7 * Math.min(dur, 1) + 0.3 * q))
}

export function scoreLabel(score: number) {
  return score >= 85 ? 'Excelente' : score >= 70 ? 'Dormiste bien' : score >= 50 ? 'Regular' : 'Dormiste poco'
}

/** Noches seguidas con 7 h o más, terminando hoy (o ayer si hoy todavía no se anotó). */
export function sleepStreak(sleep: Map<string, Entry>, end: string) {
  let day = sleep.has(end) ? end : shiftDay(end, -1)
  let n = 0
  while ((sleepHours(sleep.get(day)?.values.horas) ?? 0) >= SLEEP_OK_HOURS) {
    n++
    day = shiftDay(day, -1)
  }
  return n
}

/** Celdas del mes en semanas de lunes a domingo: null = hueco antes del día 1. */
export function monthCells(mood: Map<string, Entry>, month: string) {
  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const total = new Date(y, m, 0).getDate()
  const cells: ({ date: string; mood?: number } | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= total; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    cells.push({ date, mood: moodLevel(mood.get(date)?.values.nivel) })
  }
  return cells
}

// ——— Diario del día (energía, estrés, hábitos, nota) y resumen semanal ———

export const ENERGY = [
  { level: 1, emoji: '🪫', label: 'Agotado' },
  { level: 2, emoji: '😴', label: 'Baja' },
  { level: 3, emoji: '😐', label: 'Normal' },
  { level: 4, emoji: '🔋', label: 'Buena' },
  { level: 5, emoji: '⚡', label: 'Plena' },
] as const

export const STRESS = [
  { level: 1, emoji: '😌', label: 'Nada' },
  { level: 2, emoji: '🙂', label: 'Poco' },
  { level: 3, emoji: '😬', label: 'Medio' },
  { level: 4, emoji: '😰', label: 'Mucho' },
  { level: 5, emoji: '🤯', label: 'Al límite' },
] as const

export const HABITS = [
  { id: 'respirar', emoji: '🌬️', label: 'Respirar' },
  { id: 'caminar', emoji: '🚶', label: 'Caminar' },
  { id: 'agradecer', emoji: '🙏', label: 'Agradecer' },
  { id: 'sol', emoji: '☀️', label: 'Tomar sol' },
  { id: 'estirar', emoji: '🤸', label: 'Estirar' },
  { id: 'pantallas', emoji: '📵', label: 'Menos pantallas' },
] as const

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined)

export interface WeekStats { sleep?: number; mood?: number; energy?: number; stress?: number; habits: number }

function statsFor(days: string[], sleep: Map<string, Entry>, mood: Map<string, Entry>, diary: Map<string, Entry>): WeekStats {
  const pick = (f: (d: string) => number | undefined) => avg(days.map(f).filter((n): n is number => n !== undefined))
  return {
    sleep: pick((d) => sleepHours(sleep.get(d)?.values.horas)),
    mood: pick((d) => moodLevel(mood.get(d)?.values.nivel)),
    energy: pick((d) => moodLevel(diary.get(d)?.values.energia)),
    stress: pick((d) => moodLevel(diary.get(d)?.values.estres)),
    habits: days.reduce((s, d) => {
      const h = diary.get(d)?.values.habitos
      return s + (Array.isArray(h) ? h.length : 0)
    }, 0),
  }
}

/** Los últimos 7 días (terminando en `end`) contra los 7 anteriores. */
export function weekCompare(sleep: Map<string, Entry>, mood: Map<string, Entry>, diary: Map<string, Entry>, end: string) {
  const range = (offset: number) => Array.from({ length: 7 }, (_, i) => shiftDay(end, -(6 + offset) + i))
  return { cur: statsFor(range(0), sleep, mood, diary), prev: statsFor(range(7), sleep, mood, diary) }
}
