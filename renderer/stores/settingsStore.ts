import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  dbPath: string;
  setDbPath: (path: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dbPath: '',
      setDbPath: (path) => set({ dbPath: path }),
    }),
    {
      name: 'settings-storage',
    }
  )
);