import { vars } from 'nativewind';
import { Platform, useColorScheme } from 'react-native';

import { useUiPrefs } from './uiPrefs';

export type Scheme = 'light' | 'dark';
export type Appearance = Scheme | 'system';

/**
 * Paleta "Shu no Michi". La escala `ink` se invierte entre modos (950 = fondo, 100 = texto
 * principal), así las 400+ clases `bg-ink-*` / `text-ink-*` de la app cambian solas.
 * Los tonos claros de los acentos (300/400) se oscurecen en modo claro para que se lean
 * sobre papel. Los 500/600 (fondos de botones) son iguales en los dos modos.
 */
const PALETTES = {
  dark: {
    'ink-100': '#ede3d3',
    'ink-200': '#dcd0bc',
    'ink-300': '#c4b69c',
    'ink-400': '#a6987c',
    'ink-500': '#877a61',
    'ink-600': '#5e5242',
    'ink-700': '#35291f',
    'ink-800': '#2a2118',
    'ink-900': '#1f1a16',
    'ink-950': '#16120f',
    'shu-300': '#e08575',
    'shu-400': '#d3624e',
    'gold-300': '#dcc28a',
    'gold-400': '#c9a860',
    'moss-300': '#8fb894',
    'moss-400': '#6b9a72',
    'kurenai-300': '#c98a7c',
    'kurenai-400': '#a85445',
  },
  light: {
    'ink-100': '#1e1812',
    'ink-200': '#3a2f24',
    'ink-300': '#54473a',
    'ink-400': '#75674f',
    'ink-500': '#978a70',
    'ink-600': '#b9ad96',
    'ink-700': '#d7cbb6',
    'ink-800': '#e6dccb',
    'ink-900': '#fbf7f0',
    'ink-950': '#f3ece0',
    'shu-300': '#a5301f',
    'shu-400': '#b8392b',
    'gold-300': '#86652a',
    'gold-400': '#9c7a35',
    'moss-300': '#3d6b44',
    'moss-400': '#4c7a52',
    'kurenai-300': '#8f3b2d',
    'kurenai-400': '#7a3226',
  },
} satisfies Record<Scheme, Record<string, string>>;

export type ThemeColors = (typeof PALETTES)['dark'];

const toRgb = (hex: string) => `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;

// Variables CSS que usa tailwind.config.js (`rgb(var(--ink-950) / <alpha-value>)`).
const VARS = {
  dark: vars(Object.fromEntries(Object.entries(PALETTES.dark).map(([k, v]) => [`--${k}`, toRgb(v)]))),
  light: vars(Object.fromEntries(Object.entries(PALETTES.light).map(([k, v]) => [`--${k}`, toRgb(v)]))),
};

/** Modo que corresponde ahora: el elegido en Ajustes o, en "Automático", el del sistema. */
export function useScheme(): Scheme {
  const appearance = useUiPrefs((s) => s.appearance);
  const system = useColorScheme();
  if (appearance === 'system') return system === 'light' ? 'light' : 'dark';
  return appearance;
}

/** Estilo para el contenedor raíz: define las variables de color de toda la app. */
export const themeVars = (scheme: Scheme) => VARS[scheme];

/**
 * En web, las ventanas emergentes (Modal) se dibujan fuera del contenedor raíz: las variables
 * también se definen en la página entera. `color-scheme` hace que los controles del navegador
 * (ej. el selector de fecha) sigan el modo.
 */
export function applyPageTheme(scheme: Scheme) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(PALETTES[scheme])) root.setProperty(`--${k}`, toRgb(v));
  root.colorScheme = scheme;
  document.body.style.backgroundColor = PALETTES[scheme]['ink-950'];
}

/** Colores en hexadecimal para lo que no acepta clases (StyleSheet, props de color, navegación). */
export function useThemeColors(): ThemeColors {
  return PALETTES[useScheme()];
}
