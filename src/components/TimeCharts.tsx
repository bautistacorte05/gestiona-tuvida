import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDay } from '../lib/dates';
import { CHART_CATEGORIES, formatMinutes } from '../lib/time';

/** Leyenda: el color lleva la identidad, el texto queda en tinta neutra. */
export function Legend() {
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
      {CHART_CATEGORIES.map((c) => (
        <View key={c.id} className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.chart }} />
          <Text className="text-xs text-ink-400">{c.name}</Text>
        </View>
      ))}
    </View>
  );
}

/** Barra horizontal apilada con el reparto del tiempo de un día. */
export function DayStack({ byCat }: { byCat: Map<string, number> }) {
  const total = [...byCat.values()].reduce((a, b) => a + b, 0);
  if (!total) return <View className="h-3 rounded-full bg-ink-800" />;
  return (
    <View className="h-3 flex-row gap-[2px] overflow-hidden rounded-full">
      {CHART_CATEGORIES.map((c) => {
        const m = byCat.get(c.id) ?? 0;
        if (!m) return null;
        return <View key={c.id} style={{ width: `${(m / total) * 100}%`, backgroundColor: c.chart }} />;
      })}
    </View>
  );
}

/** Columnas apiladas por día del mes; tocar una columna muestra el detalle. */
export function MonthStack({ month, days, data }: { month: string; days: number; data: Map<string, Map<string, number>> }) {
  const [active, setActive] = useState<number | null>(null);
  const cols = Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const byCat = data.get(date) ?? new Map<string, number>();
    return { date, byCat, total: [...byCat.values()].reduce((a, b) => a + b, 0) };
  });
  const max = Math.max(...cols.map((c) => c.total), 60);
  const guideH = Math.max(1, Math.floor(max / 60));
  const sel = active !== null ? cols[active] : null;

  return (
    <View>
      <View className="h-40">
        <View className="absolute inset-x-0 border-t border-dashed border-ink-700" style={{ bottom: `${((guideH * 60) / max) * 100}%` }}>
          <Text className="absolute -top-4 right-0 text-[10px] text-ink-500">{guideH} h</Text>
        </View>
        <View className="absolute inset-0 flex-row items-end gap-[2px]">
          {cols.map((c, i) => (
            <Pressable
              key={c.date}
              onPress={() => setActive(active === i ? null : i)}
              accessibilityLabel={`${formatDay(c.date, { day: 'numeric', month: 'short' })}: ${formatMinutes(c.total)}`}
              className={`h-full flex-1 justify-end gap-[2px] rounded-t-sm ${active === i ? 'bg-ink-800/60' : ''}`}
              style={{ flexDirection: 'column-reverse' }}>
              {c.total === 0 ? (
                <View className="h-[3px] rounded-sm bg-ink-800" />
              ) : (
                CHART_CATEGORIES.map((cat, k) => {
                  const m = c.byCat.get(cat.id) ?? 0;
                  if (!m) return null;
                  const isTop = !CHART_CATEGORIES.slice(k + 1).some((o) => c.byCat.get(o.id));
                  return (
                    <View
                      key={cat.id}
                      className={isTop ? 'rounded-t-[4px]' : ''}
                      style={{ height: `${Math.max((m / max) * 100, 1)}%` as `${number}%`, backgroundColor: cat.chart, minHeight: 2 }}
                    />
                  );
                })
              )}
            </Pressable>
          ))}
        </View>
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-[10px] text-ink-500">1</Text>
        <Text className="text-[10px] text-ink-500">{Math.ceil(days / 2)}</Text>
        <Text className="text-[10px] text-ink-500">{days}</Text>
      </View>
      <View className="mt-2 min-h-12 rounded-xl bg-ink-950/60 px-3 py-2">
        {sel ? (
          <>
            <Text className="mb-1 text-xs font-medium text-ink-200">
              {formatDay(sel.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {formatMinutes(sel.total)}
            </Text>
            <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
              {CHART_CATEGORIES.filter((c) => sel.byCat.get(c.id)).map((c) => (
                <View key={c.id} className="flex-row items-center gap-1">
                  <View className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.chart }} />
                  <Text className="text-xs text-ink-400">
                    {c.name} {formatMinutes(sel.byCat.get(c.id)!)}
                  </Text>
                </View>
              ))}
              {!sel.total && <Text className="text-xs text-ink-400">Sin tiempo cargado</Text>}
            </View>
          </>
        ) : (
          <Text className="text-xs text-ink-500">Tocá una columna para ver el detalle del día.</Text>
        )}
      </View>
    </View>
  );
}
