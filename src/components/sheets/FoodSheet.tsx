import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { confirm } from '../../lib/confirm';
import { formatDay, shiftDay, today } from '../../lib/dates';
import { useDb, type Entry } from '../../lib/db';
import {
  DEFAULT_CALORIE_GOAL,
  DEFAULT_WATER_GOAL,
  HEALTH,
  MEALS,
  foodWeek,
  frequentFoods,
  isMeal,
  isWater,
  kcalOf,
  type FrequentFood,
} from '../../lib/food';
import { goToSub } from '../../lib/nav';
import { markDone } from '../../lib/sheets';
import { useThemeColors } from '../../lib/theme';
import DateField from '../DateField';
import TrashButton from '../TrashButton';
import { Chip, Hero, PrimaryButton, Section, SheetScreen, SmallButton } from './kit';

const MEAL_ICON: Record<string, string> = { Desayuno: '☕', Almuerzo: '🍽️', Merienda: '🧉', Cena: '🌙', Snack: '🍎' };
const HEALTH_ICON: Record<string, string> = { Sí: '🟢', 'Más o menos': '🟡', No: '🔴', 'Sin marcar': '⚪' };

// ——— Fila para Hoy ———

export function FoodEntryRow({ entry }: { entry: Entry }) {
  const kcal = kcalOf(entry);
  return (
    <Pressable onPress={() => goToSub('comida', 'comidas')} className="flex-row justify-between gap-3 rounded-xl px-3 py-2.5 active:bg-ink-800/60">
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-ink-100">
          {MEAL_ICON[String(entry.values.momento)] ?? '🍽️'} {String(entry.values.que ?? '')}
        </Text>
        <Text className="mt-0.5 text-xs text-ink-400">{String(entry.values.momento ?? '')}</Text>
      </View>
      {kcal > 0 && <Text className="text-[15px] font-bold text-ink-100">{kcal} kcal</Text>}
    </Pressable>
  );
}

// ——— Formulario ———

interface FormProps {
  entry?: Entry;
  defaultDate: string;
  defaultMeal?: string;
  prefill?: FrequentFood;
  onClose: () => void;
}

function FoodEntryForm({ entry, defaultDate, defaultMeal, prefill, onClose }: FormProps) {
  const c = useThemeColors();
  const saved = useRef(false);
  const [date, setDate] = useState(entry?.date ?? defaultDate);
  const [meal, setMeal] = useState(entry ? String(entry.values.momento ?? '') : (prefill?.momento || defaultMeal || ''));
  const [que, setQue] = useState(entry ? String(entry.values.que ?? '') : (prefill?.que ?? ''));
  const [kcal, setKcal] = useState(entry ? String(entry.values.calorias ?? '') : prefill?.calorias ? String(prefill.calorias) : '');
  const [health, setHealth] = useState(entry ? String(entry.values.saludable ?? '') : '');
  const valid = !!meal && !!que.trim();

  const save = () => {
    if (saved.current || !valid) return;
    saved.current = true;
    const db = useDb.getState();
    const values: Entry['values'] = { momento: meal, que: que.trim() };
    if (Number(kcal) > 0) values.calorias = Number(kcal);
    if (health) values.saludable = health;
    if (entry) db.saveEntry({ id: entry.id, categoryId: 'comida', subId: 'comidas', date, values });
    else {
      db.saveEntry({ categoryId: 'comida', subId: 'comidas', date, values });
      markDone(date, 'comida');
    }
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    if (!(await confirm('¿Borrar esta comida?', 'No se puede deshacer.', 'Borrar'))) return;
    useDb.getState().deleteEntry(entry.id);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable className="max-h-[88%] rounded-t-3xl border border-ink-800 bg-ink-900" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between border-b border-ink-800 px-5 py-3">
              <Text className="text-lg font-bold text-ink-100">{entry ? '✏️ Editar comida' : '🍽️ Anotar comida'}</Text>
              <Pressable onPress={onClose} className="px-2 py-1" accessibilityLabel="Cerrar">
                <Text className="text-ink-300">✕</Text>
              </Pressable>
            </View>
            <ScrollView className="px-5 py-4" contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
              <View>
                <Text className="mb-1 text-xs text-ink-500">Fecha</Text>
                <DateField value={date} onChange={setDate} />
              </View>
              <View className="gap-2">
                <Text className="text-xs text-ink-500">Momento</Text>
                <View className="flex-row flex-wrap gap-2">
                  {MEALS.map((m) => (
                    <Chip key={m} label={`${MEAL_ICON[m]} ${m}`} selected={meal === m} onPress={() => setMeal(meal === m ? '' : m)} />
                  ))}
                </View>
              </View>
              <View>
                <Text className="mb-1 text-xs text-ink-500">¿Qué comiste?</Text>
                <TextInput
                  className="h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
                  value={que}
                  onChangeText={setQue}
                  placeholder="Milanesa con ensalada"
                  placeholderTextColor={c['ink-600']}
                />
              </View>
              <View>
                <Text className="mb-1 text-xs text-ink-500">Calorías (opcional)</Text>
                <TextInput
                  className="h-11 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
                  keyboardType="number-pad"
                  value={kcal}
                  onChangeText={setKcal}
                  placeholder="—"
                  placeholderTextColor={c['ink-600']}
                />
              </View>
              <View className="gap-2">
                <Text className="text-xs text-ink-500">¿Saludable?</Text>
                <View className="flex-row flex-wrap gap-2">
                  {HEALTH.map((h) => (
                    <Chip key={h} label={`${HEALTH_ICON[h]} ${h}`} selected={health === h} onPress={() => setHealth(health === h ? '' : h)} />
                  ))}
                </View>
              </View>
            </ScrollView>
            <View className="flex-row gap-2 border-t border-ink-800 px-5 py-3 pb-8">
              {!!entry && (
                <Pressable onPress={remove} className="items-center justify-center rounded-lg px-4 py-2.5">
                  <Text className="font-medium text-kurenai-400">Borrar</Text>
                </Pressable>
              )}
              <Pressable
                onPress={save}
                disabled={!valid}
                className={`flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5 ${!valid ? 'opacity-40' : ''}`}>
                <Text className="font-medium text-washi">Guardar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ——— Pantalla ———

function GoalsEditor({ calories, water, onDone }: { calories: number; water: number; onDone: () => void }) {
  const c = useThemeColors();
  const [kcalText, setKcalText] = useState(String(calories));
  const [waterText, setWaterText] = useState(String(water));
  const field = 'h-9 w-20 rounded-lg border border-ink-700 bg-ink-950 px-2 text-center text-[15px] text-ink-100';

  const save = () => {
    const patch: { calorieGoal?: number; waterGoal?: number } = {};
    if (Number(kcalText) > 0) patch.calorieGoal = Number(kcalText);
    if (Number(waterText) > 0) patch.waterGoal = Number(waterText);
    useDb.getState().updateUserProfile(patch);
    onDone();
  };

  return (
    <View className="gap-2 border-t border-ink-800 pt-3">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-xs text-ink-400">Calorías por día</Text>
        <TextInput className={field} keyboardType="number-pad" value={kcalText} onChangeText={setKcalText} placeholderTextColor={c['ink-600']} />
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-xs text-ink-400">Vasos de agua por día</Text>
        <TextInput className={field} keyboardType="number-pad" value={waterText} onChangeText={setWaterText} placeholderTextColor={c['ink-600']} />
      </View>
      <SmallButton label="Guardar" strong onPress={save} />
    </View>
  );
}

export default function FoodSheet() {
  const profile = useDb((s) => s.userProfile[0]);
  const allEntries = useDb((s) => s.entries);
  const now = today();
  const [date, setDate] = useState(now);
  const [editing, setEditing] = useState<{ entry?: Entry; meal?: string; prefill?: FrequentFood } | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const calorieGoal = profile?.calorieGoal ?? DEFAULT_CALORIE_GOAL;
  const waterGoal = profile?.waterGoal ?? DEFAULT_WATER_GOAL;

  // El agua ahora vive acá: se borran los registros de la subcategoría vieja "Agua".
  useEffect(() => {
    const db = useDb.getState();
    for (const e of db.entries) if (e.categoryId === 'comida' && e.subId === 'agua') db.deleteEntry(e.id);
  }, []);

  const meals = useMemo(() => allEntries.filter(isMeal), [allEntries]);
  const dayMeals = useMemo(() => meals.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt), [meals, date]);
  const waterEntry = useMemo(() => allEntries.find((e) => isWater(e) && e.date === date), [allEntries, date]);
  const glasses = Number(waterEntry?.values.vasos) || 0;
  const frequent = useMemo(() => frequentFoods(meals), [meals]);
  const week = useMemo(() => foodWeek(meals, date), [meals, date]);

  const total = dayMeals.reduce((s, e) => s + kcalOf(e), 0);
  const left = calorieGoal - total;
  const pct = Math.min(total / calorieGoal, 1);
  const maxDay = Math.max(calorieGoal, ...week.days.map((d) => d.kcal));

  const setGlasses = (n: number) => {
    const vasos = Math.max(0, n);
    useDb.getState().saveEntry({ id: waterEntry?.id, categoryId: 'comida', subId: 'hidratacion', date, values: { vasos } });
    if (vasos > 0) markDone(date, 'comida');
  };

  const dateLabel = date === now ? 'Hoy' : formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' });
  const overlay = editing ? (
    <FoodEntryForm entry={editing.entry} defaultDate={date} defaultMeal={editing.meal} prefill={editing.prefill} onClose={() => setEditing(null)} />
  ) : null;

  return (
    <SheetScreen categoryId="comida" overlay={overlay}>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => setDate(shiftDay(date, -1))} className="px-3 py-1" accessibilityLabel="Día anterior">
          <Text className="text-2xl text-ink-300">‹</Text>
        </Pressable>
        <Pressable onPress={() => setDate(now)}>
          <Text className="text-base font-semibold capitalize text-ink-100">{dateLabel}</Text>
        </Pressable>
        <Pressable onPress={() => setDate(shiftDay(date, 1))} className="px-3 py-1" accessibilityLabel="Día siguiente">
          <Text className="text-2xl text-ink-300">›</Text>
        </Pressable>
      </View>

      <Hero title="Calorías del día" right={<SmallButton label="Metas" onPress={() => setGoalsOpen((o) => !o)} />}>
        <Text className="text-4xl font-bold text-ink-100" style={{ fontVariant: ['tabular-nums'] }}>
          {total} <Text className="text-base font-normal text-ink-400">/ {calorieGoal} kcal</Text>
        </Text>
        <View className="h-2.5 overflow-hidden rounded-full bg-ink-800">
          <View className={`h-full rounded-full ${left < 0 ? 'bg-kurenai-400' : 'bg-shu-500'}`} style={{ width: `${pct * 100}%` }} />
        </View>
        <Text className="text-xs text-shu-300">{left >= 0 ? `Quedan ${left} kcal` : `Te pasaste por ${-left} kcal`}</Text>
        {goalsOpen && <GoalsEditor calories={calorieGoal} water={waterGoal} onDone={() => setGoalsOpen(false)} />}
      </Hero>

      <Section
        title="💧 Agua"
        right={
          <Text className="text-sm text-ink-300" style={{ fontVariant: ['tabular-nums'] }}>
            {glasses} / {waterGoal}
          </Text>
        }>
        <View className="flex-row flex-wrap gap-1.5">
          {Array.from({ length: Math.max(waterGoal, glasses) }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => setGlasses(glasses === i + 1 ? i : i + 1)}
              className={`h-9 w-9 items-center justify-center rounded-full ${i < glasses ? 'bg-shu-500' : 'border border-ink-700'}`}>
              <Text className="text-sm">{i < glasses ? '💧' : ''}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row gap-2">
          <SmallButton label="− 1 vaso" onPress={() => setGlasses(glasses - 1)} />
          <SmallButton label="+ 1 vaso" strong onPress={() => setGlasses(glasses + 1)} />
        </View>
      </Section>

      {frequent.length > 0 && (
        <View className="gap-2">
          <Text className="text-[17px] font-bold text-ink-100">Comidas frecuentes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {frequent.map((f) => (
              <Chip key={f.que} label={f.que} selected={false} onPress={() => setEditing({ prefill: f })} />
            ))}
          </ScrollView>
        </View>
      )}

      <View className="gap-3">
        {MEALS.map((m) => {
          const list = dayMeals.filter((e) => e.values.momento === m);
          const sum = list.reduce((s, e) => s + kcalOf(e), 0);
          return (
            <View key={m} className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
              <View className="flex-row items-center justify-between px-4 py-3">
                <Text className="text-[15px] font-bold text-ink-100">
                  {MEAL_ICON[m]} {m}
                  {sum > 0 && <Text className="font-normal text-ink-400">{`  ${sum} kcal`}</Text>}
                </Text>
                <SmallButton label="+" strong accessibilityLabel={`Anotar ${m}`} onPress={() => setEditing({ meal: m })} />
              </View>
              {list.map((e) => (
                <View key={e.id} className="flex-row items-center border-t border-ink-800 pr-1">
                  <Pressable onPress={() => setEditing({ entry: e })} className="min-w-0 flex-1 flex-row justify-between gap-3 py-3 pl-4 pr-2 active:bg-ink-800/60">
                    <Text className="min-w-0 flex-1 text-[15px] text-ink-100">
                      {HEALTH_ICON[String(e.values.saludable)] ?? ''} {String(e.values.que ?? '')}
                    </Text>
                    {kcalOf(e) > 0 && <Text className="text-sm text-ink-300">{kcalOf(e)} kcal</Text>}
                  </Pressable>
                  <TrashButton what={`la comida (${String(e.values.que ?? '')})`} onDelete={() => useDb.getState().deleteEntry(e.id)} />
                </View>
              ))}
            </View>
          );
        })}
      </View>

      <PrimaryButton label="Anotar comida" onPress={() => setEditing({})} />

      <Section title="Resumen de la semana" subtitle="Lunes a domingo, de la semana que estás mirando">
        <View className="h-24 flex-row items-end gap-1.5">
          {week.days.map((d) => (
            <View key={d.date} className="h-full flex-1 items-center justify-end gap-1">
              <View
                className={`w-full rounded-t ${d.kcal > calorieGoal ? 'bg-kurenai-400' : 'bg-shu-500'}`}
                style={{ height: `${d.kcal > 0 ? Math.max((d.kcal / maxDay) * 75, 4) : 0}%` }}
              />
              <Text className={`text-[11px] ${d.date === date ? 'font-bold text-shu-300' : 'text-ink-500'}`}>
                {formatDay(d.date, { weekday: 'narrow' })}
              </Text>
            </View>
          ))}
        </View>

        <Text className="text-sm font-semibold text-ink-100">
          Saludable{' '}
          <Text className="font-normal text-ink-400">
            · {week.total} {week.total === 1 ? 'comida' : 'comidas'}
          </Text>
        </Text>
        {week.total === 0 ? (
          <Text className="text-sm text-ink-500">Todavía no anotaste comidas esta semana.</Text>
        ) : (
          (['Sí', 'Más o menos', 'No', 'Sin marcar'] as const).map((h) =>
            week.health[h].length === 0 ? null : (
              <View key={h} className="gap-1">
                <Text className="text-sm font-semibold text-ink-100">
                  {HEALTH_ICON[h]} {h} <Text className="font-normal text-ink-400">({week.health[h].length})</Text>
                </Text>
                <Text className="text-xs text-ink-400">{week.health[h].map((e) => String(e.values.que ?? '')).join(' · ')}</Text>
              </View>
            ),
          )
        )}
      </Section>
    </SheetScreen>
  );
}
