import { usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { COLOR_CLASSES } from '../config/categories';
import { useAuth } from '../lib/auth';
import { useDb } from '../lib/db';
import { useMenuCategories } from '../lib/names';
import Avatar from './Avatar';

function NavLink({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`mx-2 flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${active ? 'bg-shu-500/20' : ''}`}>
      <Text className="text-lg">{icon}</Text>
      <Text className={`text-sm font-semibold ${active ? 'text-ink-100' : 'text-ink-400'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Contenido del menú ☰ del celular: tu foto y nombre arriba (entrada a Ajustes, sin engranaje),
 * Hoy/Mes, y todas las categorías con acordeón para sus subcategorías.
 * `onNavigate` recibe la ruta; cada plataforma decide cómo navegar.
 */
export default function NavMenu({ onNavigate }: { onNavigate: (href: string) => void }) {
  const pathname = usePathname();
  const [, currentCat, currentSub] = /^\/c\/([^/]+)\/([^/]+)/.exec(pathname) ?? [];
  // La categoría actual arranca desplegada; lo que el usuario abra o cierre a mano tiene prioridad.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const { session } = useAuth();
  const profile = useDb((s) => s.userProfile[0]);
  const email = session?.user.email ?? '';
  const fullName = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ');
  const inSettings = pathname === '/ajustes';
  const categories = useMenuCategories();

  return (
    <View>
      <Pressable
        onPress={() => onNavigate('/ajustes')}
        accessibilityLabel="Perfil y ajustes"
        className={`mx-2 mb-2 flex-row items-center gap-3 rounded-xl px-3 py-3 ${inSettings ? 'bg-shu-500/20' : 'active:bg-ink-800/60'}`}>
        <Avatar profile={profile} email={email} size={44} />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-ink-100">
            {fullName || email}
          </Text>
          <Text className="text-xs text-ink-400">Ver perfil y ajustes</Text>
        </View>
      </Pressable>

      <NavLink icon="📅" label="Hoy" active={pathname === '/'} onPress={() => onNavigate('/')} />
      <NavLink icon="📈" label="Mes" active={pathname === '/mes'} onPress={() => onNavigate('/mes')} />

      <View className="mx-4 my-2 h-px bg-ink-800" />

      {categories.map((cat) => {
        const isOpen = toggled[cat.id] ?? cat.id === currentCat;
        const colors = COLOR_CLASSES[cat.color];
        // Categoría con hoja propia: una sola entrada, directo a la hoja (sin desplegar secciones).
        if (cat.landing) {
          const active = cat.id === currentCat;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onNavigate(`/c/${cat.id}/${cat.landing}`)}
              className={`mx-2 flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${active ? 'bg-shu-500/20' : 'active:bg-ink-800/60'}`}>
              <Text className="text-lg">{cat.icon}</Text>
              <Text className={`flex-1 text-sm font-medium ${active ? 'font-semibold text-ink-100' : 'text-ink-200'}`}>{cat.name}</Text>
            </Pressable>
          );
        }
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
              <View className="ml-7 border-l border-ink-800 pl-2">
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
    </View>
  );
}
