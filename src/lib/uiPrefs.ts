import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Appearance = 'system' | 'light' | 'dark';

/** Preferencias de pantalla de este dispositivo (no son datos de la cuenta: no se sincronizan). */
export const useUiPrefs = create<{
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
}>()(
  persist(
    (set) => ({
      sidebarCollapsed: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      // La app nació oscura: se mantiene así hasta que se elija otra cosa en Ajustes.
      appearance: 'dark',
      setAppearance: (appearance) => set({ appearance }),
    }),
    { name: 'gestion-squali-ui', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
