import { create } from "zustand";

// Define the calculation settings structure separately
interface CalculationSettings {
  grossPay?: { formula: string; description: string };
  others?: { formula: string; description: string };
  totalDeductions?: { formula: string; description: string };
  netPay?: { formula: string; description: string };
}

// Define the shape of the settings data to be saved
interface PersistedSettings {
  dbPath: string;
  logoPath: string;
  preparedBy: string;
  approvedBy: string;
  companyName: string;
  columnColors: { [key: string]: string };
  calculationSettings: CalculationSettings; // Use the separate type
}

interface SettingsState extends PersistedSettings {
  isInitialized: boolean; // Keep track if initial load from file is done
  setDbPath: (path: string) => Promise<void>;
  setLogoPath: (path: string) => void;
  setPreparedBy: (name: string) => void;
  setApprovedBy: (name: string) => void;
  setCompanyName: (name: string) => void;
  setColumnColor: (columnId: string, color: string) => void;
  setCalculationSettings: (settings: CalculationSettings) => void; // Use the separate type
  initialize: (initialDbPath: string | null) => Promise<void>;
}

// Default values remain the same
const defaultSettings: PersistedSettings = {
  dbPath: "",
  logoPath: "",
  preparedBy: "",
  approvedBy: "",
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
      formula: "sss + philHealth + pagIbig + cashAdvanceDeductions + others",
      description: "Sum of all statutory and voluntary deductions",
    },
    netPay: {
      formula: "grossPay - totalDeductions",
      description: "Gross pay minus total deductions",
    },
  },
};

const settingsFilePath = (dbPath: string): string =>
  `${dbPath}/SweldoDB/settings/app_settings.json`;

export const useSettingsStore = create<SettingsState>()((set, get) => {
  // Internal helper to save settings to file
  const _saveSettings = async () => {
    const state = get();
    if (!state.dbPath) {
      console.warn("Cannot save settings: dbPath is not set.");
      return; // Don't save if dbPath is missing
    }

    const settingsToSave: PersistedSettings = {
      dbPath: state.dbPath,
      logoPath: state.logoPath,
      preparedBy: state.preparedBy,
      approvedBy: state.approvedBy,
      companyName: state.companyName,
      columnColors: state.columnColors,
      calculationSettings: state.calculationSettings,
    };

    const filePath = settingsFilePath(state.dbPath);
    const dirPath = `${state.dbPath}/SweldoDB/settings`;

    try {
      await window.electron.ensureDir(dirPath);
      await window.electron.writeFile(
        filePath,
        JSON.stringify(settingsToSave, null, 2) // Pretty print
      );
      console.log("Settings saved to:", filePath);
    } catch (error) {
      console.error("Failed to save settings to file:", filePath, error);
      // Optionally notify the user with toast
      // toast.error("Failed to save application settings.");
    }
  };

  return {
    ...defaultSettings, // Start with defaults
    isInitialized: false,

    initialize: async (initialDbPath) => {
      if (get().isInitialized) return; // Prevent re-initialization
      console.log("Initializing settings store from file...");

      let loadedSettings = { ...defaultSettings };

      if (initialDbPath) {
        const filePath = settingsFilePath(initialDbPath);
        console.log("Attempting to load settings from:", filePath);
        try {
          const fileExists = await window.electron.fileExists(filePath);
          if (fileExists) {
            const fileContent = await window.electron.readFile(filePath);
            const parsedSettings = JSON.parse(fileContent);
            // Basic validation might be good here
            loadedSettings = { ...defaultSettings, ...parsedSettings };
            console.log("Settings loaded successfully.");
          } else {
            console.log("Settings file not found, using defaults.");
            // If file not found, ensure dbPath is at least set to the initial one provided
            loadedSettings.dbPath = initialDbPath;
          }
        } catch (error) {
          console.error(
            "Error loading or parsing settings file, using defaults:",
            error
          );
          // Ensure dbPath is set even if loading fails
          loadedSettings.dbPath = initialDbPath;
        }
      } else {
        console.warn("Initializing settings store without an initial dbPath.");
      }

      set({ ...loadedSettings, isInitialized: true });

      // Attempt an initial save if dbPath is now set (covers case where file didn't exist)
      if (get().dbPath) {
        await _saveSettings();
      }
    },

    // --- Setters --- Call _saveSettings after updating state

    setDbPath: async (path) => {
      // Basic validation: Check if path is non-empty
      if (!path) {
        console.warn("Attempted to set an empty dbPath. Ignoring.");
        return; // Or handle as needed, maybe clear other settings?
      }
      // Optional: Verify path existence before setting? Depends on UX desired.
      // For now, set it directly and save.
      set({ dbPath: path });
      await _saveSettings();
    },

    setLogoPath: (path) => {
      set({ logoPath: path });
      _saveSettings();
    },

    setPreparedBy: (name) => {
      set({ preparedBy: name });
      _saveSettings();
    },

    setApprovedBy: (name) => {
      set({ approvedBy: name });
      _saveSettings();
    },

    setCompanyName: (name) => {
      set({ companyName: name });
      _saveSettings();
    },

    setColumnColor: (columnId, color) => {
      set((state) => ({
        columnColors: {
          ...state.columnColors,
          [columnId]: color,
        },
      }));
      _saveSettings();
    },

    setCalculationSettings: (settings) => {
      set({ calculationSettings: settings });
      _saveSettings();
    },
  };
});
