import { daysBetween } from './dates'
import type { Entry } from './db'

/**
 * Cuentas de la hoja de Proyectos (sin React, para poder probarlas sueltas).
 * Proyecto = proyectos/proyectos (nombre, plazo, estado, fechaLimite, nota).
 */

export type Plazo = 'Corto plazo' | 'Largo plazo'
export type ProjectState = 'Pendiente' | 'En curso' | 'Pausado' | 'Terminado'

/** Fecha límite válida ("YYYY-MM-DD") o undefined. */
export function deadlineOf(p: Entry) {
  const v = String(p.values.fechaLimite ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined
}

/**
 * Proyectos en un estado. `deadline`: primero los que vencen antes (los sin fecha al final), después
 * el último modificado. `recent`: el último modificado primero (pausados y terminados).
 */
export function projectsIn(projects: Entry[], state: ProjectState, order: 'deadline' | 'recent' = 'deadline') {
  return projects
    .filter((p) => p.values.estado === state)
    .sort((a, b) => {
      if (order === 'recent') return b.updatedAt - a.updatedAt
      const da = deadlineOf(a)
      const db = deadlineOf(b)
      if (da && db && da !== db) return da.localeCompare(db)
      if (!!da !== !!db) return da ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
}

/** Lo próximo que vence: la fecha límite más cercana desde hoy entre los no terminados. */
export function nextDue(projects: Entry[], today: string) {
  let best: { project: Entry; date: string } | undefined
  for (const p of projects) {
    if (p.values.estado === 'Terminado') continue
    const date = deadlineOf(p)
    if (!date || date < today) continue
    if (!best || date < best.date) best = { project: p, date }
  }
  return best && { ...best, days: daysBetween(today, best.date) }
}

/** Texto del vencimiento y si conviene resaltarlo (vencido o a 7 días o menos). */
export function deadlineInfo(date: string | undefined, today: string) {
  if (!date) return { text: 'Sin fecha límite', urgent: false }
  const days = daysBetween(today, date)
  if (days === 0) return { text: 'Vence hoy', urgent: true }
  if (days < 0) return { text: `Venció hace ${-days} ${days === -1 ? 'día' : 'días'}`, urgent: true }
  return { text: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, urgent: days <= 7 }
}
