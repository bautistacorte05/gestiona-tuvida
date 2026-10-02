import type { Entry } from './db'

/**
 * Cálculos de la hoja de Fútbol. Funciones puras: reciben los datos (y el año), no leen la base
 * ni el reloj, así se pueden probar sueltas.
 */

export const RESULTS = ['Ganado', 'Empatado', 'Perdido'] as const
export type MatchResult = (typeof RESULTS)[number]

export const RESULT_LETTER: Record<MatchResult, string> = { Ganado: 'G', Empatado: 'E', Perdido: 'P' }

export const isMatch = (e: Entry) => e.categoryId === 'futbol' && e.subId === 'partidos'

export function resultOf(e: Entry): MatchResult | undefined {
  const r = e.values.resultado
  return RESULTS.find((x) => x === r)
}

const yearOf = (iso: string) => Number(iso.slice(0, 4))

/** Partidos de un año, el más nuevo primero. */
export function matchesOfYear(entries: Entry[], year: number): Entry[] {
  return entries.filter((e) => isMatch(e) && yearOf(e.date) === year).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}

/** Años que se pueden recorrer: desde el primer partido cargado hasta este año (o el último partido, si es posterior). */
export function yearBounds(entries: Entry[], currentYear: number) {
  let min = currentYear
  let max = currentYear
  for (const e of entries) {
    if (!isMatch(e)) continue
    const y = yearOf(e.date)
    if (y < min) min = y
    if (y > max) max = y
  }
  return { min, max }
}

const num = (v: Entry['values'][string] | undefined) => Number(v) || 0

/** Resumen de un grupo de partidos (los de un año). `formats` = opciones del campo, para desempatar el más jugado. */
export function matchSummary(matches: Entry[], formats: string[]) {
  const count: Record<MatchResult, number> = { Ganado: 0, Empatado: 0, Perdido: 0 }
  const byFormat = new Map<string, number>()
  let goals = 0
  let assists = 0
  let minutes = 0
  let hasMinutes = false
  for (const m of matches) {
    const r = resultOf(m)
    if (r) count[r]++
    goals += num(m.values.goles)
    assists += num(m.values.asistencias)
    if (m.values.minutos !== undefined && m.values.minutos !== '') {
      hasMinutes = true
      minutes += num(m.values.minutos)
    }
    const f = m.values.formato
    if (typeof f === 'string' && f) byFormat.set(f, (byFormat.get(f) ?? 0) + 1)
  }
  // El formato más jugado; si empatan, el que va primero en las opciones.
  let topFormat: string | undefined
  let best = 0
  const order = [...formats, ...[...byFormat.keys()].filter((f) => !formats.includes(f))]
  for (const f of order) {
    const n = byFormat.get(f) ?? 0
    if (n > best) {
      best = n
      topFormat = f
    }
  }
  const played = matches.length
  return {
    played,
    won: count.Ganado,
    drawn: count.Empatado,
    lost: count.Perdido,
    /** 0 a 100, sin decimales; undefined sin partidos. */
    winPct: played ? Math.round((count.Ganado / played) * 100) : undefined,
    goals,
    assists,
    minutes,
    hasMinutes,
    goalsPerMatch: played ? goals / played : undefined,
    assistsPerMatch: played ? assists / played : undefined,
    topFormat,
  }
}

export type MatchSummary = ReturnType<typeof matchSummary>

/** Lo que hizo en el partido: "2 goles · 1 asist.", "1 gol", "sin goles". */
export function matchStatsText(e: Entry) {
  const g = num(e.values.goles)
  const a = num(e.values.asistencias)
  const parts: string[] = []
  if (g) parts.push(g === 1 ? '1 gol' : `${g} goles`)
  if (a) parts.push(`${a} asist.`)
  return parts.length ? parts.join(' · ') : 'sin goles'
}

const dec1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const int = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
/** "0,8" */
export const formatDecimal = (n: number) => dec1.format(n)
/** "1.200" */
export const formatInt = (n: number) => int.format(n)
