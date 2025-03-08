import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  dbPath: string;
  logoPath: string;
  setDbPath: (path: string) => void;
  setLogoPath: (path: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dbPath: '',
      logoPath: '',
      setDbPath: (path) => set({ dbPath: path }),
      setLogoPath: (path) => set({ logoPath: path }),
    }),
    {
      name: 'settings-storage',
    }
  )
);