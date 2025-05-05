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
} from "./settings";
import {
  fetchDocument,
  saveDocument,
  fetchCollection,
  constructDocPath,
} from "../lib/firestoreService";

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
      // If settings don't exist, create defaults and save them
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
      // If settings don't exist, create defaults and save them
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
export async function loadAppSettingsFirestore(companyName: string): Promise<{
  theme: string;
  language: string;
  notificationsEnabled: boolean;
  timeFormat: "12-hour" | "24-hour";
} | null> {
  try {
    const settings = await fetchDocument<{
      theme: string;
      language: string;
      notificationsEnabled: boolean;
      timeFormat: "12-hour" | "24-hour";
    }>("settings", "app_settings", companyName);

    return settings;
  } catch (error) {
    console.error("Error loading app settings from Firestore:", error);
    return null;
  }
}

/**
 * Save application settings to Firestore
 */
export async function saveAppSettingsFirestore(
  settings: {
    theme: string;
    language: string;
    notificationsEnabled: boolean;
    timeFormat: "12-hour" | "24-hour";
  },
  companyName: string
): Promise<void> {
  try {
    await saveDocument("settings", "app_settings", settings, companyName);
  } catch (error) {
    console.error("Error saving app settings to Firestore:", error);
    throw error;
  }
}
