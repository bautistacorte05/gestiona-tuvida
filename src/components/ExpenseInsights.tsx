import { useMemo, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import type { Subcategory } from '../config/categories';
import { useDb, type Entry } from '../lib/db';
import { formatMonth, monthRange, shiftMonth } from '../lib/dates';
import { comparePrices, pctChange } from '../lib/prices';
import { tagsOf } from '../lib/stats';
import { useThemeColors, withAlpha } from '../lib/theme';
import { money, PctBadge } from './common';

interface Props {
  sub: Subcategory;
  entries: Entry[];
  prevEntries: Entry[];
  prevMonth: string;
}

const DONUT_COLORS = ['#f59e0b', '#a78bfa', '#38bdf8', '#fb923c', '#f472b6', '#4ade80', '#e879f9', '#94a3b8'];

interface DonutSlice {
  label: string;
  value: number;
  pct: number;
  color: string;
}

function DonutChart({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const c = useThemeColors();
  if (slices.length === 0) return null;

  const size = 140;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const segments = slices.reduce<(DonutSlice & { dashLen: number; gap: number; offset: number })[]>((acc, s) => {
    const accumulated = acc.reduce((sum, seg) => sum + seg.pct, 0);
    const dashLen = (s.pct / 100) * circumference;
    const gap = circumference - dashLen;
    const offset = -(accumulated / 100) * circumference;
    acc.push({ ...s, dashLen, gap, offset });
    return acc;
  }, []);

  const compactMoney = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return money.format(n);
  };

  return (
    <View className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <Text className="mb-3 text-sm text-ink-400">Gastos por categoría</Text>
      <View className="flex-row items-center gap-4">
        {/* Donut SVG via web-only dangerouslySetInnerHTML or View-based fallback */}
        {Platform.OS === 'web' ? (
          <View style={{ width: size, height: size }}>
            <div
              style={{ width: size, height: size, position: 'relative' }}
              dangerouslySetInnerHTML={{
                __html: `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
                  ${segments
                    .map(
                      (seg) =>
                        `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${seg.color}" stroke-width="${stroke}" stroke-dasharray="${seg.dashLen} ${seg.gap}" stroke-dashoffset="${seg.offset}" transform="rotate(-90 ${center} ${center})" stroke-linecap="butt"/>`,
                    )
                    .join('')}
                  <text x="${center}" y="${center - 6}" text-anchor="middle" fill="${c['ink-100']}" font-size="16" font-weight="700" font-family="system-ui">${compactMoney(total)}</text>
                  <text x="${center}" y="${center + 10}" text-anchor="middle" fill="${c['ink-500']}" font-size="10" font-family="system-ui">Total</text>
                </svg>`,
              }}
            />
          </View>
        ) : (
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-lg font-bold text-ink-100">{compactMoney(total)}</Text>
            <Text className="text-xs text-ink-500">Total</Text>
          </View>
        )}
        <View className="min-w-0 flex-1 gap-1.5">
          {slices.slice(0, 6).map((s) => (
            <View key={s.label} className="flex-row items-center gap-2">
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
              <Text className="min-w-0 flex-1 text-xs text-ink-400" numberOfLines={1}>
                {s.label}
              </Text>
              <Text className="text-xs font-semibold text-ink-100" style={{ fontVariant: ['tabular-nums'] }}>
                {compactMoney(s.value)}
              </Text>
              <Text className="w-8 text-right text-xs text-ink-500" style={{ fontVariant: ['tabular-nums'] }}>
                {s.pct}%
              </Text>
            </View>
          ))}
          {slices.length > 6 && <Text className="text-xs text-ink-500">y {slices.length - 6} más…</Text>}
        </View>
      </View>
    </View>
  );
}

function TrendChart({ months }: { months: { label: string; value: number }[] }) {
  const c = useThemeColors();
  if (months.length < 2) return null;

  const max = Math.max(...months.map((m) => m.value), 1);
  const lastIdx = months.length - 1;
  const prev = months[lastIdx - 1]?.value ?? 0;
  const curr = months[lastIdx]?.value ?? 0;
  const change = prev > 0 ? pctChange(prev, curr) : undefined;

  return (
    <View className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm text-ink-400">Tendencia mensual</Text>
        {change !== undefined && <PctBadge pct={change} />}
      </View>
      <View className="h-24 flex-row items-end gap-1.5">
        {months.map((m, i) => {
          const pct = max > 0 ? Math.max((m.value / max) * 100, 4) : 4;
          const isCurrent = i === lastIdx;
          return (
            <View key={m.label} className="flex-1 items-center gap-1">
              <View style={{ width: '100%', height: `${pct}%`, borderRadius: 4, backgroundColor: isCurrent ? c['shu-500'] : withAlpha(c['shu-400'], 0.3) }} />
            </View>
          );
        })}
      </View>
      <View className="mt-1.5 flex-row gap-1.5">
        {months.map((m, i) => (
          <Text key={m.label} className={`flex-1 text-center text-[10px] ${i === lastIdx ? 'font-bold text-ink-300' : 'text-ink-500'}`}>
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function ExpenseInsights({ sub, entries, prevEntries, prevMonth }: Props) {
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const totalKey = sub.fields.find((f) => f.money)?.key ?? 'monto';
  const groupKey = sub.fields.find((f) => f.type === 'select')?.key ?? 'rubro';

  const currentMonth = shiftMonth(prevMonth, 1);
  const allEntries = useDb((s) => s.entries);

  const { byGroup, donutSlices, multiCount, total, prevTotal } = useMemo(() => {
    const sumOf = (list: Entry[]) => list.reduce((a, e) => a + (Number(e.values[totalKey]) || 0), 0);
    const getGroups = (e: Entry) => tagsOf(e.values[groupKey]).map((t) => (t === 'Otros' && e.values.rubroOtro ? String(e.values.rubroOtro) : t));
    const isIn = (e: Entry, g: string) => (g === 'Sin categoría' ? getGroups(e).length === 0 : getGroups(e).includes(g));

    const t = sumOf(entries);
    const pt = sumOf(prevEntries);

    const all = [...entries, ...prevEntries];
    const groups = new Set(all.flatMap(getGroups));
    if (all.some((e) => getGroups(e).length === 0)) groups.add('Sin categoría');
    const grouped = [...groups]
      .map((g) => {
        const cur = sumOf(entries.filter((e) => isIn(e, g)));
        const prev = sumOf(prevEntries.filter((e) => isIn(e, g)));
        return { g, cur, prev, pct: pctChange(prev, cur) };
      })
      .sort((a, b) => b.cur - a.cur);

    const slices: DonutSlice[] =
      t === 0
        ? []
        : grouped
            .filter((r) => r.cur > 0)
            .map((r, i) => ({
              label: r.g,
              value: r.cur,
              pct: Math.round((r.cur / t) * 100),
              color: DONUT_COLORS[i % DONUT_COLORS.length],
            }));

    const multi = entries.filter((e) => getGroups(e).length > 1).length;

    return { byGroup: grouped, donutSlices: slices, multiCount: multi, total: t, prevTotal: pt };
  }, [entries, prevEntries, groupKey, totalKey]);
  const totalPct = pctChange(prevTotal, total);

  // --- Trend chart: últimos 6 meses ---
  const trendMonths = useMemo(() => {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const gastos = allEntries.filter((e) => e.categoryId === 'finanzas' && e.subId === 'gastos');
    return Array.from({ length: 6 }, (_, idx) => {
      const m = shiftMonth(currentMonth, -(5 - idx));
      const { start: ms, end: me } = monthRange(m);
      const monthTotal = gastos.filter((e) => e.date >= ms && e.date <= me).reduce((a, e) => a + (Number(e.values[totalKey]) || 0), 0);
      return { label: monthNames[Number(m.split('-')[1]) - 1], value: monthTotal };
    });
  }, [allEntries, currentMonth, totalKey]);
  const hasTrendData = trendMonths.some((m) => m.value > 0);

  const prices = useMemo(() => comparePrices(entries, prevEntries), [entries, prevEntries]);
  const q = query.trim().toLowerCase();
  const shownPrices = q ? prices.filter((p) => p.name.toLowerCase().includes(q)) : prices;
  const compared = prices.filter((p) => p.pct !== undefined);
  const avgPct = compared.length ? compared.reduce((a, p) => a + p.pct!, 0) / compared.length : undefined;
  const prevLabel = formatMonth(prevMonth).toLowerCase();

  return (
    <View className="gap-5">
      {/* Donut chart de categorías */}
      {donutSlices.length > 0 && <DonutChart slices={donutSlices} total={total} />}

      {/* Gráfico de tendencia mensual */}
      {hasTrendData && <TrendChart months={trendMonths} />}

      <View className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
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
        <View className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <Text className="mb-1 text-sm text-ink-400">Categoría vs. mes anterior</Text>
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

      <View className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm text-ink-400">Precio por producto (unitario)</Text>
        </View>
        {prices.length > 5 && (
          <TextInput
            className="mb-3 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100"
            placeholder="Buscar producto…"
            placeholderTextColor={c['ink-500']}
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
