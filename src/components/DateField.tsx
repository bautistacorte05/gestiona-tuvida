import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { formatDay } from '../lib/dates';
import { useScheme, useThemeColors } from '../lib/theme';

/**
 * Botón que abre el selector de fecha nativo de iOS, en una hoja aparte a ancho completo.
 * Así no depende del ancho de la columna donde esté el botón (si no, el calendario podía
 * quedar recortado o corrido hacia la derecha cuando el campo estaba en una fila angosta).
 */
export default function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const scheme = useScheme();
  const c = useThemeColors();
  const [draft, setDraft] = useState(value ? new Date(value + 'T00:00:00') : new Date());

  const openPicker = () => {
    setDraft(value ? new Date(value + 'T00:00:00') : new Date());
    setOpen(true);
  };

  const confirm = () => {
    const iso = `${draft.getFullYear()}-${String(draft.getMonth() + 1).padStart(2, '0')}-${String(draft.getDate()).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={openPicker} className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5">
        <Text className="text-base text-ink-100">{value ? formatDay(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Elegir fecha'}</Text>
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setOpen(false)}>
          <Pressable className="rounded-t-3xl border border-ink-800 bg-ink-900 px-5 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-ink-100">Elegir fecha</Text>
              <Pressable onPress={() => setOpen(false)} className="px-2 py-1" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              themeVariant={scheme}
              accentColor={c['shu-500']}
              onValueChange={(_, d) => setDraft(d)}
              style={{ alignSelf: 'stretch' }}
            />
            <Pressable onPress={confirm} className="mt-3 items-center justify-center rounded-lg bg-shu-500 py-2.5">
              <Text className="font-medium text-washi">Confirmar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
