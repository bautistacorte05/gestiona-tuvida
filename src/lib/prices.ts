import type { Entry } from './db'

export interface Item {
  producto: string
  cantidad: number
  /** Precio por unidad. */
  precio: number
}

/** Clave para comparar productos sin importar mayúsculas, tildes o espacios. */
export const productKey = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

export const itemsTotal = (items: Item[]) => items.reduce((a, i) => a + i.cantidad * i.precio, 0)

export const pctChange = (prev: number, cur: number) => (prev ? ((cur - prev) / prev) * 100 : undefined)

export interface ProductPrice {
  name: string
  /** Precio unitario promedio en el período. */
  avg: number
  last: number
  lastDate: string
  count: number
}

export function pricesByProduct(entries: Entry[]) {
  const map = new Map<string, { name: string; prices: { date: string; precio: number }[] }>()
  for (const e of entries) {
    for (const it of e.items ?? []) {
      const k = productKey(it.producto)
      if (!k || !it.precio) continue
      const cur = map.get(k) ?? { name: it.producto.trim(), prices: [] }
      cur.prices.push({ date: e.date, precio: it.precio })
      map.set(k, cur)
    }
  }
  const out = new Map<string, ProductPrice>()
  for (const [k, { name, prices }] of map) {
    prices.sort((a, b) => a.date.localeCompare(b.date))
    const last = prices[prices.length - 1]
    out.set(k, {
      name,
      avg: prices.reduce((a, p) => a + p.precio, 0) / prices.length,
      last: last.precio,
      lastDate: last.date,
      count: prices.length,
    })
  }
  return out
}

export interface PriceRow {
  key: string
  name: string
  prev?: number
  cur?: number
  pct?: number
}

/** Compara el precio unitario promedio de cada producto entre dos períodos. */
export function comparePrices(cur: Entry[], prev: Entry[]): PriceRow[] {
  const a = pricesByProduct(prev)
  const b = pricesByProduct(cur)
  const keys = new Set([...a.keys(), ...b.keys()])
  return [...keys]
    .map((key) => {
      const p = a.get(key)
      const c = b.get(key)
      return { key, name: (c ?? p)!.name, prev: p?.avg, cur: c?.avg, pct: p && c ? pctChange(p.avg, c.avg) : undefined }
    })
    .sort((x, y) => {
      // Primero los que se pueden comparar (ordenados por mayor variación), después el resto.
      if ((x.pct === undefined) !== (y.pct === undefined)) return x.pct === undefined ? 1 : -1
      return Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0) || x.name.localeCompare(y.name)
    })
}
