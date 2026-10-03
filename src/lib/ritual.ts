import { RITUAL_STEPS, type RitualStep, type RitualStepId } from '../config/ritual'
import { shiftDay } from './dates'
import type { RitualDay } from './db'

/** Lo que se completa en el ritual (lo que está escribiendo la persona, antes o después de guardarse). */
export interface RitualAnswers {
  agua: boolean
  gratitude: string[]
  word: string
  focus: string
}

/** Pasos que usa la persona (Ajustes del ritual). Sin elegir, o si ninguno es válido: todos. */
export function enabledSteps(pasos: string[] | undefined): RitualStep[] {
  if (!pasos?.length) return RITUAL_STEPS
  const chosen = RITUAL_STEPS.filter((s) => pasos.includes(s.id))
  return chosen.length ? chosen : RITUAL_STEPS
}

/**
 * Lista para guardar en `ritualPasos`: sin valor cuando están todos prendidos (así un paso que se
 * agregue en el futuro aparece solo). Devuelve null si quedaría sin ningún paso (no se permite).
 */
export function togglePaso(pasos: string[] | undefined, id: RitualStepId): string[] | undefined | null {
  const current = enabledSteps(pasos).map((s) => s.id)
  const next = current.includes(id) ? current.filter((x) => x !== id) : RITUAL_STEPS.map((s) => s.id).filter((x) => x === id || current.includes(x))
  if (next.length === 0) return null
  return next.length === RITUAL_STEPS.length ? undefined : next
}

/** Respuestas guardadas de un día (o vacías). */
export function answersOf(r: RitualDay | undefined, gratitudeCount: number): RitualAnswers {
  const gratitude = Array.from({ length: gratitudeCount }, (_, i) => r?.gratitude?.[i] ?? '')
  return { agua: !!r?.steps?.includes('agua'), gratitude, word: r?.word ?? '', focus: r?.focus ?? '' }
}

/** Pasos cumplidos según lo que completó (agua = tildado; el resto, si escribió/eligió algo). */
export function doneStepIds(a: RitualAnswers): RitualStepId[] {
  const done: RitualStepId[] = []
  if (a.agua) done.push('agua')
  if (a.gratitude.some((g) => g.trim())) done.push('agradecer')
  if (a.word.trim()) done.push('palabra')
  if (a.focus.trim()) done.push('importante')
  return done
}

/**
 * Racha del ritual: días seguidos con el ritual terminado (`doneAt`). Si hoy todavía no se hizo,
 * cuenta desde ayer (la racha no se "rompe" hasta que termina el día), igual que computeStreak.
 */
export function ritualStreak(rituals: RitualDay[], todayIso: string) {
  const days = new Set(rituals.filter((r) => r.doneAt).map((r) => r.id))
  let cursor = todayIso
  if (!days.has(cursor)) cursor = shiftDay(cursor, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

/** Orden de las tareas del día con `key` primera (el resto queda como estaba). */
export function putFirst(keys: string[] | undefined, key: string) {
  return [key, ...(keys ?? []).filter((k) => k !== key)]
}

/** "1 día seguido" / "5 días seguidos" */
export const streakLabel = (n: number) => `${n} ${n === 1 ? 'día seguido' : 'días seguidos'}`
