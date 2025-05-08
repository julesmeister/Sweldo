import { create } from "zustand";
import {
  isWebEnvironment,
  setFirestoreCompanyName,
} from "../lib/firestoreService";
import {
  loadAppSettingsFirestore,
  saveAppSettingsFirestore,
  AppSettingsFirestore,
} from "../model/settings_firestore";

// Define the calculation settings structure separately
export interface CalculationSettings {
  grossPay?: { formula: string; description: string };
  others?: { formula: string; description: string };
  totalDeductions?: { formula: string; description: string };
  netPay?: { formula: string; description: string };
}

// Define the shape of the settings data to be saved
export interface PersistedSettings {
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
export const defaultSettings: PersistedSettings = {
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
    if (!state.dbPath && !isWebEnvironment()) {
      // Adjusted condition: dbPath needed for local, not strictly for web if companyName exists
      console.warn(
        "[SettingsStore] _saveSettings: Cannot save settings. For local mode, dbPath is not set. For web mode, ensure companyName is set if settings are to be saved."
      );
      return;
    }
    if (isWebEnvironment() && !state.companyName) {
      console.warn(
        "[SettingsStore] _saveSettings: Cannot save to Firestore. Company name is not set."
      );
      return;
    }

    // In web mode, save to Firestore
    if (isWebEnvironment()) {
      try {
        // Construct webSettings with all fields required by AppSettingsFirestore,
        // pulling values from the current state.
        const webSettings: AppSettingsFirestore = {
          companyName: state.companyName, // Mandatory
          logoPath: state.logoPath || "", // Default to empty string if undefined
          preparedBy: state.preparedBy || "",
          approvedBy: state.approvedBy || "",
          columnColors: state.columnColors || {},
          calculationSettings: state.calculationSettings || {},
          // Optional fields from AppSettingsFirestore, provide defaults or current state if available
          theme: "light", // Default or from state if managed
          language: "en", // Default or from state if managed
          notificationsEnabled: true, // Default or from state if managed
          timeFormat: "12-hour" as const, // Default or from state if managed
        };
        await saveAppSettingsFirestore(webSettings, state.companyName);
        // console.log("Settings saved to Firestore");
      } catch (error) {
        console.error("Failed to save settings to Firestore:", error);
      }
      return;
    }

    // Desktop mode - save to local file
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
      // console.log("Settings saved to:", filePath);
    } catch (error) {
      console.error("Failed to save settings to file:", filePath, error);
      // Optionally notify the user with toast
      // toast.error("Failed to save application settings.");
    }
  };

  const loadFromFirestore = async (
    companyName: string
  ): Promise<Partial<PersistedSettings>> => {
    try {
      const appSettings = await loadAppSettingsFirestore(companyName);
      if (!appSettings) return { companyName }; // Still return companyName if no other settings found

      // Convert Firestore settings format to our settings format
      // Ensure all relevant fields from AppSettingsFirestore are mapped
      const persistedSettings: Partial<PersistedSettings> = {
        companyName: appSettings.companyName || companyName, // Prioritize appSettings but fallback
      };

      if (appSettings.logoPath !== undefined) {
        persistedSettings.logoPath = appSettings.logoPath;
      }
      if (appSettings.preparedBy !== undefined) {
        persistedSettings.preparedBy = appSettings.preparedBy;
      }
      if (appSettings.approvedBy !== undefined) {
        persistedSettings.approvedBy = appSettings.approvedBy;
      }
      if (appSettings.columnColors !== undefined) {
        persistedSettings.columnColors = appSettings.columnColors;
      }
      if (appSettings.calculationSettings !== undefined) {
        persistedSettings.calculationSettings = appSettings.calculationSettings;
      }
      // dbPath is intentionally not set from Firestore for web mode

      return persistedSettings;
    } catch (error) {
      console.error("Failed to load settings from Firestore:", error);
      return { companyName }; // Fallback to at least returning companyName on error
    }
  };

  return {
    ...defaultSettings, // Start with defaults
    isInitialized: false,

    initialize: async (initialDbPath) => {
      if (get().isInitialized) {
        // console.log("[SettingsStore Init] Already initialized. Skipping.");
        return;
      }
      // console.log("[SettingsStore Init] Initializing settings store...");
      // console.log(
      //   `[SettingsStore Init] Received initialDbPath from layout/localStorage: ${initialDbPath}`
      // );

      let loadedSettings = { ...defaultSettings };
      let successfullyLoadedFromFile = false;

      // --- First check if we're in web mode ---
      if (isWebEnvironment()) {
        // console.log("[SettingsStore Init] Detected web environment");

        // Try to load from localStorage first to get company name
        try {
          const lsState = localStorage.getItem("settings-storage");
          if (lsState) {
            const parsedLs = JSON.parse(lsState);
            if (parsedLs && parsedLs.state && parsedLs.state.companyName) {
              const companyName = parsedLs.state.companyName;
              // console.log(
              //   `[SettingsStore Init] Found company name in localStorage: ${companyName}`
              // );

              // Set company name
              loadedSettings.companyName = companyName;

              // Update the centralized company name in firestoreService
              setFirestoreCompanyName(companyName);

              // Try to load additional settings from Firestore
              // console.log(`[SettingsStore Init] Attempting to load settings from Firestore for company: ${companyName}`);
              const firestoreSettings = await loadFromFirestore(companyName);
              // console.log("[SettingsStore Init] Loaded from Firestore:", firestoreSettings);
              loadedSettings = { ...loadedSettings, ...firestoreSettings };
              successfullyLoadedFromFile = true; // Consider this a successful load for web
            }
          }
        } catch (e) {
          console.error(
            "[SettingsStore Init] Error processing localStorage in web mode:",
            e
          );
        }
        // If companyName still not set after localStorage/Firestore attempt, it must be set another way (e.g. user input)
        if (!loadedSettings.companyName) {
          console.warn(
            "[SettingsStore Init] Web mode: Company name not found in localStorage or Firestore. It must be set via UI or other means."
          );
        }

        // Set state and exit
        // console.log("[SettingsStore Init] Web mode: Final state before setting:", loadedSettings);
        set({ ...loadedSettings, isInitialized: true });
        return;
      }

      // --- Desktop mode: attempt to load from file using initialDbPath ---
      if (initialDbPath) {
        const filePath = settingsFilePath(initialDbPath);
        // console.log(
        //   "[SettingsStore Init] Attempting to load settings from derived path:",
        //   filePath
        // );
        try {
          const fileExists = await window.electron.fileExists(filePath);
          if (fileExists) {
            const fileContent = await window.electron.readFile(filePath);
            const parsedSettings = JSON.parse(fileContent) as PersistedSettings;
            // console.log(
            //   "[SettingsStore Init] Parsed settings from file:",
            //   parsedSettings
            // );

            if (
              parsedSettings &&
              typeof parsedSettings.dbPath === "string" &&
              parsedSettings.dbPath
            ) {
              // console.log(
              //   `[SettingsStore Init] Prioritizing dbPath from file: ${parsedSettings.dbPath}`
              // );
              loadedSettings = {
                ...defaultSettings,
                ...parsedSettings,
                dbPath: parsedSettings.dbPath,
              };
              successfullyLoadedFromFile = true;

              if (parsedSettings.companyName) {
                setFirestoreCompanyName(parsedSettings.companyName);
              }
            } else {
              // console.warn(
              //   `[SettingsStore Init] File loaded, but dbPath invalid/missing. Using initialDbPath (${initialDbPath}) as fallback path.`
              // );
              loadedSettings = {
                ...defaultSettings,
                ...parsedSettings,
                dbPath: initialDbPath,
              };
              successfullyLoadedFromFile = true;

              if (parsedSettings.companyName) {
                setFirestoreCompanyName(parsedSettings.companyName);
              }
            }
          } else {
            // console.log(
            //   "[SettingsStore Init] Settings file not found at derived path. Using initialDbPath as fallback."
            // );
            loadedSettings.dbPath = initialDbPath;
          }
        } catch (error) {
          console.error(
            "[SettingsStore Init] Error loading/parsing settings file. Using initialDbPath as fallback:",
            error
          );
          loadedSettings.dbPath = initialDbPath;
        }
      } else {
        // console.warn(
        //   "[SettingsStore Init] Initializing without an initialDbPath."
        // );
      }

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
              // console.log(
              //   "[SettingsStore Init] Checking localStorage for fallbacks..."
              // );
              if (
                !loadedSettings.dbPath &&
                typeof parsedLs.state.dbPath === "string" &&
                parsedLs.state.dbPath
              ) {
                loadedSettings.dbPath = parsedLs.state.dbPath;
                // console.log(
                //   "[SettingsStore Init] Using localStorage fallback for dbPath."
                // );
              }
              if (
                loadedSettings.preparedBy === "" &&
                typeof parsedLs.state.preparedBy === "string" &&
                parsedLs.state.preparedBy
              ) {
                loadedSettings.preparedBy = parsedLs.state.preparedBy;
                // console.log(
                //   "[SettingsStore Init] Using localStorage fallback for preparedBy."
                // );
              }
              if (
                loadedSettings.approvedBy === "" &&
                typeof parsedLs.state.approvedBy === "string" &&
                parsedLs.state.approvedBy
              ) {
                loadedSettings.approvedBy = parsedLs.state.approvedBy;
                // console.log(
                //   "[SettingsStore Init] Using localStorage fallback for approvedBy."
                // );
              }
              if (
                loadedSettings.companyName === "" &&
                typeof parsedLs.state.companyName === "string" &&
                parsedLs.state.companyName
              ) {
                loadedSettings.companyName = parsedLs.state.companyName;
                // console.log(
                //   "[SettingsStore Init] Using localStorage fallback for companyName."
                // );
                setFirestoreCompanyName(parsedLs.state.companyName);
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

      // console.log(
      //   "[SettingsStore Init] Final state before setting:",
      //   loadedSettings
      // );
      set({ ...loadedSettings, isInitialized: true });

      if (get().dbPath || (isWebEnvironment() && get().companyName)) {
        // Check for companyName in webMode
        // console.log(
        //   "[SettingsStore Init] Attempting initial save. dbPath:", get().dbPath, "companyName:", get().companyName
        // );
        await _saveSettings();
      } else {
        // console.warn(
        //   "[SettingsStore Init] Skipping initial save because dbPath (local) or companyName (web) is empty."
        // );
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

      // If in web mode, immediately update localStorage and Firestore
      if (isWebEnvironment()) {
        try {
          // Update centralized company name for Firestore service
          setFirestoreCompanyName(name);

          // Explicitly save to localStorage to ensure it's available on refresh
          const currentState = get();
          const stateToSave = {
            dbPath: currentState.dbPath,
            logoPath: currentState.logoPath,
            preparedBy: currentState.preparedBy,
            approvedBy: currentState.approvedBy,
            companyName: name,
            columnColors: currentState.columnColors,
            calculationSettings: currentState.calculationSettings,
          };

          localStorage.setItem(
            "settings-storage",
            JSON.stringify({
              state: stateToSave,
            })
          );

          console.log(
            `[SettingsStore] Company name '${name}' saved to localStorage`
          );
        } catch (e) {
          console.error(
            "[SettingsStore] Error saving company name to localStorage:",
            e
          );
        }
      }

      // Call the general save method to handle both web/desktop saving
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
