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
            monthSchedules: setting.monthSchedules
              ? JSON.stringify(setting.monthSchedules)
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
        overtimeThreshold: Number(settings.overtimeThreshold),
        overtimeHourlyMultiplier: Number(settings.overtimeHourlyMultiplier),
        regularHolidayMultiplier: Number(settings.regularHolidayMultiplier),
        specialHolidayMultiplier: Number(settings.specialHolidayMultiplier),
        nightDifferentialMultiplier: Number(
          settings.nightDifferentialMultiplier
        ),
        nightDifferentialStartHour: Number(settings.nightDifferentialStartHour),
        nightDifferentialEndHour: Number(settings.nightDifferentialEndHour),
      };
    } catch (error) {
      console.error("[SettingsModel] Error loading settings:", error);
      return defaultAttendanceSettings;
    }
  }

  public async loadTimeSettings(): Promise<EmploymentType[]> {
    try {
      await this.ensureTimeSettingsFile();
      const csv = await window.electron.readFile(this.timeSettingsPath);
      const parsed = Papa.parse(csv, { header: true });

      return parsed.data.map((row: any) => ({
        type: row.type,
        hoursOfWork: Number(row.hoursOfWork),
        schedules: row.schedules ? JSON.parse(row.schedules) : undefined,
        monthSchedules: row.monthSchedules
          ? JSON.parse(row.monthSchedules)
          : undefined,
        requiresTimeTracking: row.requiresTimeTracking === "true",
      }));
    } catch (error) {
      console.error("[SettingsModel] Error loading time settings:", error);
      throw error;
    }
  }

  public async saveTimeSettings(settings: EmploymentType[]): Promise<void> {
    try {
      await this.ensureTimeSettingsFile();

      // Get the date 12 months ago
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const formattedSettings = settings.map((setting) => {
        // Clean up old month schedules
        const cleanedMonthSchedules = setting.monthSchedules
          ? Object.entries(setting.monthSchedules).reduce(
              (acc, [yearMonth, schedules]) => {
                // yearMonth format is "YYYY-MM"
                const [year, month] = yearMonth.split("-").map(Number);
                const scheduleDate = new Date(year, month - 1); // month is 0-based in Date constructor

                // Only keep schedules newer than 12 months ago
                if (scheduleDate >= twelveMonthsAgo) {
                  acc[yearMonth] = schedules;
                }
                return acc;
              },
              {} as typeof setting.monthSchedules
            )
          : {};

        return {
          type: setting.type,
          schedules: setting.schedules ? JSON.stringify(setting.schedules) : "",
          monthSchedules:
            Object.keys(cleanedMonthSchedules).length > 0
              ? JSON.stringify(cleanedMonthSchedules)
              : "",
          requiresTimeTracking: setting.requiresTimeTracking,
          hoursOfWork: setting.hoursOfWork,
        };
      });

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
