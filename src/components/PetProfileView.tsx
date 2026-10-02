import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { TRAINING_CATEGORIES, type TrainingCategory } from '../config/training';
import { useDb, type PetProfile } from '../lib/db';
import { formatDay, today } from '../lib/dates';
import { pickAndResizeImage } from '../lib/image';
import { useThemeColors } from '../lib/theme';
import DateField from './DateField';
import PetSwitcher from './PetSwitcher';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

/** Perfil de la mascota activa (foto, raza, nacimiento, teléfono) y su tarjeta tipo DNI para compartir. */
export default function PetProfileView() {
  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const addPetProfile = useDb((s) => s.addPetProfile);
  const profile = petProfiles.find((p) => p.id === activePetId && !p.archived);

  const onAddPet = () => addPetProfile({ nombre: '' });

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="mascota" subId="perfil" />
        </View>

        <PetSwitcher onAdd={onAddPet} />

        {/* La key remonta el formulario al cambiar de mascota activa, sin necesidad de sincronizar estado con un efecto. */}
        <PetProfileForm key={profile?.id ?? 'none'} profile={profile} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PetProfileForm({ profile }: { profile?: PetProfile }) {
  const c = useThemeColors();
  const updatePetProfile = useDb((s) => s.updatePetProfile);
  const archivePetProfile = useDb((s) => s.archivePetProfile);
  const cardRef = useRef<View>(null);

  const [editing, setEditing] = useState(!profile || !profile.nombre);
  const [nombre, setNombre] = useState(profile?.nombre ?? '');
  const [raza, setRaza] = useState(profile?.raza ?? '');
  const [nacimiento, setNacimiento] = useState(profile?.nacimiento ?? '');
  const [telefono, setTelefono] = useState(profile?.telefono ?? '');
  const [foto, setFoto] = useState<string | undefined>(profile?.fotoUri);
  const [tipo, setTipo] = useState<TrainingCategory | undefined>(profile?.tipoAdiestramiento);
  const [busy, setBusy] = useState(false);

  const onPickPhoto = async () => {
    const uri = await pickAndResizeImage();
    if (uri) setFoto(uri);
  };

  const cancelEdit = () => {
    // Si es una mascota recién creada sin nombre, cancelar la borra en vez de dejarla vacía en la lista.
    if (profile && !profile.nombre.trim()) {
      archivePetProfile(profile.id);
      return;
    }
    setNombre(profile?.nombre ?? '');
    setRaza(profile?.raza ?? '');
    setNacimiento(profile?.nacimiento ?? '');
    setTelefono(profile?.telefono ?? '');
    setFoto(profile?.fotoUri);
    setTipo(profile?.tipoAdiestramiento);
    setEditing(false);
  };

  const removePet = () => {
    if (!profile) return;
    Alert.alert(`¿Borrar a "${profile.nombre || 'esta mascota'}"?`, 'Se borra el perfil, no los paseos ni registros ya cargados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => archivePetProfile(profile.id) },
    ]);
  };

  const save = () => {
    if (!profile) return;
    if (!nombre.trim()) {
      Alert.alert('Falta un dato', 'Completá al menos el nombre.');
      return;
    }
    updatePetProfile(profile.id, {
      nombre: nombre.trim(),
      raza: raza.trim() || undefined,
      nacimiento: nacimiento || undefined,
      telefono: telefono.trim() || undefined,
      fotoUri: foto,
      tipoAdiestramiento: tipo,
    });
    setEditing(false);
  };

  const share = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      else Alert.alert('No se pudo compartir', 'Este dispositivo no tiene la función de compartir disponible.');
    } catch {
      Alert.alert('No se pudo generar la imagen');
    }
    setBusy(false);
  };

  if (editing) {
    return (
      <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={onPickPhoto} className="h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
            {foto ? <Image source={{ uri: foto }} style={{ width: 80, height: 80 }} /> : <Text className="text-3xl">🐾</Text>}
          </Pressable>
          <Pressable onPress={onPickPhoto} className="rounded-lg border border-ink-700 px-4 py-2.5">
            <Text className="text-ink-300">{foto ? 'Cambiar foto' : 'Agregar foto'}</Text>
          </Pressable>
        </View>
        <View>
          <Text className="mb-1 text-sm text-ink-400">Nombre</Text>
          <TextInput className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100" placeholder="Ej: Kofi" placeholderTextColor={c['ink-500']} value={nombre} onChangeText={setNombre} />
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="mb-1 text-sm text-ink-400">Raza</Text>
            <TextInput className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100" placeholder="Ej: Caniche Toy" placeholderTextColor={c['ink-500']} value={raza} onChangeText={setRaza} />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-sm text-ink-400">Nacimiento</Text>
            <DateField value={nacimiento} onChange={setNacimiento} />
          </View>
        </View>
        <View>
          <Text className="mb-1 text-sm text-ink-400">Teléfono de contacto</Text>
          <TextInput
            className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
            placeholder="Ej: 11 2345 6789"
            placeholderTextColor={c['ink-500']}
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
          />
        </View>
        <View>
          <Text className="mb-1 text-sm text-ink-400">Tipo de adiestramiento</Text>
          <View className="flex-row flex-wrap gap-2">
            {TRAINING_CATEGORIES.map((c) => {
              const selected = tipo === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setTipo(selected ? undefined : c.id)}
                  className={`rounded-full border px-3 py-1.5 ${selected ? 'border-shu-500 bg-shu-500/15' : 'border-ink-700'}`}>
                  <Text className={selected ? 'text-shu-300' : 'text-ink-300'}>
                    {c.icon} {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-1 text-xs text-ink-500">Define qué plan de pasos ve en Entrenamiento.</Text>
        </View>
        <View className="flex-row gap-2 pt-1">
          {profile && (
            <Pressable onPress={cancelEdit} className="items-center justify-center rounded-lg border border-ink-700 px-4 py-2.5">
              <Text className="text-ink-300">Cancelar</Text>
            </Pressable>
          )}
          <Pressable onPress={save} className="flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5">
            <Text className="font-medium text-washi">Guardar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!profile) return null;

  return (
    <>
      <View collapsable={false} ref={cardRef} style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: '#b8934b', backgroundColor: '#16120f' }}>
        <View style={{ flexDirection: 'row', padding: 20, gap: 16 }}>
          <View style={{ width: 96, height: 96, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#b8934b', backgroundColor: '#2a2118', alignItems: 'center', justifyContent: 'center' }}>
            {profile.fotoUri ? <Image source={{ uri: profile.fotoUri }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: 40 }}>🐾</Text>}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: '#bf3b2e', fontSize: 13, fontWeight: '600' }}>IDENTIFICACIÓN</Text>
            <Text style={{ color: '#ede3d3', fontSize: 26, fontWeight: '700' }}>{profile.nombre}</Text>
            {profile.raza && <Text style={{ color: '#c4b69c', fontSize: 13 }}>Raza: {profile.raza}</Text>}
            {profile.nacimiento && <Text style={{ color: '#c4b69c', fontSize: 13 }}>Nacimiento: {formatDay(profile.nacimiento, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>}
            {!!profile.pesos?.length && <Text style={{ color: '#c4b69c', fontSize: 13 }}>Peso: {formatKg(profile.pesos[profile.pesos.length - 1].kg)}</Text>}
          </View>
        </View>
        {profile.telefono && (
          <View style={{ backgroundColor: '#2a2118', marginHorizontal: 20, marginBottom: 16, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
            <Text style={{ color: '#bf3b2e', fontWeight: '600' }}>📞 Contacto: {profile.telefono}</Text>
          </View>
        )}
      </View>
      <View className="flex-row gap-2">
        <Pressable onPress={() => setEditing(true)} className="flex-1 items-center justify-center rounded-lg border border-ink-700 py-2.5">
          <Text className="text-ink-300">Editar</Text>
        </Pressable>
        <Pressable onPress={share} disabled={busy} className="flex-1 items-center justify-center rounded-lg bg-shu-500 py-2.5">
          <Text className="font-medium text-washi">Compartir</Text>
        </Pressable>
      </View>
      <WeightCard profile={profile} />
      <Pressable onPress={removePet} className="items-center py-1">
        <Text className="text-sm text-kurenai-400">Borrar esta mascota</Text>
      </Pressable>
    </>
  );
}

const formatKg = (kg: number) => `${kg.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`;

/** Peso actual + historial (antes era la sección "Peso"; los registros viejos se migraron acá). */
function WeightCard({ profile }: { profile: PetProfile }) {
  const c = useThemeColors();
  const [kg, setKg] = useState('');
  const history = [...(profile.pesos ?? [])].reverse();
  const current = history[0];

  const add = () => {
    const value = Number(kg.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    useDb.getState().addPetWeight(profile.id, value, today());
    setKg('');
  };

  return (
    <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-bold text-ink-100">⚖️ Peso</Text>
        {current && (
          <Text className="text-sm text-ink-400">
            <Text className="text-lg font-semibold text-ink-100">{formatKg(current.kg)}</Text> · {formatDay(current.date, { day: 'numeric', month: 'short' })}
          </Text>
        )}
      </View>
      <View className="flex-row gap-2">
        <TextInput
          className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
          placeholder="Peso de hoy en kg, ej: 8,5"
          placeholderTextColor={c['ink-500']}
          keyboardType="decimal-pad"
          value={kg}
          onChangeText={setKg}
          onSubmitEditing={add}
        />
        <Pressable onPress={add} className={`items-center justify-center rounded-lg bg-shu-500 px-4 ${kg.trim() ? '' : 'opacity-50'}`}>
          <Text className="font-medium text-washi">Registrar</Text>
        </Pressable>
      </View>
      {history.length > 1 && (
        <View className="gap-1">
          {history.slice(0, 8).map((h, i) => {
            const prev = history[i + 1];
            const diff = prev ? h.kg - prev.kg : 0;
            return (
              <View key={`${h.date}-${i}`} className="flex-row justify-between">
                <Text className="text-sm text-ink-400">{formatDay(h.date, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                <Text className="text-sm text-ink-200">
                  {formatKg(h.kg)}
                  {prev && Math.abs(diff) >= 0.01 ? (
                    <Text className={diff > 0 ? 'text-gold-300' : 'text-moss-300'}> ({diff > 0 ? '+' : '−'}{formatKg(Math.abs(diff))})</Text>
                  ) : null}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
