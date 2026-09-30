import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDb, type LongGoal } from '../lib/db';
import { today } from '../lib/dates';
import { Empty } from './common';
import LongGoalForm from './LongGoalForm';
import BackButton from './BackButton';

const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const fmt = (n: number, unit: string) => (unit === '$' ? `$${num.format(n)}` : unit === 'USD' ? `US$${num.format(n)}` : `${num.format(n)} ${unit}`.trim());

function daysLeft(deadline?: string) {
  if (!deadline) return undefined;
  const d = new Date(deadline + 'T00:00:00');
  const t = new Date(today() + 'T00:00:00');
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export default function LongGoalsView() {
  const [editing, setEditing] = useState<LongGoal | 'new' | null>(null);
  const goals = useDb((s) => s.longGoals);
  const active = goals.filter((g) => !g.archived).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <BackButton />
            <View>
              <Text className="text-sm text-violet-400">🎯 Metas</Text>
              <Text className="text-2xl font-bold text-ink-100">Largo plazo</Text>
            </View>
          </View>
          <Pressable onPress={() => setEditing('new')} className="rounded-lg bg-shu-500 px-4 py-2.5">
            <Text className="font-medium text-washi">+ Nueva meta</Text>
          </Pressable>
        </View>

        {active.length === 0 ? (
          <Empty>Todavía no creaste ninguna meta a largo plazo. Agregá la primera con &quot;+ Nueva meta&quot;.</Empty>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {active.map((g) => {
              const pct = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
              const done = g.current >= g.target && g.target > 0;
              const left = daysLeft(g.deadline);
              return (
                <Pressable key={g.id} onPress={() => setEditing(g)} className="gap-2 rounded-xl border border-ink-800 bg-ink-900/60 p-4" style={{ width: '100%' }}>
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 font-medium text-ink-100">{g.title}</Text>
                    {done && (
                      <View className="rounded-full bg-moss-500/20 px-2 py-0.5">
                        <Text className="text-xs font-medium text-moss-300">Cumplida</Text>
                      </View>
                    )}
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-ink-800">
                    <View className={`h-full rounded-full ${done ? 'bg-moss-500' : 'bg-gold-500'}`} style={{ width: `${pct}%` }} />
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-ink-400">
                      {fmt(g.current, g.unit)} de {fmt(g.target, g.unit)} · {Math.round(pct)}%
                    </Text>
                    {left !== undefined && (
                      <Text className={`text-xs ${left < 0 ? 'text-kurenai-400' : left <= 7 ? 'text-gold-400' : 'text-ink-400'}`}>
                        {left < 0 ? `${-left}d atrasada` : left === 0 ? 'hoy' : `${left}d`}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {editing && <LongGoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </SafeAreaView>
  );
}
