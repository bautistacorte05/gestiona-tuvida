import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { useScheme, useThemeColors } from '../lib/theme';

const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fromHHMM = (v: string) => {
  const d = new Date();
  const [h, m] = v.split(':').map(Number);
  d.setHours(h || 9, m || 0, 0, 0);
  return d;
};

/** Hora opcional ("HH:MM" o ''), con el selector nativo de iOS en una hoja aparte (igual que DateField). */
export default function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const scheme = useScheme();
  const c = useThemeColors();
  const [draft, setDraft] = useState(() => fromHHMM(value));

  const openPicker = () => {
    setDraft(fromHHMM(value));
    setOpen(true);
  };

  const done = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={openPicker} className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5" accessibilityLabel="Elegir hora">
        <Text className={`text-base ${value ? 'text-ink-100' : 'text-ink-500'}`}>{value ? `🕒 ${value}` : '🕒 Hora'}</Text>
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setOpen(false)}>
          <Pressable className="rounded-t-3xl border border-ink-800 bg-ink-900 px-5 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-ink-100">Elegir hora</Text>
              <Pressable onPress={() => setOpen(false)} className="px-2 py-1" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              is24Hour
              themeVariant={scheme}
              accentColor={c['shu-500']}
              onChange={(_, d) => d && setDraft(d)}
              style={{ alignSelf: 'stretch' }}
            />
            <View className="mt-3 flex-row gap-2">
              <Pressable onPress={() => done('')} className="items-center justify-center rounded-lg border border-ink-700 px-4 py-2.5">
                <Text className="text-ink-300">Sin hora</Text>
              </Pressable>
              <Pressable onPress={() => done(toHHMM(draft))} className="flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5">
                <Text className="font-medium text-washi">Confirmar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
