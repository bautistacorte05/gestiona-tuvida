import { router, usePathname } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';

import { CATEGORIES } from '../config/categories';
import { useAuth } from '../lib/auth';
import { signOutWithConfirm } from '../lib/signOut';
import { useUiPrefs } from '../lib/uiPrefs';

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 64;

/** `hint`: lo que dice el cartelito al pasar el mouse con la barra achicada (sección + pantalla). */
type Item = { href: string; icon: string; label: string; hint: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Menú',
    items: [
      { href: '/', icon: '📅', label: 'Hoy', hint: 'Hoy' },
      { href: '/mes', icon: '📈', label: 'Mes', hint: 'Resumen del mes' },
    ],
  },
  ...CATEGORIES.map((cat) => ({
    title: `${cat.icon} ${cat.name}`,
    items: cat.subcategories.map((sub) => ({ href: `/c/${cat.id}/${sub.id}`, icon: sub.icon, label: sub.name, hint: `${cat.name} · ${sub.name}` })),
  })),
];

const ALL_HREFS = [...SECTIONS.flatMap((s) => s.items.map((i) => i.href)), '/ajustes'];

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
  onHover: (href: string | null) => void;
  onTip: (tip: Tip | null) => void;
}) {
  const ref = useRef<View>(null);

  const hoverIn = () => {
    if (!collapsed) return;
    onHover(item.href);
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
      <Text className="text-base" style={[SMOOTH, { transform: [{ scale }] }]}>
        {item.icon}
      </Text>
      {!collapsed && (
        <Text numberOfLines={1} className={`flex-1 text-sm ${active ? 'font-semibold text-ink-100' : 'text-ink-300'}`}>
          {item.label}
        </Text>
      )}
    </Pressable>
  );
}

// Barra lateral de la PC: siempre visible, se achica a una columna de íconos (con el nombre al
// pasar el mouse) o se agranda con los nombres, y recuerda la elección. Vive por encima de todas
// las pantallas, así que desde cualquier lado se va directo a cualquier otra, sin flecha para volver.
export default function AppSidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const collapsed = useUiPrefs((s) => s.sidebarCollapsed);
  const toggle = useUiPrefs((s) => s.toggleSidebar);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredIndex = hovered ? ALL_HREFS.indexOf(hovered) : -1;

  const scaleFor = (href: string) => {
    if (!collapsed || hoveredIndex < 0) return 1;
    return MAGNIFY[Math.abs(ALL_HREFS.indexOf(href) - hoveredIndex)] ?? 1;
  };
  const email = session?.user.email ?? '';
  const initials = email.slice(0, 2).toUpperCase();

  const go = (href: string) => {
    setTip(null);
    setHovered(null);
    if (href === pathname) return;
    if (href.startsWith('/c/')) {
      // Entre categorías se reemplaza la pantalla: sin flecha para volver, apilarlas no sirve.
      if (pathname.startsWith('/c/')) router.replace(href as never);
      else router.push(href as never);
      return;
    }
    // Hoy/Mes/Ajustes viven debajo de las categorías: primero se cierran las que haya encima.
    if (router.canDismiss()) router.dismissAll();
    router.navigate(href as never);
  };

  const itemProps = (item: Item) => ({
    item,
    collapsed,
    active: pathname === item.href,
    scale: scaleFor(item.href),
    onPress: () => go(item.href),
    onHover: setHovered,
    onTip: setTip,
  });

  return (
    // zIndex: el cartelito se dibuja por fuera de la barra, encima del contenido.
    <View style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH, zIndex: 10, backgroundColor: '#1f1a16', borderRightWidth: 1, borderRightColor: '#2a2118' }}>
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
        {SECTIONS.map((section, i) => (
          <View key={section.title} className="gap-0.5">
            {collapsed ? (
              i > 0 && <View className="mx-4 my-2 h-px bg-ink-800" />
            ) : (
              <Text numberOfLines={1} className="px-5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                {section.title}
              </Text>
            )}
            {section.items.map((item) => (
              <SidebarItem key={item.href} {...itemProps(item)} />
            ))}
          </View>
        ))}
      </ScrollView>

      <View className="gap-1 border-t border-ink-800 py-2">
        <SidebarItem {...itemProps({ href: '/ajustes', icon: '⚙️', label: 'Ajustes', hint: 'Ajustes y cuenta' })} />
        <View className={`flex-row items-center ${collapsed ? 'justify-center py-1' : 'gap-3 px-4 py-1'}`}>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-shu-500">
            <Text className="text-xs font-bold text-ink-100">{initials}</Text>
          </View>
          {!collapsed && (
            <>
              <Text numberOfLines={1} className="flex-1 text-xs text-ink-300">
                {email}
              </Text>
              <Pressable onPress={() => void signOutWithConfirm()} accessibilityLabel="Cerrar sesión" className="rounded-lg px-2 py-1 hover:bg-ink-800/70">
                <Text className="text-xs text-kurenai-300">Salir</Text>
              </Pressable>
            </>
          )}
        </View>
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
