import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Preferencias de pantalla de este dispositivo (no son datos de la cuenta: no se sincronizan). */
export const useUiPrefs = create<{ sidebarCollapsed: boolean; toggleSidebar: () => void }>()(
  persist(
    (set) => ({
      sidebarCollapsed: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'gestion-squali-ui', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
