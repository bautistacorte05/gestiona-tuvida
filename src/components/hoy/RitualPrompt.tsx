import { Pressable, Text, View } from 'react-native';

import { RITUAL_MINUTES, RITUAL_PROMPT_UNTIL_HOUR } from '../../config/ritual';
import { today } from '../../lib/dates';
import { useDb } from '../../lib/db';
import { goToSub } from '../../lib/nav';

/**
 * En Hoy (solo el día de hoy): si todavía no hizo el ritual de la mañana, la tarjeta
 * "¿Empezamos el día?" (hasta las 15, para no insistir de noche). Si ya lo hizo y eligió una
 * palabra guía, se la recuerda en una línea. Si no, no muestra nada.
 */
export default function RitualPrompt({ date }: { date: string }) {
  const ritual = useDb((s) => s.rituals.find((r) => r.id === date));
  if (date !== today()) return null;

  if (!ritual?.doneAt) {
    if (new Date().getHours() >= RITUAL_PROMPT_UNTIL_HOUR) return null;
    return (
      <View className="gap-1.5 rounded-2xl bg-shu-500 p-[18px]">
        <Text className="text-[19px] font-bold text-washi">¿Empezamos el día?</Text>
        <Text className="text-sm text-washi opacity-90">Todavía no hiciste tu ritual de la mañana. Son {RITUAL_MINUTES} minutos.</Text>
        <Pressable
          onPress={() => goToSub('ritual', 'manana')}
          accessibilityRole="button"
          className="mt-2 h-11 items-center justify-center self-start rounded-xl bg-washi px-[18px] active:opacity-80">
          <Text className="text-[15px] font-bold text-shu-600">Empezar ritual</Text>
        </Pressable>
      </View>
    );
  }

  const word = ritual.word?.trim();
  if (!word) return null;
  return (
    <View className="flex-row items-center gap-2 rounded-2xl border border-shu-500/40 bg-shu-500/10 px-4 py-3">
      <Text className="text-base">🧭</Text>
      <Text className="shrink text-[15px] text-ink-300">
        Tu palabra de hoy: <Text className="font-bold text-shu-300">{word}</Text>
      </Text>
    </View>
  );
}
