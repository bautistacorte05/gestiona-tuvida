import { shiftDay, weekStart } from './dates'
import type { Entry } from './db'

export const MEALS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Snack'] as const
export const HEALTH = ['Sí', 'Más o menos', 'No'] as const

export const DEFAULT_CALORIE_GOAL = 2000
export const DEFAULT_WATER_GOAL = 8

export const isMeal = (e: Entry) => e.categoryId === 'comida' && e.subId === 'comidas'
/** El agua se guarda como un registro por día (subId propio, sin pantalla genérica). */
export const isWater = (e: Entry) => e.categoryId === 'comida' && e.subId === 'hidratacion'

export const kcalOf = (e: Entry) => Number(e.values.calorias) || 0

export interface FrequentFood { que: string; momento: string; calorias: number; count: number }

/** Comidas que más repetís (para anotarlas con un toque). */
export function frequentFoods(meals: Entry[], limit = 6): FrequentFood[] {
  const map = new Map<string, FrequentFood & { last: number }>()
  for (const e of meals) {
    const que = String(e.values.que ?? '').trim()
    if (!que) continue
    const key = que.toLowerCase()
    const prev = map.get(key)
    if (!prev) map.set(key, { que, momento: String(e.values.momento ?? ''), calorias: kcalOf(e), count: 1, last: e.createdAt })
    else {
      prev.count++
      if (e.createdAt >= prev.last) Object.assign(prev, { momento: String(e.values.momento ?? ''), calorias: kcalOf(e), last: e.createdAt })
    }
  }
  return [...map.values()].filter((f) => f.count > 1).sort((a, b) => b.count - a.count || b.last - a.last).slice(0, limit)
}

export interface FoodWeek {
  days: { date: string; kcal: number; meals: number }[]
  health: Record<'Sí' | 'Más o menos' | 'No' | 'Sin marcar', Entry[]>
  total: number
}

/** Resumen de la semana (lunes a domingo) que contiene `date`. */
export function foodWeek(meals: Entry[], date: string): FoodWeek {
  const start = weekStart(date)
  const dates = Array.from({ length: 7 }, (_, i) => shiftDay(start, i))
  const inWeek = meals.filter((e) => e.date >= dates[0] && e.date <= dates[6])
  const health: FoodWeek['health'] = { Sí: [], 'Más o menos': [], No: [], 'Sin marcar': [] }
  for (const e of inWeek) {
    const h = String(e.values.saludable ?? '') as keyof FoodWeek['health']
    ;(health[h] ?? health['Sin marcar']).push(e)
  }
  return {
    days: dates.map((d) => {
      const list = inWeek.filter((e) => e.date === d)
      return { date: d, kcal: list.reduce((s, e) => s + kcalOf(e), 0), meals: list.length }
    }),
    health,
    total: inWeek.length,
  }
}
