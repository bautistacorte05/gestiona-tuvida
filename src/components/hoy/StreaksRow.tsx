import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { today } from '../../lib/dates';
import { useDb } from '../../lib/db';
import type { Habit } from '../../lib/habits';
import { computeStreak } from '../../lib/streak';
import { habitDaysStreak, ritualStreak } from '../../lib/today';

/**
 * Rachas arriba de Hoy (solo se muestran en el día de hoy): días seguidos con algún hábito
 * tildado, entrenando (el mismo tilde que deja la hoja de Entrenamiento) y con el ritual de la
 * mañana terminado. Si hoy todavía no está, se cuenta desde ayer.
 */
export default function StreaksRow({ habits, done }: { habits: Habit[]; done: Map<string, Set<string>> }) {
  const checks = useDb((s) => s.checks);
  const rituals = useDb((s) => s.rituals);
  const now = today();

  const habitDays = useMemo(() => habitDaysStreak(habits, done, now), [habits, done, now]);
  const training = useMemo(() => computeStreak(checks, 'entrenamiento'), [checks]);
  const ritual = useMemo(() => ritualStreak(rituals, now), [rituals, now]);

  return (
    <View className="flex-row gap-2.5">
      <StreakCard icon="🔥" n={habitDays} one="día con hábitos" many="días con hábitos" />
      <StreakCard icon="🏋️" n={training} one="día entrenando" many="días entrenando" />
      <StreakCard icon="🌅" n={ritual} one="día de ritual" many="días de ritual" />
    </View>
  );
}

function StreakCard({ icon, n, one, many }: { icon: string; n: number; one: string; many: string }) {
  const label = n === 1 ? one : many;
  return (
    <View
      accessible
      accessibilityLabel={`Racha de ${n} ${label}`}
      className="min-w-0 flex-1 gap-2 rounded-2xl border border-ink-800 bg-ink-900 p-3">
      <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-shu-500/15">
        <Text style={{ fontSize: 18, lineHeight: 22 }}>{icon}</Text>
      </View>
      <View>
        <Text className="text-2xl font-extrabold text-ink-100">{n}</Text>
        <Text className="text-xs leading-4 text-ink-400">{label}</Text>
      </View>
    </View>
  );
}
