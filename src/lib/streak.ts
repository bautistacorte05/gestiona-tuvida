import type { Check } from './db'
import { shiftDay, today } from './dates'

/**
 * Racha de días seguidos con tic para una categoría.
 * Cuenta hacia atrás desde hoy; si hoy todavía no está marcado, arranca desde ayer
 * (para no "romper" la racha hasta que termine el día).
 */
export function computeStreak(checks: Check[], categoryId: string) {
  const days = new Set(checks.filter((c) => c.categoryId === categoryId).map((c) => c.date))
  let cursor = today()
  if (!days.has(cursor)) cursor = shiftDay(cursor, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
