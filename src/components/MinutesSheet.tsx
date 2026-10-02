import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { Category } from '../config/categories';
import { useDb } from '../lib/db';
import { useThemeColors } from '../lib/theme';
import { formatMinutes } from '../lib/time';

const QUICK = [15, 30, 45, 60, 90, 120, 180, 240];

interface Props {
  category: Category;
  date: string;
  current?: number;
  onClose: () => void;
}

/** Carga rápida de cuántos minutos se le dedicó a una actividad ese día. */
export default function MinutesSheet({ category, date, current, onClose }: Props) {
  const c = useThemeColors();
  const setMinutes = useDb((s) => s.setMinutes);
  const [value, setValue] = useState(current ? String(current) : '');
  const min = Number(value.replace(',', '.')) || 0;

  const save = (m: number | undefined) => {
    setMinutes(date, category.id, m);
    onClose();
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable className="rounded-t-3xl border border-ink-800 bg-ink-900 px-5 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink-100">
              ⏱ {category.icon} {category.name}
            </Text>
            <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
              <Text className="text-ink-300">✕</Text>
            </Pressable>
          </View>
          <Text className="mb-3 text-sm text-ink-400">¿Cuánto tiempo le dedicaste?</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {QUICK.map((q) => {
              const selected = min === q;
              return (
                <Pressable
                  key={q}
                  onPress={() => setValue(String(q))}
                  className={`rounded-xl border px-3 py-2.5 ${selected ? 'border-shu-500 bg-shu-500/15' : 'border-ink-700'}`}
                  style={{ width: '23%' }}>
                  <Text className={`text-center text-sm ${selected ? 'text-shu-300' : 'text-ink-300'}`}>{formatMinutes(q)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mb-1 text-sm text-ink-400">Otro (minutos)</Text>
          <TextInput
            className="mb-4 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
            keyboardType="numeric"
            placeholder="Ej: 50"
            placeholderTextColor={c['ink-500']}
            value={value}
            onChangeText={setValue}
          />
          <View className="flex-row gap-2">
            {current !== undefined && (
              <Pressable onPress={() => save(undefined)} className="items-center justify-center rounded-lg px-4 py-2.5">
                <Text className="font-medium text-kurenai-400">Quitar tiempo</Text>
              </Pressable>
            )}
            <Pressable onPress={() => save(min)} disabled={!min} className={`flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5 ${!min ? 'opacity-50' : ''}`}>
              <Text className="font-medium text-washi">Guardar {min ? `· ${formatMinutes(min)}` : ''}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
