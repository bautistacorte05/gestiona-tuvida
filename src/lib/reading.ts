import { monthKey, shiftDay } from './dates'
import type { Entry } from './db'

/**
 * Cuentas de la hoja de Lectura (sin React, para poder probarlas sueltas).
 * Libros = lectura/libros (titulo, autor, estado, puntaje, paginasTotales).
 * Sesiones = lectura/sesiones (libro, paginas, minutos): el libro se reconoce por el título.
 */

export type BookState = 'Pendiente' | 'Leyendo' | 'Terminado' | 'Abandonado'

/** Número de un campo (vacío o inválido = 0). */
export const numOf = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Clave para unir sesiones con su libro: sin espacios de los costados y sin mayúsculas. */
export const bookKey = (title: unknown) => String(title ?? '').trim().toLowerCase()

/** Libros en un estado, el último modificado primero. */
export function booksIn(books: Entry[], state: BookState) {
  return books.filter((b) => b.values.estado === state).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Páginas leídas de cada libro (suma de sus sesiones), por clave de título. */
export function pagesByBook(sessions: Entry[]) {
  const map = new Map<string, number>()
  for (const s of sessions) {
    const k = bookKey(s.values.libro)
    if (!k) continue
    map.set(k, (map.get(k) ?? 0) + numOf(s.values.paginas))
  }
  return map
}

/** Páginas por día de los últimos `days` días, terminando en `end` (incluido). */
export function pagesPerDay(sessions: Entry[], end: string, days = 14) {
  const start = shiftDay(end, -(days - 1))
  const byDate = new Map<string, number>()
  for (const s of sessions) {
    if (s.date < start || s.date > end) continue
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + numOf(s.values.paginas))
  }
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDay(start, i)
    return { date, pages: byDate.get(date) ?? 0 }
  })
}

/** Ritmo: promedio de páginas en los días que hubo lectura dentro de los últimos `days` días. Sin lectura = undefined. */
export function readingPace(sessions: Entry[], end: string, days = 14) {
  const read = pagesPerDay(sessions, end, days).filter((d) => d.pages > 0)
  if (!read.length) return undefined
  return read.reduce((a, d) => a + d.pages, 0) / read.length
}

/** Días que faltan para terminar al ritmo dado (undefined si no hay ritmo o ya no falta nada). */
export function daysToFinish(total: number, read: number, pace: number | undefined) {
  const left = total - read
  if (!pace || pace <= 0 || left <= 0) return undefined
  return Math.ceil(left / pace)
}

/** Páginas y minutos de las sesiones de un mes ("YYYY-MM"). */
export function monthTotals(sessions: Entry[], month: string) {
  let pages = 0
  let minutes = 0
  for (const s of sessions) {
    if (monthKey(s.date) !== month) continue
    pages += numOf(s.values.paginas)
    minutes += numOf(s.values.minutos)
  }
  return { pages, minutes }
}

/** "Jorge Luis Borges" → "J. L. Borges" (para la tapa). */
export function shortAuthor(author: unknown) {
  const words = String(author ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return words.join('')
  const last = words[words.length - 1]
  return [...words.slice(0, -1).map((w) => `${w.charAt(0).toUpperCase()}.`), last].join(' ')
}

/** Minutos como "9 h 30", "9 h" o "45 min". */
export function formatDuration(min: number) {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`
}

/** Estrellas del puntaje (1 a 5). Sin puntaje = undefined. */
export function stars(score: unknown) {
  const n = Math.round(Number(score))
  if (!Number.isFinite(n) || n < 1) return undefined
  const full = Math.min(n, 5)
  return { text: '★'.repeat(full) + '☆'.repeat(5 - full), label: `${full} de 5 estrellas` }
}
