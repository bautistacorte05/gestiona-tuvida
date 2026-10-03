import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDay, today } from '../../lib/dates';
import { isActiveOn, type Habit } from '../../lib/habits';
import { useIsDesktop } from '../../lib/layout';
import { toggleHabit } from '../HabitPanel';

/**
 * "Hábitos de hoy": una tarjeta grande por hábito para tildarlo de un toque. Marca lo mismo que
 * la grilla "Día por día" (mismos tildes, misma función): solo los hábitos que cuentan ese día,
 * y los días que todavía no llegaron no se pueden tildar.
 */

const GAP = 8;
/** Ancho mínimo de una tarjeta en la PC (en el celular van siempre 3 por fila). */
const PC_MIN_TILE = 150;

export default function TodayHabits({ habits, done, date }: { habits: Habit[]; done: Map<string, Set<string>>; date: string }) {
  const isDesktop = useIsDesktop();
  const [width, setWidth] = useState(0);
  const now = today();

  const shown = habits.filter((h) => isActiveOn(h, date));
  if (!shown.length) return null;

  const isFuture = date > now;
  const doneCount = shown.filter((h) => done.get(h.key)?.has(date)).length;
  const pct = Math.round((doneCount / shown.length) * 100);
  const title = date === now ? 'Hábitos de hoy' : `Hábitos del ${formatDay(date, { weekday: 'long', day: 'numeric' }).toLowerCase()}`;

  const cols = isDesktop && width ? Math.min(8, Math.max(3, Math.floor((width + GAP) / (PC_MIN_TILE + GAP)))) : 3;
  const rows: Habit[][] = [];
  for (let i = 0; i < shown.length; i += cols) rows.push(shown.slice(i, i + cols));

  return (
    <View className="gap-2.5">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-2">
        <Text className="text-[17px] font-bold text-ink-100">{title}</Text>
        <Text className="text-[13px] text-ink-400">
          {doneCount} de {shown.length} · <Text className="font-bold text-shu-400">{pct}%</Text>
        </Text>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ gap: GAP }}>
        {rows.map((row, r) => (
          <View key={r} className="flex-row" style={{ gap: GAP }}>
            {row.map((h) => (
              <Tile key={h.key} h={h} isDone={!!done.get(h.key)?.has(date)} disabled={isFuture} big={isDesktop} onPress={() => void toggleHabit(h, date)} />
            ))}
            {/* La última fila se completa con huecos para que las tarjetas tengan todas el mismo ancho. */}
            {Array.from({ length: cols - row.length }, (_, i) => (
              <View key={`empty-${i}`} className="flex-1" />
            ))}
          </View>
        ))}
      </View>

      <Text className="text-xs text-ink-500">
        {isFuture ? 'Este día todavía no llegó: vas a poder tildarlos cuando llegue.' : 'Un toque y queda tildado en la grilla del mes.'}
      </Text>
    </View>
  );
}

function Tile({ h, isDone, disabled, big, onPress }: { h: Habit; isDone: boolean; disabled: boolean; big: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isDone, disabled }}
      accessibilityLabel={h.title}
      className={`h-[108px] min-w-0 flex-1 justify-between rounded-2xl p-2.5 ${isDone ? 'bg-shu-500' : 'border border-ink-700 bg-ink-800'} ${
        disabled ? 'opacity-50' : 'active:opacity-80'
      }`}>
      {/* El círculo va arriba, al lado del emoji: así el nombre usa todo el ancho (ej. "Entrenamiento" en 3 columnas). */}
      <View className="flex-row items-start justify-between">
        <Text style={{ fontSize: 24, lineHeight: 30 }}>{h.icon}</Text>
        <View className={`h-7 w-7 items-center justify-center rounded-full ${isDone ? 'bg-washi' : 'border-[6px] border-ink-700 bg-ink-900'}`}>
          {isDone && <Text className="text-sm font-bold text-shu-600">✓</Text>}
        </View>
      </View>
      <Text numberOfLines={2} className={`${big ? 'text-[13px]' : 'text-xs'} font-semibold leading-4 ${isDone ? 'text-washi' : 'text-ink-100'}`}>
        {h.title}
      </Text>
    </Pressable>
  );
}
