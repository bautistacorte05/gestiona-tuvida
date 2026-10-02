import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useDb, type LongGoal } from '../lib/db';
import { useThemeColors } from '../lib/theme';
import { parseNum } from './ItemsEditor';
import DateField from './DateField';

export default function LongGoalForm({ goal, onClose }: { goal?: LongGoal; onClose: () => void }) {
  const c = useThemeColors();
  const addLongGoal = useDb((s) => s.addLongGoal);
  const updateLongGoal = useDb((s) => s.updateLongGoal);
  const archiveLongGoal = useDb((s) => s.archiveLongGoal);
  const [title, setTitle] = useState(goal?.title ?? '');
  const [unit, setUnit] = useState(goal?.unit ?? '$');
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [current, setCurrent] = useState(goal ? String(goal.current) : '0');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');

  const submit = () => {
    if (!title.trim() || !target.trim()) {
      Alert.alert('Falta un dato', 'Completá el nombre de la meta y el objetivo.');
      return;
    }
    const data = { title: title.trim(), unit: unit.trim() || '', target: parseNum(target) || 0, current: parseNum(current) || 0, deadline: deadline || undefined };
    if (goal) updateLongGoal(goal.id, data);
    else addLongGoal(data);
    onClose();
  };

  const remove = () => {
    if (!goal) return;
    Alert.alert(`¿Borrar la meta "${goal.title}"?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          archiveLongGoal(goal.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable className="max-h-[88%] rounded-t-3xl border border-ink-800 bg-ink-900" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-3">
            <Text className="text-lg font-bold text-ink-100">🏁 {goal ? 'Editar' : 'Nueva'} meta</Text>
            <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
              <Text className="text-ink-300">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="px-5 py-4" contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <View>
              <Text className="mb-1 text-sm text-ink-400">Meta</Text>
              <TextInput
                className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
                placeholder="Ej: Ahorrar para el viaje"
                placeholderTextColor={c['ink-500']}
                value={title}
                onChangeText={setTitle}
              />
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="mb-1 text-sm text-ink-400">Objetivo</Text>
                <TextInput
                  className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
                  keyboardType="decimal-pad"
                  placeholder="1000"
                  placeholderTextColor={c['ink-500']}
                  value={target}
                  onChangeText={setTarget}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-sm text-ink-400">Llevás</Text>
                <TextInput
                  className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={c['ink-500']}
                  value={current}
                  onChangeText={setCurrent}
                />
              </View>
              <View style={{ width: 90 }}>
                <Text className="mb-1 text-sm text-ink-400">Unidad</Text>
                <TextInput
                  className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
                  placeholder="$"
                  placeholderTextColor={c['ink-500']}
                  value={unit}
                  onChangeText={setUnit}
                />
              </View>
            </View>
            <View>
              <Text className="mb-1 text-sm text-ink-400">Fecha límite (opcional)</Text>
              <DateField value={deadline} onChange={setDeadline} />
            </View>
          </ScrollView>

          <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
            {goal && (
              <Pressable onPress={remove} className="items-center justify-center rounded-lg px-4 py-2.5">
                <Text className="font-medium text-kurenai-400">Borrar</Text>
              </Pressable>
            )}
            <Pressable onPress={submit} className="flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5">
              <Text className="font-medium text-washi">Guardar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
