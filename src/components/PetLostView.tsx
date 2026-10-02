import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { useDb } from '../lib/db';
import { formatDay, today } from '../lib/dates';
import { goToSub } from '../lib/nav';
import { useThemeColors } from '../lib/theme';
import { Empty } from './common';
import DateField from './DateField';
import PetSwitcher from './PetSwitcher';
import BackButton from './BackButton';
import ScreenTitle from './ScreenTitle';

/** Genera un cartel de "se perdió" con la foto y los datos del Perfil de la mascota activa, listo para compartir. */
export default function PetLostView() {
  const c = useThemeColors();
  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const addPetProfile = useDb((s) => s.addPetProfile);
  const profile = petProfiles.find((p) => p.id === activePetId && !p.archived);
  const posterRef = useRef<View>(null);
  const [ultimaVez, setUltimaVez] = useState('');
  const [fecha, setFecha] = useState(today());
  const [busy, setBusy] = useState(false);

  const onAddPet = () => {
    addPetProfile({ nombre: '' });
    goToSub('mascota', 'perfil');
  };

  const share = async () => {
    if (!posterRef.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(posterRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      else Alert.alert('No se pudo compartir', 'Este dispositivo no tiene la función de compartir disponible.');
    } catch {
      Alert.alert('No se pudo generar la imagen');
    }
    setBusy(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <ScreenTitle categoryId="mascota" subId="perdido" />
        </View>

        {petProfiles.some((p) => !p.archived) && <PetSwitcher onAdd={onAddPet} />}

        {!profile ? (
          <Empty>
            <Text className="text-sm text-ink-400">
              Primero completá el{' '}
              <Text className="text-shu-400 underline" onPress={() => goToSub('mascota', 'perfil')}>
                Perfil / DNI
              </Text>{' '}
              de tu mascota, con al menos el nombre y una foto.
            </Text>
          </Empty>
        ) : (
          <>
            <View className="gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
              <View>
                <Text className="mb-1 text-sm text-ink-400">¿Dónde se perdió? (opcional)</Text>
                <TextInput
                  className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
                  placeholder="Ej: Plaza Irlanda, Caballito"
                  placeholderTextColor={c['ink-500']}
                  value={ultimaVez}
                  onChangeText={setUltimaVez}
                />
              </View>
              <View>
                <Text className="mb-1 text-sm text-ink-400">Fecha</Text>
                <DateField value={fecha} onChange={setFecha} />
              </View>
              {!profile.telefono && (
                <Text className="text-xs text-gold-400">
                  No tenés un teléfono cargado. Andá a{' '}
                  <Text className="underline" onPress={() => goToSub('mascota', 'perfil')}>
                    Perfil / DNI
                  </Text>{' '}
                  para agregarlo — el cartel es mucho más útil con un contacto.
                </Text>
              )}
            </View>

            <View collapsable={false} ref={posterRef} style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#16120f' }}>
              <View style={{ backgroundColor: '#bf3b2e', paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ color: '#ede3d3', fontSize: 26, fontWeight: '700' }}>SE PERDIÓ</Text>
              </View>
              <View style={{ padding: 20, alignItems: 'center', gap: 6 }}>
                <View style={{ width: 220, height: 220, borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: '#b8934b', backgroundColor: '#2a2118', alignItems: 'center', justifyContent: 'center' }}>
                  {profile.fotoUri ? <Image source={{ uri: profile.fotoUri }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: 70 }}>🐾</Text>}
                </View>
                <Text style={{ color: '#ede3d3', fontSize: 22, fontWeight: '700', marginTop: 10 }}>{profile.nombre}</Text>
                {profile.raza && <Text style={{ color: '#c4b69c', fontSize: 14 }}>{profile.raza}</Text>}
                {!!ultimaVez && (
                  <Text style={{ color: '#c4b69c', fontSize: 13, textAlign: 'center' }}>
                    Última vez: {ultimaVez}
                    {fecha ? ` · ${formatDay(fecha, { day: 'numeric', month: 'short' })}` : ''}
                  </Text>
                )}
                {profile.telefono && (
                  <View style={{ backgroundColor: '#bf3b2e', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 10, alignItems: 'center' }}>
                    <Text style={{ color: '#ede3d3', fontSize: 13, fontWeight: '600' }}>Si lo ves, comunicate al:</Text>
                    <Text style={{ color: '#ede3d3', fontSize: 18, fontWeight: '700' }}>{profile.telefono}</Text>
                  </View>
                )}
              </View>
            </View>

            <Pressable onPress={share} disabled={busy} className="items-center justify-center rounded-lg bg-kurenai-500 py-2.5">
              <Text className="font-medium text-washi">Compartir cartel</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
