import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDb } from '../lib/db';
import { formatDay, shiftDay, today } from '../lib/dates';
import { computeStreak } from '../lib/streak';
import { useThemeColors } from '../lib/theme';
import { Empty, Stepper } from './common';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

const goalCatId = (id: string) => `goal:${id}`;

export default function DailyGoalsView() {
  const c = useThemeColors();
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState('');
  const addDailyGoal = useDb((s) => s.addDailyGoal);
  const archiveDailyGoal = useDb((s) => s.archiveDailyGoal);
  const toggleCheck = useDb((s) => s.toggleCheck);
  const goals = useDb((s) => s.dailyGoals);
  const allChecks = useDb((s) => s.checks);
  const active = goals.filter((g) => !g.archived).sort((a, b) => a.createdAt - b.createdAt);
  const checks = allChecks.filter((c) => c.date === date);
  const done = new Set(checks.map((c) => c.categoryId));
  const isToday = date === today();

  const add = () => {
    if (!title.trim()) return;
    addDailyGoal(title);
    setTitle('');
  };

  const remove = (id: string, name: string) => {
    Alert.alert(`¿Borrar la meta "${name}"?`, 'Se pierde su historial de rachas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => archiveDailyGoal(id) },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <BackButton />
            <ScreenTitle categoryId="metas" subId="diarias" />
          </View>
          <Stepper label={isToday ? 'Hoy' : formatDay(date, { day: 'numeric', month: 'short' })} onPrev={() => setDate(shiftDay(date, -1))} onNext={() => setDate(shiftDay(date, 1))} />
        </View>

        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
            placeholder="Nueva meta diaria, ej: Meditar 10 min"
            placeholderTextColor={c['ink-500']}
            value={title}
            onChangeText={setTitle}
          />
          <Pressable onPress={add} disabled={!title.trim()} className={`shrink-0 items-center justify-center rounded-lg bg-shu-500 px-4 py-2.5 ${!title.trim() ? 'opacity-50' : ''}`}>
            <Text className="font-medium text-washi">+ Agregar</Text>
          </Pressable>
        </View>

        {active.length === 0 ? (
          <Empty>Todavía no creaste ninguna meta diaria. Agregá la primera arriba.</Empty>
        ) : (
          <View className="gap-2">
            {active.map((g) => {
              const checked = done.has(goalCatId(g.id));
              const streak = computeStreak(allChecks, goalCatId(g.id));
              return (
                <View key={g.id} className={`flex-row items-center gap-3 rounded-2xl border-2 p-3 ${checked ? 'border-moss-500 bg-moss-500/15' : 'border-ink-800 bg-ink-900'}`}>
                  <Pressable
                    onPress={() => toggleCheck(date, goalCatId(g.id))}
                    accessibilityLabel={`${g.title}: ${checked ? 'hecho' : 'sin hacer'}`}
                    className={`h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-moss-500 bg-moss-500' : 'border-ink-600'}`}>
                    <Text className={`text-lg font-bold ${checked ? 'text-ink-950' : 'text-transparent'}`}>✓</Text>
                  </Pressable>
                  <Text className={`flex-1 text-sm font-medium ${checked ? 'text-moss-300' : 'text-ink-100'}`}>{g.title}</Text>
                  {streak > 0 && (
                    <View className="rounded-full border border-gold-500/50 bg-ink-950/80 px-1.5 py-0.5">
                      <Text className="text-[11px] font-medium text-gold-300">🔥{streak}</Text>
                    </View>
                  )}
                  <Pressable onPress={() => remove(g.id, g.title)} className="px-2 py-1" accessibilityLabel="Borrar meta">
                    <Text className="text-ink-500">✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
