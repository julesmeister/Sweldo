import Papa from "papaparse";
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
  private filePath: string;
  private timeSettingsPath: string;

  constructor(filePath: string, timeSettingsPath?: string) {
    this.filePath = filePath;
    this.timeSettingsPath = timeSettingsPath || "";
  }

  // Load attendance settings from CSV or return defaults if file doesn't exist
  public async loadAttendanceSettings(): Promise<AttendanceSettings> {
    try {
      const text = await window.electron.readFile(this.filePath);
      const results = Papa.parse<AttendanceSettings>(text, { header: true });
      if (results.data.length === 0) {
        console.log(
          `Attendance settings file ${this.filePath} doesn't exist, using defaults`
        );
        // File doesn't exist, save defaults and return them
        await this.saveAttendanceSettings(defaultAttendanceSettings);
      }
      const settings = results.data[0] || defaultAttendanceSettings;

      return settings;
    } catch (error) {
      console.error(`Error loading attendance settings: ${error}`);
      console.log(`Using default attendance settings`);
      return defaultAttendanceSettings; // Return defaults on any error
    }
  }

  public async loadTimeSettings(): Promise<EmploymentType[]> {
    try {
      const text = await window.electron.readFile(this.timeSettingsPath);
      const results = Papa.parse<any>(text, { header: true });
      if (results.data.length === 0) {
        await this.saveTimeSettings(defaultTimeSettings);
        return defaultTimeSettings;
      } else {
        // Process the parsed data to ensure proper types
        const processedData = results.data
          .map((item: any) => {
            try {
              let schedules = undefined;
              if (item.schedules) {
                try {
                  schedules = JSON.parse(item.schedules);
                } catch (error) {
                  // Error handling without console.log
                }
              }

              const processedItem = {
                type: item.type?.toLowerCase() || "",
                schedules,
                requiresTimeTracking:
                  item.requiresTimeTracking === "true" ||
                  item.requiresTimeTracking === true,
              };
              return processedItem;
            } catch (error) {
              return {
                type: item.type?.toLowerCase() || "",
                schedules: undefined,
                requiresTimeTracking: false,
              };
            }
          })
          .filter((item: any) => item.type);

        return processedData;
      }
    } catch (error) {
      return defaultTimeSettings;
    }
  }

  public async saveTimeSettings(settings: EmploymentType[]): Promise<void> {
    // Transform the timeSettings to match the expected CSV structure
    const formattedSettings = settings.map((setting) => {
      // Ensure schedules is properly handled
      let schedulesValue = "";
      if (setting.schedules) {
        try {
          schedulesValue = JSON.stringify(setting.schedules);
        } catch (error) {
          schedulesValue = "";
        }
      }

      const formattedSetting = {
        type: setting.type,
        schedules: schedulesValue,
        requiresTimeTracking: setting.requiresTimeTracking,
      };
      return formattedSetting;
    });

    const csv = Papa.unparse(formattedSettings);
    await window.electron.saveFile(this.timeSettingsPath, csv);
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

  // Save attendance settings to CSV
  public async saveAttendanceSettings(
    settings: AttendanceSettings
  ): Promise<void> {
    const csv = Papa.unparse([settings]); // Wrap in array since unparse expects array
    await window.electron.saveFile(this.filePath, csv);
  }
}

export const createAttendanceSettingsModel = (
  dbPath: string
): AttendanceSettingsModel => {
  const filePath = `${dbPath}/SweldoDB/settings.csv`;
  const timeSettingsPath = `${dbPath}/SweldoDB/timeSettings.csv`;
  return new AttendanceSettingsModel(filePath, timeSettingsPath);
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
