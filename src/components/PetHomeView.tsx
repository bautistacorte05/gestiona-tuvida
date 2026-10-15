import { useMemo, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';

import { formatDay, today } from '../lib/dates';
import { useDb } from '../lib/db';
import { goToSub } from '../lib/nav';
import { healthDue, mealsOn, petAge, petDay, petWeek } from '../lib/pets';
import { useThemeColors } from '../lib/theme';
import PetSwitcher from './PetSwitcher';
import { Hero, PrimaryButton, Section, SheetScreen, SmallButton } from './sheets/kit';

const SHORTCUTS = [
  { subId: 'paseos', icon: '🦮', label: 'Paseos' },
  { subId: 'alimento', icon: '🦴', label: 'Alimentación' },
  { subId: 'salud', icon: '🩺', label: 'Salud' },
  { subId: 'entrenamiento', icon: '🎓', label: 'Entrenamiento' },
  { subId: 'perfil', icon: '🪪', label: 'Perfil / DNI' },
  { subId: 'perdido', icon: '🚨', label: 'Modo perdido' },
] as const;

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const dueText = (dias: number) =>
  dias < 0 ? `vencida hace ${-dias} ${-dias === 1 ? 'día' : 'días'}` : dias === 0 ? 'es hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;

/** Panel de inicio de Mascota: resumen de la mascota activa y accesos a todo lo demás. */
export default function PetHomeView() {
  const c = useThemeColors();
  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const entries = useDb((s) => s.entries);
  const walks = useDb((s) => s.petWalks);
  const pet = petProfiles.find((p) => p.id === activePetId && !p.archived);
  const now = today();
  const [weighing, setWeighing] = useState(false);
  const [kgText, setKgText] = useState('');

  const due = useMemo(() => (pet ? healthDue(entries, pet.id, now).filter((d) => d.dias <= 60).slice(0, 3) : []), [entries, pet, now]);
  const week = useMemo(() => (pet ? petWeek(entries, walks, pet.id, now) : []), [entries, walks, pet, now]);
  const todayWalks = pet ? petDay(entries, walks, pet.id, now) : undefined;
  const meals = pet ? mealsOn(entries, pet.id, now) : 0;

  const onAdd = () => {
    useDb.getState().addPetProfile({ nombre: '' });
    goToSub('mascota', 'perfil');
  };

  if (!pet) {
    return (
      <SheetScreen categoryId="mascota">
        <PetSwitcher onAdd={onAdd} />
        <View className="items-center gap-3 rounded-2xl border border-dashed border-ink-800 p-8">
          <Text className="text-4xl">🐾</Text>
          <Text className="text-center text-sm text-ink-400">Todavía no agregaste ninguna mascota.</Text>
          <PrimaryButton label="Agregar mi mascota" onPress={onAdd} />
        </View>
      </SheetScreen>
    );
  }

  const pesos = pet.pesos ?? [];
  const lastKg = pesos[pesos.length - 1];
  const prevKg = pesos[pesos.length - 2];
  const recent = pesos.slice(-8);
  const maxKg = Math.max(...recent.map((p) => p.kg), 1);
  const minKg = Math.min(...recent.map((p) => p.kg));
  const age = petAge(pet.nacimiento, now);
  const weekKm = week.reduce((s, d) => s + d.km, 0);
  const weekWalks = week.reduce((s, d) => s + d.walks, 0);
  const weekMin = week.reduce((s, d) => s + d.minutes, 0);
  const maxWalks = Math.max(...week.map((d) => d.walks), 1);
  const dec = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

  const saveWeight = () => {
    const kg = Number(kgText.replace(',', '.'));
    if (!(kg > 0)) return;
    useDb.getState().addPetWeight(pet.id, Math.round(kg * 10) / 10, now);
    setKgText('');
    setWeighing(false);
  };

  return (
    <SheetScreen categoryId="mascota">
      <PetSwitcher onAdd={onAdd} />

      <Hero title="Mascota activa">
        <View className="flex-row items-center gap-4">
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-ink-800">
            {pet.fotoUri ? <Image source={{ uri: pet.fotoUri }} style={{ width: 80, height: 80 }} /> : <Text className="text-4xl">🐾</Text>}
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-2xl font-bold text-ink-100">
              {pet.nombre || 'Sin nombre'}
            </Text>
            <Text className="mt-0.5 text-sm text-ink-300">{[pet.raza, age, lastKg ? `${dec(lastKg.kg)} kg` : ''].filter(Boolean).join(' · ') || 'Completá su perfil'}</Text>
          </View>
        </View>
      </Hero>

      <Section title="⏰ Próximos controles" subtitle={due.length === 0 ? 'Nada pendiente. Cargá vacunas y controles en Salud con su próxima dosis.' : undefined}>
        {due.map((d) => (
          <Pressable key={d.id} onPress={() => goToSub('mascota', 'salud')} className="flex-row items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-950 px-3 py-2.5 active:opacity-70">
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-[15px] font-semibold text-ink-100">
                {d.nombre}
              </Text>
              <Text className="mt-0.5 text-xs text-ink-400">{formatDay(d.fecha, { weekday: 'short', day: 'numeric', month: 'long' })}</Text>
            </View>
            <Text className={`text-xs font-semibold ${d.dias < 0 ? 'text-kurenai-400' : d.dias <= 7 ? 'text-shu-300' : 'text-ink-300'}`}>{dueText(d.dias)}</Text>
          </Pressable>
        ))}
      </Section>

      <View className="gap-2">
        <Text className="text-[17px] font-bold text-ink-100">Hoy</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={() => goToSub('mascota', 'paseos')} className="min-w-0 flex-1 rounded-2xl border border-ink-800 bg-ink-900 p-3.5 active:opacity-70">
            <Text className="text-2xl">🦮</Text>
            <Text className="mt-1 text-lg font-bold text-ink-100">
              {todayWalks?.walks ?? 0} {todayWalks?.walks === 1 ? 'paseo' : 'paseos'}
            </Text>
            <Text className="text-xs text-ink-400">
              {todayWalks && todayWalks.walks > 0 ? `${dec(todayWalks.km)} km · ${todayWalks.minutes} min` : 'Todavía no salieron'}
            </Text>
          </Pressable>
          <Pressable onPress={() => goToSub('mascota', 'alimento')} className="min-w-0 flex-1 rounded-2xl border border-ink-800 bg-ink-900 p-3.5 active:opacity-70">
            <Text className="text-2xl">🦴</Text>
            <Text className="mt-1 text-lg font-bold text-ink-100">
              {meals} {meals === 1 ? 'comida' : 'comidas'}
            </Text>
            <Text className="text-xs text-ink-400">{meals > 0 ? 'Anotadas hoy' : 'Todavía sin anotar'}</Text>
          </Pressable>
        </View>
        <PrimaryButton label="🛰️ Salir a pasear (en vivo)" onPress={() => goToSub('mascota', 'paseo-vivo')} />
      </View>

      <Section title="Esta semana" right={<Text className="mt-1 text-xs text-ink-400">paseos por día</Text>}>
        <View className="flex-row gap-4">
          <View>
            <Text className="text-xl font-bold text-ink-100">{weekWalks}</Text>
            <Text className="text-xs text-ink-400">paseos</Text>
          </View>
          <View>
            <Text className="text-xl font-bold text-ink-100">{dec(weekKm)}</Text>
            <Text className="text-xs text-ink-400">km</Text>
          </View>
          <View>
            <Text className="text-xl font-bold text-ink-100">{weekMin}</Text>
            <Text className="text-xs text-ink-400">minutos</Text>
          </View>
        </View>
        <View className="h-20 flex-row items-end gap-1.5">
          {week.map((d, i) => (
            <View key={d.date} className="h-full flex-1 items-center justify-end gap-1">
              <View className={`w-full rounded-t ${d.walks > 0 ? 'bg-shu-500' : 'bg-ink-800'}`} style={{ height: `${d.walks > 0 ? Math.max((d.walks / maxWalks) * 70, 12) : 6}%` }} />
              <Text className={`text-[11px] ${d.date === now ? 'font-bold text-shu-300' : 'text-ink-500'}`}>{WEEKDAYS[i]}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section
        title="⚖️ Peso"
        right={<SmallButton label={weighing ? 'Cancelar' : '+ Pesar'} onPress={() => setWeighing((o) => !o)} />}>
        {lastKg ? (
          <Text className="text-sm text-ink-300">
            <Text className="text-xl font-bold text-ink-100">{dec(lastKg.kg)} kg</Text>
            {'  '}
            {formatDay(lastKg.date, { day: 'numeric', month: 'short' })}
            {prevKg && Math.abs(lastKg.kg - prevKg.kg) >= 0.05 ? `  ${lastKg.kg > prevKg.kg ? '▲' : '▼'} ${dec(Math.abs(lastKg.kg - prevKg.kg))} kg` : ''}
          </Text>
        ) : (
          <Text className="text-sm text-ink-400">Todavía no anotaste su peso.</Text>
        )}
        {recent.length > 1 && (
          <View className="h-20 flex-row items-end gap-1.5">
            {recent.map((p, i) => (
              <View key={`${p.date}-${i}`} className="h-full flex-1 items-center justify-end gap-0.5">
                <Text className="text-[10px] text-ink-400">{dec(p.kg)}</Text>
                <View className="w-full rounded-t bg-shu-500" style={{ height: `${maxKg === minKg ? 50 : 25 + ((p.kg - minKg) / (maxKg - minKg)) * 50}%` }} />
              </View>
            ))}
          </View>
        )}
        {weighing && (
          <View className="flex-row items-center gap-2 border-t border-ink-800 pt-3">
            <TextInput
              className="h-10 flex-1 rounded-xl border border-ink-700 bg-ink-950 px-3 text-[15px] text-ink-100"
              keyboardType="decimal-pad"
              value={kgText}
              onChangeText={setKgText}
              placeholder="Peso de hoy en kg"
              placeholderTextColor={c['ink-600']}
              autoFocus
            />
            <SmallButton label="Guardar" strong onPress={saveWeight} />
          </View>
        )}
      </Section>

      <View className="gap-2">
        <Text className="text-[17px] font-bold text-ink-100">Todo sobre {pet.nombre || 'tu mascota'}</Text>
        <View className="flex-row flex-wrap gap-2">
          {SHORTCUTS.map((s) => (
            <Pressable
              key={s.subId}
              onPress={() => goToSub('mascota', s.subId)}
              className="min-w-[30%] flex-1 items-center gap-1 rounded-2xl border border-ink-800 bg-ink-900 px-2 py-3.5 active:opacity-70">
              <Text className="text-2xl">{s.icon}</Text>
              <Text numberOfLines={1} className="text-xs font-semibold text-ink-200">
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SheetScreen>
  );
}
