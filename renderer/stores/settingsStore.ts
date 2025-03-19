import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  dbPath: string;
  logoPath: string;
  isInitialized: boolean;
  isInitializing: boolean;
  setDbPath: (path: string) => Promise<void>;
  setLogoPath: (path: string) => void;
  initialize: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      dbPath: "",
      logoPath: "",
      isInitialized: false,
      isInitializing: false,
      setDbPath: async (path) => {
        console.log("Setting dbPath in settings store:", path);
        // Verify the path exists before setting
        if (path) {
          try {
            const exists = await window.electron.fileExists(path);
            if (exists) {
              set({ dbPath: path });
              // Also update localStorage directly to ensure persistence
              if (typeof window !== "undefined") {
                try {
                  const persistedState =
                    localStorage.getItem("settings-storage");
                  if (persistedState) {
                    const parsed = JSON.parse(persistedState);
                    parsed.state.dbPath = path;
                    localStorage.setItem(
                      "settings-storage",
                      JSON.stringify(parsed)
                    );
                  }
                } catch (error) {
                  console.error("Error updating persisted dbPath:", error);
                }
              }
            } else {
              console.warn("Attempted to set non-existent dbPath:", path);
              set({ dbPath: "" });
            }
          } catch (error) {
            console.error("Error verifying dbPath:", error);
            set({ dbPath: "" });
          }
        } else {
          set({ dbPath: "" });
        }
      },
      setLogoPath: (path) => set({ logoPath: path }),
      initialize: async () => {
        // Prevent multiple simultaneous initializations
        if (get().isInitialized || get().isInitializing) return;

        set({ isInitializing: true });
        console.log("Initializing settings store...");

        try {
          // Try to get from localStorage
          const persistedState = localStorage.getItem("settings-storage");
          if (persistedState) {
            const { state } = JSON.parse(persistedState);

            // Verify dbPath if it exists
            if (state.dbPath) {
              console.log("Verifying stored dbPath:", state.dbPath);
              const exists = await window.electron.fileExists(state.dbPath);
              if (exists) {
                console.log("Stored dbPath verified, setting:", state.dbPath);
                set({ dbPath: state.dbPath });
              } else {
                console.warn("Stored dbPath no longer exists:", state.dbPath);
                set({ dbPath: "" });
              }
            }

            // Set logo path if it exists
            if (state.logoPath) {
              set({ logoPath: state.logoPath });
            }
          }
        } catch (error) {
          console.error("Error initializing settings:", error);
          set({ dbPath: "", logoPath: "" });
        } finally {
          console.log("Settings store initialization complete");
          set({ isInitialized: true, isInitializing: false });
        }
      },
    }),
    {
      name: "settings-storage",
      partialize: (state) => ({
        dbPath: state.dbPath,
        logoPath: state.logoPath,
      }),
      getStorage: () => localStorage,
    }
  )
);
