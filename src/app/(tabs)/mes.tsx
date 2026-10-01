import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PctBadge, Stepper } from '../../components/common';
import { Legend, MonthStack } from '../../components/TimeCharts';
import { DAILY_CATEGORIES } from '../../config/categories';
import { useDb, type Check, type Entry } from '../../lib/db';
import { formatMonth, monthKey, monthRange, shiftMonth, today } from '../../lib/dates';
import { useCategoryName } from '../../lib/names';
import { pctChange } from '../../lib/prices';
import { useThemeColors } from '../../lib/theme';
import { CHART_CATEGORIES, formatMinutes, minutesByDay } from '../../lib/time';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const isDaily = (id: string) => DAILY_CATEGORIES.some((c) => c.id === id);

/** Totales de minutos por categoría en un rango de fechas. */
function useMonthTime(allChecks: Check[], allEntries: Entry[], month: string, untilDay?: number) {
  const range = monthRange(month);
  const start = range.start;
  const end = untilDay ? `${month}-${String(Math.min(untilDay, range.days)).padStart(2, '0')}` : range.end;

  return useMemo(() => {
    const checks = allChecks.filter((c) => c.date >= start && c.date <= end);
    const entries = allEntries.filter((e) => e.date >= start && e.date <= end && isDaily(e.categoryId));
    const byDay = minutesByDay(checks, entries);
    const byCat = new Map<string, number>();
    const daysByCat = new Map<string, Set<string>>();
    for (const [date, cats] of byDay)
      for (const [cat, m] of cats) {
        byCat.set(cat, (byCat.get(cat) ?? 0) + m);
        daysByCat.set(cat, (daysByCat.get(cat) ?? new Set()).add(date));
      }
    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    return { byDay, byCat, daysByCat, total, checks };
     
  }, [allChecks, allEntries, start, end]);
}

export default function MesScreen() {
  const nameOf = useCategoryName();
  const c = useThemeColors();
  const [month, setMonth] = useState(() => monthKey(today()));
  const allChecks = useDb((s) => s.checks);
  const allEntries = useDb((s) => s.entries);
  const { days } = monthRange(month);
  const isCurrent = month === monthKey(today());
  const todayDay = isCurrent ? Number(today().slice(8)) : 0;
  const cur = useMonthTime(allChecks, allEntries, month);
  const prev = useMonthTime(allChecks, allEntries, shiftMonth(month, -1), todayDay || undefined);
  const vsLabel = isCurrent ? `vs 1–${todayDay} del mes ant.` : 'vs mes ant.';
  const elapsed = isCurrent ? todayDay : month < monthKey(today()) ? days : 0;
  const activeDays = cur.byDay.size;
  const top = CHART_CATEGORIES.filter((c) => cur.byCat.get(c.id)).sort((a, b) => cur.byCat.get(b.id)! - cur.byCat.get(a.id)!)[0];
  const totalPct = pctChange(prev.total, cur.total);

  const totalDaily = DAILY_CATEGORIES.length;
  const ticks = Array.from({ length: days }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`;
    // Solo actividades (no metas diarias ni tareas, que también guardan su tilde en checks).
    return cur.checks.filter((c) => c.date === d && isDaily(c.categoryId)).length;
  });
  const [y, m] = month.split('-').map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;

  const rows = CHART_CATEGORIES.map((c) => {
    const min = cur.byCat.get(c.id) ?? 0;
    const ticksDays = cur.checks.filter((k) => k.categoryId === c.id).length;
    return {
      c,
      min,
      share: cur.total ? (min / cur.total) * 100 : 0,
      days: Math.max(cur.daysByCat.get(c.id)?.size ?? 0, ticksDays),
      avg: cur.daysByCat.get(c.id)?.size ? min / cur.daysByCat.get(c.id)!.size : 0,
      pct: pctChange(prev.byCat.get(c.id) ?? 0, min),
    };
  }).sort((a, b) => b.min - a.min);
  const maxMin = Math.max(...rows.map((r) => r.min), 1);

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['bottom']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center justify-between gap-3">
          <View>
            <Text className="text-sm text-ink-400">¿En qué se fue el tiempo?</Text>
            <Text className="text-2xl font-bold text-ink-100">{formatMonth(month)}</Text>
          </View>
          <Stepper label={formatMonth(month)} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />
        </View>

        <View className="flex-row flex-wrap gap-3">
          <Kpi label="Tiempo total" value={cur.total ? formatMinutes(cur.total) : '—'}>
            {totalPct !== undefined && cur.total > 0 ? (
              <View className="flex-row flex-wrap items-center gap-1">
                <PctBadge pct={totalPct} neutral />
                <Text className="text-xs text-ink-500">{vsLabel}</Text>
              </View>
            ) : null}
          </Kpi>
          <Kpi label="Promedio por día" value={elapsed && cur.total ? formatMinutes(cur.total / elapsed) : '—'}>
            {elapsed ? <Text className="text-xs text-ink-500">sobre {elapsed} días</Text> : null}
          </Kpi>
          <Kpi label="Días con tiempo cargado" value={`${activeDays} / ${days}`} />
          <Kpi label="Donde más tiempo" value={top ? `${top.icon} ${nameOf(top.id, top.name)}` : '—'}>
            {top ? <Text className="text-xs text-ink-500">{formatMinutes(cur.byCat.get(top.id)!)}</Text> : null}
          </Kpi>
        </View>

        <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
          <Text className="mb-3 text-sm text-ink-400">Reparto del tiempo</Text>
          {cur.total === 0 ? (
            <Text className="text-sm text-ink-500">Todavía no cargaste tiempo este mes. En &quot;Hoy&quot;, tocá &quot;⏱ Tiempo&quot; en cada actividad.</Text>
          ) : (
            <View className="gap-3">
              {rows.map((r) => (
                <View key={r.c.id}>
                  <View className="mb-1 flex-row items-baseline justify-between gap-2">
                    <View className="flex-row items-center gap-2">
                      <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.c.chart }} />
                      <Text className="text-sm text-ink-100">
                        {r.c.icon} {nameOf(r.c.id, r.c.name)}
                      </Text>
                    </View>
                    <Text className="text-sm text-ink-100">
                      {r.min ? formatMinutes(r.min) : '—'} <Text className="text-ink-500">· {Math.round(r.share)}%</Text>
                    </Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-ink-800">
                    <View className="h-full rounded-r-[4px]" style={{ width: `${(r.min / maxMin) * 100}%`, backgroundColor: r.c.chart }} />
                  </View>
                  <View className="mt-1 flex-row flex-wrap items-center gap-x-3">
                    <Text className="text-xs text-ink-500">{r.days} días</Text>
                    {r.avg > 0 && <Text className="text-xs text-ink-500">{formatMinutes(r.avg)} por día activo</Text>}
                    {r.pct !== undefined && r.min > 0 && (
                      <View className="flex-row items-center gap-1">
                        <Text className="text-xs text-ink-500">{vsLabel}</Text>
                        <PctBadge pct={r.pct} neutral />
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
          <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-sm text-ink-400">Tiempo por día</Text>
            <Legend />
          </View>
          <MonthStack month={month} days={days} data={cur.byDay} />
        </View>

        <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
          <Text className="mb-3 text-sm text-ink-400">🔥 Constancia (actividades marcadas por día)</Text>
          <View className="flex-row flex-wrap" style={{ gap: 4 }}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`w${i}`} className="text-center text-[10px] text-ink-500" style={{ width: '12.5%' }}>
                {d}
              </Text>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <View key={`o${i}`} style={{ width: '12.5%', aspectRatio: 1 }} />
            ))}
            {ticks.map((n, i) => (
              <View
                key={i}
                style={{
                  width: '12.5%',
                  aspectRatio: 1,
                  borderRadius: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: n ? `rgba(191,59,46,${0.15 + (n / totalDaily) * 0.75})` : `${c['ink-800']}99`,
                  borderWidth: todayDay === i + 1 ? 2 : 0,
                  borderColor: c['gold-400'],
                }}>
                <Text style={{ fontSize: 11, color: n / totalDaily > 0.6 ? '#16120f' : c['ink-100'] }}>{i + 1}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <View className="rounded-xl border border-ink-800 bg-ink-900/60 p-4" style={{ width: '47%' }}>
      <Text className="text-xs text-ink-400">{label}</Text>
      <Text className="mt-1 text-xl font-semibold text-ink-100" numberOfLines={1}>
        {value}
      </Text>
      {children ? <View className="mt-1">{children}</View> : null}
    </View>
  );
}
