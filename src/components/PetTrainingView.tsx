import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDb } from '../lib/db';
import { goToSub } from '../lib/nav';
import { Empty } from './common';
import PetSwitcher from './PetSwitcher';
import TrainingPlan from './TrainingPlan';
import BackButton from './BackButton';

const NIVELES = 5;

/** Plan de adiestramiento por etapas + comandos individuales (por mascota), con nivel de dominio (0 a 5) y sesiones practicadas. */
export default function PetTrainingView() {
  const [nombre, setNombre] = useState('');
  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const addPetProfile = useDb((s) => s.addPetProfile);
  const addPetCommand = useDb((s) => s.addPetCommand);
  const archivePetCommand = useDb((s) => s.archivePetCommand);
  const updatePetCommand = useDb((s) => s.updatePetCommand);
  const commands = useDb((s) => s.petCommands);
  const hasPets = petProfiles.some((p) => !p.archived);
  const profile = petProfiles.find((p) => p.id === activePetId && !p.archived);
  const active = commands.filter((c) => !c.archived && c.petId === activePetId).sort((a, b) => a.createdAt - b.createdAt);

  const onAddPet = () => {
    addPetProfile({ nombre: '' });
    goToSub('mascota', 'perfil');
  };

  const add = () => {
    if (!nombre.trim() || !activePetId) return;
    addPetCommand(activePetId, nombre);
    setNombre('');
  };

  const remove = (id: string, name: string) => {
    Alert.alert(`¿Borrar el comando "${name}"?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => archivePetCommand(id) },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="gap-5 pb-10 pt-4">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <View>
            <Text className="text-sm text-pink-400">🐾 Mascota</Text>
            <Text className="text-2xl font-bold text-ink-100">🎓 Entrenamiento</Text>
          </View>
        </View>

        {hasPets && <PetSwitcher onAdd={onAddPet} />}

        {!hasPets ? (
          <Empty>
            <Text className="text-sm text-ink-400">
              Primero completá el{' '}
              <Text className="text-shu-400 underline" onPress={() => goToSub('mascota', 'perfil')}>
                Perfil / DNI
              </Text>{' '}
              de tu mascota.
            </Text>
          </Empty>
        ) : (
          <>
            {profile && <TrainingPlan profile={profile} />}

            <View>
              <Text className="mb-2 font-semibold text-ink-100">Comandos individuales</Text>
              <Text className="mb-3 text-xs text-ink-500">Para trucos o comandos sueltos que no están en el plan de arriba.</Text>
            </View>

            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-base text-ink-100"
                placeholder="Nuevo comando, ej: Sentado"
                placeholderTextColor="#877a61"
                value={nombre}
                onChangeText={setNombre}
              />
              <Pressable onPress={add} disabled={!nombre.trim()} className={`shrink-0 items-center justify-center rounded-lg bg-shu-500 px-4 py-2.5 ${!nombre.trim() ? 'opacity-50' : ''}`}>
                <Text className="font-medium text-washi">+ Agregar</Text>
              </Pressable>
            </View>

            {active.length === 0 ? (
              <Empty>Todavía no cargaste ningún comando. Agregá el primero arriba.</Empty>
            ) : (
              <View className="gap-2">
                {active.map((c) => (
                  <View key={c.id} className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
                    <View className="mb-2 flex-row items-center justify-between">
                      <Text className="font-medium text-ink-100">{c.nombre}</Text>
                      <Pressable onPress={() => remove(c.id, c.nombre)} className="px-2 py-1" accessibilityLabel="Borrar comando">
                        <Text className="text-ink-500">✕</Text>
                      </Pressable>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <View className="flex-1 flex-row gap-1">
                        {Array.from({ length: NIVELES }, (_, i) => {
                          const on = i < c.nivel;
                          return (
                            <Pressable
                              key={i}
                              onPress={() => updatePetCommand(c.id, { nivel: on && i === c.nivel - 1 ? i : i + 1 })}
                              accessibilityLabel={`Nivel ${i + 1}${on ? ' (alcanzado)' : ''}`}
                              className={`h-3 flex-1 rounded-full ${on ? 'bg-gold-500' : 'bg-ink-800'}`}
                            />
                          );
                        })}
                      </View>
                      <Text className="w-16 shrink-0 text-right text-xs text-ink-400">
                        {c.nivel} / {NIVELES}
                      </Text>
                    </View>
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="text-xs text-ink-500">
                        {c.sesiones} sesión{c.sesiones !== 1 ? 'es' : ''}
                      </Text>
                      <Pressable onPress={() => updatePetCommand(c.id, { sesiones: c.sesiones + 1 })}>
                        <Text className="text-xs text-shu-400">+ Registrar sesión</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
