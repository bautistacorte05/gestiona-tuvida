import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Empty, EntryRow } from '../../components/common';
import DayPlan from '../../components/DayPlan';
import EntryForm from '../../components/EntryForm';
import { DayChart, GoalsHint, HabitGrid, HabitProgressList, MonthProgress } from '../../components/HabitPanel';
import { DayStack } from '../../components/TimeCharts';
import { COLOR_CLASSES, DAILY_CATEGORIES, findSub, type Category, type Subcategory } from '../../config/categories';
import { formatDay, monthKey, shiftDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { buildHabits, dayProgress, doneDatesByKey, habitRows, isActiveInMonth, monthSummary } from '../../lib/habits';
import { useCategoryName } from '../../lib/names';
import { greeting } from '../../lib/streak';
import { formatMinutes, minutesByDay } from '../../lib/time';

type Editing = { category: Category; sub: Subcategory; entry?: Entry };

/**
 * Hoy: la grilla de hábitos (actividades + metas diarias), el Plan del día del día elegido,
 * el progreso del mes, el tiempo dedicado y lo registrado. El día elegido se cambia con
 * ‹ › arriba, con ‹ › de la grilla o tocando un día de la grilla.
 */
export default function HoyScreen() {
  const nameOf = useCategoryName();
  const t = today();
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<Editing | null>(null);

  const allEntries = useDb((s) => s.entries);
  const allChecks = useDb((s) => s.checks);
  const goals = useDb((s) => s.dailyGoals);
  const nombre = useDb((s) => s.userProfile[0]?.nombre);

  const habits = useMemo(
    () => buildHabits(goals, DAILY_CATEGORIES.map((c) => ({ id: c.id, name: nameOf(c.id, c.name), icon: c.icon }))),
    [goals, nameOf],
  );
  const done = useMemo(() => doneDatesByKey(allChecks, habits.map((h) => h.key)), [allChecks, habits]);
  const month = monthKey(date);
  const monthHabits = useMemo(() => habits.filter((h) => isActiveInMonth(h, month)), [habits, month]);
  const summary = useMemo(() => monthSummary(monthHabits, done, month, t), [monthHabits, done, month, t]);
  const rows = useMemo(() => habitRows(monthHabits, done, month, t), [monthHabits, done, month, t]);
  const progress = dayProgress(habits, done, date);
  const hasGoals = goals.some((g) => !g.archived);

  const entries = useMemo(
    () => allEntries.filter((e) => e.date === date && DAILY_CATEGORIES.some((c) => c.id === e.categoryId)).sort((a, b) => a.createdAt - b.createdAt),
    [allEntries, date],
  );
  const checks = useMemo(() => allChecks.filter((c) => c.date === date), [allChecks, date]);
  const isToday = date === t;
  // Minutos de los registros de cada actividad (más los cargados a mano antes, que siguen contando).
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
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink text-2xl font-bold text-ink-100">{greeting()}{nombre ? `, ${nombre}` : ''} 👋</Text>
            {progress.active > 0 && (
              <Text className="text-sm font-medium text-ink-400">
                {progress.done}/{progress.active} · {Math.round((progress.done / progress.active) * 100)}%
              </Text>
            )}
          </View>
        )}

        <HabitGrid habits={habits} done={done} date={date} onSelectDate={setDate} />

        <DayPlan date={date} />

        <MonthProgress month={month} summary={summary} />
        <DayChart byDay={summary.byDay} selected={date} />
        <HabitProgressList rows={rows} />

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
                    <Text className="flex-1 text-sm text-ink-300">{nameOf(c.id, c.name)}</Text>
                    <Text className="text-sm text-ink-400">{Math.round((minutes.get(c.id)! / totalMin) * 100)}%</Text>
                    <Text className="w-24 text-right text-sm text-ink-100">{formatMinutes(minutes.get(c.id)!)}</Text>
                  </View>
                ))}
            </View>
          ) : (
            <Text className="mt-3 text-xs text-ink-500">El tiempo sale de la duración que cargás adentro de cada actividad (Gimnasio, Jornada, Sesiones de lectura, Paseos).</Text>
          )}
        </Card>

        {entries.length > 0 ? (
          <View>
            <Text className="mb-2 font-bold text-ink-100">Lo que registraste ({entries.length})</Text>
            <View className="gap-3">
              {DAILY_CATEGORIES.map((cat) => {
                const list = entries.filter((e) => e.categoryId === cat.id);
                if (!list.length) return null;
                return (
                  <View key={cat.id} className="rounded-2xl border border-ink-800 bg-ink-900 p-2">
                    <Text className={`px-3 pb-1 pt-1 text-xs font-medium ${COLOR_CLASSES[cat.color].text}`}>
                      {cat.icon} {nameOf(cat.id, cat.name)}
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
          <Empty>Todavía no registraste nada este día. Para cargar datos (duración, páginas, kilómetros…), entrá a cada actividad desde el menú.</Empty>
        )}

        {!hasGoals && <GoalsHint />}
      </ScrollView>

      {editing && <EntryForm {...editing} defaultDate={date} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}
