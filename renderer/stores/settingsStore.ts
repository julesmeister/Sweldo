import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  dbPath: string;
  logoPath: string;
  setDbPath: (path: string) => void;
  setLogoPath: (path: string) => void;
}

// Helper to get initial dbPath from localStorage
const getInitialDbPath = () => {
  if (typeof window === "undefined") return "";
  try {
    const persistedState = localStorage.getItem("settings-storage");
    if (persistedState) {
      const { state } = JSON.parse(persistedState);
      return state.dbPath || "";
    }
  } catch (error) {
    console.error("Error reading persisted settings:", error);
  }
  return "";
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dbPath: getInitialDbPath(),
      logoPath: "",
      setDbPath: (path) => {
        console.log("Setting dbPath in settings store:", path);
        set({ dbPath: path });
        // Also update localStorage directly to ensure persistence
        if (typeof window !== "undefined") {
          try {
            const persistedState = localStorage.getItem("settings-storage");
            if (persistedState) {
              const parsed = JSON.parse(persistedState);
              parsed.state.dbPath = path;
              localStorage.setItem("settings-storage", JSON.stringify(parsed));
            }
          } catch (error) {
            console.error("Error updating persisted dbPath:", error);
          }
        }
      },
      setLogoPath: (path) => set({ logoPath: path }),
    }),
    {
      name: "settings-storage",
      partialize: (state) => ({
        dbPath: state.dbPath,
        logoPath: state.logoPath,
      }),
    }
  )
);
