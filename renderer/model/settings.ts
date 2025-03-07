import Papa from "papaparse";

export interface Settings {
    theme: string;
    language: string;
    notificationsEnabled: boolean;
    timeFormat: '12-hour' | '24-hour';
    attendance: AttendanceSettings;
}

export interface EmploymentType {
    type: string; // Employee type (e.g., full-time, part-time)
    timeIn?: string; // Optional time in (HH:mm format)
    timeOut?: string; // Optional time out (HH:mm format)
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
        type: 'regular',
        timeIn: '08:00',
        timeOut: '17:00',
        requiresTimeTracking: true,
    },
    {
        type: 'merchandiser',
        timeIn: '09:00',
        timeOut: '14:00',
        requiresTimeTracking: false,
    },
    {
        type: 'sales',
        timeIn: '10:00',
        timeOut: '18:00',   
        requiresTimeTracking: true,
    },
    {
        type: 'pharmacist',
        requiresTimeTracking: false,
    },
];

export const defaultSettings: Settings = {
    theme: 'light',
    language: 'en',
    notificationsEnabled: true,
    timeFormat: '12-hour',
    attendance: defaultAttendanceSettings,
};

export class AttendanceSettingsModel {

    private filePath: string;
    private timeSettingsPath: string;

    constructor(filePath: string, timeSettingsPath?: string) {
        this.filePath = filePath;
        this.timeSettingsPath = timeSettingsPath || '';
    }

    // Load attendance settings from CSV or return defaults if file doesn't exist
    public async loadAttendanceSettings(): Promise<AttendanceSettings> {
        try {
            const text = await window.electron.readFile(this.filePath);
            const results = Papa.parse<AttendanceSettings>(text, { header: true });
            if (results.data.length === 0) {
                console.log(`Attendance settings file ${this.filePath} doesn't exist, using defaults`);
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
        const results = Papa.parse<EmploymentType[]>(text, { header: true });
        if (results.data.length === 0) {
            console.log(`Time settings file ${this.timeSettingsPath} doesn't exist, using defaults`);
            await this.saveTimeSettings(defaultTimeSettings);
            return defaultTimeSettings;
        } else {
            // Ensure we return a flat array
            return results.data.flat() as EmploymentType[]; // Use flat() to ensure it's a single-level array
        }
    } catch (error) {
        console.error(`Error loading time settings: ${error}`);
        console.log(`Using default time settings`);
        return defaultTimeSettings; // Return defaults on any error
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

    // Save attendance settings to CSV
    public async saveAttendanceSettings(settings: AttendanceSettings): Promise<void> {
        const csv = Papa.unparse([settings]); // Wrap in array since unparse expects array
        await window.electron.saveFile(this.filePath, csv);
    }

    public async saveTimeSettings(settings: EmploymentType[]): Promise<void> {
        // Transform the timeSettings to match the expected CSV structure
        const formattedSettings = settings.map(setting => ({
            type: setting.type,
            timeIn: setting.timeIn || '', // Ensure timeIn is a string
            timeOut: setting.timeOut || '', // Ensure timeOut is a string
            requiresTimeTracking: setting.requiresTimeTracking,
        }));
    
        const csv = Papa.unparse(formattedSettings); // Wrap in array since unparse expects array
        await window.electron.saveFile(this.timeSettingsPath, csv);
    }
}

export const createAttendanceSettingsModel = (dbPath: string): AttendanceSettingsModel => {
    const filePath = `${dbPath}/SweldoDB/settings.csv`; 
    const timeSettingsPath = `${dbPath}/SweldoDB/timeSettings.csv`; 
    return new AttendanceSettingsModel(filePath, timeSettingsPath);
};
