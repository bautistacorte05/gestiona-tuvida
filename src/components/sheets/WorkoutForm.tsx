import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { confirm } from '../../lib/confirm';
import { today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import { DEFAULT_EXERCISES, exercisesByGroup, GROUP_EMOJI, searchExercises, type Exercise } from '../../lib/exercises';
import { markDone } from '../../lib/sheets';
import { useThemeColors } from '../../lib/theme';
import { isExerciseEntry, newestFirst } from '../../lib/training';
import { parseNum } from '../ItemsEditor';
import DateField from '../DateField';

interface SetDraft {
  weight: string;
  reps: string;
}

interface ExerciseDraft {
  name: string;
  groups: string[];
  equipment: string;
  sets: SetDraft[];
}

function parseWeight(s: string): number {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

interface Props {
  entry?: Entry;
  defaultDate?: string;
  onClose: () => void;
}

export default function WorkoutForm({ entry, defaultDate, onClose }: Props) {
  const c = useThemeColors();
  const deleteEntry = useDb((s) => s.deleteEntry);
  const allEntries = useDb((s) => s.entries);
  const saved = useRef(false);

  const recentExercises = useMemo(() => allEntries.filter(isExerciseEntry).sort(newestFirst), [allEntries]);

  const lastWeightFor = (name: string): number | undefined => {
    for (const e of recentExercises) {
      if (String(e.values.ejercicio) !== name || !e.items?.length) continue;
      return Math.max(...e.items.map((i) => i.precio));
    }
    return undefined;
  };

  const initialExercises: ExerciseDraft[] = entry?.values.ejercicio
    ? [
        {
          name: String(entry.values.ejercicio),
          groups: Array.isArray(entry.values.grupo) ? entry.values.grupo.map(String) : [],
          equipment: '',
          sets: entry.items?.length
            ? entry.items.map((i) => ({ weight: String(i.precio || ''), reps: String(i.cantidad || '') }))
            : [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }],
        },
      ]
    : [];

  const [date, setDate] = useState(entry?.date ?? defaultDate ?? today());
  const [exercises, setExercises] = useState<ExerciseDraft[]>(initialExercises);
  const [picking, setPicking] = useState(!entry && initialExercises.length === 0);
  const [query, setQuery] = useState('');

  const addExercise = (ex: Exercise) => {
    const lastW = lastWeightFor(ex.name);
    const w = lastW ? String(lastW) : '';
    setExercises((prev) => [
      ...prev,
      { name: ex.name, groups: ex.groups, equipment: ex.equipment, sets: [{ weight: w, reps: '' }, { weight: w, reps: '' }, { weight: w, reps: '' }] },
    ]);
    setPicking(false);
    setQuery('');
  };

  const removeExercise = (idx: number) => setExercises((prev) => prev.filter((_, i) => i !== idx));

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { weight: last?.weight ?? '', reps: '' }] };
      }),
    );
  };

  const updateSet = (exIdx: number, setIdx: number, field: 'weight' | 'reps', value: string) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)) };
      }),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      }),
    );
  };

  const hasValidExercise = exercises.some((ex) => ex.sets.some((s) => (parseNum(s.reps) ?? 0) > 0));

  const save = () => {
    if (saved.current) return;
    if (!hasValidExercise) return;
    saved.current = true;
    const db = useDb.getState();

    if (entry) {
      const ex = exercises[0];
      const validSets = ex.sets.filter((s) => (parseNum(s.reps) ?? 0) > 0);
      db.saveEntry({
        id: entry.id,
        categoryId: 'entrenamiento',
        subId: 'gimnasio',
        date,
        values: { ejercicio: ex.name, grupo: ex.groups },
        items: validSets.map((s, i) => ({ producto: `Serie ${i + 1}`, cantidad: parseNum(s.reps) ?? 0, precio: parseWeight(s.weight) })),
      });
    } else {
      for (const ex of exercises) {
        const validSets = ex.sets.filter((s) => (parseNum(s.reps) ?? 0) > 0);
        if (validSets.length === 0) continue;
        db.saveEntry({
          categoryId: 'entrenamiento',
          subId: 'gimnasio',
          date,
          values: { ejercicio: ex.name, grupo: ex.groups },
          items: validSets.map((s, i) => ({ producto: `Serie ${i + 1}`, cantidad: parseNum(s.reps) ?? 0, precio: parseWeight(s.weight) })),
        });
      }
      markDone(date, 'entrenamiento');
    }
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm('¿Borrar este ejercicio?', 'No se puede deshacer.', 'Borrar'))) return;
    deleteEntry(entry.id);
    onClose();
  };

  const closePicker = () => {
    if (exercises.length > 0) setPicking(false);
    else onClose();
  };

  // ——— Exercise picker ———
  if (picking) {
    const filtered = searchExercises(DEFAULT_EXERCISES, query);
    const grouped = exercisesByGroup(filtered);

    return (
      <Modal transparent animationType="slide" onRequestClose={closePicker}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable className="flex-1 justify-end bg-black/60" onPress={closePicker}>
            <Pressable className="max-h-[88%] rounded-t-3xl border border-ink-800 bg-ink-900" onPress={(e) => e.stopPropagation()}>
              <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-3">
                {exercises.length > 0 ? (
                  <Pressable onPress={() => setPicking(false)} className="pr-3 py-1">
                    <Text className="text-sm font-semibold text-shu-400">← Volver</Text>
                  </Pressable>
                ) : (
                  <Text className="text-lg font-bold text-ink-100">Elegir ejercicio</Text>
                )}
                <Pressable onPress={closePicker} className="px-2 py-1" accessibilityLabel="Cerrar">
                  <Text className="text-ink-300">✕</Text>
                </Pressable>
              </View>

              <ScrollView className="px-4 py-3" contentContainerClassName="gap-3 pb-8" keyboardShouldPersistTaps="handled">
                <TextInput
                  className="rounded-xl border border-ink-700 bg-ink-950 px-4 py-2.5 text-[15px] text-ink-100"
                  placeholder="Buscar ejercicio..."
                  placeholderTextColor={c['ink-500']}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />

                {grouped.map(([group, exs]) => {
                  if (exs.length === 0) return null;
                  return (
                    <View key={group}>
                      <Text className="mb-1.5 mt-1 text-xs font-bold uppercase tracking-wider text-shu-300">
                        {GROUP_EMOJI[group] ?? '💪'} {group}
                      </Text>
                      <View className="overflow-hidden rounded-xl border border-ink-800 bg-ink-950">
                        {exs.map((ex, i) => {
                          const lastW = lastWeightFor(ex.name);
                          return (
                            <Pressable
                              key={ex.name}
                              onPress={() => addExercise(ex)}
                              className={`flex-row items-center justify-between px-4 py-3 active:bg-ink-800/60 ${i < exs.length - 1 ? 'border-b border-ink-800' : ''}`}>
                              <View className="min-w-0 flex-1">
                                <Text className="text-[15px] font-semibold text-ink-100">{ex.name}</Text>
                                <Text className="mt-0.5 text-xs text-ink-500">
                                  {ex.equipment} · {ex.groups.join(', ')}
                                </Text>
                              </View>
                              {lastW !== undefined && <Text className="shrink-0 text-xs text-ink-400">última: {lastW} kg</Text>}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // ——— Workout form ———
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="max-h-[88%] rounded-t-3xl border border-ink-800 bg-ink-900" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-3">
              <Text className="text-lg font-bold text-ink-100">{entry ? '✏️ Editar ejercicio' : '🏋️ Entrenamiento'}</Text>
              <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              {/* Fecha */}
              <View>
                <Text className="mb-1 text-xs text-ink-500">Fecha</Text>
                <DateField value={date} onChange={setDate} />
              </View>

              {/* Exercise cards */}
              {exercises.map((ex, exIdx) => (
                <View key={`${ex.name}-${exIdx}`} className="rounded-xl border border-ink-800 bg-ink-950 p-3.5">
                  <View className="flex-row items-start justify-between">
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-bold text-ink-100">{ex.name}</Text>
                      <Text className="mt-0.5 text-xs text-ink-500">
                        {ex.groups.join(' · ')}
                        {!!ex.equipment && ` · ${ex.equipment}`}
                      </Text>
                    </View>
                    {!entry && exercises.length > 1 && (
                      <Pressable onPress={() => removeExercise(exIdx)} className="px-1 py-0.5" accessibilityLabel="Quitar ejercicio">
                        <Text className="text-xs text-ink-500">✕</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Sets table */}
                  <View className="mt-3 gap-1.5">
                    <View className="flex-row items-center gap-2 px-1">
                      <Text className="w-8 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-500">Serie</Text>
                      <Text className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-500">Peso (kg)</Text>
                      <Text className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-500">Reps</Text>
                      <View className="w-6" />
                    </View>
                    {ex.sets.map((set, setIdx) => (
                      <View key={setIdx} className="flex-row items-center gap-2">
                        <Text className="w-8 text-center text-sm font-semibold text-ink-400" style={{ fontVariant: ['tabular-nums'] }}>
                          {setIdx + 1}
                        </Text>
                        <TextInput
                          className="h-10 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 text-center text-[15px] text-ink-100"
                          keyboardType="decimal-pad"
                          value={set.weight}
                          onChangeText={(v) => updateSet(exIdx, setIdx, 'weight', v)}
                          placeholder="0"
                          placeholderTextColor={c['ink-600']}
                          style={{ fontVariant: ['tabular-nums'] }}
                        />
                        <TextInput
                          className="h-10 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 text-center text-[15px] text-ink-100"
                          keyboardType="number-pad"
                          value={set.reps}
                          onChangeText={(v) => updateSet(exIdx, setIdx, 'reps', v)}
                          placeholder="0"
                          placeholderTextColor={c['ink-600']}
                          style={{ fontVariant: ['tabular-nums'] }}
                        />
                        <Pressable
                          onPress={() => removeSet(exIdx, setIdx)}
                          disabled={ex.sets.length <= 1}
                          className="w-6 items-center"
                          accessibilityLabel="Quitar serie">
                          <Text className={`text-xs ${ex.sets.length <= 1 ? 'text-ink-800' : 'text-ink-500'}`}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                    <Pressable onPress={() => addSet(exIdx)} className="mt-1 flex-row items-center justify-center rounded-lg border border-dashed border-ink-700 py-2">
                      <Text className="text-xs text-shu-400">+ Serie</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              {/* Add exercise */}
              {!entry && (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setPicking(true);
                  }}
                  className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-shu-500/40 bg-shu-500/10 py-3">
                  <Text className="text-sm font-semibold text-shu-400">+ Agregar ejercicio</Text>
                </Pressable>
              )}

              {exercises.length === 0 && (
                <View className="rounded-xl border border-dashed border-ink-800 p-6">
                  <Text className="text-center text-sm text-ink-500">Elegí tu primer ejercicio para empezar.</Text>
                </View>
              )}
            </ScrollView>

            <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
              {!!entry && (
                <Pressable onPress={remove} className="items-center justify-center rounded-lg px-4 py-2.5">
                  <Text className="font-medium text-kurenai-400">Borrar</Text>
                </Pressable>
              )}
              <Pressable
                onPress={save}
                disabled={!hasValidExercise}
                className={`flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5 ${!hasValidExercise ? 'opacity-40' : ''}`}>
                <Text className="font-medium text-washi">Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
