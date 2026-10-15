import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXTERNAL_MONEY_FIELDS, findSub } from '../config/categories';
import { useDb, type Entry } from '../lib/db';
import { formatDay, monthKey, monthRange, today } from '../lib/dates';
import { formatCurrency, tagsOf } from '../lib/stats';
import { useThemeColors, withAlpha } from '../lib/theme';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

function amountOf(e: Entry) {
  if (e.categoryId === 'finanzas') return Number(e.values.monto) || 0;
  return EXTERNAL_MONEY_FIELDS.filter((x) => x.category.id === e.categoryId && x.sub.id === e.subId).reduce((a, x) => a + (Number(e.values[x.field.key]) || 0), 0);
}

const RUBRO_COLORS: Record<string, string> = {
  Supermercado: '#f59e0b',
  Verdulería: '#84cc16',
  Carnicería: '#ef4444',
  Almacén: '#f97316',
  Farmacia: '#06b6d4',
  Combustible: '#38bdf8',
  Transporte: '#38bdf8',
  Servicios: '#fb923c',
  Salidas: '#a78bfa',
  Ropa: '#e879f9',
  Hogar: '#4ade80',
  Salud: '#f472b6',
  Mascota: '#f472b6',
  Educación: '#60a5fa',
  Entretenimiento: '#c084fc',
  Suscripciones: '#22d3ee',
  Regalos: '#fb7185',
  Viajes: '#34d399',
  Impuestos: '#fbbf24',
  Otros: '#94a3b8',
};

function rubroColor(rubro: string) {
  return RUBRO_COLORS[rubro] ?? '#94a3b8';
}

export default function FinanceHomeView() {
  const c = useThemeColors();
  const found = findSub('finanzas', 'gastos')!;
  const foundIngresos = findSub('finanzas', 'ingresos')!;

  const allEntries = useDb((s) => s.entries);
  const month = monthKey(today());
  const { start, end } = monthRange(month);

  const gastosMes = useMemo(() => allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'gastos' && e.date >= start && e.date <= end), [allEntries, start, end]);
  const ingresosMes = useMemo(() => allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'ingresos' && e.date >= start && e.date <= end), [allEntries, start, end]);
  const externosMes = useMemo(
    () => allEntries.filter((e) => e.categoryId !== 'finanzas' && e.date >= start && e.date <= end && EXTERNAL_MONEY_FIELDS.some((x) => x.category.id === e.categoryId && x.sub.id === e.subId)),
    [allEntries, start, end],
  );

  const totalGastos = gastosMes.reduce((a, e) => a + amountOf(e), 0) + externosMes.reduce((a, e) => a + amountOf(e), 0);
  const totalIngresos = ingresosMes.reduce((a, e) => a + amountOf(e), 0);
  const saldo = totalIngresos - totalGastos;

  const allGastosMes = useMemo(() => [...gastosMes, ...externosMes], [gastosMes, externosMes]);

  // --- Stats del mes ---
  const stats = useMemo(() => {
    const daysRegistered = new Set(allGastosMes.map((e) => e.date)).size;
    const promedioDiario = daysRegistered > 0 ? totalGastos / daysRegistered : 0;

    let maxGasto = 0;
    let maxGastoLabel = '';
    let maxGastoDate = '';
    for (const e of allGastosMes) {
      const amt = amountOf(e);
      if (amt > maxGasto) {
        maxGasto = amt;
        const rubros = e.categoryId === 'finanzas' ? tagsOf(e.values.rubro) : [];
        maxGastoLabel = rubros[0] ?? (e.categoryId !== 'finanzas' ? findSub(e.categoryId, e.subId)?.sub.name ?? 'Gasto' : String(e.values.lugar ?? 'Gasto'));
        maxGastoDate = e.date;
      }
    }

    const rubrosMap = new Map<string, number>();
    for (const e of allGastosMes) {
      const amt = amountOf(e);
      if (e.categoryId === 'finanzas') {
        const tags = tagsOf(e.values.rubro);
        if (tags.length === 0) {
          rubrosMap.set('Otros', (rubrosMap.get('Otros') ?? 0) + amt);
        } else {
          for (const t of tags) {
            const label = t === 'Otros' && e.values.rubroOtro ? String(e.values.rubroOtro) : t;
            rubrosMap.set(label, (rubrosMap.get(label) ?? 0) + amt);
          }
        }
      } else {
        const f = findSub(e.categoryId, e.subId);
        const label = f ? f.sub.name : 'Otros';
        rubrosMap.set(label, (rubrosMap.get(label) ?? 0) + amt);
      }
    }
    const topCategory = [...rubrosMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const topPct = topCategory && totalGastos > 0 ? Math.round((topCategory[1] / totalGastos) * 100) : 0;

    return {
      maxGasto,
      maxGastoLabel,
      maxGastoDate,
      promedioDiario,
      daysRegistered,
      topCategory: topCategory?.[0] ?? '',
      topPct,
      count: allGastosMes.length,
    };
  }, [allGastosMes, totalGastos]);

  // --- Movimientos del mes agrupados por día ---
  const grouped = useMemo(() => {
    const all = [
      ...gastosMes.map((e) => ({ e, sub: found.sub, cat: found.category })),
      ...ingresosMes.map((e) => ({ e, sub: foundIngresos.sub, cat: foundIngresos.category })),
      ...externosMes.map((e) => {
        const f = findSub(e.categoryId, e.subId)!;
        return { e, sub: f.sub, cat: f.category };
      }),
    ].sort((a, b) => b.e.date.localeCompare(a.e.date) || b.e.createdAt - a.e.createdAt);

    const todayStr = today();
    const yesterdayStr = (() => {
      const dt = new Date();
      dt.setDate(dt.getDate() - 1);
      return dt.toISOString().slice(0, 10);
    })();

    const groups: { date: string; label: string; items: typeof all }[] = [];
    for (const item of all) {
      const last = groups[groups.length - 1];
      if (last && last.date === item.e.date) {
        last.items.push(item);
      } else {
        const d = item.e.date;
        const dayLabel = d === todayStr ? 'Hoy' : d === yesterdayStr ? 'Ayer' : formatDay(d, { weekday: 'long', day: 'numeric', month: 'short' });
        groups.push({ date: d, label: dayLabel, items: [item] });
      }
    }
    return groups;
  }, [gastosMes, ingresosMes, externosMes, found.sub, found.category, foundIngresos.sub, foundIngresos.category]);

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-4 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="finanzas" subId="balance" />
        </View>

        {/* ── Tarjeta de balance mensual ── */}
        <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 p-5">
          <Text className="text-sm text-ink-400">Balance del mes</Text>
          <Text className={`mt-1 text-4xl font-bold ${saldo >= 0 ? 'text-ink-100' : 'text-kurenai-400'}`}>{formatCurrency(saldo, 'ARS')}</Text>
          <View className="mt-4 flex-row gap-4 border-t border-ink-800 pt-4">
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full bg-moss-400" />
                <Text className="text-xs text-ink-500">Ingresos</Text>
              </View>
              <Text className="mt-0.5 text-base font-semibold text-moss-400">+{formatCurrency(totalIngresos, 'ARS')}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full bg-kurenai-400" />
                <Text className="text-xs text-ink-500">Gastos</Text>
              </View>
              <Text className="mt-0.5 text-base font-semibold text-kurenai-400">−{formatCurrency(totalGastos, 'ARS')}</Text>
            </View>
          </View>
          {externosMes.length > 0 && <Text className="mt-2 text-xs text-ink-500">Incluye gastos de otras categorías (ej: 🩺 Veterinario).</Text>}
        </View>

        {/* ── Stats rápidos ── */}
        {allGastosMes.length > 0 && (
          <View className="flex-row flex-wrap gap-2.5">
            <View className="min-w-[46%] flex-1 rounded-xl border border-ink-800 bg-ink-900 p-3.5">
              <Text className="text-xs text-ink-500">Gasto más grande</Text>
              <Text className="mt-1 text-lg font-bold text-ink-100">{formatCurrency(stats.maxGasto, 'ARS')}</Text>
              <Text className="mt-0.5 text-xs text-ink-500" numberOfLines={1}>
                {stats.maxGastoLabel} · {formatDay(stats.maxGastoDate, { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View className="min-w-[46%] flex-1 rounded-xl border border-ink-800 bg-ink-900 p-3.5">
              <Text className="text-xs text-ink-500">Promedio diario</Text>
              <Text className="mt-1 text-lg font-bold text-ink-100">{formatCurrency(stats.promedioDiario, 'ARS')}</Text>
              <Text className="mt-0.5 text-xs text-ink-500">
                {stats.daysRegistered} día{stats.daysRegistered !== 1 ? 's' : ''} con gastos
              </Text>
            </View>
            <View className="min-w-[46%] flex-1 rounded-xl border border-ink-800 bg-ink-900 p-3.5">
              <Text className="text-xs text-ink-500">Categoría top</Text>
              <Text className="mt-1 text-base font-bold text-ink-100" numberOfLines={1}>
                {stats.topCategory}
              </Text>
              <Text className="mt-0.5 text-xs text-ink-500">{stats.topPct}% del total</Text>
            </View>
            <View className="min-w-[46%] flex-1 rounded-xl border border-ink-800 bg-ink-900 p-3.5">
              <Text className="text-xs text-ink-500">Gastos cargados</Text>
              <Text className="mt-1 text-lg font-bold text-ink-100">{stats.count}</Text>
              <Text className="mt-0.5 text-xs text-ink-500">este mes</Text>
            </View>
          </View>
        )}

        {/* ── Movimientos del mes agrupados por día ── */}
        <View>
          <Text className="mb-2 font-bold text-ink-100">Movimientos del mes</Text>
          {grouped.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-ink-800 p-6">
              <Text className="text-center text-sm text-ink-500">Todavía no cargaste gastos ni ingresos este mes.</Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
              {grouped.map((group) => (
                <View key={group.date}>
                  <View className="bg-ink-800/40 px-4 py-2">
                    <Text className="text-xs font-semibold text-ink-400" style={{ letterSpacing: 0.3 }}>
                      {group.label}
                    </Text>
                  </View>
                  {group.items.map(({ e, sub, cat }) => {
                    const isIngreso = sub.id === 'ingresos';
                    const isExternal = cat.id !== 'finanzas';
                    const rubros = !isIngreso && !isExternal ? tagsOf(e.values.rubro) : [];
                    const displayRubro = rubros[0] === 'Otros' && e.values.rubroOtro ? String(e.values.rubroOtro) : rubros[0];
                    const label = isIngreso
                      ? String(e.values.fuente ?? 'Ingreso')
                      : isExternal
                        ? `${sub.name}`
                        : String(e.values.lugar || displayRubro || 'Gasto');
                    const pillLabel = isIngreso ? String(e.values.fuente ?? 'Ingreso') : isExternal ? cat.name : displayRubro ?? '';
                    const pillColor = isIngreso ? c['moss-400'] : rubroColor(rubros[0] ?? (isExternal ? 'Mascota' : 'Otros'));

                    return (
                      <View key={e.id} className="flex-row items-center gap-3 border-b border-ink-800/50 px-4 py-3">
                        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: withAlpha(isIngreso ? c['moss-400'] : c['kurenai-400'], 0.12) }}>
                          <Text className="text-lg">{sub.icon}</Text>
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text numberOfLines={1} className="text-sm font-medium text-ink-100">
                            {label}
                          </Text>
                          <View className="mt-0.5 flex-row items-center gap-1.5">
                            {!!pillLabel && (
                              <Text
                                className="overflow-hidden rounded px-1.5 py-0.5 text-xs font-medium"
                                numberOfLines={1}
                                style={{ backgroundColor: withAlpha(pillColor, 0.18), color: pillColor }}
                              >
                                {pillLabel}
                              </Text>
                            )}
                            {isExternal && <Text className="text-xs text-ink-500">desde {cat.icon}</Text>}
                          </View>
                        </View>
                        <Text className={`shrink-0 text-sm font-semibold ${isIngreso ? 'text-moss-400' : 'text-kurenai-400'}`}>
                          {isIngreso ? '+' : '−'}
                          {formatCurrency(amountOf(e), 'ARS')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
