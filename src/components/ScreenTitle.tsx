import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { COLOR_CLASSES, findSub } from '../config/categories';
import { useDb } from '../lib/db';
import { nameIdOf, useFindSub } from '../lib/names';
import { useThemeColors } from '../lib/theme';

const INPUT = 'rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100';

/** Título de una pantalla de categoría (categoría arriba, sección abajo) con ✏️ para renombrarlas. */
export default function ScreenTitle({ categoryId, subId }: { categoryId: string; subId: string }) {
  const found = useFindSub(categoryId, subId);
  const [editing, setEditing] = useState(false);
  if (!found) return null;
  const { category, sub } = found;

  return (
    <View className="flex-row items-center gap-1">
      <View>
        <Text className={`text-sm ${COLOR_CLASSES[category.color].text}`}>
          {category.icon} {category.name}
        </Text>
        <Text className="text-[26px] font-bold text-ink-100">
          {sub.icon} {sub.name}
        </Text>
      </View>
      <Pressable onPress={() => setEditing(true)} accessibilityLabel="Cambiar nombre" className="h-9 w-9 items-center justify-center rounded-lg">
        <Text className="text-sm opacity-60">✏️</Text>
      </Pressable>
      {editing && <RenameSheet categoryId={categoryId} subId={subId} current={{ category: category.name, sub: sub.name }} onClose={() => setEditing(false)} />}
    </View>
  );
}

function RenameSheet({
  categoryId,
  subId,
  current,
  onClose,
}: {
  categoryId: string;
  subId: string;
  current: { category: string; sub: string };
  onClose: () => void;
}) {
  const c = useThemeColors();
  const original = findSub(categoryId, subId)!;
  const [categoryName, setCategoryName] = useState(current.category);
  const [subName, setSubName] = useState(current.sub);

  // Guardar el nombre original equivale a no tener nombre propio (vacío = original).
  const save = () => {
    const { setCustomName } = useDb.getState();
    const cat = categoryName.trim();
    const sub = subName.trim();
    setCustomName(nameIdOf(categoryId), cat === original.category.name ? '' : cat);
    setCustomName(nameIdOf(categoryId, subId), sub === original.sub.name ? '' : sub);
    onClose();
  };

  const restore = () => {
    setCategoryName(original.category.name);
    setSubName(original.sub.name);
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable className="gap-3 rounded-t-3xl border border-ink-800 bg-ink-900 px-5 pb-8 pt-4" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink-100">Cambiar nombres</Text>
            <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
              <Text className="text-ink-300">✕</Text>
            </Pressable>
          </View>
          <View>
            <Text className="mb-1 text-sm text-ink-400">
              Categoría {original.category.icon}
            </Text>
            <TextInput className={INPUT} value={categoryName} onChangeText={setCategoryName} placeholder={original.category.name} placeholderTextColor={c['ink-500']} />
          </View>
          <View>
            <Text className="mb-1 text-sm text-ink-400">
              Sección {original.sub.icon}
            </Text>
            <TextInput className={INPUT} value={subName} onChangeText={setSubName} placeholder={original.sub.name} placeholderTextColor={c['ink-500']} onSubmitEditing={save} />
          </View>
          <Text className="text-xs text-ink-500">Se cambia en el menú y en todas las pantallas, en el celular y en la PC.</Text>
          <View className="flex-row gap-2 pt-1">
            <Pressable onPress={restore} className="items-center justify-center rounded-lg border border-ink-700 px-4 py-2.5">
              <Text className="text-ink-300">Volver a los originales</Text>
            </Pressable>
            <Pressable onPress={save} className="flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5">
              <Text className="font-medium text-washi">Guardar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
