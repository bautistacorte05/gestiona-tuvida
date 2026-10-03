import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';

import { COLOR_CLASSES } from '../config/categories';
import Avatar from './Avatar';
import { useAuth } from '../lib/auth';
import { useDb } from '../lib/db';
import { categoryIcon, subIcon, TOP_ICONS, type MenuIconName } from '../lib/menuIcons';
import { useMenuCategories } from '../lib/names';
import { signOutWithConfirm } from '../lib/signOut';
import { useThemeColors } from '../lib/theme';
import { useUiPrefs } from '../lib/uiPrefs';

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 64;

/** `hint`: lo que dice el cartelito al pasar el mouse con la barra achicada. */
type Item = { id: string; icon: MenuIconName; label: string; hint: string };

const TOP_ITEMS: (Item & { href: string })[] = [
  { id: '/', href: '/', icon: TOP_ICONS.hoy, label: 'Hoy', hint: 'Hoy' },
  { id: '/mes', href: '/mes', icon: TOP_ICONS.mes, label: 'Mes', hint: 'Resumen del mes' },
];

// Efecto "Dock" de la Mac con la barra achicada: el ícono bajo el mouse crece y sus vecinos un poco.
const MAGNIFY = [1.6, 1.25, 1.1];
// Transición CSS (la barra solo existe en la PC/web).
const SMOOTH = { transitionProperty: 'transform', transitionDuration: '140ms', transitionTimingFunction: 'ease-out' } as TextStyle;

type Tip = { text: string; top: number };

function SidebarItem({
  item,
  active,
  collapsed,
  scale,
  onPress,
  onHover,
  onTip,
}: {
  item: Item;
  active: boolean;
  collapsed: boolean;
  scale: number;
  onPress: () => void;
  onHover: (id: string | null) => void;
  onTip: (tip: Tip | null) => void;
}) {
  const ref = useRef<View>(null);
  const c = useThemeColors();

  const hoverIn = () => {
    if (!collapsed) return;
    onHover(item.id);
    ref.current?.measureInWindow((_x, y, _w, h) => onTip({ text: item.hint, top: y + h / 2 }));
  };

  const hoverOut = () => {
    onHover(null);
    onTip(null);
  };

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      onHoverIn={hoverIn}
      onHoverOut={hoverOut}
      accessibilityLabel={item.hint}
      className={`mx-2 flex-row items-center rounded-xl ${collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2'} ${
        active ? 'bg-shu-500' : 'hover:bg-ink-800/70 active:bg-ink-800'
      }`}>
      <Ionicons name={item.icon} size={18} color={c['shu-400']} style={[SMOOTH, { transform: [{ scale }] }]} />
      {!collapsed && (
        <Text numberOfLines={1} className={`flex-1 text-sm ${active ? 'font-semibold text-washi' : 'text-ink-300'}`}>
          {item.label}
        </Text>
      )}
    </Pressable>
  );
}

// Barra lateral de la PC: siempre visible, se achica a una columna de íconos (con el nombre al
// pasar el mouse) o se agranda con los nombres, y recuerda la elección. Vive por encima de todas
// las pantallas, así que desde cualquier lado se va directo a cualquier otra, sin flecha para volver.
// Las categorías se pliegan como en el menú del celular (NavMenu).
export default function AppSidebar() {
  const pathname = usePathname();
  const [, currentCat] = /^\/c\/([^/]+)\/([^/]+)/.exec(pathname) ?? [];
  const categories = useMenuCategories();
  const { session } = useAuth();
  const collapsed = useUiPrefs((s) => s.sidebarCollapsed);
  const toggle = useUiPrefs((s) => s.toggleSidebar);
  const [tip, setTip] = useState<Tip | null>(null);
  const c = useThemeColors();
  const [hovered, setHovered] = useState<string | null>(null);

  // La categoría actual arranca desplegada; lo que se abra o cierre a mano tiene prioridad.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  // Al entrar a otra categoría se descarta lo que se haya cerrado a mano en ella, así queda abierta.
  const [prevCat, setPrevCat] = useState(currentCat);
  if (prevCat !== currentCat) {
    setPrevCat(currentCat);
    if (currentCat && toggled[currentCat] === false) {
      setToggled((t) => {
        const next = { ...t };
        delete next[currentCat];
        return next;
      });
    }
  }
  const isOpen = (catId: string) => toggled[catId] ?? catId === currentCat;

  // Orden de los íconos de la barra achicada, para el efecto Dock.
  const iconIds = [...TOP_ITEMS.map((i) => i.id), ...categories.map((cat) => `cat:${cat.id}`)];
  const hoveredIndex = hovered ? iconIds.indexOf(hovered) : -1;
  const scaleFor = (id: string) => {
    if (!collapsed || hoveredIndex < 0) return 1;
    return MAGNIFY[Math.abs(iconIds.indexOf(id) - hoveredIndex)] ?? 1;
  };

  const email = session?.user.email ?? '';
  const profile = useDb((s) => s.userProfile[0]);
  const displayName = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || email;

  const go = (href: string) => {
    setTip(null);
    setHovered(null);
    if (href === pathname) return;
    // Todas las pantallas (también las categorías) viven en el mismo menú: se navega directo.
    router.navigate(href as never);
  };

  // Barra achicada: el ícono de una categoría agranda la barra con esa categoría abierta.
  const openCategory = (catId: string) => {
    setTip(null);
    setHovered(null);
    setToggled((t) => ({ ...t, [catId]: true }));
    if (collapsed) toggle();
  };

  const itemProps = (item: Item, active: boolean, onPress: () => void) => ({
    item,
    collapsed,
    active,
    scale: scaleFor(item.id),
    onPress,
    onHover: setHovered,
    onTip: setTip,
  });

  return (
    // zIndex: el cartelito se dibuja por fuera de la barra, encima del contenido.
    <View style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, zIndex: 10, backgroundColor: c['ink-900'], borderRightWidth: 1, borderRightColor: c['ink-800'] }}>
      <View className={`flex-row items-center pb-3 pt-4 ${collapsed ? 'justify-center' : 'justify-between pl-5 pr-2'}`}>
        {!collapsed && <Text className="text-sm font-semibold text-shu-400">Gestiona tu vida</Text>}
        <Pressable
          onPress={() => {
            setTip(null);
            toggle();
          }}
          accessibilityLabel={collapsed ? 'Agrandar menú' : 'Achicar menú'}
          className="h-8 w-8 items-center justify-center rounded-lg hover:bg-ink-800/70">
          <Text className="text-lg text-ink-400">{collapsed ? '›' : '‹'}</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false} onScroll={() => setTip(null)} scrollEventThrottle={100}>
        <View className="gap-0.5">
          {!collapsed && (
            <Text numberOfLines={1} className="px-5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Menú
            </Text>
          )}
          {TOP_ITEMS.map((item) => (
            <SidebarItem key={item.id} {...itemProps(item, pathname === item.href, () => go(item.href))} />
          ))}
        </View>

        <View className="mx-4 my-2 h-px bg-ink-800" />

        {collapsed ? (
          <View className="gap-0.5">
            {categories.map((cat) => {
              const item = { id: `cat:${cat.id}`, icon: categoryIcon(cat.id), label: cat.name, hint: cat.name };
              // Con hoja propia va directo a la hoja; si no, agranda la barra con la categoría abierta.
              const onPress = cat.landing ? () => go(`/c/${cat.id}/${cat.landing}`) : () => openCategory(cat.id);
              return <SidebarItem key={item.id} {...itemProps(item, cat.id === currentCat, onPress)} />;
            })}
          </View>
        ) : (
          categories.map((cat) => {
            // Categoría con hoja propia: una sola entrada, directo a la hoja (sin desplegar secciones).
            if (cat.landing) {
              const href = `/c/${cat.id}/${cat.landing}`;
              const item = { id: `cat:${cat.id}`, icon: categoryIcon(cat.id), label: cat.name, hint: cat.name };
              return <SidebarItem key={item.id} {...itemProps(item, cat.id === currentCat, () => go(href))} />;
            }
            const open = isOpen(cat.id);
            return (
              <View key={cat.id}>
                <Pressable
                  onPress={() => setToggled((t) => ({ ...t, [cat.id]: !open }))}
                  accessibilityLabel={cat.name}
                  className="mx-2 flex-row items-center gap-3 rounded-xl px-3 py-2 hover:bg-ink-800/70 active:bg-ink-800">
                  <Ionicons name={categoryIcon(cat.id)} size={18} color={c['shu-400']} />
                  <Text numberOfLines={1} className={`flex-1 text-sm font-medium ${cat.id === currentCat ? COLOR_CLASSES[cat.color].text : 'text-ink-200'}`}>
                    {cat.name}
                  </Text>
                  <Text className="text-xs text-ink-500">{open ? '▼' : '▶'}</Text>
                </Pressable>
                {open && (
                  <View className="mb-1 ml-6 gap-0.5 border-l border-ink-800">
                    {cat.subcategories.map((sub) => {
                      const href = `/c/${cat.id}/${sub.id}`;
                      const item = { id: href, icon: subIcon(cat.id, sub.id), label: sub.name, hint: `${cat.name} · ${sub.name}` };
                      return <SidebarItem key={href} {...itemProps(item, pathname === href, () => go(href))} />;
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* La foto de perfil es la entrada a Ajustes (no hay ítem de engranaje). */}
      <View className={`flex-row items-center border-t border-ink-800 py-3 ${collapsed ? 'justify-center' : 'gap-2 pl-3 pr-2'}`}>
        <Pressable
          onPress={() => go('/ajustes')}
          accessibilityLabel="Perfil y ajustes"
          className={`flex-row items-center rounded-xl ${collapsed ? 'p-1' : 'flex-1 gap-3 p-1 pr-2'} ${pathname === '/ajustes' ? 'bg-shu-500/20' : 'hover:bg-ink-800/70'}`}>
          <View style={{ borderRadius: 20, borderWidth: 2, borderColor: pathname === '/ajustes' ? c['shu-500'] : 'transparent' }}>
            <Avatar profile={profile} email={email} size={32} />
          </View>
          {!collapsed && (
            <Text numberOfLines={1} className={`flex-1 text-xs ${pathname === '/ajustes' ? 'font-semibold text-ink-100' : 'text-ink-300'}`}>
              {displayName}
            </Text>
          )}
        </Pressable>
        {!collapsed && (
          <Pressable onPress={() => void signOutWithConfirm()} accessibilityLabel="Cerrar sesión" className="rounded-lg px-2 py-1 hover:bg-ink-800/70">
            <Text className="text-xs text-kurenai-300">Salir</Text>
          </Pressable>
        )}
      </View>

      {tip && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: COLLAPSED_WIDTH + 6, top: tip.top - 15, height: 30, justifyContent: 'center' }}
          className="rounded-lg border border-ink-700 bg-ink-900 px-3">
          <Text numberOfLines={1} className="text-sm text-ink-100">
            {tip.text}
          </Text>
        </View>
      )}
    </View>
  );
}
