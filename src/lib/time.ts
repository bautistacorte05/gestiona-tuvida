import { CATEGORIES, CHART_ORDER, DAILY_CATEGORIES } from '../config/categories'
import type { Check, Entry } from './db'

export const CHART_CATEGORIES = CHART_ORDER.map((id) => DAILY_CATEGORIES.find((c) => c.id === id)!).filter(Boolean)

/** "45 min", "2 h", "2 h 15 min" */
export function formatMinutes(min: number) {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** Minutos que salen de los registros de detalle (campos "minutos" u "horas"). */
function entryMinutes(e: Entry) {
  const cat = CATEGORIES.find((c) => c.id === e.categoryId)
  const sub = cat?.subcategories.find((s) => s.id === e.subId)
  if (!sub?.fields.some((f) => f.key === 'minutos' || f.key === 'horas')) return 0
  return (Number(e.values.minutos) || 0) + (Number(e.values.horas) || 0) * 60
}

/**
 * Minutos por día y categoría. Si se cargó el tiempo en el cuadrado se usa ese;
 * si no, se suma lo que haya en los registros de detalle de ese día.
 */
export function minutesByDay(checks: Check[], entries: Entry[]) {
  const out = new Map<string, Map<string, number>>() // fecha -> categoría -> minutos
  const add = (date: string, cat: string, min: number) => {
    const day = out.get(date) ?? new Map<string, number>()
    day.set(cat, (day.get(cat) ?? 0) + min)
    out.set(date, day)
  }
  const explicit = new Set<string>()
  for (const c of checks) {
    if (c.minutos) {
      explicit.add(c.id)
      add(c.date, c.categoryId, c.minutos)
    }
  }
  for (const e of entries) {
    if (explicit.has(`${e.date}|${e.categoryId}`)) continue
    const m = entryMinutes(e)
    if (m) add(e.date, e.categoryId, m)
  }
  return out
}
