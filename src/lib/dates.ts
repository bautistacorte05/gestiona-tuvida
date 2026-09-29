const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => toISO(new Date())

/** "YYYY-MM" */
export const monthKey = (iso: string) => iso.slice(0, 7)

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return { start: `${month}-01`, end: `${month}-${pad(days)}`, days }
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  return toISO(new Date(y, m - 1 + delta, 1)).slice(0, 7)
}

export function shiftDay(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + delta))
}

/** Días entre hoy y una fecha: negativo si ya pasó. */
export function daysUntil(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const [ty, tm, td] = today().split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000)
}

export function formatMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  const [y, m, d] = iso.split('-').map(Number)
  const s = new Date(y, m - 1, d).toLocaleDateString('es-AR', opts)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
