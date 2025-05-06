import Papa from "papaparse";
import path from "path";
import { Schedule } from "./schedule";
import { AttendanceSettingsModel as OldAttendanceSettingsModel } from "./settings_old"; // Import old implementation
import {
  loadAttendanceSettingsFirestore,
  saveAttendanceSettingsFirestore,
  loadTimeSettingsFirestore,
  saveTimeSettingsFirestore,
  loadMonthScheduleFirestore,
  saveMonthScheduleFirestore,
} from "./settings_firestore";
import {
  isWebEnvironment,
  setFirestoreCompanyName,
  getCompanyName,
} from "../lib/firestoreService";
import {
  useSettingsStore,
  PersistedSettings as StorePersistedSettings,
  defaultSettings as storeDefaultSettings,
} from "../stores/settingsStore";

export interface Settings {
  theme: string;
  language: string;
  notificationsEnabled: boolean;
  timeFormat: "12-hour" | "24-hour";
  attendance: AttendanceSettings;
}

export interface WeeklySchedule {
  dayOfWeek: number;
  timeIn: string;
  timeOut: string;
}

export interface DailySchedule {
  timeIn: string;
  timeOut: string;
  isOff?: boolean;
}

export interface MonthSchedule {
  [date: string]: DailySchedule; // Format: "YYYY-MM-DD"
}

export interface EmploymentType {
  type: string;
  hoursOfWork: number; // Standard hours of work per day
  schedules?: Schedule[];
  requiresTimeTracking: boolean;
}

export interface AttendanceSettings {
  lateGracePeriod: number; // in minutes
  lateDeductionPerMinute: number; // in currency units
  undertimeGracePeriod: number; // in minutes
  undertimeDeductionPerMinute: number; // in currency units
  overtimeThreshold: number; // in minutes
  overtimeHourlyMultiplier: number; // multiplier for hourly rate
  regularHolidayMultiplier: number; // multiplier for regular holidays
  specialHolidayMultiplier: number; // multiplier for special holidays
  nightDifferentialMultiplier: number; // decimal multiplier for night differential
  nightDifferentialStartHour: number; // e.g., 22 for 10 PM
  nightDifferentialEndHour: number; // e.g., 6 for 6 AM
  countEarlyTimeInAsOvertime: boolean; // new field to control early time in overtime
}

export const defaultAttendanceSettings: AttendanceSettings = {
  lateGracePeriod: 5,
  lateDeductionPerMinute: 1,
  undertimeGracePeriod: 5,
  undertimeDeductionPerMinute: 1,
  overtimeThreshold: 5,
  overtimeHourlyMultiplier: 1.25, // 25% more than regular hourly rate
  regularHolidayMultiplier: 1.5,
  specialHolidayMultiplier: 2,
  nightDifferentialMultiplier: 0.1,
  nightDifferentialStartHour: 22,
  nightDifferentialEndHour: 6,
  countEarlyTimeInAsOvertime: false,
};

export const defaultTimeSettings: EmploymentType[] = [
  {
    type: "regular",
    hoursOfWork: 8,
    schedules: [
      { dayOfWeek: 1, timeIn: "08:00", timeOut: "17:00" }, // Monday
      { dayOfWeek: 2, timeIn: "08:00", timeOut: "17:00" }, // Tuesday
      { dayOfWeek: 3, timeIn: "08:00", timeOut: "17:00" }, // Wednesday
      { dayOfWeek: 4, timeIn: "08:00", timeOut: "17:00" }, // Thursday
      { dayOfWeek: 5, timeIn: "08:00", timeOut: "17:00" }, // Friday
      { dayOfWeek: 6, timeIn: "08:00", timeOut: "17:00" }, // Saturday
    ],
    requiresTimeTracking: true,
  },
  {
    type: "merchandiser",
    hoursOfWork: 8,
    schedules: [
      { dayOfWeek: 1, timeIn: "09:00", timeOut: "14:00" }, // Monday
      { dayOfWeek: 2, timeIn: "09:00", timeOut: "14:00" }, // Tuesday
      { dayOfWeek: 3, timeIn: "09:00", timeOut: "14:00" }, // Wednesday
      { dayOfWeek: 4, timeIn: "09:00", timeOut: "14:00" }, // Thursday
      { dayOfWeek: 5, timeIn: "09:00", timeOut: "14:00" }, // Friday
      { dayOfWeek: 6, timeIn: "09:00", timeOut: "14:00" }, // Saturday
    ],
    requiresTimeTracking: false,
  },
  {
    type: "sales",
    hoursOfWork: 8,
    schedules: [
      { dayOfWeek: 1, timeIn: "10:00", timeOut: "18:00" }, // Monday
      { dayOfWeek: 2, timeIn: "10:00", timeOut: "18:00" }, // Tuesday
      { dayOfWeek: 3, timeIn: "10:00", timeOut: "18:00" }, // Wednesday
      { dayOfWeek: 4, timeIn: "10:00", timeOut: "18:00" }, // Thursday
      { dayOfWeek: 5, timeIn: "10:00", timeOut: "18:00" }, // Friday
      { dayOfWeek: 6, timeIn: "09:00", timeOut: "15:00" }, // Saturday
    ],
    requiresTimeTracking: true,
  },
  {
    type: "pharmacist",
    hoursOfWork: 8,
    requiresTimeTracking: false,
  },
];

export const defaultSettings: Settings = {
  theme: "light",
  language: "en",
  notificationsEnabled: true,
  timeFormat: "12-hour",
  attendance: defaultAttendanceSettings,
};

// --- JSON Structures --- //

// Attendance settings will be stored directly as an object in settings.json
type AttendanceSettingsJson = AttendanceSettings;

// Time settings will be stored in an object with an employmentTypes array
export interface TimeSettingsJson {
  employmentTypes: EmploymentType[];
}

export class AttendanceSettingsModel {
  private settingsJsonPath: string;
  private timeSettingsJsonPath: string;
  private appSettingsJsonPath: string; // New path for app_settings.json
  private oldModel: OldAttendanceSettingsModel; // Instance of the old CSV model

  constructor(public dbPath: string) {
    const basePath = path.join(dbPath, "SweldoDB");
    this.settingsJsonPath = path.join(basePath, "settings.json");
    this.timeSettingsJsonPath = path.join(basePath, "timeSettings.json");
    this.appSettingsJsonPath = path.join(
      basePath,
      "settings",
      "app_settings.json"
    ); // Path for general app settings
    this.oldModel = new OldAttendanceSettingsModel(dbPath); // Instantiate old model
  }

  // --- Private JSON Read/Write Helpers --- //

  private async readAttendanceSettingsJson(): Promise<AttendanceSettingsJson | null> {
    try {
      const fileExists = await window.electron.fileExists(
        this.settingsJsonPath
      );
      if (!fileExists) return null;
      const content = await window.electron.readFile(this.settingsJsonPath);
      if (!content || content.trim() === "") return null;
      // Basic validation might be needed here depending on robustness required
      return JSON.parse(content) as AttendanceSettingsJson;
    } catch (error) {
      console.error("[SettingsModel] Error reading settings.json:", error);
      return null;
    }
  }

  private async writeAttendanceSettingsJson(
    data: AttendanceSettingsJson
  ): Promise<void> {
    try {
      await window.electron.ensureDir(path.dirname(this.settingsJsonPath));
      await window.electron.writeFile(
        this.settingsJsonPath,
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error("[SettingsModel] Error writing settings.json:", error);
      throw error;
    }
  }

  private async readTimeSettingsJson(): Promise<TimeSettingsJson | null> {
    try {
      const fileExists = await window.electron.fileExists(
        this.timeSettingsJsonPath
      );
      if (!fileExists) return null;
      const content = await window.electron.readFile(this.timeSettingsJsonPath);
      if (!content || content.trim() === "") return { employmentTypes: [] }; // Return empty structure
      // Add potential validation for employmentTypes array?
      return JSON.parse(content) as TimeSettingsJson;
    } catch (error) {
      console.error("[SettingsModel] Error reading timeSettings.json:", error);
      return null;
    }
  }

  private async writeTimeSettingsJson(data: TimeSettingsJson): Promise<void> {
    try {
      await window.electron.ensureDir(path.dirname(this.timeSettingsJsonPath));
      await window.electron.writeFile(
        this.timeSettingsJsonPath,
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error("[SettingsModel] Error writing timeSettings.json:", error);
      throw error;
    }
  }

  // --- New Private Helpers for Persisted App Settings --- //
  private async readPersistedAppSettingsJson(): Promise<StorePersistedSettings | null> {
    if (isWebEnvironment()) {
      console.warn(
        "[SettingsModel] readPersistedAppSettingsJson should not be called in web environment directly for file reading. Store manages this."
      );
      // In web mode, the store directly handles its state, potentially from Firestore via its own init.
      // This model method is primarily for desktop file operations.
      return null;
    }
    try {
      const fileExists = await window.electron.fileExists(
        this.appSettingsJsonPath
      );
      if (!fileExists) {
        console.log(
          `[SettingsModel] app_settings.json not found at ${this.appSettingsJsonPath}. Returning defaults.`
        );
        // Return a structure that includes dbPath for local consistency if needed by consuming logic
        return { ...storeDefaultSettings, dbPath: this.dbPath };
      }
      const content = await window.electron.readFile(this.appSettingsJsonPath);
      if (!content || content.trim() === "") {
        console.log(
          `[SettingsModel] app_settings.json is empty at ${this.appSettingsJsonPath}. Returning defaults.`
        );
        return { ...storeDefaultSettings, dbPath: this.dbPath };
      }
      const parsedSettings = JSON.parse(content) as StorePersistedSettings;
      // Ensure dbPath from the file is prioritized if it exists and is valid, otherwise use current model's dbPath
      parsedSettings.dbPath =
        parsedSettings.dbPath && typeof parsedSettings.dbPath === "string"
          ? parsedSettings.dbPath
          : this.dbPath;
      return { ...storeDefaultSettings, ...parsedSettings }; // Merge with defaults to ensure all fields
    } catch (error) {
      console.error("[SettingsModel] Error reading app_settings.json:", error);
      // Return defaults including the current dbPath on error
      return { ...storeDefaultSettings, dbPath: this.dbPath };
    }
  }

  private async writePersistedAppSettingsJson(
    data: StorePersistedSettings
  ): Promise<void> {
    if (isWebEnvironment()) {
      console.warn(
        "[SettingsModel] writePersistedAppSettingsJson should not be called in web environment directly for file writing. Store manages this via Firestore."
      );
      return;
    }
    try {
      await window.electron.ensureDir(path.dirname(this.appSettingsJsonPath));
      // Ensure dbPath is part of the saved data if it's part of StorePersistedSettings
      const dataToSave = { ...data, dbPath: this.dbPath };
      await window.electron.writeFile(
        this.appSettingsJsonPath,
        JSON.stringify(dataToSave, null, 2)
      );
      console.log(
        `[SettingsModel] Successfully wrote app_settings.json to ${this.appSettingsJsonPath}`
      );
    } catch (error) {
      console.error("[SettingsModel] Error writing app_settings.json:", error);
      throw error;
    }
  }

  // --- New Helpers for Monthly Schedules --- //
  private getMonthSchedulePath(
    employmentType: string,
    year: number,
    month: number
  ): string {
    const safeTypeName = employmentType.replace(/[^a-z0-9_-]/gi, "_"); // Sanitize type name for filename
    const schedulesDir = path.join(
      this.dbPath,
      "SweldoDB",
      "schedules",
      safeTypeName
    );
    return path.join(
      schedulesDir,
      `${year}_${String(month).padStart(2, "0")}_schedule.json`
    );
  }

  private async readMonthScheduleJson(
    filePath: string
  ): Promise<MonthSchedule | null> {
    try {
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) return {}; // Return empty object if file doesn't exist
      const content = await window.electron.readFile(filePath);
      if (!content || content.trim() === "") return {}; // Return empty if file is empty
      const parsedData = JSON.parse(content) as MonthSchedule;
      return parsedData;
    } catch (error) {
      console.error(
        `[SettingsModel] Error reading month schedule ${filePath}:`,
        error
      );
      return null; // Return null on error
    }
  }

  private async writeMonthScheduleJson(
    filePath: string,
    data: MonthSchedule
  ): Promise<void> {
    try {
      await window.electron.ensureDir(path.dirname(filePath));
      await window.electron.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(
        `[SettingsModel] Error writing month schedule ${filePath}:`,
        error
      );
      throw error;
    }
  }

  // --- Public API Methods (Updated for Firestore) --- //

  public async loadAttendanceSettings(): Promise<AttendanceSettings> {
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        return loadAttendanceSettingsFirestore(companyName);
      }

      // Desktop mode - use local file storage
      const jsonData = await this.readAttendanceSettingsJson();
      if (jsonData) {
        // Merge with defaults to ensure all properties exist
        return { ...defaultAttendanceSettings, ...jsonData };
      } else {
        console.warn(
          "[SettingsModel] settings.json not found or invalid, falling back to settings.csv"
        );
        try {
          const csvSettings = await this.oldModel.loadAttendanceSettings();
          // Merge with defaults after loading from CSV too
          return { ...defaultAttendanceSettings, ...csvSettings };
        } catch (csvError) {
          console.error(
            "[SettingsModel] Error loading from settings.csv fallback:",
            csvError
          );
          console.warn(
            "[SettingsModel] Using default attendance settings due to errors."
          );
          return defaultAttendanceSettings;
        }
      }
    } catch (error) {
      console.error(
        "[SettingsModel] Unexpected error loading attendance settings:",
        error
      );
      return defaultAttendanceSettings;
    }
  }

  public async loadTimeSettings(): Promise<EmploymentType[]> {
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        return loadTimeSettingsFirestore(companyName);
      }

      // Desktop mode - use local file storage
      const jsonData = await this.readTimeSettingsJson();
      if (jsonData) {
        // Ensure essential fields exist, remove monthSchedules if present from old saves
        return jsonData.employmentTypes;
      } else {
        console.warn(
          "[SettingsModel] timeSettings.json not found or invalid, falling back to timeSettings.csv"
        );
        try {
          const csvSettings = await this.oldModel.loadTimeSettings();
          // Remove monthSchedules if present from old saves
          return csvSettings;
        } catch (csvError) {
          console.error(
            "[SettingsModel] Error loading from timeSettings.csv fallback:",
            csvError
          );
          console.warn(
            "[SettingsModel] Using default time settings due to errors."
          );
          // Return default without monthSchedules
          return defaultTimeSettings;
        }
      }
    } catch (error) {
      console.error(
        "[SettingsModel] Unexpected error loading time settings:",
        error
      );
      // Return default without monthSchedules
      return defaultTimeSettings;
    }
  }

  public async saveTimeSettings(settings: EmploymentType[]): Promise<void> {
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        return saveTimeSettingsFirestore(settings, companyName);
      }

      // Desktop mode - use local file storage
      // Remove monthSchedules before saving to timeSettings.json - No longer needed as it's removed from type
      const jsonData: TimeSettingsJson = { employmentTypes: settings };
      await this.writeTimeSettingsJson(jsonData);
    } catch (error) {
      console.error("[SettingsModel] Error saving time settings:", error);
      throw error;
    }
  }

  // --- Methods for Monthly Schedules --- //
  public async loadMonthSchedule(
    employmentType: string,
    year: number,
    month: number
  ): Promise<MonthSchedule | null> {
    if (!employmentType) {
      console.warn(
        "[SettingsModel] loadMonthSchedule called with empty employmentType."
      );
      return {};
    }

    // Web mode - use Firestore
    if (isWebEnvironment()) {
      const companyName = await getCompanyName();
      return loadMonthScheduleFirestore(
        employmentType,
        year,
        month,
        companyName
      );
    }

    // Desktop mode - use local file storage
    const filePath = this.getMonthSchedulePath(employmentType, year, month);
    const result = await this.readMonthScheduleJson(filePath);
    return result;
  }

  public async saveMonthSchedule(
    employmentType: string,
    year: number,
    month: number,
    schedule: MonthSchedule
  ): Promise<void> {
    if (!employmentType) {
      console.error(
        "[SettingsModel] saveMonthSchedule called with empty employmentType. Cannot save."
      );
      throw new Error("Cannot save month schedule without an employment type.");
    }

    // Web mode - use Firestore
    if (isWebEnvironment()) {
      const companyName = await getCompanyName();
      return saveMonthScheduleFirestore(
        employmentType,
        year,
        month,
        schedule,
        companyName
      );
    }

    // Desktop mode - use local file storage
    const filePath = this.getMonthSchedulePath(employmentType, year, month);
    await this.writeMonthScheduleJson(filePath, schedule);
  }

  // --- Instance Method for getting schedule --- //
  public async getScheduleForDate(
    employmentTypeInput: EmploymentType | string | null,
    date: Date
  ): Promise<DailySchedule | null> {
    let employmentType: EmploymentType | null = null;

    if (!employmentTypeInput) return null;

    // If input is a string, load the full EmploymentType object
    if (typeof employmentTypeInput === "string") {
      const allTypes = await this.loadTimeSettings();
      employmentType =
        allTypes.find((t) => t.type === employmentTypeInput) || null;
    } else {
      employmentType = employmentTypeInput;
    }

    if (!employmentType) {
      // console.warn(`[SettingsModel] Could not find employment type: ${employmentTypeInput}`); // Keep warn for now?
      return null;
    }

    // 1. Check month-specific schedule
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // Month is 1-based here
    const dateStr = date.toISOString().split("T")[0];

    try {
      const monthSchedule = await this.loadMonthSchedule(
        employmentType.type,
        year,
        month
      );
      if (monthSchedule && monthSchedule[dateStr]) {
        // console.log(`[getScheduleForDate] Using MONTH-SPECIFIC schedule for ${employmentType.type} on ${dateStr}`);
        return monthSchedule[dateStr];
      }
    } catch (error) {
      console.error(
        `[SettingsModel] Error loading month schedule for ${employmentType.type}, ${year}-${month}:`,
        error
      );
      // Continue to fallback even if loading fails
    }

    // 2. Fall back to weekly schedule
    if (employmentType.schedules) {
      const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, etc.
      const scheduleDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to 0-6 index (Mon-Sun)
      const weeklySchedule = employmentType.schedules[scheduleDay];

      if (weeklySchedule) {
        // console.log(`[getScheduleForDate] Using WEEKLY fallback for ${employmentType.type} on ${dateStr} (Day ${dayOfWeek})`);
        return {
          timeIn: weeklySchedule.timeIn,
          timeOut: weeklySchedule.timeOut,
          isOff: !weeklySchedule.timeIn || !weeklySchedule.timeOut,
        };
      }
    }

    // console.log(`[getScheduleForDate] NO schedule (monthly or weekly) found for ${employmentType.type} on ${dateStr}`);
    // 3. No schedule found
    return null;
  }

  public async saveAttendanceSettings(
    settings: AttendanceSettings
  ): Promise<void> {
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        return saveAttendanceSettingsFirestore(settings, companyName);
      }

      // Desktop mode - use local file storage
      // Directly save the settings object (no need to convert boolean to string for JSON)
      await this.writeAttendanceSettingsJson(settings);
    } catch (error) {
      console.error("[SettingsModel] Error saving attendance settings:", error);
      throw error;
    }
  }

  // setRegularHolidayMultiplier and setSpecialHolidayMultiplier use the public save/load methods,
  // so their implementation doesn't need to change.
  public async setRegularHolidayMultiplier(multiplier: number): Promise<void> {
    const settings = await this.loadAttendanceSettings();
    settings.regularHolidayMultiplier = multiplier;
    await this.saveAttendanceSettings(settings);
  }

  public async setSpecialHolidayMultiplier(multiplier: number): Promise<void> {
    const settings = await this.loadAttendanceSettings();
    settings.specialHolidayMultiplier = multiplier;
    await this.saveAttendanceSettings(settings);
  }

  // --- Migration Function --- //

  static async migrateCsvToJson(
    dbPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
    onProgress?.("Starting Settings CSV to JSON migration...");
    const settingsJsonPath = path.join(dbPath, "SweldoDB", "settings.json");
    const timeSettingsJsonPath = path.join(
      dbPath,
      "SweldoDB",
      "timeSettings.json"
    );
    const oldModel = new OldAttendanceSettingsModel(dbPath); // Instance to load from CSV
    // Create a temporary instance of the new model for accessing helper methods like saveMonthSchedule
    const tempNewModel = new AttendanceSettingsModel(dbPath);
    let settingsMigrated = false;
    let timeSettingsMigrated = false;
    let monthlySchedulesMigratedCount = 0;

    // Ensure the base schedules directory exists BEFORE processing any types
    const baseSchedulesDir = path.join(dbPath, "SweldoDB", "schedules");
    try {
      onProgress?.("- Ensuring base schedules directory exists...");
      await window.electron.ensureDir(baseSchedulesDir);
      onProgress?.("- Base schedules directory ensured.");
    } catch (dirError) {
      const msg =
        dirError instanceof Error ? dirError.message : String(dirError);
      onProgress?.(
        `! CRITICAL ERROR: Failed to create base schedules directory (${baseSchedulesDir}): ${msg}. Aborting monthly schedule migration.`
      );
      console.error(
        "Critical migration error creating base schedules directory:",
        dirError
      );
      // Skip the rest of the time settings migration if base dir fails
      // Optionally, re-throw or handle differently if settings.json migration should also stop.
      return; // Exit migration function
    }

    // 1. Migrate settings.csv to settings.json (No change needed here)
    try {
      if (await window.electron.fileExists(settingsJsonPath)) {
        onProgress?.(`- settings.json already exists, skipping.`);
      } else {
        onProgress?.("- Loading attendance settings from settings.csv...");
        const attendanceSettings = await oldModel.loadAttendanceSettings();
        // Use the instance write helper via prototype.call
        await AttendanceSettingsModel.prototype.writeAttendanceSettingsJson.call(
          { settingsJsonPath, dbPath },
          attendanceSettings
        );
        onProgress?.(`- Successfully created settings.json`);
        settingsMigrated = true;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onProgress?.(
        `- Error migrating attendance settings: ${msg}. Skipping file.`
      );
      console.error("Error migrating settings.csv:", error);
    }

    // 2. Migrate timeSettings.csv to timeSettings.json AND separate monthly files
    try {
      if (await window.electron.fileExists(timeSettingsJsonPath)) {
        onProgress?.(
          `- timeSettings.json already exists, skipping core time settings migration.`
        );
        // Even if timeSettings.json exists, we might still need to extract monthly schedules if they haven't been moved
        onProgress?.(
          "- Checking for embedded monthly schedules in existing timeSettings.json..."
        );
        const existingTimeSettings = await tempNewModel.readTimeSettingsJson();
        let needsExtraction = false;
        if (existingTimeSettings?.employmentTypes) {
          for (const type of existingTimeSettings.employmentTypes) {
            // Check if the loaded type *still* has monthSchedules (from an incomplete previous migration)
            if (
              (type as any).monthSchedules &&
              Object.keys((type as any).monthSchedules).length > 0
            ) {
              needsExtraction = true;
              onProgress?.(
                `-- Found embedded schedules for type: ${type.type}. Attempting extraction.`
              );
              const oldMonthSchedules = (type as any).monthSchedules;
              for (const [yearMonth, monthData] of Object.entries(
                oldMonthSchedules
              )) {
                try {
                  const [year, month] = yearMonth.split("-").map(Number);
                  if (
                    year &&
                    month &&
                    typeof monthData === "object" &&
                    monthData !== null
                  ) {
                    await tempNewModel.saveMonthSchedule(
                      type.type,
                      year,
                      month,
                      monthData as MonthSchedule
                    );
                    monthlySchedulesMigratedCount++;
                    onProgress?.(
                      `--- Migrated schedule for ${type.type} - ${yearMonth}`
                    );
                  } else {
                    onProgress?.(
                      `--- Skipping invalid month schedule data for ${type.type} - ${yearMonth}`
                    );
                  }
                } catch (extractError) {
                  const msg =
                    extractError instanceof Error
                      ? extractError.message
                      : String(extractError);
                  onProgress?.(
                    `--- Error extracting schedule for ${type.type} - ${yearMonth}: ${msg}`
                  );
                }
              }
            }
          }
        }
        if (needsExtraction) {
          onProgress?.(
            "- Re-saving timeSettings.json without embedded schedules..."
          );
          await tempNewModel.saveTimeSettings(
            existingTimeSettings?.employmentTypes || []
          ); // Save cleaned data
          timeSettingsMigrated = true; // Mark as migrated because we cleaned it
        }
        if (!needsExtraction) {
          onProgress?.(
            "- No embedded monthly schedules found requiring extraction."
          );
        }
      } else {
        // timeSettings.json does not exist, perform full migration from CSV
        onProgress?.("- Loading time settings from timeSettings.csv...");
        const loadedTimeSettings = await oldModel.loadTimeSettings(); // This might contain monthSchedules

        const coreTimeSettings: EmploymentType[] = [];
        let migrationErrorOccurred = false;

        for (const type of loadedTimeSettings) {
          // Assume the loaded type might have monthSchedules attached by the old loader
          const oldMonthSchedules = (type as any).monthSchedules;
          const { monthSchedules, ...coreType } = type; // Destructure to separate core data
          coreTimeSettings.push(coreType); // Add only core data

          if (oldMonthSchedules && typeof oldMonthSchedules === "object") {
            onProgress?.(
              `-- Processing embedded schedules for type: ${coreType.type}`
            );
            for (const [yearMonth, monthData] of Object.entries(
              oldMonthSchedules
            )) {
              try {
                const [year, month] = yearMonth.split("-").map(Number);
                if (
                  year &&
                  month &&
                  typeof monthData === "object" &&
                  monthData !== null
                ) {
                  await tempNewModel.saveMonthSchedule(
                    coreType.type,
                    year,
                    month,
                    monthData as MonthSchedule
                  );
                  monthlySchedulesMigratedCount++;
                  onProgress?.(
                    `--- Migrated schedule for ${coreType.type} - ${yearMonth}`
                  );
                } else {
                  onProgress?.(
                    `--- Skipping invalid month schedule data for ${coreType.type} - ${yearMonth}`
                  );
                }
              } catch (monthSaveError) {
                const msg =
                  monthSaveError instanceof Error
                    ? monthSaveError.message
                    : String(monthSaveError);
                onProgress?.(
                  `--- Error saving schedule for ${coreType.type} - ${yearMonth}: ${msg}`
                );
                console.error(
                  `[Migration Error] Failed to save monthly schedule for ${coreType.type} - ${yearMonth}:`,
                  monthSaveError
                );
                // Re-throw the error to stop the time settings migration process
                throw new Error(
                  `Failed to save monthly schedule for ${coreType.type} - ${yearMonth}: ${msg}`
                );
              }
            }
          }
        }

        onProgress?.(`- Saving core time settings to timeSettings.json...`);
        await tempNewModel.saveTimeSettings(coreTimeSettings); // Use the instance method
        onProgress?.(
          `- Successfully created timeSettings.json with core data.`
        );
        timeSettingsMigrated = true;
        if (migrationErrorOccurred) {
          onProgress?.(
            "! Warning: Some monthly schedules failed to migrate. Check logs."
          );
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onProgress?.(
        `- Error during time settings migration: ${msg}. Process halted.`
      );
      console.error("Error migrating timeSettings.csv:", error);
      // No further action needed here as the error is caught and logged,
      // and coreTimeSettings won't be saved due to the error.
    }

    // Final summary
    let summary = "Settings migration finished. ";
    const migratedParts: string[] = [];
    if (settingsMigrated) migratedParts.push("Attendance settings migrated");
    if (timeSettingsMigrated)
      migratedParts.push("Core time settings saved/updated");
    if (monthlySchedulesMigratedCount > 0)
      migratedParts.push(
        `${monthlySchedulesMigratedCount} monthly schedules migrated/extracted`
      );

    if (migratedParts.length === 0) {
      summary += "No files required migration or extraction.";
    } else {
      summary += migratedParts.join(", ") + ".";
    }
    onProgress?.(summary);
  }

  // --- Public API for Persisted App Settings --- //

  // This method is for settings_firestore.ts to get data to sync TO Firestore
  public async loadPersistedAppSettings(): Promise<
    Partial<StorePersistedSettings>
  > {
    if (isWebEnvironment()) {
      // In web mode, get current settings directly from the Zustand store,
      // as it's the source of truth, potentially hydrated from Firestore by its own init.
      const storeState = useSettingsStore.getState();
      console.log(
        "[SettingsModel] loadPersistedAppSettings (Web): Returning settings from Zustand store:",
        storeState
      );
      // Return a copy, excluding functions, and ensure it aligns with what Firestore expects
      const {
        isInitialized,
        initialize,
        setDbPath,
        setLogoPath,
        setPreparedBy,
        setApprovedBy,
        setCompanyName,
        setColumnColor,
        setCalculationSettings,
        ...relevantSettings
      } = storeState;
      return relevantSettings;
    }
    // Desktop mode: read from app_settings.json
    console.log(
      "[SettingsModel] loadPersistedAppSettings (Desktop): Reading from app_settings.json"
    );
    return (
      (await this.readPersistedAppSettingsJson()) || {
        ...storeDefaultSettings,
        dbPath: this.dbPath,
      }
    );
  }

  // This method is for settings_firestore.ts to save data synced FROM Firestore
  public async savePersistedAppSettings(
    settings: Partial<StorePersistedSettings>
  ): Promise<void> {
    console.log(
      "[SettingsModel] savePersistedAppSettings: Received settings to save/update store:",
      settings
    );

    // Update the Zustand store first
    const {
      setDbPath,
      setLogoPath,
      setPreparedBy,
      setApprovedBy,
      setCompanyName,
      setColumnColor,
      setCalculationSettings,
    } = useSettingsStore.getState();

    // We call setters directly to ensure individual save logic (like _saveSettings in store) is triggered
    // if dbPath is part of settings and different, handle with care or disallow changing dbPath this way.
    // For now, we assume dbPath is not changed by sync from Firestore directly through this method.
    if (settings.companyName !== undefined)
      setCompanyName(settings.companyName);
    if (settings.logoPath !== undefined) setLogoPath(settings.logoPath);
    if (settings.preparedBy !== undefined) setPreparedBy(settings.preparedBy);
    if (settings.approvedBy !== undefined) setApprovedBy(settings.approvedBy);
    if (settings.columnColors !== undefined) {
      Object.entries(settings.columnColors).forEach(([key, value]) => {
        setColumnColor(key, value);
      });
    }
    if (settings.calculationSettings !== undefined) {
      setCalculationSettings(settings.calculationSettings);
    }

    // For desktop, also write to the local app_settings.json
    if (!isWebEnvironment()) {
      console.log(
        "[SettingsModel] savePersistedAppSettings (Desktop): Writing updated settings to app_settings.json"
      );
      // Load current local settings, merge, then save, to preserve local dbPath
      const currentLocalSettings =
        (await this.readPersistedAppSettingsJson()) || {
          ...storeDefaultSettings,
          dbPath: this.dbPath,
        };
      const mergedSettings = {
        ...currentLocalSettings,
        ...settings,
        dbPath: currentLocalSettings.dbPath,
      }; // Ensure local dbPath is preserved
      await this.writePersistedAppSettingsJson(mergedSettings);
    }
    // Note: The store setters themselves will trigger _saveSettings, which handles Firestore persistence in web mode.
  }
}

export const createAttendanceSettingsModel = (
  dbPath: string
): AttendanceSettingsModel => {
  return new AttendanceSettingsModel(dbPath);
};
