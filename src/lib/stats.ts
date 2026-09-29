import type { Field, Subcategory } from '../config/categories'
import { formatDay } from './dates'
import type { Entry } from './db'

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const moneyByCurrency: Record<string, Intl.NumberFormat> = {}

/** Formatea un monto en la moneda dada (ARS por defecto). "USD" se muestra como "US$". */
export function formatCurrency(amount: number, currency = 'ARS') {
  const c = currency === 'USD' ? 'USD' : 'ARS'
  moneyByCurrency[c] ??= new Intl.NumberFormat('es-AR', { style: 'currency', currency: c, maximumFractionDigits: 0 })
  return moneyByCurrency[c].format(amount)
}

/** Si el campo tiene `currencyFrom`, usa la moneda que diga ese campo en el mismo registro. */
export function formatValue(field: Field, value: number | string | string[] | undefined, entry?: Entry) {
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (field.type === 'date') return formatDay(String(value), { day: 'numeric', month: 'short', year: 'numeric' })
  if (field.type !== 'number') return String(value)
  const n = Number(value)
  if (field.money) return formatCurrency(n, field.currencyFrom && entry ? String(entry.values[field.currencyFrom]) : 'ARS')
  return field.unit ? `${num.format(n)} ${field.unit}` : num.format(n)
}

/** Las opciones marcadas de un campo select, sea de una sola o de varias (multi). */
export function tagsOf(value: number | string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  return value !== undefined && value !== '' ? [String(value)] : []
}

export interface Metric {
  field: Field
  value: number
}

/** Resume los campos numéricos con aggregate según la config. */
export function summarize(sub: Subcategory, entries: Entry[]): Metric[] {
  return sub.fields
    .filter((f) => f.type === 'number' && f.aggregate)
    .map((field) => {
      const nums = entries
        .map((e) => e.values[field.key])
        .filter((v) => v !== undefined && v !== '')
        .map(Number)
        .filter(Number.isFinite)
      const total = nums.reduce((a, b) => a + b, 0)
      return { field, value: field.aggregate === 'avg' ? (nums.length ? total / nums.length : 0) : total }
    })
}

/** Cuenta ocurrencias por opción de un campo select. Si el campo es multi, cada opción marcada suma completo (no se reparte). */
export function breakdown(field: Field, entries: Entry[], weightKey?: string) {
  const map = new Map<string, number>()
  for (const e of entries) {
    const keys = tagsOf(e.values[field.key])
    if (!keys.length) continue
    const w = weightKey ? Number(e.values[weightKey]) || 0 : 1
    for (const k of keys) map.set(k, (map.get(k) ?? 0) + w)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}
