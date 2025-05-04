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
      if (get().isInitialized) return;
      console.log("[SettingsStore Init] Initializing settings store...");
      console.log(
        `[SettingsStore Init] Received initialDbPath from layout/localStorage: ${initialDbPath}`
      );

      let loadedSettings = { ...defaultSettings };
      let successfullyLoadedFromFile = false;

      // --- Attempt to load from file using initialDbPath ---
      if (initialDbPath) {
        const filePath = settingsFilePath(initialDbPath);
        console.log(
          "[SettingsStore Init] Attempting to load settings from derived path:",
          filePath
        );
        try {
          const fileExists = await window.electron.fileExists(filePath);
          if (fileExists) {
            const fileContent = await window.electron.readFile(filePath);
            const parsedSettings = JSON.parse(fileContent) as PersistedSettings;
            console.log(
              "[SettingsStore Init] Parsed settings from file:",
              parsedSettings
            );

            // *** CRUCIAL CHANGE: Prioritize dbPath FROM THE FILE ***
            if (
              parsedSettings &&
              typeof parsedSettings.dbPath === "string" &&
              parsedSettings.dbPath
            ) {
              console.log(
                `[SettingsStore Init] Prioritizing dbPath from file: ${parsedSettings.dbPath}`
              );
              loadedSettings = {
                ...defaultSettings,
                ...parsedSettings,
                dbPath: parsedSettings.dbPath,
              };
              successfullyLoadedFromFile = true;
            } else {
              // File exists but doesn't contain a valid dbPath, use initialDbPath as fallback for path, but load other settings
              console.warn(
                `[SettingsStore Init] File loaded, but dbPath invalid/missing. Using initialDbPath (${initialDbPath}) as fallback path.`
              );
              loadedSettings = {
                ...defaultSettings,
                ...parsedSettings,
                dbPath: initialDbPath,
              };
              successfullyLoadedFromFile = true; // Still count as loaded for other settings
            }
          } else {
            console.log(
              "[SettingsStore Init] Settings file not found at derived path. Using initialDbPath as fallback."
            );
            // If file not found, set dbPath to the initial one provided
            loadedSettings.dbPath = initialDbPath;
          }
        } catch (error) {
          console.error(
            "[SettingsStore Init] Error loading/parsing settings file. Using initialDbPath as fallback:",
            error
          );
          // Ensure dbPath is set to the initial one even if loading fails
          loadedSettings.dbPath = initialDbPath;
        }
      } else {
        console.warn(
          "[SettingsStore Init] Initializing without an initialDbPath."
        );
        // No initial path, rely solely on localStorage fallback later if needed
      }

      // --- One-time LocalStorage Fallback (Only if file wasn't loaded successfully OR certain fields are still default) ---
      if (
        !successfullyLoadedFromFile ||
        loadedSettings.preparedBy === "" ||
        loadedSettings.approvedBy === "" ||
        loadedSettings.companyName === ""
      ) {
        try {
          const lsState = localStorage.getItem("settings-storage");
          if (lsState) {
            const parsedLs = JSON.parse(lsState);
            if (parsedLs && parsedLs.state) {
              console.log(
                "[SettingsStore Init] Checking localStorage for fallbacks..."
              );
              // Fallback for dbPath ONLY if not loaded from file and not provided initially
              if (
                !loadedSettings.dbPath &&
                typeof parsedLs.state.dbPath === "string" &&
                parsedLs.state.dbPath
              ) {
                loadedSettings.dbPath = parsedLs.state.dbPath;
                console.log(
                  "[SettingsStore Init] Using localStorage fallback for dbPath."
                );
              }
              // Fallback for other specific fields if they are still default
              if (
                loadedSettings.preparedBy === "" &&
                typeof parsedLs.state.preparedBy === "string" &&
                parsedLs.state.preparedBy
              ) {
                loadedSettings.preparedBy = parsedLs.state.preparedBy;
                console.log(
                  "[SettingsStore Init] Using localStorage fallback for preparedBy."
                );
              }
              if (
                loadedSettings.approvedBy === "" &&
                typeof parsedLs.state.approvedBy === "string" &&
                parsedLs.state.approvedBy
              ) {
                loadedSettings.approvedBy = parsedLs.state.approvedBy;
                console.log(
                  "[SettingsStore Init] Using localStorage fallback for approvedBy."
                );
              }
              if (
                loadedSettings.companyName === "" &&
                typeof parsedLs.state.companyName === "string" &&
                parsedLs.state.companyName
              ) {
                loadedSettings.companyName = parsedLs.state.companyName;
                console.log(
                  "[SettingsStore Init] Using localStorage fallback for companyName."
                );
              }
            }
          }
        } catch (e) {
          console.error(
            "[SettingsStore Init] Error processing localStorage fallback:",
            e
          );
        }
      }
      // --- End LocalStorage Fallback ---

      console.log(
        "[SettingsStore Init] Final state before setting:",
        loadedSettings
      );
      set({ ...loadedSettings, isInitialized: true });

      // Attempt an initial save IF dbPath is now set correctly
      if (get().dbPath) {
        console.log(
          "[SettingsStore Init] Attempting initial save with dbPath:",
          get().dbPath
        );
        await _saveSettings();
      } else {
        console.warn(
          "[SettingsStore Init] Skipping initial save because dbPath is empty."
        );
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
