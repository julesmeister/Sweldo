import Papa from "papaparse";
import path from "path";
import { Schedule } from "./schedule";
import { AttendanceSettingsModel as OldAttendanceSettingsModel } from "./settings_old"; // Import old implementation

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
  monthSchedules?: {
    [yearMonth: string]: MonthSchedule; // Format: "YYYY-MM"
  };
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
interface TimeSettingsJson {
  employmentTypes: EmploymentType[];
}

export class AttendanceSettingsModel {
  private settingsJsonPath: string;
  private timeSettingsJsonPath: string;
  private oldModel: OldAttendanceSettingsModel; // Instance of the old CSV model

  constructor(public dbPath: string) {
    const basePath = path.join(dbPath, "SweldoDB");
    this.settingsJsonPath = path.join(basePath, "settings.json");
    this.timeSettingsJsonPath = path.join(basePath, "timeSettings.json");
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

  // --- Public API Methods (Updated for JSON) --- //

  public async loadAttendanceSettings(): Promise<AttendanceSettings> {
    try {
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
      const jsonData = await this.readTimeSettingsJson();
      if (jsonData) {
        return jsonData.employmentTypes;
      } else {
        console.warn(
          "[SettingsModel] timeSettings.json not found or invalid, falling back to timeSettings.csv"
        );
        try {
          const csvSettings = await this.oldModel.loadTimeSettings();
          return csvSettings;
        } catch (csvError) {
          console.error(
            "[SettingsModel] Error loading from timeSettings.csv fallback:",
            csvError
          );
          console.warn(
            "[SettingsModel] Using default time settings due to errors."
          );
          return defaultTimeSettings;
        }
      }
    } catch (error) {
      console.error(
        "[SettingsModel] Unexpected error loading time settings:",
        error
      );
      return defaultTimeSettings; // Return default on unexpected error
    }
  }

  public async saveTimeSettings(settings: EmploymentType[]): Promise<void> {
    try {
      // Perform cleanup of old month schedules (same logic as before)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const cleanedSettings = settings.map((setting) => {
        const cleanedMonthSchedules = setting.monthSchedules
          ? Object.entries(setting.monthSchedules).reduce(
              (acc, [yearMonth, schedules]) => {
                const [year, month] = yearMonth.split("-").map(Number);
                const scheduleDate = new Date(year, month - 1);
                if (scheduleDate >= twelveMonthsAgo) {
                  acc[yearMonth] = schedules;
                }
                return acc;
              },
              {} as typeof setting.monthSchedules
            )
          : {};
        return {
          ...setting, // Spread the original setting first
          monthSchedules: cleanedMonthSchedules, // Overwrite with cleaned version
        };
      });

      const jsonData: TimeSettingsJson = { employmentTypes: cleanedSettings };
      await this.writeTimeSettingsJson(jsonData);
    } catch (error) {
      console.error("[SettingsModel] Error saving time settings:", error);
      throw error;
    }
  }

  public async saveAttendanceSettings(
    settings: AttendanceSettings
  ): Promise<void> {
    try {
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
    let settingsMigrated = false;
    let timeSettingsMigrated = false;

    // 1. Migrate settings.csv to settings.json
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

    // 2. Migrate timeSettings.csv to timeSettings.json
    try {
      if (await window.electron.fileExists(timeSettingsJsonPath)) {
        onProgress?.(`- timeSettings.json already exists, skipping.`);
      } else {
        onProgress?.("- Loading time settings from timeSettings.csv...");
        const timeSettings = await oldModel.loadTimeSettings();
        const timeSettingsJsonData: TimeSettingsJson = {
          employmentTypes: timeSettings,
        };
        // Use the instance write helper via prototype.call
        await AttendanceSettingsModel.prototype.writeTimeSettingsJson.call(
          { timeSettingsJsonPath, dbPath },
          timeSettingsJsonData
        );
        onProgress?.(`- Successfully created timeSettings.json`);
        timeSettingsMigrated = true;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onProgress?.(`- Error migrating time settings: ${msg}. Skipping file.`);
      console.error("Error migrating timeSettings.csv:", error);
    }

    if (settingsMigrated || timeSettingsMigrated) {
      onProgress?.("Settings migration finished.");
    } else {
      onProgress?.("Settings migration finished. No files needed migration.");
    }
  }
}

export const createAttendanceSettingsModel = (
  dbPath: string
): AttendanceSettingsModel => {
  return new AttendanceSettingsModel(dbPath);
};

// Helper function to get schedule for a specific date
export const getScheduleForDate = (
  employmentType: EmploymentType | null,
  date: Date
): DailySchedule | null => {
  if (!employmentType) {
    return null;
  }

  // Check for month-specific schedule first
  const yearMonth = `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
  const dateStr = date.toISOString().split("T")[0];
  const monthSchedule = employmentType.monthSchedules?.[yearMonth]?.[dateStr];

  if (monthSchedule) {
    return monthSchedule;
  }

  // Fall back to weekly schedule if no month-specific schedule exists
  if (employmentType.schedules) {
    const dayOfWeek = date.getDay();
    const scheduleDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday from 0 to 7
    const weeklySchedule = employmentType.schedules[scheduleDay - 1];

    if (weeklySchedule) {
      return {
        timeIn: weeklySchedule.timeIn,
        timeOut: weeklySchedule.timeOut,
        isOff: !weeklySchedule.timeIn || !weeklySchedule.timeOut,
      };
    }
  }

  return null;
};

// Helper function to get schedule for a specific day of the week
export const getScheduleForDay = (
  employmentType: EmploymentType | null,
  dayOfWeek: number
): Schedule | null => {
  if (!employmentType?.schedules) return null;
  return employmentType.schedules[dayOfWeek - 1] || null;
};
