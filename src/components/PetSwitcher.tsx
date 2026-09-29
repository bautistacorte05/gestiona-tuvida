import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useDb } from '../lib/db';

/** Selector horizontal de mascota activa, para las pantallas de la sección Mascota. */
export default function PetSwitcher({ onAdd }: { onAdd: () => void }) {
  const petProfiles = useDb((s) => s.petProfiles);
  const activePetId = useDb((s) => s.activePetId);
  const setActivePet = useDb((s) => s.setActivePet);
  const pets = petProfiles.filter((p) => !p.archived);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-1">
      {pets.map((p) => {
        const active = p.id === activePetId;
        return (
          <Pressable
            key={p.id}
            onPress={() => setActivePet(p.id)}
            className={`flex-row items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 ${active ? 'border-shu-500 bg-shu-500/15' : 'border-ink-700 bg-ink-900/60'}`}>
            <View className="h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-ink-800">
              {p.fotoUri ? <Image source={{ uri: p.fotoUri }} style={{ width: 28, height: 28 }} /> : <Text className="text-sm">🐾</Text>}
            </View>
            <Text className={active ? 'font-medium text-shu-300' : 'text-ink-300'} numberOfLines={1}>
              {p.nombre || 'Sin nombre'}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onAdd} className="flex-row items-center gap-1 rounded-full border border-dashed border-ink-700 px-3 py-1.5">
        <Text className="text-ink-300">+ Agregar</Text>
      </Pressable>
    </ScrollView>
  );
}
