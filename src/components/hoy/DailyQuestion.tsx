import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { today } from '../../lib/dates';
import { useDb } from '../../lib/db';
import { goToSub } from '../../lib/nav';
import { useThemeColors } from '../../lib/theme';
import { questionAnswer, questionFor } from '../../lib/today';

/**
 * Pregunta del día. Hoy: la pregunta, un lugar para responder y "Otra pregunta" para cambiarla.
 * La respuesta se guarda como nota (kind 'pregunta', una por día) y se ve en Anotaciones.
 * Días anteriores: solo si se respondió (se puede editar). Días que no llegaron: nada.
 */
export default function DailyQuestion({ date }: { date: string }) {
  // Con `key` por fecha, al cambiar de día no se arrastra lo que se estaba escribiendo.
  return <QuestionCard key={date} date={date} />;
}

function QuestionCard({ date }: { date: string }) {
  const c = useThemeColors();
  const notes = useDb((s) => s.notes);
  const answer = useMemo(() => questionAnswer(notes, date), [notes, date]);
  const [skip, setSkip] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const now = today();

  if (date > now || (!answer && date < now)) return null;

  const question = answer ? { id: answer.questionId, text: answer.title } : questionFor(date, skip);
  const writing = !answer || editing;
  const canSave = !!draft.trim();

  const save = () => {
    const body = draft.trim();
    if (!body) return;
    useDb.getState().saveNote({ id: answer?.id, kind: 'pregunta', title: question.text, body, date, questionId: question.id });
    setEditing(false);
    setDraft('');
  };

  const startEdit = () => {
    setDraft(answer?.body ?? '');
    setEditing(true);
  };

  return (
    <View className="gap-3 rounded-2xl border border-shu-500/40 bg-shu-500/10 p-4">
      <Text className="text-xs font-bold tracking-wider text-shu-300">PREGUNTA DEL DÍA</Text>
      <Text className="text-[21px] font-bold leading-7 text-ink-100">{question.text}</Text>

      {writing ? (
        <>
          <View className="gap-1.5">
            <Text className="text-[13px] text-ink-300">Tu respuesta (solo la ves vos)</Text>
            <TextInput
              multiline
              textAlignVertical="top"
              className="min-h-[84px] rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-[15px] text-ink-100"
              placeholder="Escribí lo primero que se te venga…"
              placeholderTextColor={c['ink-500']}
              accessibilityLabel="Tu respuesta"
              value={draft}
              onChangeText={setDraft}
            />
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              className={`h-11 flex-1 items-center justify-center rounded-xl bg-shu-500 px-3 ${canSave ? 'active:opacity-80' : 'opacity-40'}`}>
              <Text className="text-[15px] font-bold text-washi">Guardar respuesta</Text>
            </Pressable>
            {answer ? (
              <OutlineButton label="Cancelar" onPress={() => setEditing(false)} />
            ) : (
              <OutlineButton label="Otra pregunta" onPress={() => setSkip((s) => s + 1)} />
            )}
          </View>
        </>
      ) : (
        <>
          <Text className="text-[15px] leading-6 text-ink-200">{answer.body}</Text>
          <View className="flex-row">
            <OutlineButton label="Editar" onPress={startEdit} accessibilityLabel="Editar tu respuesta" />
          </View>
        </>
      )}

      <Pressable onPress={() => goToSub('notas', 'todas')} accessibilityRole="link" className="min-h-11 justify-center self-start">
        <Text className="text-xs text-ink-400">
          Tus respuestas se guardan en <Text className="font-semibold text-shu-400">Anotaciones ›</Text>
        </Text>
      </Pressable>
    </View>
  );
}

function OutlineButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-11 items-center justify-center rounded-xl border border-ink-700 px-3.5 active:opacity-70">
      <Text className="text-sm text-ink-300">{label}</Text>
    </Pressable>
  );
}
