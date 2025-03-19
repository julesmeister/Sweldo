import Papa from "papaparse";
import path from "path";
import { Schedule } from "./schedule";
export interface Settings {
  theme: string;
  language: string;
  notificationsEnabled: boolean;
  timeFormat: "12-hour" | "24-hour";
  attendance: AttendanceSettings;
}

export interface EmploymentType {
  type: string; // Employee type (e.g., full-time, part-time)
  schedules?: Array<{
    dayOfWeek: number;
    timeIn: string;
    timeOut: string;
  }>; // Optional schedule (if applicable)
  requiresTimeTracking: boolean; // Indicates if time tracking is required
}

export interface AttendanceSettings {
  lateGracePeriod: number; // in minutes
  lateDeductionPerMinute: number; // in currency units
  undertimeGracePeriod: number; // in minutes
  undertimeDeductionPerMinute: number; // in currency units
  overtimeGracePeriod: number; // in minutes
  overtimeAdditionPerMinute: number; // in currency units
  regularHolidayMultiplier: number; // multiplier for regular holidays
  specialHolidayMultiplier: number; // multiplier for special holidays
}

export const defaultAttendanceSettings: AttendanceSettings = {
  lateGracePeriod: 5,
  lateDeductionPerMinute: 1,
  undertimeGracePeriod: 5,
  undertimeDeductionPerMinute: 1,
  overtimeGracePeriod: 5,
  overtimeAdditionPerMinute: 2,
  regularHolidayMultiplier: 1.5,
  specialHolidayMultiplier: 2,
};

export const defaultTimeSettings: EmploymentType[] = [
  {
    type: "regular",
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

export class AttendanceSettingsModel {
  private settingsPath: string;
  private timeSettingsPath: string;

  constructor(public dbPath: string) {
    // Ensure the path includes SweldoDB
    const basePath = path.join(dbPath, "SweldoDB");
    this.settingsPath = path.join(basePath, "settings.csv");
    this.timeSettingsPath = path.join(basePath, "timeSettings.csv");
  }

  private async ensureSettingsFile(): Promise<void> {
    try {
      const exists = await window.electron.fileExists(this.settingsPath);
      if (!exists) {
        // Create directory if it doesn't exist
        await window.electron.ensureDir(path.dirname(this.settingsPath));
        // Create file with default settings
        const csv = Papa.unparse([defaultAttendanceSettings]);
        await window.electron.writeFile(this.settingsPath, csv);
      }
    } catch (error) {
      console.error("[SettingsModel] Error ensuring settings file:", error);
      throw error;
    }
  }

  private async ensureTimeSettingsFile(): Promise<void> {
    try {
      const exists = await window.electron.fileExists(this.timeSettingsPath);
      if (!exists) {
        // Create directory if it doesn't exist
        await window.electron.ensureDir(path.dirname(this.timeSettingsPath));
        // Create file with default time settings
        const csv = Papa.unparse(
          defaultTimeSettings.map((setting) => ({
            type: setting.type,
            schedules: setting.schedules
              ? JSON.stringify(setting.schedules)
              : "",
            requiresTimeTracking: setting.requiresTimeTracking,
          }))
        );
        await window.electron.writeFile(this.timeSettingsPath, csv);
      }
    } catch (error) {
      console.error(
        "[SettingsModel] Error ensuring time settings file:",
        error
      );
      throw error;
    }
  }

  public async loadAttendanceSettings(): Promise<AttendanceSettings> {
    try {
      await this.ensureSettingsFile();
      const content = await window.electron.readFile(this.settingsPath);
      const results = Papa.parse<AttendanceSettings>(content, { header: true });

      if (results.data.length === 0) {
        console.log("[SettingsModel] No settings found, using defaults");
        await this.saveAttendanceSettings(defaultAttendanceSettings);
        return defaultAttendanceSettings;
      }

      // Convert string values to numbers
      const settings = results.data[0];
      return {
        lateGracePeriod: Number(settings.lateGracePeriod),
        lateDeductionPerMinute: Number(settings.lateDeductionPerMinute),
        undertimeGracePeriod: Number(settings.undertimeGracePeriod),
        undertimeDeductionPerMinute: Number(
          settings.undertimeDeductionPerMinute
        ),
        overtimeGracePeriod: Number(settings.overtimeGracePeriod),
        overtimeAdditionPerMinute: Number(settings.overtimeAdditionPerMinute),
        regularHolidayMultiplier: Number(settings.regularHolidayMultiplier),
        specialHolidayMultiplier: Number(settings.specialHolidayMultiplier),
      };
    } catch (error) {
      console.error("[SettingsModel] Error loading settings:", error);
      return defaultAttendanceSettings;
    }
  }

  public async loadTimeSettings(): Promise<EmploymentType[]> {
    try {
      await this.ensureTimeSettingsFile();
      const content = await window.electron.readFile(this.timeSettingsPath);
      const results = Papa.parse(content, { header: true });

      if (results.data.length === 0) {
        await this.saveTimeSettings(defaultTimeSettings);
        return defaultTimeSettings;
      }

      return results.data
        .map((item: any) => {
          let schedules;
          try {
            schedules = item.schedules ? JSON.parse(item.schedules) : undefined;
          } catch (error) {
            console.error("[SettingsModel] Error parsing schedules:", error);
            schedules = undefined;
          }

          return {
            type: item.type?.toLowerCase() || "",
            schedules,
            requiresTimeTracking:
              item.requiresTimeTracking === "true" ||
              item.requiresTimeTracking === true,
          };
        })
        .filter((item: any) => item.type);
    } catch (error) {
      console.error("[SettingsModel] Error loading time settings:", error);
      return defaultTimeSettings;
    }
  }

  public async saveTimeSettings(settings: EmploymentType[]): Promise<void> {
    try {
      await this.ensureTimeSettingsFile();
      const formattedSettings = settings.map((setting) => ({
        type: setting.type,
        schedules: setting.schedules ? JSON.stringify(setting.schedules) : "",
        requiresTimeTracking: setting.requiresTimeTracking,
      }));

      const csv = Papa.unparse(formattedSettings);
      await window.electron.writeFile(this.timeSettingsPath, csv);
    } catch (error) {
      console.error("[SettingsModel] Error saving time settings:", error);
      throw error;
    }
  }

  public async saveAttendanceSettings(
    settings: AttendanceSettings
  ): Promise<void> {
    try {
      await this.ensureSettingsFile();
      const csv = Papa.unparse([settings]);
      await window.electron.writeFile(this.settingsPath, csv);
    } catch (error) {
      console.error("[SettingsModel] Error saving settings:", error);
      throw error;
    }
  }

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
}

export const createAttendanceSettingsModel = (
  dbPath: string
): AttendanceSettingsModel => {
  return new AttendanceSettingsModel(dbPath);
};

// Helper function to get schedule for a specific day
export function getScheduleForDay(
  employmentType: EmploymentType,
  dayOfWeek: number
): { timeIn: string; timeOut: string } | undefined {
  if (!employmentType.schedules) return undefined;
  return employmentType.schedules.find(
    (schedule) => schedule.dayOfWeek === dayOfWeek
  );
}
