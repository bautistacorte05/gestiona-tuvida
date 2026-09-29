import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Empty, EntryRow } from '../../components/common';
import EntryForm from '../../components/EntryForm';
import MinutesSheet from '../../components/MinutesSheet';
import { DayStack } from '../../components/TimeCharts';
import { COLOR_CLASSES, DAILY_CATEGORIES, findSub, type Category, type Subcategory } from '../../config/categories';
import { formatDay, shiftDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { goToSub } from '../../lib/nav';
import { computeStreak, greeting } from '../../lib/streak';
import { formatMinutes, minutesByDay } from '../../lib/time';

type Editing = { category: Category; sub: Subcategory; entry?: Entry };

export default function HoyScreen() {
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [timing, setTiming] = useState<Category | null>(null);

  const allEntries = useDb((s) => s.entries);
  const allChecks = useDb((s) => s.checks);

  const entries = useMemo(
    () => allEntries.filter((e) => e.date === date && DAILY_CATEGORIES.some((c) => c.id === e.categoryId)).sort((a, b) => a.createdAt - b.createdAt),
    [allEntries, date],
  );
  const checks = useMemo(() => allChecks.filter((c) => c.date === date), [allChecks, date]);
  const done = new Set(checks.map((c) => c.categoryId));
  const doneCount = DAILY_CATEGORIES.filter((c) => done.has(c.id)).length;
  const isToday = date === today();
  const minutes = useMemo(() => minutesByDay(checks, entries).get(date) ?? new Map<string, number>(), [checks, entries, date]);
  const totalMin = [...minutes.values()].reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['bottom']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center justify-between gap-2">
          <Pressable onPress={() => setDate(shiftDay(date, -1))} className="h-11 w-11 items-center justify-center" accessibilityLabel="Día anterior">
            <Text className="text-xl text-ink-300">‹</Text>
          </Pressable>
          <View className="flex-1 items-center">
            {isToday ? (
              <Text className="text-xs text-ink-400">Hoy</Text>
            ) : (
              <Pressable onPress={() => setDate(today())}>
                <Text className="text-xs text-shu-400">Volver a hoy</Text>
              </Pressable>
            )}
            <Text className="text-xl font-bold text-ink-100">{formatDay(date, { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
          </View>
          <Pressable onPress={() => setDate(shiftDay(date, 1))} className="h-11 w-11 items-center justify-center" accessibilityLabel="Día siguiente">
            <Text className="text-xl text-ink-300">›</Text>
          </Pressable>
        </View>

        {isToday && (
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-ink-100">{greeting()} 👋</Text>
            <Text className="text-sm font-medium text-ink-400">
              {doneCount}/{DAILY_CATEGORIES.length} · {Math.round((doneCount / DAILY_CATEGORIES.length) * 100)}%
            </Text>
          </View>
        )}

        <View>
          {!isToday && (
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-ink-400">¿Qué hiciste este día?</Text>
              <Text className="text-sm font-medium text-ink-200">
                {doneCount} / {DAILY_CATEGORIES.length}
              </Text>
            </View>
          )}
          <View className="mb-3 h-2 overflow-hidden rounded-full bg-ink-800">
            <View className="h-full rounded-full bg-shu-500" style={{ width: `${(doneCount / DAILY_CATEGORIES.length) * 100}%` }} />
          </View>

          <View className="flex-row flex-wrap gap-3">
            {DAILY_CATEGORIES.map((cat) => {
              const checked = done.has(cat.id);
              const count = entries.filter((e) => e.categoryId === cat.id).length;
              const streak = computeStreak(allChecks, cat.id);
              return (
                <View
                  key={cat.id}
                  className={`h-28 overflow-hidden rounded-xl border-2 ${checked ? 'border-moss-500 bg-moss-500/20' : 'border-ink-800 bg-ink-900/60'}`}
                  style={{ width: '47%' }}>
                  {streak > 0 && (
                    <View className="absolute right-1.5 top-1.5 z-10 flex-row items-center rounded-full border border-gold-500/50 bg-ink-950/80 px-1.5 py-0.5">
                      <Text className="text-[11px] font-medium text-gold-300">🔥{streak}</Text>
                    </View>
                  )}
                  <Pressable onPress={() => useDb.getState().toggleCheck(date, cat.id)} className="flex-1 items-center justify-center gap-0.5 p-2">
                    <Text className="text-2xl">{cat.icon}</Text>
                    <Text className={`text-sm font-semibold ${checked ? 'text-moss-300' : 'text-ink-200'}`}>{cat.name}</Text>
                  </Pressable>
                  <View className={`flex-row border-t ${checked ? 'border-moss-500/40' : 'border-ink-800/80'}`}>
                    <Pressable onPress={() => setTiming(cat)} className="flex-1 items-center py-1.5">
                      <Text className={`text-xs ${minutes.get(cat.id) ? 'font-medium text-ink-100' : 'text-ink-400'}`}>
                        ⏱ {minutes.get(cat.id) ? formatMinutes(minutes.get(cat.id)!) : 'Tiempo'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => goToSub(cat.id, cat.subcategories[0].id)}
                      className={`flex-1 items-center border-l py-1.5 ${checked ? 'border-moss-500/40' : 'border-ink-800/80'}`}>
                      <Text className="text-xs text-ink-400">
                        {count ? `${count} · ` : ''}Detalle ›
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <Card>
          <View className="mb-3 flex-row items-baseline justify-between">
            <Text className="text-sm text-ink-400">Tiempo dedicado {isToday ? 'hoy' : 'este día'}</Text>
            <Text className="text-2xl font-semibold text-ink-100">{totalMin ? formatMinutes(totalMin) : '—'}</Text>
          </View>
          <DayStack byCat={minutes} />
          {totalMin > 0 ? (
            <View className="mt-3 gap-1.5">
              {DAILY_CATEGORIES.filter((c) => minutes.get(c.id))
                .sort((a, b) => minutes.get(b.id)! - minutes.get(a.id)!)
                .map((c) => (
                  <View key={c.id} className="flex-row items-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.chart }} />
                    <Text className="flex-1 text-sm text-ink-300">{c.name}</Text>
                    <Text className="text-sm text-ink-400">{Math.round((minutes.get(c.id)! / totalMin) * 100)}%</Text>
                    <Text className="w-24 text-right text-sm text-ink-100">{formatMinutes(minutes.get(c.id)!)}</Text>
                  </View>
                ))}
            </View>
          ) : (
            <Text className="mt-3 text-xs text-ink-500">Tocá &quot;⏱ Tiempo&quot; en un cuadrado para cargar los minutos.</Text>
          )}
        </Card>

        {entries.length > 0 ? (
          <View>
            <Text className="mb-2 font-semibold text-ink-100">Lo que registraste ({entries.length})</Text>
            <View className="gap-3">
              {DAILY_CATEGORIES.map((cat) => {
                const list = entries.filter((e) => e.categoryId === cat.id);
                if (!list.length) return null;
                return (
                  <View key={cat.id} className="rounded-xl border border-ink-800 bg-ink-900/60 p-2">
                    <Text className={`px-3 pb-1 pt-1 text-xs font-medium ${COLOR_CLASSES[cat.color].text}`}>
                      {cat.icon} {cat.name}
                    </Text>
                    {list.map((e) => {
                      const found = findSub(e.categoryId, e.subId);
                      if (!found) return null;
                      return <EntryRow key={e.id} sub={found.sub} entry={e} showSub onPress={() => setEditing({ ...found, entry: e })} />;
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Empty>Tocá un cuadrado para marcarlo como hecho. En &quot;Detalle&quot; podés cargar datos.</Empty>
        )}
      </ScrollView>

      {timing && <MinutesSheet category={timing} date={date} current={checks.find((c) => c.categoryId === timing.id)?.minutos} onClose={() => setTiming(null)} />}
      {editing && <EntryForm {...editing} defaultDate={date} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}
