import { vars } from 'nativewind';
import { Platform, useColorScheme } from 'react-native';

import { useDb } from './db';
import { useUiPrefs } from './uiPrefs';

export type Scheme = 'light' | 'dark';
export type Appearance = Scheme | 'system';

/** Texto sobre fondos sólidos de acento (`text-washi`): fijo, igual en los dos modos. Mismo valor que en tailwind.config.js. */
export const WASHI = '#fafafa';

/**
 * Paleta neutra. La escala `ink` se invierte entre modos (950 = fondo, 100 = texto
 * principal), así las 400+ clases `bg-ink-*` / `text-ink-*` de la app cambian solas.
 * Los tonos claros de los colores (300/400) se oscurecen en modo claro para que se lean
 * sobre fondo blanco. El color de la app (`shu`) sale de ACCENTS, más abajo.
 */
const PALETTES = {
  dark: {
    'ink-100': '#f4f4f5',
    'ink-200': '#e4e4e7',
    'ink-300': '#d4d4d8',
    'ink-400': '#a1a1aa',
    'ink-500': '#71717a',
    'ink-600': '#52525b',
    'ink-700': '#3f3f46',
    'ink-800': '#27272a',
    'ink-900': '#18181b',
    'ink-950': '#0b0b0d',
    'gold-300': '#dcc28a',
    'gold-400': '#c9a860',
    'moss-300': '#8fb894',
    'moss-400': '#6b9a72',
    'kurenai-300': '#c98a7c',
    'kurenai-400': '#a85445',
  },
  light: {
    'ink-100': '#18181b',
    'ink-200': '#27272a',
    'ink-300': '#3f3f46',
    'ink-400': '#52525b',
    'ink-500': '#71717a',
    'ink-600': '#a1a1aa',
    'ink-700': '#d4d4d8',
    'ink-800': '#e4e4e7',
    'ink-900': '#ffffff',
    'ink-950': '#f4f4f5',
    'gold-300': '#86652a',
    'gold-400': '#9c7a35',
    'moss-300': '#3d6b44',
    'moss-400': '#4c7a52',
    'kurenai-300': '#8f3b2d',
    'kurenai-400': '#7a3226',
  },
} satisfies Record<Scheme, Record<string, string>>;

/**
 * Colores de la app que se pueden elegir en Ajustes → Apariencia (se guarda en la cuenta).
 * `500`/`600` son los fondos de botones (iguales en los dos modos); `dark`/`light` son los
 * tonos 300 y 400 de cada modo (textos y detalles). El rojo es el de siempre.
 */
export const ACCENTS = [
  { id: 'rojo', label: 'Rojo', 500: '#bf3b2e', 600: '#a5301f', dark: ['#e08575', '#d3624e'], light: ['#a5301f', '#b8392b'] },
  { id: 'naranja', label: 'Naranja', 500: '#ea580c', 600: '#c2410c', dark: ['#fdba74', '#fb923c'], light: ['#9a3412', '#c2410c'] },
  { id: 'ambar', label: 'Ámbar', 500: '#d97706', 600: '#b45309', dark: ['#fcd34d', '#fbbf24'], light: ['#92400e', '#b45309'] },
  { id: 'verde', label: 'Verde', 500: '#16a34a', 600: '#15803d', dark: ['#86efac', '#4ade80'], light: ['#166534', '#15803d'] },
  { id: 'turquesa', label: 'Turquesa', 500: '#0d9488', 600: '#0f766e', dark: ['#5eead4', '#2dd4bf'], light: ['#115e59', '#0f766e'] },
  { id: 'azul', label: 'Azul', 500: '#2563eb', 600: '#1d4ed8', dark: ['#93c5fd', '#60a5fa'], light: ['#1e40af', '#1d4ed8'] },
  { id: 'indigo', label: 'Índigo', 500: '#4f46e5', 600: '#4338ca', dark: ['#a5b4fc', '#818cf8'], light: ['#3730a3', '#4338ca'] },
  { id: 'violeta', label: 'Violeta', 500: '#7c3aed', 600: '#6d28d9', dark: ['#c4b5fd', '#a78bfa'], light: ['#5b21b6', '#6d28d9'] },
  { id: 'rosa', label: 'Rosa', 500: '#db2777', 600: '#be185d', dark: ['#f9a8d4', '#f472b6'], light: ['#9d174d', '#be185d'] },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
type Accent = (typeof ACCENTS)[number];

const DEFAULT_ACCENT: Accent = ACCENTS[0];

/** El color guardado en el perfil; si no hay (o es uno que esta versión no conoce), el rojo. */
const accentOf = (id: unknown): Accent => ACCENTS.find((a) => a.id === id) ?? DEFAULT_ACCENT;

export type ThemeColors = (typeof PALETTES)['dark'] & Record<'shu-300' | 'shu-400' | 'shu-500' | 'shu-600', string>;

const toRgb = (hex: string) => `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;

// Se arman una sola vez por combinación de modo + color (no en cada render): así los `useMemo`
// que dependen de los colores no se recalculan de más.
const COLORS_CACHE = new Map<string, ThemeColors>();
const VARS_CACHE = new Map<string, ReturnType<typeof vars>>();

function themeColors(scheme: Scheme, accentId: AccentId): ThemeColors {
  const key = `${scheme}:${accentId}`;
  let colors = COLORS_CACHE.get(key);
  if (!colors) {
    const a = accentOf(accentId);
    colors = { ...PALETTES[scheme], 'shu-300': a[scheme][0], 'shu-400': a[scheme][1], 'shu-500': a[500], 'shu-600': a[600] };
    COLORS_CACHE.set(key, colors);
  }
  return colors;
}

/** Modo que corresponde ahora: el elegido en Ajustes o, en "Automático", el del sistema. */
export function useScheme(): Scheme {
  const appearance = useUiPrefs((s) => s.appearance);
  const system = useColorScheme();
  if (appearance === 'system') return system === 'light' ? 'light' : 'dark';
  return appearance;
}

/** Color de la app elegido en Ajustes (viaja con la cuenta). Sin sesión o sin elegir: rojo. */
export function useAccent(): AccentId {
  const saved = useDb((s) => s.userProfile[0]?.accent);
  return accentOf(saved).id;
}

/** El 500 del color de la app, para lo que vive fuera de las pantallas (ej. la notificación del paseo). */
export const currentAccentColor = () => accentOf(useDb.getState().userProfile[0]?.accent)[500];

/** Estilo para el contenedor raíz: define las variables de color de toda la app. */
export function themeVars(scheme: Scheme, accentId: AccentId) {
  const key = `${scheme}:${accentId}`;
  let v = VARS_CACHE.get(key);
  if (!v) {
    // Variables CSS que usa tailwind.config.js (`rgb(var(--ink-950) / <alpha-value>)`).
    v = vars(Object.fromEntries(Object.entries(themeColors(scheme, accentId)).map(([k, hex]) => [`--${k}`, toRgb(hex)])));
    VARS_CACHE.set(key, v);
  }
  return v;
}

/**
 * En web, las ventanas emergentes (Modal) se dibujan fuera del contenedor raíz: las variables
 * también se definen en la página entera. `color-scheme` hace que los controles del navegador
 * (ej. el selector de fecha) sigan el modo.
 */
export function applyPageTheme(scheme: Scheme, accentId: AccentId) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const colors = themeColors(scheme, accentId);
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(colors)) root.setProperty(`--${k}`, toRgb(v));
  root.colorScheme = scheme;
  document.body.style.backgroundColor = colors['ink-950'];
}

/** Colores en hexadecimal para lo que no acepta clases (StyleSheet, props de color, navegación). */
export function useThemeColors(): ThemeColors {
  return themeColors(useScheme(), useAccent());
}

/** Un color hexadecimal con transparencia (0 a 1), para estilos que no aceptan clases. */
export const withAlpha = (hex: string, alpha: number) => `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
