import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  dbPath: string;
  logoPath: string;
  preparedBy: string;
  approvedBy: string;
  isInitialized: boolean;
  isInitializing: boolean;
  companyName: string;
  columnColors: {
    [key: string]: string; // Key is column id, value is hex color code
  };
  calculationSettings: {
    grossPay?: { formula: string; description: string };
    others?: { formula: string; description: string };
    totalDeductions?: { formula: string; description: string };
    netPay?: { formula: string; description: string };
  };
  setDbPath: (path: string) => Promise<void>;
  setLogoPath: (path: string) => void;
  setPreparedBy: (name: string) => void;
  setApprovedBy: (name: string) => void;
  setCompanyName: (name: string) => void;
  setColumnColor: (columnId: string, color: string) => void;
  setCalculationSettings: (settings: {
    grossPay?: { formula: string; description: string };
    others?: { formula: string; description: string };
    totalDeductions?: { formula: string; description: string };
    netPay?: { formula: string; description: string };
  }) => void;
  initialize: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      dbPath: "",
      logoPath: "",
      preparedBy: "",
      approvedBy: "",
      isInitialized: false,
      isInitializing: false,
      companyName: "",
      columnColors: {},
      calculationSettings: {
        grossPay: {
          formula: "basicPay + overtime + holidayBonus - undertimeDeduction",
          description:
            "Basic pay plus overtime and holiday bonus, minus undertime deductions",
        },
        others: {
          formula: "sssLoan + pagibigLoan + partial",
          description: "Sum of SSS loan, Pag-IBIG loan, and partial payments",
        },
        totalDeductions: {
          formula:
            "sss + philHealth + pagIbig + cashAdvanceDeductions + others",
          description: "Sum of all statutory and voluntary deductions",
        },
        netPay: {
          formula: "grossPay - totalDeductions",
          description: "Gross pay minus total deductions",
        },
      },
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
              // Don't clear the path if verification fails - let the user fix it
              // set({ dbPath: "" });
            }
          } catch (error) {
            console.error("Error verifying dbPath:", error);
            // Don't clear the path on verification error
            // set({ dbPath: "" });
          }
        } else {
          // Only clear the path if explicitly set to empty
          set({ dbPath: "" });
        }
      },
      setLogoPath: (path) => set({ logoPath: path }),
      setPreparedBy: (name) => set({ preparedBy: name }),
      setApprovedBy: (name) => set({ approvedBy: name }),
      setCompanyName: (name) => set({ companyName: name }),
      setColumnColor: (columnId, color) =>
        set((state) => ({
          columnColors: {
            ...state.columnColors,
            [columnId]: color,
          },
        })),
      setCalculationSettings: (settings) =>
        set({ calculationSettings: settings }),
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

            // Set paths from persisted state
            if (state.dbPath) {
              console.log("Found persisted dbPath:", state.dbPath);
              set({ dbPath: state.dbPath });

              // Verify path exists but don't clear it if verification fails
              try {
                const exists = await window.electron.fileExists(state.dbPath);
                if (!exists) {
                  console.warn(
                    "Stored dbPath may no longer exist:",
                    state.dbPath
                  );
                  // Keep the path but log a warning - user can update if needed
                }
              } catch (error) {
                console.error("Error verifying dbPath:", error);
                // Keep the path even if verification fails
              }
            }

            // Set logo path if it exists
            if (state.logoPath) {
              set({ logoPath: state.logoPath });
            }
          }
        } catch (error) {
          console.error("Error initializing settings:", error);
          // Don't clear paths on initialization error
          // set({ dbPath: "", logoPath: "" });
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
        preparedBy: state.preparedBy,
        approvedBy: state.approvedBy,
        companyName: state.companyName,
        columnColors: state.columnColors,
        calculationSettings: state.calculationSettings,
      }),
      getStorage: () => localStorage,
    }
  )
);
