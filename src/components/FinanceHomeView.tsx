import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXTERNAL_MONEY_FIELDS, findSub, type Category, type Subcategory } from '../config/categories';
import { useDb, type Entry } from '../lib/db';
import { formatDay, monthKey, monthRange, today } from '../lib/dates';
import { goToSub } from '../lib/nav';
import { netByCurrency } from '../lib/savings';
import { formatCurrency } from '../lib/stats';
import EntryForm from './EntryForm';
import BackButton from './BackButton';

type Editing = { category: Category; sub: Subcategory; entry?: Entry };

/** Monto en pesos de un registro: el campo "monto" de Finanzas, o el/los campos de dinero de otra categoría. */
function amountOf(e: Entry) {
  if (e.categoryId === 'finanzas') return Number(e.values.monto) || 0;
  return EXTERNAL_MONEY_FIELDS.filter((x) => x.category.id === e.categoryId && x.sub.id === e.subId).reduce((a, x) => a + (Number(e.values[x.field.key]) || 0), 0);
}

/** Panel principal de Finanzas: saldo acumulado de siempre (como una billetera), accesos rápidos y movimientos recientes. */
export default function FinanceHomeView() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const found = findSub('finanzas', 'gastos')!;
  const foundIngresos = findSub('finanzas', 'ingresos')!;

  const allEntries = useDb((s) => s.entries);
  const gastos = useMemo(() => allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'gastos'), [allEntries]);
  const ingresos = useMemo(() => allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'ingresos'), [allEntries]);
  const ahorros = useMemo(() => allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'ahorros'), [allEntries]);
  // Gastos cargados en OTRAS categorías (ej: Mascota → Salud/Veterinario), para descontarlos también.
  const externos = useMemo(
    () => allEntries.filter((e) => e.categoryId !== 'finanzas' && EXTERNAL_MONEY_FIELDS.some((x) => x.category.id === e.categoryId && x.sub.id === e.subId)),
    [allEntries],
  );

  const totalGastos = gastos.reduce((a, e) => a + amountOf(e), 0) + externos.reduce((a, e) => a + amountOf(e), 0);
  const totalIngresos = ingresos.reduce((a, e) => a + amountOf(e), 0);
  const saldo = totalIngresos - totalGastos;

  const month = monthKey(today());
  const { start, end } = monthRange(month);
  const inMonth = (e: Entry) => e.date >= start && e.date <= end;
  const gastosMes = gastos.filter(inMonth).reduce((a, e) => a + amountOf(e), 0) + externos.filter(inMonth).reduce((a, e) => a + amountOf(e), 0);
  const ingresosMes = ingresos.filter(inMonth).reduce((a, e) => a + amountOf(e), 0);

  const ahorroNeto = useMemo(() => netByCurrency(ahorros), [ahorros]);

  const recientes = useMemo(
    () =>
      [
        ...gastos.map((e) => ({ e, sub: found.sub, cat: found.category })),
        ...ingresos.map((e) => ({ e, sub: foundIngresos.sub, cat: foundIngresos.category })),
        ...externos.map((e) => {
          const f = findSub(e.categoryId, e.subId)!;
          return { e, sub: f.sub, cat: f.category };
        }),
      ]
        .sort((a, b) => b.e.date.localeCompare(a.e.date) || b.e.createdAt - a.e.createdAt)
        .slice(0, 8),
    [gastos, ingresos, externos],
  );

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <View>
            <Text className="text-sm text-emerald-400">💰 Finanzas</Text>
            <Text className="text-2xl font-bold text-ink-100">Balance</Text>
          </View>
        </View>

        <View className="rounded-xl border border-ink-800 border-l-4 border-l-shu-500 bg-ink-900/60 p-4">
          <Text className="text-sm text-ink-400">Saldo actual</Text>
          <Text className={`mt-1 text-4xl font-semibold ${saldo >= 0 ? 'text-ink-100' : 'text-kurenai-400'}`}>{formatCurrency(saldo, 'ARS')}</Text>
          <Text className="mt-2 text-xs text-ink-500">
            Este mes: <Text className="text-moss-400">+{formatCurrency(ingresosMes, 'ARS')}</Text> · <Text className="text-kurenai-400">−{formatCurrency(gastosMes, 'ARS')}</Text>
          </Text>
          {externos.length > 0 && <Text className="mt-1 text-xs text-ink-500">Incluye gastos cargados en otras categorías (ej: 🩺 Mascota → Salud).</Text>}
          <View className="mt-4 flex-row gap-2">
            <Pressable onPress={() => setEditing({ ...found })} className="flex-1 items-center justify-center rounded-lg border border-shu-500/50 py-2.5">
              <Text className="font-medium text-shu-300">− Gasto</Text>
            </Pressable>
            <Pressable onPress={() => setEditing({ ...foundIngresos })} className="flex-1 items-center justify-center rounded-lg bg-moss-500 py-2.5">
              <Text className="font-medium text-washi">+ Ingreso</Text>
            </Pressable>
          </View>
        </View>

        {(ahorroNeto.ARS !== 0 || ahorroNeto.USD !== 0) && (
          <Pressable onPress={() => goToSub('finanzas', 'ahorros')} className="flex-row items-center gap-4 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
            <Text className="text-2xl">🐖</Text>
            <View className="flex-1">
              <Text className="text-sm text-ink-400">Ahorros</Text>
              <Text className="text-sm font-medium text-ink-100">
                {formatCurrency(ahorroNeto.ARS, 'ARS')} · {formatCurrency(ahorroNeto.USD, 'USD')}
              </Text>
            </View>
            <Text className="text-ink-600">›</Text>
          </Pressable>
        )}

        <View>
          <Text className="mb-2 font-semibold text-ink-100">Movimientos recientes</Text>
          {recientes.length === 0 ? (
            <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
              <Text className="text-center text-sm text-ink-500">Todavía no cargaste gastos ni ingresos.</Text>
            </View>
          ) : (
            <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-2">
              {recientes.map(({ e, sub, cat }) => {
                const isIngreso = sub.id === 'ingresos';
                const isExternal = cat.id !== 'finanzas';
                const label = isIngreso ? String(e.values.fuente ?? 'Ingreso') : isExternal ? `${sub.name} · ${cat.name}` : String(e.values.rubro ?? 'Gasto');
                return (
                  <Pressable key={e.id} onPress={() => setEditing({ category: cat, sub, entry: e })} className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-ink-800/60">
                    <Text className="text-xl">{sub.icon}</Text>
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-sm font-medium text-ink-100">
                        {label}
                      </Text>
                      <Text className="text-xs text-ink-500">{formatDay(e.date, { day: 'numeric', month: 'short' })}</Text>
                    </View>
                    <Text className={`shrink-0 text-sm font-medium ${isIngreso ? 'text-moss-400' : 'text-kurenai-400'}`}>
                      {isIngreso ? '+' : '−'}
                      {formatCurrency(amountOf(e), 'ARS')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {editing && <EntryForm {...editing} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}
