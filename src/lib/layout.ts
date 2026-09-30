import { useSyncExternalStore } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const DESKTOP_MIN_WIDTH = 768;

const subscribeNothing = () => () => {};
// false al pre-renderizar (export estático) y true en el cliente, sin desajustes al hidratar.
const useIsClient = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

// Barras de desplazamiento finas y del color del modo actual en la PC (las del navegador desentonan).
// Se inyecta solo en web: en el celular no existen y NativeWind no entiende estos selectores.
const SCROLLBAR_CSS = `
* { scrollbar-width: thin; scrollbar-color: rgb(var(--ink-700)) transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgb(var(--ink-700)); border-radius: 8px; }
::-webkit-scrollbar-thumb:hover { background: rgb(var(--ink-600)); }
`;
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('app-scrollbars')) {
  const style = document.createElement('style');
  style.id = 'app-scrollbars';
  style.textContent = SCROLLBAR_CSS;
  document.head.appendChild(style);
}

/** App de PC (Electron o navegador con pantalla ancha): barra lateral fija en vez del menú ☰. */
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  const isClient = useIsClient();
  return isClient && Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}
