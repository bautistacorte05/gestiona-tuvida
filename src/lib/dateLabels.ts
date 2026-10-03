// Fechas escritas "a mano" en castellano (sin depender de Intl, que cambia según el celular).

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pad = (n: number) => String(n).padStart(2, '0')

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/** "Jueves 2 oct" */
export function weekdayDayMonth(iso: string) {
  const { y, m, d } = parse(iso)
  return `${cap(WEEKDAYS[new Date(y, m - 1, d).getDay()])} ${d} ${MONTHS_SHORT[m - 1]}`
}

/** "2 oct" (con el año si no es `currentYear`: "2 oct 2025"). */
export function dayMonth(iso: string, currentYear?: number) {
  const { y, m, d } = parse(iso)
  const base = `${d} ${MONTHS_SHORT[m - 1]}`
  return currentYear !== undefined && y !== currentYear ? `${base} ${y}` : base
}

/** 'YYYY-MM' → "Octubre 2026" */
export function monthYear(month: string) {
  const { y, m } = parse(month)
  return `${cap(MONTHS[m - 1])} ${y}`
}

/** 'YYYY-MM' → "Octubre" */
export function monthName(month: string) {
  return cap(MONTHS[parse(month).m - 1])
}

/** 'YYYY-MM' → "sept" */
export function monthShort(month: string) {
  return MONTHS_SHORT[parse(month).m - 1]
}

/** "08:40" */
export function hourMinute(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
