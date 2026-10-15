import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Category, Subcategory } from '../config/categories';
import { confirm, notify } from '../lib/confirm';
import { useDb, type Entry } from '../lib/db';
import { today } from '../lib/dates';
import { itemsTotal } from '../lib/prices';
import { useThemeColors } from '../lib/theme';
import { money } from './common';
import DateField from './DateField';
import ItemsEditor, { draftsToItems, parseNum, type ItemDraft } from './ItemsEditor';

interface Props {
  category: Category;
  sub: Subcategory;
  entry?: Entry;
  defaultDate?: string;
  onClose: () => void;
}

export default function FinanceEntryForm({ category, sub, entry, defaultDate, onClose }: Props) {
  const c = useThemeColors();
  const saveEntry = useDb((s) => s.saveEntry);
  const deleteEntry = useDb((s) => s.deleteEntry);
  const saved = useRef(false);

  const moneyField = sub.fields.find((f) => f.money)!;
  const selectFields = sub.fields.filter((f) => f.type === 'select');
  const textFields = sub.fields.filter((f) => f.type === 'text');

  const [date, setDate] = useState(entry?.date ?? defaultDate ?? today());
  const [amount, setAmount] = useState(entry ? String(entry.values[moneyField.key] ?? '') : '');

  const [selects, setSelects] = useState<Record<string, string | string[]>>(() => {
    const init: Record<string, string | string[]> = {};
    for (const f of selectFields) {
      const raw = entry?.values[f.key];
      if (f.multi) {
        init[f.key] = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
      } else {
        init[f.key] = raw !== undefined ? String(raw) : '';
      }
    }
    return init;
  });

  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of textFields) init[f.key] = entry ? String(entry.values[f.key] ?? '') : '';
    return init;
  });

  const [rubroOtro, setRubroOtro] = useState(entry ? String(entry.values.rubroOtro ?? '') : '');
  const rubroField = selectFields.find((f) => f.key === 'rubro');
  const hasOtros = rubroField ? (Array.isArray(selects.rubro) && (selects.rubro as string[]).includes('Otros')) : false;

  const hasTextValues = textFields.some((f) => !!texts[f.key]);
  const [showDetails, setShowDetails] = useState(!!entry && (hasTextValues || (entry.items?.length ?? 0) > 0));

  const [items, setItems] = useState<ItemDraft[]>(() =>
    (entry?.items ?? []).map((i) => ({ producto: i.producto, cantidad: String(i.cantidad), precio: String(i.precio) })),
  );
  const parsedItems = draftsToItems(items);
  const autoTotal = sub.itemized && parsedItems.length ? itemsTotal(parsedItems) : undefined;

  const toggleMulti = (fieldKey: string, opt: string) => {
    setSelects((s) => {
      const arr = Array.isArray(s[fieldKey]) ? (s[fieldKey] as string[]) : [];
      return { ...s, [fieldKey]: arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt] };
    });
  };

  const toggleSingle = (fieldKey: string, opt: string) => {
    setSelects((s) => ({ ...s, [fieldKey]: s[fieldKey] === opt ? '' : opt }));
  };

  const submit = () => {
    if (saved.current) return;
    const amountNum = parseNum(amount);
    if (!amountNum && autoTotal === undefined) {
      notify('Falta el monto', 'Escribí cuánto para guardar.');
      return;
    }
    for (const f of selectFields) {
      if (!f.required) continue;
      const v = selects[f.key];
      const empty = f.multi ? !Array.isArray(v) || v.length === 0 : !String(v ?? '').trim();
      if (empty) {
        notify('Falta un dato', `Elegí al menos un${f.multi ? 'a opción en' : ''} "${f.label}".`);
        return;
      }
    }
    saved.current = true;
    const clean: Record<string, string | number | string[]> = {};
    clean[moneyField.key] = amountNum || (autoTotal ?? 0);
    for (const f of selectFields) {
      const v = selects[f.key];
      if (f.multi && Array.isArray(v) && v.length) clean[f.key] = v;
      else if (!f.multi && typeof v === 'string' && v) clean[f.key] = v;
    }
    for (const f of textFields) {
      const v = texts[f.key]?.trim();
      if (v) clean[f.key] = v;
    }
    if (hasOtros && rubroOtro.trim()) clean.rubroOtro = rubroOtro.trim();
    saveEntry({ id: entry?.id, categoryId: category.id, subId: sub.id, date, values: clean, items: sub.itemized ? parsedItems : undefined });
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm('¿Borrar este registro?', 'No se puede deshacer.', 'Borrar'))) return;
    deleteEntry(entry.id);
    onClose();
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

            <ScrollView className="px-5 py-4" contentContainerClassName="gap-5" keyboardShouldPersistTaps="handled">
              {/* ── Monto grande ── */}
              <View className="items-center rounded-2xl bg-ink-950/60 py-6">
                <Text className="mb-1 text-xs text-ink-500">Monto</Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-3xl text-ink-400">$</Text>
                  <TextInput
                    autoFocus={!entry}
                    keyboardType="decimal-pad"
                    className="min-w-[60px] text-center text-5xl font-bold text-ink-100"
                    placeholder="0"
                    placeholderTextColor={c['ink-700']}
                    value={amount}
                    onChangeText={setAmount}
                    style={{ fontVariant: ['tabular-nums'] }}
                  />
                </View>
                {autoTotal !== undefined && !amount.trim() && (
                  <Pressable onPress={() => setAmount(String(autoTotal))} className="mt-2 rounded-md bg-ink-800 px-3 py-1">
                    <Text className="text-xs text-ink-400">
                      Suma de productos: <Text className="text-shu-400">{money.format(autoTotal)}</Text>
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* ── Fecha ── */}
              <View>
                <Text className="mb-1 text-xs text-ink-500">Fecha</Text>
                <DateField value={date} onChange={setDate} />
              </View>

              {/* ── Campos de selección ── */}
              {selectFields.map((f) => (
                <View key={f.key}>
                  <Text className="mb-2 text-xs text-ink-500">
                    {f.label} {f.required ? '*' : ''} {f.multi ? '(una o varias)' : ''}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {f.options!.map((opt) => {
                      const selected = f.multi
                        ? Array.isArray(selects[f.key]) && (selects[f.key] as string[]).includes(opt)
                        : selects[f.key] === opt;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => (f.multi ? toggleMulti(f.key, opt) : toggleSingle(f.key, opt))}
                          className={`rounded-xl px-3.5 py-2 ${selected ? 'bg-shu-500' : 'border border-ink-700 bg-ink-900'}`}
                        >
                          <Text className={`text-sm font-medium ${selected ? 'text-washi' : 'text-ink-300'}`}>
                            {f.multi && selected ? '✓ ' : ''}
                            {opt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* ── Nombre personalizado para "Otros" ── */}
              {hasOtros && (
                <View>
                  <Text className="mb-1 text-xs text-ink-500">¿Qué tipo de gasto es?</Text>
                  <TextInput
                    className="rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2.5 text-base text-ink-100"
                    value={rubroOtro}
                    onChangeText={setRubroOtro}
                    placeholder="Ej: Peluquería, Lavadero, Regalo..."
                    placeholderTextColor={c['ink-600']}
                  />
                </View>
              )}

              {/* ── Más detalles ── */}
              {(textFields.length > 0 || sub.itemized) && (
                <View>
                  <Pressable onPress={() => setShowDetails(!showDetails)} className="flex-row items-center gap-1.5 py-1">
                    <Text className="text-sm text-shu-400">{showDetails ? '▾' : '▸'} Más detalles</Text>
                    {hasTextValues && !showDetails && <View className="h-1.5 w-1.5 rounded-full bg-shu-400" />}
                  </Pressable>
                  {showDetails && (
                    <View className="mt-2 gap-3">
                      {textFields.map((f) => (
                        <View key={f.key}>
                          <Text className="mb-1 text-xs text-ink-500">{f.label}</Text>
                          <TextInput
                            className="rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2.5 text-base text-ink-100"
                            value={texts[f.key]}
                            onChangeText={(t) => setTexts((s) => ({ ...s, [f.key]: t }))}
                            placeholder={f.label}
                            placeholderTextColor={c['ink-600']}
                          />
                        </View>
                      ))}
                      {sub.itemized && <ItemsEditor categoryId={category.id} subId={sub.id} date={date} entryId={entry?.id} items={items} onChange={setItems} />}
                    </View>
                  )}
                </View>
              )}
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
