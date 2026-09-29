import { usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CATEGORIES, COLOR_CLASSES } from '../config/categories';

function NavLink({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`mx-2 flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${active ? 'bg-shu-500/20' : ''}`}>
      <Text className="text-lg">{icon}</Text>
      <Text className={`text-sm font-semibold ${active ? 'text-ink-100' : 'text-ink-400'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Contenido del menú (el drawer ☰ del celular y la barra fija de la PC): Hoy/Mes arriba,
 * todas las categorías con acordeón para sus subcategorías, y Ajustes abajo.
 * `onNavigate` recibe la ruta; cada plataforma decide cómo navegar.
 */
export default function NavMenu({ onNavigate }: { onNavigate: (href: string) => void }) {
  const pathname = usePathname();
  const [, currentCat, currentSub] = /^\/c\/([^/]+)\/([^/]+)/.exec(pathname) ?? [];
  // La categoría actual arranca desplegada; lo que el usuario abra o cierre a mano tiene prioridad.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <View>
      <NavLink icon="📅" label="Hoy" active={pathname === '/'} onPress={() => onNavigate('/')} />
      <NavLink icon="📈" label="Mes" active={pathname === '/mes'} onPress={() => onNavigate('/mes')} />

      <View className="mx-4 my-2 h-px bg-ink-800" />

      {CATEGORIES.map((cat) => {
        const isOpen = toggled[cat.id] ?? cat.id === currentCat;
        const colors = COLOR_CLASSES[cat.color];
        return (
          <View key={cat.id}>
            <Pressable
              onPress={() => setToggled((t) => ({ ...t, [cat.id]: !isOpen }))}
              className="mx-2 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-ink-800/60">
              <Text className="text-lg">{cat.icon}</Text>
              <Text className={`flex-1 text-sm font-medium ${isOpen || cat.id === currentCat ? colors.text : 'text-ink-200'}`}>{cat.name}</Text>
              <Text className="text-xs text-ink-500">{isOpen ? '▼' : '▶'}</Text>
            </Pressable>
            {isOpen && (
              <View className="ml-7 border-l pl-2" style={{ borderColor: '#2a2118' }}>
                {cat.subcategories.map((sub) => {
                  const active = cat.id === currentCat && sub.id === currentSub;
                  return (
                    <Pressable
                      key={sub.id}
                      onPress={() => onNavigate(`/c/${cat.id}/${sub.id}`)}
                      className={`flex-row items-center gap-2 rounded-lg px-3 py-2 ${active ? 'bg-shu-500/20' : 'active:bg-ink-800/60'}`}>
                      <Text>{sub.icon}</Text>
                      <Text className={`text-sm ${active ? 'font-semibold text-ink-100' : 'text-ink-300'}`}>{sub.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      <View className="mx-4 my-2 h-px bg-ink-800" />

      <NavLink icon="⚙️" label="Ajustes" active={pathname === '/ajustes'} onPress={() => onNavigate('/ajustes')} />
    </View>
  );
}
