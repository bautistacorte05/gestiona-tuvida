import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { confirm } from '../lib/confirm';
import { formatDay, monthKey, formatMonth, monthRange, shiftMonth, today } from '../lib/dates';
import { useDb, type Entry } from '../lib/db';
import { goToSub } from '../lib/nav';
import { markDone } from '../lib/sheets';
import { useThemeColors } from '../lib/theme';
import PetSwitcher from './PetSwitcher';
import TrashButton from './TrashButton';
import { PrimaryButton, Section, SheetScreen, StatTile } from './sheets/kit';

const FOOD_TYPES = [
  { id: 'Balanceado', icon: '🥣', label: 'Balanceado' },
  { id: 'Casero', icon: '🍗', label: 'Casero' },
  { id: 'Premio', icon: '🦴', label: 'Premio' },
  { id: 'Otro', icon: '🥛', label: 'Otro' },
] as const;

const FOOD_ICON: Record<string, string> = Object.fromEntries(FOOD_TYPES.map((t) => [t.id, t.icon]));

function iconFor(e: Entry) {
  const tipo = e.values.tipo;
  if (Array.isArray(tipo)) return FOOD_ICON[tipo[0]] ?? '🦴';
  return FOOD_ICON[String(tipo)] ?? '🦴';
}

function tipoLabel(e: Entry) {
  const tipo = e.values.tipo;
  if (Array.isArray(tipo)) return tipo.join(', ');
  return String(tipo ?? '');
}

function EditForm({ petId, entry, onClose }: { petId: string; entry: Entry; onClose: () => void }) {
  const c = useThemeColors();
  const saved = useRef(false);
  const [tipos, setTipos] = useState<string[]>(Array.isArray(entry.values.tipo) ? entry.values.tipo : [String(entry.values.tipo ?? '')]);
  const [gramos, setGramos] = useState(entry.values.gramos !== undefined ? String(entry.values.gramos) : '');
  const [nota, setNota] = useState(String(entry.values.nota ?? ''));

  const save = () => {
    if (saved.current || tipos.length === 0) return;
    saved.current = true;
    const values: Entry['values'] = { tipo: tipos };
    if (Number(gramos) > 0) values.gramos = Number(gramos);
    if (nota.trim()) values.nota = nota.trim();
    useDb.getState().saveEntry({ id: entry.id, categoryId: 'mascota', subId: 'alimento', date: entry.date, values, petId });
    onClose();
  };

  const remove = async () => {
    if (!(await confirm('¿Borrar esta comida?', 'No se puede deshacer.', 'Borrar'))) return;
    useDb.getState().deleteEntry(entry.id);
    onClose();
  };

  const input = 'h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100';
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="max-h-[88%] rounded-t-3xl border border-ink-800 bg-ink-900" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-3">
              <Text className="text-lg font-bold text-ink-100">✏️ Editar comida</Text>
              <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="px-5 py-4" contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              <View className="gap-2">
                <Text className="text-xs text-ink-500">Tipo</Text>
                <View className="flex-row flex-wrap gap-2">
                  {FOOD_TYPES.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => setTipos((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                      className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 ${tipos.includes(t.id) ? 'bg-shu-500' : 'border border-ink-700'}`}>
                      <Text className="text-base">{t.icon}</Text>
                      <Text className={`text-sm font-medium ${tipos.includes(t.id) ? 'text-washi' : 'text-ink-300'}`}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View>
                <Text className="mb-1 text-xs text-ink-500">Cantidad en gramos (opcional)</Text>
                <TextInput className={input} keyboardType="number-pad" value={gramos} onChangeText={setGramos} placeholder="—" placeholderTextColor={c['ink-600']} />
              </View>
              <View>
                <Text className="mb-1 text-xs text-ink-500">Nota (opcional)</Text>
                <TextInput
                  className="min-h-[60px] rounded-xl border border-ink-700 bg-ink-950 px-3 py-2.5 text-[15px] text-ink-100"
                  multiline
                  value={nota}
                  onChangeText={setNota}
                  placeholderTextColor={c['ink-600']}
                />
              </View>
            </ScrollView>
            <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
              <Pressable onPress={remove} className="items-center justify-center rounded-lg px-4 py-2.5">
                <Text className="font-medium text-kurenai-400">Borrar</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={tipos.length === 0}
                className={`flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5 ${tipos.length === 0 ? 'opacity-40' : ''}`}>
                <Text className="font-medium text-washi">Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function PetFeedingView() {
  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const entries = useDb((s) => s.entries);
  const pet = petProfiles.find((p) => p.id === activePetId && !p.archived);
  const now = today();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [month, setMonth] = useState(() => monthKey(now));

  const onAdd = () => {
    useDb.getState().addPetProfile({ nombre: '' });
    goToSub('mascota', 'perfil');
  };

  const todayMeals = useMemo(
    () =>
      entries
        .filter((e) => e.categoryId === 'mascota' && e.subId === 'alimento' && e.petId === pet?.id && e.date === now)
        .sort((a, b) => a.createdAt - b.createdAt),
    [entries, pet?.id, now],
  );

  const { start, end } = monthRange(month);
  const monthEntries = useMemo(
    () =>
      entries
        .filter((e) => e.categoryId === 'mascota' && e.subId === 'alimento' && e.petId === pet?.id && e.date >= start && e.date <= end)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [entries, pet?.id, start, end],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of monthEntries) {
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return [...map.entries()];
  }, [monthEntries]);

  const quickAdd = (tipo: string) => {
    if (!pet) return;
    useDb.getState().saveEntry({ categoryId: 'mascota', subId: 'alimento', date: now, values: { tipo: [tipo] }, petId: pet.id });
    markDone(now, 'mascota');
  };

  if (!pet) {
    return (
      <SheetScreen categoryId="mascota">
        <PetSwitcher onAdd={onAdd} />
        <View className="items-center gap-3 rounded-2xl border border-dashed border-ink-800 p-8">
          <Text className="text-4xl">🦴</Text>
          <Text className="text-center text-sm text-ink-400">Primero agregá una mascota.</Text>
          <PrimaryButton label="Agregar mi mascota" onPress={onAdd} />
        </View>
      </SheetScreen>
    );
  }

  const overlay = editing ? <EditForm key={editing.id} petId={pet.id} entry={editing} onClose={() => setEditing(null)} /> : null;

  return (
    <SheetScreen categoryId="mascota" overlay={overlay}>
      <PetSwitcher onAdd={onAdd} />

      <View className="gap-1">
        <Text className="text-2xl font-bold text-ink-100">Alimentación de {pet.nombre || 'tu mascota'}</Text>
        <Text className="text-sm text-ink-400">
          {todayMeals.length === 0 ? 'Todavía no anotaste comidas hoy' : `${todayMeals.length} ${todayMeals.length === 1 ? 'comida' : 'comidas'} hoy`}
        </Text>
      </View>

      {/* --- Carga rápida --- */}
      <View className="gap-2.5">
        <Text className="text-[15px] font-semibold text-ink-200">Agregar comida</Text>
        <View className="flex-row gap-2">
          {FOOD_TYPES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => quickAdd(t.id)}
              className="min-w-0 flex-1 items-center gap-1.5 rounded-2xl border border-ink-800 bg-ink-900 py-4 active:bg-shu-500/20 active:border-shu-500/40">
              <Text className="text-3xl">{t.icon}</Text>
              <Text className="text-xs font-semibold text-ink-200">{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* --- Comidas de hoy --- */}
      {todayMeals.length > 0 && (
        <Section title="Hoy">
          {todayMeals.map((e) => {
            const g = Number(e.values.gramos) || 0;
            const hora = new Date(e.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            return (
              <View key={e.id} className="flex-row items-center">
                <Pressable onPress={() => setEditing(e)} className="min-w-0 flex-1 flex-row items-center gap-3 rounded-xl py-1.5 active:bg-ink-800/60">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-ink-800">
                    <Text className="text-lg">{iconFor(e)}</Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[15px] font-semibold text-ink-100">{tipoLabel(e)}</Text>
                    <Text className="text-xs text-ink-400">
                      {hora}
                      {g > 0 ? ` · ${g} g` : ''}
                      {e.values.nota ? ` · ${String(e.values.nota)}` : ''}
                    </Text>
                  </View>
                  <Text className="text-xs text-ink-500">✏️</Text>
                </Pressable>
                <TrashButton what="esta comida" onDelete={() => useDb.getState().deleteEntry(e.id)} />
              </View>
            );
          })}
        </Section>
      )}

      {/* --- Historial del mes --- */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[17px] font-bold text-ink-100">Historial</Text>
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8}>
              <Text className="text-lg text-ink-400">‹</Text>
            </Pressable>
            <Text className="text-sm font-medium text-ink-300">{formatMonth(month)}</Text>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8}>
              <Text className="text-lg text-ink-400">›</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row gap-2">
          <StatTile label="Comidas" value={String(monthEntries.length)} />
          <StatTile
            label="Promedio/día"
            value={byDay.length > 0 ? String(Math.round((monthEntries.length / byDay.length) * 10) / 10).replace('.', ',') : '—'}
          />
        </View>

        {byDay.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-ink-800 p-5">
            <Text className="text-center text-sm text-ink-500">Sin registros en {formatMonth(month).toLowerCase()}.</Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
            {byDay.map(([date, list], di) => (
              <View key={date} className={di > 0 ? 'border-t border-ink-800' : ''}>
                <View className="px-4 pt-2.5 pb-1">
                  <Text className="text-xs font-medium text-ink-500">{formatDay(date)}</Text>
                </View>
                {list.map((e) => {
                  const g = Number(e.values.gramos) || 0;
                  return (
                    <View key={e.id} className="flex-row items-center pr-1">
                      <Pressable onPress={() => setEditing(e)} className="min-w-0 flex-1 flex-row items-center gap-3 py-2 pl-4 pr-2 active:bg-ink-800/60">
                        <Text className="text-lg">{iconFor(e)}</Text>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[15px] text-ink-100">{tipoLabel(e)}</Text>
                          {g > 0 && <Text className="text-xs text-ink-400">{g} g</Text>}
                        </View>
                      </Pressable>
                      <TrashButton what="esta comida" onDelete={() => useDb.getState().deleteEntry(e.id)} />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </View>
    </SheetScreen>
  );
}
