import { dayMonth, hourMinute } from './dateLabels'
import { shiftDay, toISO } from './dates'
import type { Note } from './db'

export type NoteFilter = 'todas' | 'fijadas' | 'pregunta'

/** Texto para comparar sin importar mayúsculas ni tildes ("Mamá" = "mama"). */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** La nota tiene todas las palabras buscadas (en el título o en el texto). */
export function matchesQuery(note: Pick<Note, 'title' | 'body'>, query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = fold(`${note.title}\n${note.body}`)
  return words.every((w) => text.includes(w))
}

export function matchesFilter(note: Note, filter: NoteFilter) {
  if (filter === 'fijadas') return !!note.pinned
  if (filter === 'pregunta') return note.kind === 'pregunta'
  return true
}

/** Fijadas primero; después, la última que se tocó arriba. */
export function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt)
}

/** Lo que se ve en la lista: filtro + búsqueda, ordenado. */
export function visibleNotes(notes: Note[], filter: NoteFilter, query: string) {
  return sortNotes(notes.filter((n) => matchesFilter(n, filter) && matchesQuery(n, query)))
}

export function noteCounts(notes: Note[]): Record<NoteFilter, number> {
  return {
    todas: notes.length,
    fijadas: notes.filter((n) => n.pinned).length,
    pregunta: notes.filter((n) => n.kind === 'pregunta').length,
  }
}

/** "Hoy 08:40" / "Ayer" / "1 oct" / "1 oct 2025" (según cuándo se tocó por última vez). */
export function noteDateLabel(ts: number, now: Date) {
  const d = new Date(ts)
  const iso = toISO(d)
  const todayIso = toISO(now)
  if (iso === todayIso) return `Hoy ${hourMinute(d)}`
  if (iso === shiftDay(todayIso, -1)) return 'Ayer'
  return dayMonth(iso, now.getFullYear())
}

/** Una nota necesita un título o un texto. */
export const canSaveNote = (title: string, body: string) => !!(title.trim() || body.trim())

/** Nombre corto para avisos ("¿Borrar la nota …?"): el título o el principio del texto. */
export function noteName(note: Pick<Note, 'title' | 'body'>) {
  const t = note.title.trim() || note.body.trim().split('\n')[0]
  return t.length > 40 ? `${t.slice(0, 40).trimEnd()}…` : t
}
