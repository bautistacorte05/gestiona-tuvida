import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useDb, type Entry } from '../lib/db';
import { netByCurrency } from '../lib/savings';
import { formatCurrency } from '../lib/stats';

const CURRENCIES = ['ARS', 'USD'] as const;

/** Saldo de ahorros por moneda: total acumulado (todo el historial) + movimientos del mes. */
export default function SavingsInsights({ categoryId, subId, entries }: { categoryId: string; subId: string; entries: Entry[] }) {
  // Todo el historial, para el saldo acumulado (no solo el mes que se está viendo).
  const allEntries = useDb((s) => s.entries);
  const subEntries = useMemo(() => allEntries.filter((e) => e.categoryId === categoryId && e.subId === subId), [allEntries, categoryId, subId]);
  const total = useMemo(() => netByCurrency(subEntries), [subEntries]);

  return (
    <View className="flex-row flex-wrap gap-3">
      {CURRENCIES.map((cur) => {
        const monthMoves = entries.filter((e) => (String(e.values.moneda) === 'USD' ? 'USD' : 'ARS') === cur);
        const aportes = monthMoves.filter((e) => e.values.tipo === 'Aporte').reduce((a, e) => a + (Number(e.values.monto) || 0), 0);
        const retiros = monthMoves.filter((e) => e.values.tipo === 'Retiro').reduce((a, e) => a + (Number(e.values.monto) || 0), 0);
        return (
          <View key={cur} className="rounded-2xl border border-ink-800 bg-ink-900 p-4" style={{ width: '47%' }}>
            <Text className="text-sm text-ink-400">Ahorrado en {cur === 'ARS' ? 'pesos' : 'dólares'}</Text>
            <Text className="mt-1 text-2xl font-semibold text-ink-100">{formatCurrency(total[cur], cur)}</Text>
            {monthMoves.length > 0 ? (
              <View className="mt-3 gap-1">
                {aportes > 0 && (
                  <Text className="text-xs text-ink-400">
                    <Text className="text-moss-400">▲ aportes</Text> {formatCurrency(aportes, cur)}
                  </Text>
                )}
                {retiros > 0 && (
                  <Text className="text-xs text-ink-400">
                    <Text className="text-kurenai-400">▼ retiros</Text> {formatCurrency(retiros, cur)}
                  </Text>
                )}
              </View>
            ) : (
              <Text className="mt-3 text-xs text-ink-500">Sin movimientos este mes</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
