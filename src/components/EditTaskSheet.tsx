import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import type { PlanTask } from '../lib/dayTasks';
import { useDb } from '../lib/db';
import { useThemeColors } from '../lib/theme';
import TimeField from './TimeField';

const INPUT = 'rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100';

/** Hoja para corregir el texto o la hora de una tarea ya cargada, sin borrarla y escribirla de nuevo (Hoy y Mi semana). */
export default function EditTaskSheet({ task, onClose }: { task: PlanTask; onClose: () => void }) {
  const c = useThemeColors();
  const [title, setTitle] = useState(task.title);
  const [time, setTime] = useState(task.time ?? '');

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const patch = { title: t, time: time || undefined };
    if (task.kind === 'day') useDb.getState().updateDayTask(task.id, patch);
    else useDb.getState().updateFixedTask(task.id, patch);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="gap-3 rounded-t-3xl border border-ink-800 bg-ink-900 px-5 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-ink-100">Editar tarea</Text>
              <Pressable onPress={onClose} className="h-11 w-11 items-center justify-center" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <TextInput
              className={INPUT}
              value={title}
              onChangeText={setTitle}
              placeholder="Nombre de la tarea"
              placeholderTextColor={c['ink-500']}
              onSubmitEditing={save}
              returnKeyType="done"
              autoFocus
              accessibilityLabel="Nombre de la tarea"
            />
            <TimeField value={time} onChange={setTime} />
            {task.kind === 'fixed' && <Text className="text-xs text-ink-500">Se repite: el cambio se aplica en todos los días en que aparece.</Text>}
            <Pressable onPress={save} disabled={!title.trim()} className={`items-center justify-center rounded-lg bg-shu-500 py-3 ${title.trim() ? '' : 'opacity-50'}`}>
              <Text className="font-semibold text-washi">Guardar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
