import { daysBetween, shiftDay, weekStart } from './dates'
import type { Entry, PetWalk } from './db'

/** "4 años", "8 meses", "3 semanas": edad aproximada desde la fecha de nacimiento. */
export function petAge(nacimiento: string | undefined, now: string) {
  if (!nacimiento) return ''
  const days = daysBetween(nacimiento, now)
  if (days < 0) return ''
  const years = Math.floor(days / 365.25)
  if (years >= 1) return `${years} ${years === 1 ? 'año' : 'años'}`
  const months = Math.floor(days / 30.44)
  if (months >= 1) return `${months} ${months === 1 ? 'mes' : 'meses'}`
  const weeks = Math.max(1, Math.floor(days / 7))
  return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
}

export interface HealthDue {
  id: string
  nombre: string
  fecha: string
  /** Días hasta la fecha (negativo = vencida). */
  dias: number
}

const label = (e: Entry) => {
  const nombre = String(e.values.nombre ?? '').trim()
  if (nombre) return nombre
  const motivo = e.values.motivo
  return Array.isArray(motivo) ? motivo.join(', ') : String(motivo ?? 'Control')
}

/**
 * Próximas dosis / controles de la mascota. Si una vacuna se vuelve a dar (mismo nombre, fecha más nueva),
 * cuenta solo la última. Ordenadas: primero las vencidas, después las que vienen.
 */
export function healthDue(entries: Entry[], petId: string, now: string): HealthDue[] {
  const latest = new Map<string, Entry>()
  for (const e of entries) {
    if (e.categoryId !== 'mascota' || e.subId !== 'salud' || e.petId !== petId) continue
    const key = label(e).toLowerCase()
    const prev = latest.get(key)
    if (!prev || e.date > prev.date || (e.date === prev.date && e.updatedAt > prev.updatedAt)) latest.set(key, e)
  }
  return [...latest.values()]
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(String(e.values.proximaDosis ?? '')))
    .map((e) => {
      const fecha = String(e.values.proximaDosis)
      return { id: e.id, nombre: label(e), fecha, dias: daysBetween(now, fecha) }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export interface PetDay { date: string; walks: number; km: number; minutes: number }

/** Paseos de un día: los cargados a mano (Paseos) y los hechos en vivo con GPS. */
export function petDay(entries: Entry[], walks: PetWalk[], petId: string, date: string): PetDay {
  let n = 0
  let km = 0
  let minutes = 0
  for (const e of entries) {
    if (e.categoryId !== 'mascota' || e.subId !== 'paseos' || e.petId !== petId || e.date !== date) continue
    n++
    km += Number(e.values.km) || 0
    minutes += Number(e.values.minutos) || 0
  }
  for (const w of walks) {
    if (w.petId !== petId || w.date !== date) continue
    n++
    km += w.distanceKm || 0
    minutes += Math.round(Math.max(0, w.endedAt - w.startedAt) / 60000)
  }
  return { date, walks: n, km, minutes }
}

/** Los 7 días de la semana (lunes a domingo) que contiene `now`. */
export function petWeek(entries: Entry[], walks: PetWalk[], petId: string, now: string): PetDay[] {
  const start = weekStart(now)
  return Array.from({ length: 7 }, (_, i) => petDay(entries, walks, petId, shiftDay(start, i)))
}

export function mealsOn(entries: Entry[], petId: string, date: string) {
  return entries.filter((e) => e.categoryId === 'mascota' && e.subId === 'alimento' && e.petId === petId && e.date === date).length
}
