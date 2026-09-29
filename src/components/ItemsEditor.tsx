import { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useDb, type Entry } from '../lib/db';
import { monthKey } from '../lib/dates';
import { itemsTotal, pctChange, pricesByProduct, productKey } from '../lib/prices';
import { money, PctBadge } from './common';

/** Fila en edición: los números quedan como texto hasta guardar. */
export interface ItemDraft {
  producto: string;
  cantidad: string;
  precio: string;
}

/** Acepta "1500", "15.000", "1,5", "1.5" y "15.000,50". */
export function parseNum(s: string) {
  let t = s.trim().replace(/\s|\$/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return Number(t);
}

export function draftsToItems(drafts: ItemDraft[]) {
  return drafts
    .filter((d) => d.producto.trim() && d.precio.trim())
    .map((d) => ({ producto: d.producto.trim(), cantidad: parseNum(d.cantidad) || 1, precio: parseNum(d.precio) || 0 }));
}

interface Props {
  categoryId: string;
  subId: string;
  date: string;
  entryId?: string;
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
}

export default function ItemsEditor({ categoryId, subId, date, entryId, items, onChange }: Props) {
  // Historial de precios anterior al mes de esta compra, para comparar.
  const monthStart = `${monthKey(date)}-01`;
  const allEntries = useDb((s) => s.entries);
  const history = useMemo(
    () => allEntries.filter((e) => e.categoryId === categoryId && e.subId === subId && e.date < monthStart && e.id !== entryId && !!e.items?.length),
    [allEntries, categoryId, subId, monthStart, entryId],
  );
  const prices = useMemo(() => pricesByProduct(history), [history]);

  const set = (i: number, patch: Partial<ItemDraft>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, { producto: '', cantidad: '1', precio: '' }]);

  const total = itemsTotal(draftsToItems(items));

  return (
    <View className="rounded-xl border border-ink-800 p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-ink-100">🧾 Productos</Text>
        {items.length > 0 && <Text className="text-sm text-ink-300">{money.format(total)}</Text>}
      </View>

      <View className="gap-3">
        {items.map((it, i) => {
          const before = prices.get(productKey(it.producto));
          const unit = parseNum(it.precio);
          const pct = before && unit ? pctChange(before.last, unit) : undefined;
          return (
            <View key={i} className="gap-1.5 rounded-xl bg-ink-950/60 p-2">
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-base text-ink-100"
                  placeholder="Producto (ej: Leche 1L)"
                  placeholderTextColor="#877a61"
                  value={it.producto}
                  onChangeText={(t) => set(i, { producto: t })}
                />
                <Pressable onPress={() => remove(i)} className="items-center justify-center rounded-lg px-3">
                  <Text className="text-kurenai-400">✕</Text>
                </Pressable>
              </View>
              <View className="flex-row gap-2">
                <View style={{ width: 80 }}>
                  <Text className="mb-0.5 text-[11px] text-ink-500">Cant.</Text>
                  <TextInput
                    className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-base text-ink-100"
                    keyboardType="decimal-pad"
                    value={it.cantidad}
                    onChangeText={(t) => set(i, { cantidad: t })}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-0.5 text-[11px] text-ink-500">Precio unitario $</Text>
                  <TextInput
                    className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-base text-ink-100"
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#877a61"
                    value={it.precio}
                    onChangeText={(t) => set(i, { precio: t })}
                  />
                </View>
              </View>
              {before && (
                <View className="flex-row items-center gap-2 px-1">
                  <Text className="text-xs text-ink-400">
                    Antes: {money.format(before.last)} ({before.lastDate.split('-').reverse().slice(0, 2).join('/')})
                  </Text>
                  {pct !== undefined && <PctBadge pct={pct} />}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Pressable onPress={add} className="mt-2 items-center rounded-lg border border-dashed border-ink-700 py-2.5">
        <Text className="text-sm text-ink-300">+ Agregar producto</Text>
      </Pressable>
    </View>
  );
}
