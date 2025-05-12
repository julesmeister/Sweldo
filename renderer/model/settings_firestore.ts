/**
 * Firestore implementation for settings-related operations
 *
 * This module provides Firestore implementations for all settings-related
 * operations that mirror the local filesystem operations in settings.ts.
 *
 * IMPLEMENTATION PATTERN:
 * 1. Import interfaces from the main model file (settings.ts) rather than redefining them
 * 2. Use utility functions from firestoreService.ts for common Firestore operations
 * 3. Maintain the same function signatures as local storage but with "Firestore" suffix
 * 4. Follow the Firestore path structure from the documentation:
 *    companies/{companyName}/settings/{settingType}
 */

import {
  Settings,
  AttendanceSettings,
  EmploymentType,
  defaultAttendanceSettings,
  defaultTimeSettings,
  MonthSchedule,
  AttendanceSettingsModel,
} from "./settings";
import {
  fetchDocument,
  saveDocument,
  fetchCollection,
  constructDocPath,
  getCompanyName,
} from "../lib/firestoreService";
import { CalculationSettings } from "../stores/settingsStore"; // Import CalculationSettings

// Interface for App Settings stored in Firestore
// Mirrors PersistedSettings from settingsStore.ts, excluding dbPath
export interface AppSettingsFirestore {
  logoPath?: string; // Optional as it might not always be set
  preparedBy?: string;
  approvedBy?: string;
  companyName: string; // Should generally always be present
  columnColors?: { [key: string]: string };
  calculationSettings?: CalculationSettings;
  // Keep existing fields, make them optional if they aren't primary
  theme?: string;
  language?: string;
  notificationsEnabled?: boolean;
  timeFormat?: "12-hour" | "24-hour";
}

/**
 * Load attendance settings from Firestore
 */
export async function loadAttendanceSettingsFirestore(
  companyName: string
): Promise<AttendanceSettings> {
  try {
    const settings = await fetchDocument<AttendanceSettings>(
      "settings",
      "attendance",
      companyName
    );

    if (!settings) {
      await saveAttendanceSettingsFirestore(
        defaultAttendanceSettings,
        companyName
      );
      return defaultAttendanceSettings;
    }

    // Merge with defaults to ensure all properties exist
    return { ...defaultAttendanceSettings, ...settings };
  } catch (error) {
    console.error("Error loading attendance settings from Firestore:", error);
    return defaultAttendanceSettings;
  }
}

/**
 * Save attendance settings to Firestore
 */
export async function saveAttendanceSettingsFirestore(
  settings: AttendanceSettings,
  companyName: string
): Promise<void> {
  try {
    await saveDocument("settings", "attendance", settings, companyName);
  } catch (error) {
    console.error("Error saving attendance settings to Firestore:", error);
    throw error;
  }
}

/**
 * Load time settings (employment types) from Firestore
 */
export async function loadTimeSettingsFirestore(
  companyName: string
): Promise<EmploymentType[]> {
  try {
    const settingsDoc = await fetchDocument<{
      employmentTypes: EmploymentType[];
    }>("settings", "employment_types", companyName);

    if (!settingsDoc || !settingsDoc.employmentTypes) {
      await saveTimeSettingsFirestore(defaultTimeSettings, companyName);
      return defaultTimeSettings;
    }

    return settingsDoc.employmentTypes;
  } catch (error) {
    console.error("Error loading time settings from Firestore:", error);
    return defaultTimeSettings;
  }
}

/**
 * Save time settings (employment types) to Firestore
 */
export async function saveTimeSettingsFirestore(
  settings: EmploymentType[],
  companyName: string
): Promise<void> {
  try {
    const timeSettings = { employmentTypes: settings };
    await saveDocument(
      "settings",
      "employment_types",
      timeSettings,
      companyName
    );
  } catch (error) {
    console.error("Error saving time settings to Firestore:", error);
    throw error;
  }
}

/**
 * Load month schedule from Firestore
 */
export async function loadMonthScheduleFirestore(
  employmentType: string,
  year: number,
  month: number,
  companyName: string
): Promise<MonthSchedule | null> {
  try {
    const safeTypeName = employmentType.replace(/[^a-z0-9_-]/gi, "_");
    const docId = `${safeTypeName}_${year}_${month}`;

    const schedule = await fetchDocument<MonthSchedule>(
      "schedules",
      docId,
      companyName
    );

    return schedule || {};
  } catch (error) {
    console.error(
      `Error loading month schedule from Firestore for ${employmentType} ${year}-${month}:`,
      error
    );
    return null;
  }
}

/**
 * Save month schedule to Firestore
 */
export async function saveMonthScheduleFirestore(
  employmentType: string,
  year: number,
  month: number,
  schedule: MonthSchedule,
  companyName: string
): Promise<void> {
  try {
    if (!employmentType) {
      console.error(
        "[Firestore] saveMonthScheduleFirestore: Attempted to save schedule without employmentType."
      );
      throw new Error("Cannot save month schedule without an employment type.");
    }

    const safeTypeName = employmentType.replace(/[^a-z0-9_-]/gi, "_");
    const docId = `${safeTypeName}_${year}_${month}`;

    await saveDocument("schedules", docId, schedule, companyName);
  } catch (error) {
    console.error(
      `Error saving month schedule to Firestore for ${employmentType} ${year}-${month}:`,
      error
    );
    throw error;
  }
}

/**
 * Load application settings from Firestore
 */
export async function loadAppSettingsFirestore(
  companyName: string
): Promise<Partial<AppSettingsFirestore> | null> {
  try {
    const settings = await fetchDocument<AppSettingsFirestore>(
      "settings",
      "app_settings",
      companyName
    );
    return settings; // settings will be null if document doesn't exist
  } catch (error) {
    console.error("Error loading app settings from Firestore:", error);
    return null; // Return null on error
  }
}

/**
 * Save application settings to Firestore
 */
export async function saveAppSettingsFirestore(
  settings: AppSettingsFirestore, // Expects the full AppSettingsFirestore structure
  companyName: string
): Promise<void> {
  try {
    await saveDocument("settings", "app_settings", settings, companyName);
  } catch (error) {
    console.error("Error saving app settings to Firestore:", error);
    throw error;
  }
}

/**
 * Create a Firestore instance for the settings model
 */
export function createSettingsFirestoreInstance(
  model: AttendanceSettingsModel,
  syncYear?: number // Optional parameter for year to sync
) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting settings sync to Firestore...");
        const companyName = await getCompanyName();

        // Sync App Settings (General application settings)
        onProgress?.("Syncing general application settings...");
        if (typeof (model as any).loadPersistedAppSettings === "function") {
          const appSettingsToSync = await (
            model as any
          ).loadPersistedAppSettings();
          if (appSettingsToSync && appSettingsToSync.companyName) {
            await saveAppSettingsFirestore(
              appSettingsToSync as AppSettingsFirestore,
              companyName
            );
          } else {
            onProgress?.(
              "Skipped app settings sync to Firestore (no local data/companyName)."
            );
          }
        } else {
          onProgress?.(
            "Skipped app settings sync to Firestore (model method missing)."
          );
        }

        // Sync attendance settings
        onProgress?.("Syncing attendance settings...");
        const attendanceSettings = await model.loadAttendanceSettings();
        await saveAttendanceSettingsFirestore(attendanceSettings, companyName);

        // Sync time settings
        onProgress?.("Syncing time settings (employment types)...");
        const timeSettings = await model.loadTimeSettings();
        await saveTimeSettingsFirestore(timeSettings, companyName);

        // Sync month schedules - Use the specified year or default to current year
        const yearToSync = syncYear || new Date().getFullYear();
        onProgress?.(`Syncing month schedules for year ${yearToSync}...`);
        const employmentTypes = await model.loadTimeSettings();

        // For month schedules, we'll sync all months of the specified year
        for (const type of employmentTypes) {
          for (let month = 1; month <= 12; month++) {
            try {
              const schedule = await model.loadMonthSchedule(
                type.type,
                yearToSync,
                month
              );

              if (schedule && Object.keys(schedule).length > 0) {
                await saveMonthScheduleFirestore(
                  type.type,
                  yearToSync,
                  month,
                  schedule,
                  companyName
                );
                onProgress?.(
                  `Synced ${type.type} schedule for ${yearToSync}-${month}`
                );
              }
            } catch (monthError) {
              console.error(
                `Error syncing ${type.type} schedule for ${yearToSync}-${month}:`,
                monthError
              );
              onProgress?.(
                `Failed to sync ${type.type} schedule for ${yearToSync}-${month}`
              );
              // Continue with other months rather than failing completely
            }
          }
        }

        onProgress?.("Settings sync to Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing settings to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting settings sync from Firestore...");
        const companyName = await getCompanyName();

        // Sync App Settings from Firestore
        onProgress?.("Syncing general application settings from Firestore...");
        const firestoreAppSettings = await loadAppSettingsFirestore(
          companyName
        );
        if (firestoreAppSettings) {
          if (typeof (model as any).savePersistedAppSettings === "function") {
            await (model as any).savePersistedAppSettings(firestoreAppSettings);
          } else {
            onProgress?.(
              "Skipped saving Firestore app settings locally (model method missing)."
            );
          }
        } else {
          onProgress?.(
            "Skipped app settings sync from Firestore (no data found)."
          );
        }

        // Sync attendance settings
        onProgress?.("Syncing attendance settings from Firestore...");
        const attendanceSettings = await loadAttendanceSettingsFirestore(
          companyName
        );
        await model.saveAttendanceSettings(attendanceSettings);

        // Sync time settings
        onProgress?.(
          "Syncing time settings (employment types) from Firestore..."
        );
        const timeSettings = await loadTimeSettingsFirestore(companyName);
        await model.saveTimeSettings(timeSettings);

        // Sync month schedules
        onProgress?.("Syncing current month schedules from Firestore...");
        const employmentTypes = await model.loadTimeSettings(); // Load local types to know what schedules to fetch
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        for (const type of employmentTypes) {
          const schedule = await loadMonthScheduleFirestore(
            type.type,
            currentYear,
            currentMonth,
            companyName
          );
          if (schedule) {
            await model.saveMonthSchedule(
              type.type,
              currentYear,
              currentMonth,
              schedule
            );
          }
        }

        onProgress?.("Settings sync from Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing settings from Firestore:", error);
        throw error;
      }
    },
  };
}
