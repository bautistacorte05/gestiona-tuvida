import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Category, Subcategory } from '../config/categories';
import { PET_OWNED_SUBS, useDb, type Entry } from '../lib/db';
import { today } from '../lib/dates';
import { itemsTotal } from '../lib/prices';
import { useThemeColors } from '../lib/theme';
import { money } from './common';
import DateField from './DateField';
import ItemsEditor, { draftsToItems, parseNum, type ItemDraft } from './ItemsEditor';
import TimeField from './TimeField';

interface Props {
  category: Category;
  sub: Subcategory;
  entry?: Entry;
  defaultDate?: string;
  onClose: () => void;
}

export default function EntryForm({ category, sub, entry, defaultDate, onClose }: Props) {
  const c = useThemeColors();
  const saveEntry = useDb((s) => s.saveEntry);
  const deleteEntry = useDb((s) => s.deleteEntry);
  const activePetId = useDb((s) => s.activePetId);
  const needsPet = category.id === 'mascota' && PET_OWNED_SUBS.includes(sub.id);
  const petId = needsPet ? (entry?.petId ?? activePetId) : undefined;
  const [date, setDate] = useState(entry?.date ?? defaultDate ?? today());
  const [values, setValues] = useState<Record<string, string | string[]>>(() =>
    Object.fromEntries(
      sub.fields.map((f) => {
        const raw = entry?.values[f.key];
        if (f.multi) return [f.key, Array.isArray(raw) ? raw : raw !== undefined ? [String(raw)] : []];
        return [f.key, raw !== undefined ? String(raw) : ''];
      }),
    ),
  );

  const [items, setItems] = useState<ItemDraft[]>(() =>
    (entry?.items ?? []).map((i) => ({ producto: i.producto, cantidad: String(i.cantidad), precio: String(i.precio) })),
  );
  // Si hay productos, el total se calcula solo.
  const parsedItems = draftsToItems(items);
  const autoTotal = sub.itemized && parsedItems.length ? itemsTotal(parsedItems) : undefined;
  const totalField = sub.fields.find((f) => f.money);

  const submit = () => {
    if (needsPet && !petId) {
      Alert.alert('Falta un dato', 'Primero elegí (o agregá) una mascota en Perfil / DNI.');
      return;
    }
    for (const f of sub.fields) {
      if (!f.required) continue;
      const v = values[f.key];
      const empty = f.multi ? !Array.isArray(v) || v.length === 0 : !String(v ?? '').trim();
      // El Total se puede dejar vacío si hay productos cargados: se completa solo con la suma.
      if (empty && f === totalField && autoTotal !== undefined) continue;
      if (empty) {
        Alert.alert('Falta un dato', `Completá "${f.label}" para guardar.`);
        return;
      }
    }
    const clean: Record<string, string | number | string[]> = {};
    for (const f of sub.fields) {
      if (f.multi) {
        const arr = values[f.key];
        if (Array.isArray(arr) && arr.length) clean[f.key] = arr;
        continue;
      }
      const raw = values[f.key];
      const v = typeof raw === 'string' ? raw.trim() : '';
      if (!v) {
        // Total sin cargar a mano: usar la suma de productos. Si se cargó, se respeta lo que escribió el usuario.
        if (f === totalField && autoTotal !== undefined) clean[f.key] = autoTotal;
        continue;
      }
      clean[f.key] = f.type === 'number' ? parseNum(v) : v;
    }
    saveEntry({ id: entry?.id, categoryId: category.id, subId: sub.id, date, values: clean, items: sub.itemized ? parsedItems : undefined, petId });
    onClose();
  };

  const remove = () => {
    if (!entry) return;
    Alert.alert('¿Borrar este registro?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          deleteEntry(entry.id);
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
            <Text className="text-lg font-bold text-ink-100">
              {sub.icon} {entry ? 'Editar' : 'Nuevo'} · {sub.name}
            </Text>
            <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
              <Text className="text-ink-300">✕</Text>
            </Pressable>
          </View>

          <ScrollView className="px-5 py-4" contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <View>
              <Text className="mb-1 text-sm text-ink-400">Fecha</Text>
              <DateField value={date} onChange={setDate} />
            </View>

            {sub.fields.map((f) => (
              <View key={f.key}>
                <Text className="mb-1 text-sm text-ink-400">
                  {f.label}
                  {f.unit && !f.money ? ` (${f.unit})` : ''}
                  {f.multi ? ' (una o varias)' : ''}
                  {f.required ? ' *' : ''}
                </Text>
                {f === totalField && autoTotal !== undefined && !String(values[f.key] ?? '').trim() && (
                  <Pressable
                    onPress={() => setValues((v) => ({ ...v, [f.key]: String(autoTotal) }))}
                    className="mb-1 self-start rounded-md bg-ink-950/60 px-2 py-1">
                    <Text className="text-xs text-ink-400">
                      Suma de productos: <Text className="text-shu-400">{money.format(autoTotal)}</Text> · tocá para usarla
                    </Text>
                  </Pressable>
                )}
                {f.type === 'select' ? (
                  <View className="flex-row flex-wrap gap-2">
                    {f.options!.map((opt) => {
                      const current = values[f.key];
                      const selected = f.multi ? Array.isArray(current) && current.includes(opt) : current === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() =>
                            setValues((v) => {
                              if (f.multi) {
                                const arr = Array.isArray(v[f.key]) ? (v[f.key] as string[]) : [];
                                return { ...v, [f.key]: arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt] };
                              }
                              return { ...v, [f.key]: selected ? '' : opt };
                            })
                          }
                          className={`rounded-full border px-3 py-1.5 ${selected ? 'border-shu-500 bg-shu-500/15' : 'border-ink-700'}`}>
                          <Text className={selected ? 'text-shu-300' : 'text-ink-300'}>
                            {f.multi && selected ? '✓ ' : ''}
                            {opt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : f.type === 'date' ? (
                  <DateField value={values[f.key] as string} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                ) : f.type === 'time' ? (
                  <TimeField value={values[f.key] as string} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                ) : (
                  <TextInput
                    className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
                    keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                    value={values[f.key] as string}
                    onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                    placeholder={f.money ? '0' : undefined}
                    placeholderTextColor={c['ink-500']}
                  />
                )}
              </View>
            ))}

            {sub.itemized && <ItemsEditor categoryId={category.id} subId={sub.id} date={date} entryId={entry?.id} items={items} onChange={setItems} />}
          </ScrollView>

          <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
            {entry && (
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
