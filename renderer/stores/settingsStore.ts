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
  // Add recovery method
  recoverSettings: () => Promise<boolean>;
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

/**
 * Safe localStorage getter with error handling and type safety
 */
const safeGetFromLocalStorage = (key: string): any => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
    }
    return null;
  } catch (e) {
    console.error(`[SettingsStore] Error reading ${key} from localStorage:`, e);
    return null;
  }
};

/**
 * Safe localStorage setter with error handling
 */
const safeSetToLocalStorage = (key: string, value: any): boolean => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
    return false;
  } catch (e) {
    console.error(`[SettingsStore] Error saving ${key} to localStorage:`, e);
    return false;
  }
};

/**
 * Backup critical settings to sessionStorage as an additional safeguard
 */
const backupSettingsToSession = (
  settings: Partial<PersistedSettings>
): void => {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.setItem(
        "settings-backup",
        JSON.stringify({
          timestamp: new Date().toISOString(),
          data: settings,
        })
      );
    }
  } catch (e) {
    console.error(
      `[SettingsStore] Error backing up settings to sessionStorage:`,
      e
    );
  }
};

/**
 * Retrieve backup settings from sessionStorage if available
 */
const getBackupSettingsFromSession = (): Partial<PersistedSettings> | null => {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const backup = sessionStorage.getItem("settings-backup");
      if (backup) {
        const parsed = JSON.parse(backup);
        return parsed.data;
      }
    }
    return null;
  } catch (e) {
    console.error(
      `[SettingsStore] Error retrieving backup settings from sessionStorage:`,
      e
    );
    return null;
  }
};

/**
 * Merge settings with preference for non-empty values
 * This ensures we don't overwrite existing values with empty ones
 */
const mergeSafelyPreservingValues = (
  target: Partial<PersistedSettings>,
  source: Partial<PersistedSettings>
): Partial<PersistedSettings> => {
  const result = { ...target };

  // Only copy values from source that are not empty strings, null, or undefined
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key as keyof PersistedSettings];

      // Skip empty strings, null, or undefined values
      if (
        sourceValue === "" ||
        sourceValue === null ||
        sourceValue === undefined
      ) {
        continue;
      }

      // For objects like calculationSettings, do deep merge
      if (
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        sourceValue !== null
      ) {
        result[key as keyof PersistedSettings] = {
          ...result[key as keyof PersistedSettings],
          ...sourceValue,
        } as any;
      } else {
        result[key as keyof PersistedSettings] = sourceValue as any;
      }
    }
  }

  return result;
};

export const useSettingsStore = create<SettingsState>()((set, get) => {
  // Internal helper to save settings to file
  const _saveSettings = async () => {
    const state = get();
    if (!state.dbPath && !isWebEnvironment()) {
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

    // Backup critical settings to sessionStorage
    backupSettingsToSession({
      companyName: state.companyName,
      dbPath: state.dbPath,
      preparedBy: state.preparedBy,
      approvedBy: state.approvedBy,
    });

    // In web mode, save to Firestore and localStorage
    if (isWebEnvironment()) {
      try {
        // Save to localStorage first for reliability
        const stateToSave = {
          dbPath: state.dbPath,
          logoPath: state.logoPath,
          preparedBy: state.preparedBy,
          approvedBy: state.approvedBy,
          companyName: state.companyName,
          columnColors: state.columnColors,
          calculationSettings: state.calculationSettings,
        };

        safeSetToLocalStorage("settings-storage", { state: stateToSave });

        // Then save to Firestore
        const webSettings: AppSettingsFirestore = {
          companyName: state.companyName,
          logoPath: state.logoPath || "",
          preparedBy: state.preparedBy || "",
          approvedBy: state.approvedBy || "",
          columnColors: state.columnColors || {},
          calculationSettings: state.calculationSettings || {},
          theme: "light",
          language: "en",
          notificationsEnabled: true,
          timeFormat: "12-hour" as const,
        };
        await saveAppSettingsFirestore(webSettings, state.companyName);
        console.log(
          "[SettingsStore] Settings saved to localStorage and Firestore"
        );
      } catch (error) {
        console.error("[SettingsStore] Failed to save settings:", error);
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

      // Also save critical settings to localStorage as backup
      safeSetToLocalStorage("settings-storage", { state: settingsToSave });

      console.log(
        "[SettingsStore] Settings saved to file and localStorage backup"
      );
    } catch (error) {
      console.error(
        "[SettingsStore] Failed to save settings to file:",
        filePath,
        error
      );
      // Try to save to localStorage as fallback
      safeSetToLocalStorage("settings-storage", { state: settingsToSave });
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
        console.log("[SettingsStore Init] Already initialized. Skipping.");
        return;
      }
      console.log("[SettingsStore Init] Initializing settings store...");

      // Start with default values
      let loadedSettings = { ...defaultSettings };
      let successfullyLoadedFromFile = false;

      // Create a record of settings sources for debugging
      const settingsSources = {
        fromSessionStorage: false,
        fromLocalStorage: false,
        fromFirestore: false,
        fromFile: false,
        fromInitialDbPath: false,
      };

      // First try to recover from session storage (highest priority)
      const sessionBackup = getBackupSettingsFromSession();
      if (sessionBackup) {
        console.log(
          "[SettingsStore Init] Found backup in sessionStorage:",
          Object.keys(sessionBackup).filter(
            (k) => sessionBackup[k as keyof PersistedSettings]
          )
        );
        loadedSettings = mergeSafelyPreservingValues(
          loadedSettings,
          sessionBackup
        );
        settingsSources.fromSessionStorage = true;
      }

      // --- Check if we're in web mode ---
      if (isWebEnvironment()) {
        console.log("[SettingsStore Init] Detected web environment");

        // Try to load from localStorage first to get company name and other settings
        const lsData = safeGetFromLocalStorage("settings-storage");
        if (lsData && lsData.state) {
          const lsSettings = lsData.state;
          console.log(
            "[SettingsStore Init] Found settings in localStorage:",
            Object.keys(lsSettings).filter((k) => lsSettings[k])
          );

          // Apply localStorage settings, but don't overwrite session backup with empty values
          loadedSettings = mergeSafelyPreservingValues(
            loadedSettings,
            lsSettings
          );
          settingsSources.fromLocalStorage = true;

          // If we have a company name, set it centrally and try to load from Firestore
          if (lsSettings.companyName) {
            setFirestoreCompanyName(lsSettings.companyName);

            try {
              console.log(
                `[SettingsStore Init] Loading settings from Firestore for company: ${lsSettings.companyName}`
              );
              const firestoreSettings = await loadFromFirestore(
                lsSettings.companyName
              );
              if (
                firestoreSettings &&
                Object.keys(firestoreSettings).length > 0
              ) {
                console.log(
                  "[SettingsStore Init] Found settings in Firestore:",
                  Object.keys(firestoreSettings).filter(
                    (k) => firestoreSettings[k as keyof PersistedSettings]
                  )
                );

                // Apply Firestore settings, but don't overwrite with empty values
                loadedSettings = mergeSafelyPreservingValues(
                  loadedSettings,
                  firestoreSettings
                );
                settingsSources.fromFirestore = true;
                successfullyLoadedFromFile = true;
              }
            } catch (e) {
              console.error(
                "[SettingsStore Init] Error loading from Firestore:",
                e
              );
            }
          }
        }

        // If we still don't have a company name, it will need to be set via UI
        if (!loadedSettings.companyName) {
          console.warn(
            "[SettingsStore Init] Web mode: Company name not found in any storage."
          );
        }

        console.log(
          `[SettingsStore Init] Web mode initialization complete. Sources:`,
          settingsSources
        );
        console.log(`[SettingsStore Init] Final settings:`, {
          companyName: loadedSettings.companyName ? "✓" : "✗",
          dbPath: loadedSettings.dbPath ? "✓" : "✗",
          preparedBy: loadedSettings.preparedBy ? "✓" : "✗",
          approvedBy: loadedSettings.approvedBy ? "✓" : "✗",
        });

        // Set state and exit for web mode
        set({ ...loadedSettings, isInitialized: true });

        // Save settings to ensure they're properly stored
        if (loadedSettings.companyName) {
          await _saveSettings();
        }

        return;
      }

      // --- Desktop mode: attempt to load from file using initialDbPath ---
      if (initialDbPath) {
        settingsSources.fromInitialDbPath = true;
        const filePath = settingsFilePath(initialDbPath);
        console.log(
          "[SettingsStore Init] Attempting to load settings from:",
          filePath
        );

        try {
          const fileExists = await window.electron.fileExists(filePath);
          if (fileExists) {
            const fileContent = await window.electron.readFile(filePath);
            const parsedSettings = JSON.parse(fileContent) as PersistedSettings;
            console.log("[SettingsStore Init] Found settings in file");

            if (parsedSettings && typeof parsedSettings === "object") {
              // If settings file has a valid dbPath, use it; otherwise use initialDbPath
              const effectiveDbPath = parsedSettings.dbPath || initialDbPath;

              // Merge settings from file with defaults, prioritizing file values
              loadedSettings = mergeSafelyPreservingValues(
                loadedSettings,
                parsedSettings
              );

              // Always ensure we have a dbPath
              loadedSettings.dbPath = effectiveDbPath;

              settingsSources.fromFile = true;
              successfullyLoadedFromFile = true;

              if (parsedSettings.companyName) {
                setFirestoreCompanyName(parsedSettings.companyName);
              }
            }
          } else {
            console.log(
              "[SettingsStore Init] Settings file not found. Using initialDbPath."
            );
            loadedSettings.dbPath = initialDbPath;
          }
        } catch (error) {
          console.error(
            "[SettingsStore Init] Error reading settings file:",
            error
          );
          loadedSettings.dbPath = initialDbPath;
        }
      } else {
        console.warn(
          "[SettingsStore Init] Initializing without an initialDbPath."
        );
      }

      // --- Try localStorage as fallback for any empty critical values ---
      if (
        !successfullyLoadedFromFile ||
        !loadedSettings.dbPath ||
        loadedSettings.preparedBy === "" ||
        loadedSettings.approvedBy === "" ||
        loadedSettings.companyName === ""
      ) {
        const lsData = safeGetFromLocalStorage("settings-storage");
        if (lsData && lsData.state) {
          console.log(
            "[SettingsStore Init] Checking localStorage for fallbacks"
          );

          // Only use values from localStorage that aren't empty and aren't already set
          loadedSettings = mergeSafelyPreservingValues(
            loadedSettings,
            lsData.state
          );

          if (lsData.state.companyName && !loadedSettings.companyName) {
            setFirestoreCompanyName(lsData.state.companyName);
            settingsSources.fromLocalStorage = true;
          }
        }
      }

      console.log(
        `[SettingsStore Init] Desktop mode initialization complete. Sources:`,
        settingsSources
      );
      console.log(`[SettingsStore Init] Final settings:`, {
        companyName: loadedSettings.companyName ? "✓" : "✗",
        dbPath: loadedSettings.dbPath ? "✓" : "✗",
        preparedBy: loadedSettings.preparedBy ? "✓" : "✗",
        approvedBy: loadedSettings.approvedBy ? "✓" : "✗",
      });

      // Set the final state
      set({ ...loadedSettings, isInitialized: true });

      // Save settings to all storage mechanisms
      if (
        loadedSettings.dbPath ||
        (isWebEnvironment() && loadedSettings.companyName)
      ) {
        console.log(
          "[SettingsStore Init] Performing initial save to persist settings"
        );
        await _saveSettings();
      } else {
        console.warn(
          "[SettingsStore Init] Skipping initial save because required fields missing"
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
      if (!name || name.trim() === "") {
        console.warn(
          "[SettingsStore] Attempted to set an empty company name. Ignoring."
        );
        return;
      }

      console.log(`[SettingsStore] Setting company name to: ${name}`);

      // Get current state to check if this is an actual change
      const currentState = get();
      const isNewValue = currentState.companyName !== name;

      // Update the store state
      set({ companyName: name });

      // Update centralized company name for Firestore service
      setFirestoreCompanyName(name);

      // Create a backup to sessionStorage (survives page refreshes)
      backupSettingsToSession({
        ...currentState,
        companyName: name,
      });

      // Save to localStorage for persistence (works in both web and desktop mode)
      try {
        // Get the rest of the state to preserve all settings
        const stateToSave: PersistedSettings = {
          dbPath: currentState.dbPath,
          logoPath: currentState.logoPath,
          preparedBy: currentState.preparedBy,
          approvedBy: currentState.approvedBy,
          companyName: name,
          columnColors: currentState.columnColors,
          calculationSettings: currentState.calculationSettings,
        };

        // Save to localStorage directly to ensure it's immediately available
        safeSetToLocalStorage("settings-storage", { state: stateToSave });

        console.log(
          `[SettingsStore] Company name '${name}' saved to localStorage`
        );

        // In desktop mode, also create a backup in a special key
        if (!isWebEnvironment()) {
          safeSetToLocalStorage("settings-backup", {
            timestamp: new Date().toISOString(),
            state: stateToSave,
          });
        }
      } catch (e) {
        console.error(
          "[SettingsStore] Error saving company name to localStorage:",
          e
        );
      }

      // Only trigger a full save if the value actually changed
      if (isNewValue) {
        _saveSettings();
      }
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

    // Add recovery method
    recoverSettings: async () => {
      console.log(
        "[SettingsStore] Attempting to recover settings from backups..."
      );

      let recoveredSettings: Partial<PersistedSettings> = {};
      let recoverySuccessful = false;

      // Source 1: Try sessionStorage (highest priority, most recent)
      try {
        const sessionBackup = getBackupSettingsFromSession();
        if (sessionBackup && Object.keys(sessionBackup).length > 0) {
          console.log(
            "[SettingsStore] Found session backup:",
            Object.keys(sessionBackup).filter(
              (k) => sessionBackup[k as keyof PersistedSettings]
            )
          );
          recoveredSettings = { ...recoveredSettings, ...sessionBackup };
          recoverySuccessful = true;
        }
      } catch (e) {
        console.error("[SettingsStore] Error accessing session backup:", e);
      }

      // Source 2: Try special backup in localStorage
      try {
        const lsBackup = safeGetFromLocalStorage("settings-backup");
        if (
          lsBackup &&
          lsBackup.state &&
          Object.keys(lsBackup.state).length > 0
        ) {
          console.log(
            "[SettingsStore] Found localStorage backup from:",
            lsBackup.timestamp
          );
          // Don't overwrite values we already recovered from sessionStorage
          recoveredSettings = mergeSafelyPreservingValues(
            recoveredSettings,
            lsBackup.state
          );
          recoverySuccessful = true;
        }
      } catch (e) {
        console.error(
          "[SettingsStore] Error accessing localStorage backup:",
          e
        );
      }

      // Source 3: Try regular localStorage
      try {
        const lsSettings = safeGetFromLocalStorage("settings-storage");
        if (
          lsSettings &&
          lsSettings.state &&
          Object.keys(lsSettings.state).length > 0
        ) {
          console.log("[SettingsStore] Found settings in localStorage");
          // Don't overwrite values we already recovered from other sources
          recoveredSettings = mergeSafelyPreservingValues(
            recoveredSettings,
            lsSettings.state
          );
          recoverySuccessful = true;
        }
      } catch (e) {
        console.error(
          "[SettingsStore] Error accessing localStorage settings:",
          e
        );
      }

      // Source 4 (Web mode only): Try Firestore if we recovered a company name
      if (isWebEnvironment() && recoveredSettings.companyName) {
        try {
          console.log(
            `[SettingsStore] Attempting to recover from Firestore with company: ${recoveredSettings.companyName}`
          );
          const firestoreSettings = await loadFromFirestore(
            recoveredSettings.companyName
          );
          if (firestoreSettings && Object.keys(firestoreSettings).length > 0) {
            console.log("[SettingsStore] Found settings in Firestore");
            // Don't overwrite values we already recovered from other sources
            recoveredSettings = mergeSafelyPreservingValues(
              recoveredSettings,
              firestoreSettings
            );
            recoverySuccessful = true;
          }
        } catch (e) {
          console.error("[SettingsStore] Error recovering from Firestore:", e);
        }
      }

      // Source 5 (Desktop mode only): Try to find settings file
      if (!isWebEnvironment() && recoveredSettings.dbPath) {
        try {
          const filePath = settingsFilePath(recoveredSettings.dbPath);
          console.log(
            `[SettingsStore] Checking for settings file at: ${filePath}`
          );

          const fileExists = await window.electron.fileExists(filePath);
          if (fileExists) {
            const fileContent = await window.electron.readFile(filePath);
            const fileSettings = JSON.parse(fileContent) as PersistedSettings;
            console.log("[SettingsStore] Found settings in file");

            // Don't overwrite values we already recovered
            recoveredSettings = mergeSafelyPreservingValues(
              recoveredSettings,
              fileSettings
            );
            recoverySuccessful = true;
          }
        } catch (e) {
          console.error(
            "[SettingsStore] Error recovering from settings file:",
            e
          );
        }
      }

      if (recoverySuccessful) {
        console.log(
          "[SettingsStore] Recovery successful. Recovered values:",
          Object.keys(recoveredSettings).filter(
            (k) => recoveredSettings[k as keyof PersistedSettings]
          )
        );

        // Apply recovered settings to current state, preserving any existing non-empty values
        const currentState = get();
        const mergedState = mergeSafelyPreservingValues(
          currentState,
          recoveredSettings
        );

        // Update state
        set(mergedState);

        // Set the company name for Firestore if it was recovered
        if (recoveredSettings.companyName) {
          setFirestoreCompanyName(recoveredSettings.companyName);
        }

        // Save to ensure recovery is persisted
        await _saveSettings();

        return true;
      } else {
        console.log(
          "[SettingsStore] Recovery unsuccessful. No backup sources found."
        );
        return false;
      }
    },
  };
});
