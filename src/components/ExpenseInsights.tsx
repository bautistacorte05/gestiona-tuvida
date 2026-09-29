import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { Subcategory } from '../config/categories';
import { useDb, type Entry } from '../lib/db';
import { formatMonth, monthRange, shiftMonth } from '../lib/dates';
import { comparePrices, pctChange } from '../lib/prices';
import { tagsOf } from '../lib/stats';
import { money, PctBadge } from './common';

interface Props {
  sub: Subcategory;
  entries: Entry[];
  prevEntries: Entry[];
  prevMonth: string;
}

/** Comparación de gastos contra el mes anterior: total, por categoría y precio de cada producto. */
export default function ExpenseInsights({ sub, entries, prevEntries, prevMonth }: Props) {
  const [query, setQuery] = useState('');
  const totalKey = sub.fields.find((f) => f.money)?.key ?? 'monto';
  const groupKey = sub.fields.find((f) => f.type === 'select')?.key ?? 'rubro';
  const sum = (list: Entry[]) => list.reduce((a, e) => a + (Number(e.values[totalKey]) || 0), 0);

  const { start, end } = monthRange(shiftMonth(prevMonth, 1));
  const allEntries = useDb((s) => s.entries);
  const ingresos = useMemo(
    () => allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'ingresos' && e.date >= start && e.date <= end),
    [allEntries, start, end],
  );
  const totalIngresos = ingresos.reduce((a, e) => a + (Number(e.values.monto) || 0), 0);

  const total = sum(entries);
  const prevTotal = sum(prevEntries);
  const totalPct = pctChange(prevTotal, total);

  // Un gasto puede tener varias categorías marcadas a la vez; en ese caso el monto entero
  // cuenta para cada una (es una etiqueta, no se reparte la plata).
  const groupsOf = (e: Entry) => tagsOf(e.values[groupKey]);
  const inGroup = (e: Entry, g: string) => (g === 'Sin categoría' ? groupsOf(e).length === 0 : groupsOf(e).includes(g));

  const byGroup = useMemo(() => {
    const all = [...entries, ...prevEntries];
    const groups = new Set(all.flatMap(groupsOf));
    if (all.some((e) => groupsOf(e).length === 0)) groups.add('Sin categoría');
    return [...groups]
      .map((g) => {
        const cur = sum(entries.filter((e) => inGroup(e, g)));
        const prev = sum(prevEntries.filter((e) => inGroup(e, g)));
        return { g, cur, prev, pct: pctChange(prev, cur) };
      })
      .sort((a, b) => b.cur - a.cur);
  }, [entries, prevEntries, groupKey]);
  const multiCount = entries.filter((e) => groupsOf(e).length > 1).length;

  const prices = useMemo(() => comparePrices(entries, prevEntries), [entries, prevEntries]);
  const q = query.trim().toLowerCase();
  const shownPrices = q ? prices.filter((p) => p.name.toLowerCase().includes(q)) : prices;
  const compared = prices.filter((p) => p.pct !== undefined);
  const avgPct = compared.length ? compared.reduce((a, p) => a + p.pct!, 0) / compared.length : undefined;
  const prevLabel = formatMonth(prevMonth).toLowerCase();

  const saldo = totalIngresos - total;

  return (
    <View className="gap-5">
      <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
        <Text className="mb-3 text-sm text-ink-400">💰 Balance del mes</Text>
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-ink-500">Ingresos</Text>
            <Text className="font-semibold text-ink-100">{money.format(totalIngresos)}</Text>
          </View>
          <View>
            <Text className="text-xs text-ink-500">Gastos</Text>
            <Text className="font-semibold text-ink-100">{money.format(total)}</Text>
          </View>
          <View>
            <Text className="text-xs text-ink-500">Saldo</Text>
            <Text className={`font-semibold ${saldo >= 0 ? 'text-moss-300' : 'text-kurenai-300'}`}>
              {saldo < 0 ? '− ' : ''}
              {money.format(Math.abs(saldo))}
            </Text>
          </View>
        </View>
      </View>

      <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
        <Text className="mb-3 text-sm text-ink-400">Comparado con {prevLabel}</Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-xs text-ink-500">Gasto total</Text>
            <Text className="text-xl font-semibold text-ink-100">{money.format(total)}</Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <Text className="text-xs text-ink-400">antes {money.format(prevTotal)}</Text>
              {totalPct !== undefined && <PctBadge pct={totalPct} />}
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-ink-500">Precios (promedio)</Text>
            {avgPct !== undefined ? <PctBadge pct={avgPct} /> : <Text className="text-xl font-semibold text-ink-100">—</Text>}
            <Text className="mt-1 text-xs text-ink-400">{compared.length ? `${compared.length} productos comparados` : 'Cargá productos 2 meses seguidos'}</Text>
          </View>
        </View>
      </View>

      {byGroup.length > 0 && (
        <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
          <Text className="mb-1 text-sm text-ink-400">Por categoría</Text>
          {multiCount > 0 && (
            <Text className="mb-3 text-xs text-ink-500">
              {multiCount} gasto{multiCount > 1 ? 's tienen' : ' tiene'} más de una categoría marcada: cuentan completos en cada una.
            </Text>
          )}
          <View className="flex-row border-b border-ink-800 pb-2">
            <Text className="flex-1 text-xs text-ink-500">Categoría</Text>
            <Text className="w-20 text-right text-xs text-ink-500">Mes ant.</Text>
            <Text className="w-20 text-right text-xs text-ink-500">Este mes</Text>
          </View>
          {byGroup.map((r) => (
            <View key={r.g} className="flex-row items-center border-b border-ink-800 py-2">
              <Text className="flex-1 text-sm text-ink-100" numberOfLines={1}>
                {r.g}
              </Text>
              <Text className="w-20 text-right text-sm text-ink-400">{r.prev ? money.format(r.prev) : '—'}</Text>
              <View className="w-20 items-end">
                <Text className="text-sm text-ink-100">{r.cur ? money.format(r.cur) : '—'}</Text>
                {r.pct !== undefined && r.cur ? <PctBadge pct={r.pct} /> : null}
              </View>
            </View>
          ))}
        </View>
      )}

      <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm text-ink-400">Precio por producto (unitario)</Text>
        </View>
        {prices.length > 5 && (
          <TextInput
            className="mb-3 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100"
            placeholder="Buscar producto…"
            placeholderTextColor="#877a61"
            value={query}
            onChangeText={setQuery}
          />
        )}
        {prices.length === 0 ? (
          <Text className="text-sm text-ink-500">Todavía no hay productos. Al cargar un gasto, agregá cada producto con su precio.</Text>
        ) : (
          <>
            <View className="flex-row border-b border-ink-800 pb-2">
              <Text className="flex-1 text-xs text-ink-500">Producto</Text>
              <Text className="w-20 text-right text-xs text-ink-500">Mes ant.</Text>
              <Text className="w-20 text-right text-xs text-ink-500">Este mes</Text>
            </View>
            {shownPrices.map((p) => (
              <View key={p.key} className="flex-row items-center border-b border-ink-800 py-2">
                <Text className="flex-1 text-sm text-ink-100" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="w-20 text-right text-sm text-ink-400">{p.prev !== undefined ? money.format(p.prev) : '—'}</Text>
                <View className="w-20 items-end">
                  <Text className="text-sm text-ink-100">{p.cur !== undefined ? money.format(p.cur) : '—'}</Text>
                  {p.pct !== undefined ? <PctBadge pct={p.pct} /> : p.cur !== undefined ? <Text className="text-xs text-ink-500">nuevo</Text> : null}
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}
