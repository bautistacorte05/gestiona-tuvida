import type { Entry } from './db'

/** Aportes menos retiros, separado por moneda (ARS/USD). */
export function netByCurrency(entries: Entry[]) {
  const net: Record<string, number> = { ARS: 0, USD: 0 }
  for (const e of entries) {
    const cur = String(e.values.moneda) === 'USD' ? 'USD' : 'ARS'
    const monto = Number(e.values.monto) || 0
    net[cur] += e.values.tipo === 'Retiro' ? -monto : monto
  }
  return net
}
