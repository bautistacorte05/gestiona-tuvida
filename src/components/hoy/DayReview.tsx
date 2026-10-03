import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { useIsDesktop } from '../../lib/layout';
import { useThemeColors } from '../../lib/theme';
import { moodEntryOf } from '../../lib/today';
import { moodLevel, MOODS } from '../../lib/wellbeing';

/**
 * "¿Cómo estuvo tu día?": el ánimo del día (1 a 5) y lo mejor del día. Se guarda en el mismo
 * registro que el ánimo de la hoja de Bienestar (bienestar/animo, nivel + nota): si ese día ya
 * tenía uno, se actualiza (no se crea otro). Días que no llegaron: nada.
 */
export default function DayReview({ date }: { date: string }) {
  // Con `key` por fecha, al cambiar de día no se arrastra lo que se estaba eligiendo.
  return <ReviewCard key={date} date={date} />;
}

function ReviewCard({ date }: { date: string }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const entries = useDb((s) => s.entries);
  const entry = useMemo(() => moodEntryOf(entries, date), [entries, date]);
  const [editing, setEditing] = useState(false);
  // null = sin tocar: se muestra lo guardado.
  const [draftLevel, setDraftLevel] = useState<number | null>(null);
  const [draftNote, setDraftNote] = useState<string | null>(null);

  if (date > today()) return null;

  const savedLevel = moodLevel(entry?.values.nivel);
  const savedNote = String(entry?.values.nota ?? '').trim();
  const level = draftLevel ?? savedLevel;
  const note = draftNote ?? savedNote;
  const saved = savedLevel ? MOODS[savedLevel - 1] : undefined;
  const dateLabel = formatDay(date, { weekday: 'long', day: 'numeric', month: 'short' });

  const reset = () => {
    setEditing(false);
    setDraftLevel(null);
    setDraftNote(null);
  };

  const save = () => {
    if (!level) return;
    const values: Entry['values'] = { ...(entry?.values ?? {}), nivel: level };
    const clean = note.trim();
    if (clean) values.nota = clean;
    else delete values.nota;
    useDb.getState().saveEntry({ id: entry?.id, categoryId: 'bienestar', subId: 'animo', date, values });
    reset();
  };

  const header = (
    <View className="flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-[17px] font-bold text-ink-100">¿Cómo estuvo tu día?</Text>
        <Text className="mt-0.5 text-[13px] text-ink-400">{dateLabel}</Text>
      </View>
      {!!saved && !editing && (
        <Pressable
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel="Editar cómo estuvo tu día"
          className="h-11 items-center justify-center rounded-xl border border-ink-700 px-3.5 active:opacity-70">
          <Text className="text-sm text-ink-300">Editar</Text>
        </Pressable>
      )}
    </View>
  );

  const footer = <Text className="text-xs text-ink-500">Queda en Bienestar, junto con tu sueño.</Text>;

  // Ya anotado: resumen corto.
  if (saved && !editing) {
    return (
      <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
        {header}
        <View className="flex-row items-center gap-3">
          <Text style={{ fontSize: 34, lineHeight: 42 }}>{saved.emoji}</Text>
          <View className="min-w-0 flex-1">
            <Text className="text-base font-bold text-shu-300">{saved.label}</Text>
            {!!savedNote && <Text className="mt-0.5 text-sm leading-5 text-ink-300">{savedNote}</Text>}
          </View>
        </View>
        {footer}
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      {header}

      <View className="flex-row gap-2">
        {MOODS.map((m) => {
          const on = level === m.level;
          return (
            <Pressable
              key={m.level}
              onPress={() => setDraftLevel(m.level)}
              accessibilityRole="radio"
              accessibilityLabel={m.label}
              accessibilityState={{ selected: on }}
              className={`h-16 items-center justify-center rounded-[14px] ${isDesktop ? 'w-[76px]' : 'min-w-0 flex-1'} ${
                on ? 'border-2 border-shu-500 bg-shu-500/15' : 'border border-ink-700 bg-ink-800'
              } active:opacity-80`}>
              <Text style={{ fontSize: 26, lineHeight: 32 }}>{m.emoji}</Text>
              <Text className="text-[11px] text-ink-400">{m.level}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="min-h-[18px] text-sm font-semibold text-shu-300" accessibilityLiveRegion="polite">
        {level ? MOODS[level - 1].label : ''}
      </Text>

      <View className="gap-1.5">
        <Text className="text-[13px] text-ink-300">¿Qué fue lo mejor del día? (opcional)</Text>
        <TextInput
          multiline
          textAlignVertical="top"
          className="min-h-[64px] rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-[15px] text-ink-100"
          placeholder="Una línea alcanza"
          placeholderTextColor={c['ink-500']}
          accessibilityLabel="Lo mejor del día"
          value={note}
          onChangeText={setDraftNote}
        />
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={save}
          disabled={!level}
          accessibilityRole="button"
          className={`h-11 flex-1 items-center justify-center rounded-xl bg-shu-500 ${level ? 'active:opacity-80' : 'opacity-40'}`}>
          <Text className="text-[15px] font-bold text-washi">Guardar</Text>
        </Pressable>
        {editing && (
          <Pressable
            onPress={reset}
            accessibilityRole="button"
            className="h-11 items-center justify-center rounded-xl border border-ink-700 px-3.5 active:opacity-70">
            <Text className="text-sm text-ink-300">Cancelar</Text>
          </Pressable>
        )}
      </View>

      {footer}
    </View>
  );
}
