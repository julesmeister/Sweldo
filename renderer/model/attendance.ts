import { Employee } from "./employee";
import Papa from "papaparse";
import {
  loadAttendanceFirestore,
  saveAttendanceFirestore,
  loadAttendanceByDayFirestore,
  loadAlternativeTimesFirestore,
  saveAlternativeTimesFirestore,
  loadAttendanceSettingsFirestore,
  saveAttendanceSettingsFirestore,
  queryAttendanceByDateRangeFirestore,
} from "./attendance_firestore";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";

// Keep the same interfaces as the original file for API compatibility
export interface Attendance {
  employeeId: string;
  day: number;
  month: number;
  year: number;
  timeIn: string | null;
  timeOut: string | null;
  schedule?: {
    timeIn: string;
    timeOut: string;
    dayOfWeek: number;
  } | null;
}

// Interface for the shared alternatives file content
export interface SharedAlternatives {
  times: string[];
}

export interface ExcelData {
  startDate: Date;
  endDate: Date;
  days: number;
  employees: Employee[];
  fileType: string;
  generatedTime: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// New JSON format interfaces
export interface AttendanceJsonDay {
  timeIn: string | null;
  timeOut: string | null;
  schedule?: {
    timeIn: string;
    timeOut: string;
    dayOfWeek: number;
  } | null;
}

export interface AttendanceJsonMonth {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  days: {
    [day: string]: AttendanceJsonDay;
  };
}

export interface BackupEntry {
  timestamp: string;
  changes: {
    day: number;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[];
}

export interface BackupJsonMonth {
  employeeId: string;
  year: number;
  month: number;
  backups: BackupEntry[];
}

export class AttendanceModel {
  private folderPath: string;
  private useJsonFormat: boolean = true; // Default to JSON format

  constructor(dbPath: string) {
    // In web mode, folderPath can be empty as it's not used
    this.folderPath = this.isWebMode() ? "" : `${dbPath}/SweldoDB/attendances`;
  }

  /**
   * Detect if running in web mode (as opposed to desktop/Electron mode)
   */
  private isWebMode(): boolean {
    return isWebEnvironment();
  }

  /**
   * Set whether to use JSON format (true) or CSV format (false)
   * Useful during the transition period
   */
  public setUseJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  /**
   * Check if a JSON version of the file exists
   */
  private async jsonFileExists(
    month: number,
    year: number,
    employeeId: string
  ): Promise<boolean> {
    const jsonFilePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.json`;
    return await window.electron.fileExists(jsonFilePath);
  }

  /**
   * Check if a CSV version of the file exists
   */
  private async csvFileExists(
    month: number,
    year: number,
    employeeId: string
  ): Promise<boolean> {
    const csvFilePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.csv`;
    return await window.electron.fileExists(csvFilePath);
  }

  /**
   * Get the appropriate file path based on format mode
   */
  private getFilePath(
    month: number,
    year: number,
    employeeId: string,
    forceFormat?: "json" | "csv"
  ): string {
    const format = forceFormat || (this.useJsonFormat ? "json" : "csv");
    return `${this.folderPath}/${employeeId}/${year}_${month}_attendance.${format}`;
  }

  /**
   * Get the backup file path
   */
  private getBackupFilePath(
    month: number,
    year: number,
    employeeId: string,
    forceFormat?: "json" | "csv"
  ): string {
    const format = forceFormat || (this.useJsonFormat ? "json" : "csv");
    return `${this.folderPath}/${employeeId}/${year}_${month}_attendance_backup.${format}`;
  }

  // Helper function to append records to the backup file (CSV mode)
  private async appendToBackup(
    recordsToBackup: Attendance[],
    filePath: string
  ): Promise<void> {
    if (recordsToBackup.length === 0) {
      return; // Nothing to backup
    }

    const backupFilePath = filePath.replace(
      "_attendance.csv",
      "_attendance_backup.csv"
    );
    const timestamp = new Date().toISOString();

    // Map record without alternative times AND explicitly select only needed fields
    const backupData = recordsToBackup.map((record) => ({
      timestamp: timestamp,
      // Explicitly list fields matching backupHeaders
      employeeId: record.employeeId,
      day: record.day,
      month: record.month,
      year: record.year,
      timeIn: record.timeIn,
      timeOut: record.timeOut,
    }));

    // Define headers specifically for the backup file
    const backupHeaders = [
      "timestamp",
      "employeeId",
      "day",
      "month",
      "year",
      "timeIn",
      "timeOut",
    ];

    try {
      const backupExists = await window.electron.fileExists(backupFilePath);
      const csvToAppend = Papa.unparse(backupData, {
        header: !backupExists,
        columns: backupHeaders,
      });
      const contentToAppend = backupExists ? `\n${csvToAppend}` : csvToAppend;
      await window.electron.appendFile(backupFilePath, contentToAppend);
    } catch (error) {
      console.error("Error appending to backup file:", backupFilePath, error);
    }
  }

  /**
   * Helper method to append to JSON backup file
   */
  private async appendToJsonBackup(
    changes: {
      day: number;
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[],
    month: number,
    year: number,
    employeeId: string
  ): Promise<void> {
    if (changes.length === 0) return;

    try {
      const backupJsonPath = this.getBackupFilePath(
        month,
        year,
        employeeId,
        "json"
      );
      const directoryPath = `${this.folderPath}/${employeeId}`;

      await window.electron.ensureDir(directoryPath);

      // Check if backup file already exists
      let backupData: BackupJsonMonth = {
        employeeId,
        year,
        month,
        backups: [],
      };

      const backupExists = await window.electron.fileExists(backupJsonPath);
      if (backupExists) {
        try {
          const existingContent = await window.electron.readFile(
            backupJsonPath
          );
          if (existingContent && existingContent.trim().length > 0) {
            backupData = JSON.parse(existingContent) as BackupJsonMonth;
          }
        } catch (readError) {
          console.warn(
            `Could not read existing backup JSON file ${backupJsonPath}, creating new one.`
          );
        }
      }

      // Create a new backup entry
      const timestamp = new Date().toISOString();
      backupData.backups.push({
        timestamp,
        changes,
      });

      // Write the updated backup JSON
      await window.electron.writeFile(
        backupJsonPath,
        JSON.stringify(backupData, null, 2)
      );
    } catch (error) {
      console.error(
        `Error appending to JSON backup for ${employeeId} ${year}-${month}:`,
        error
      );
    }
  }

  // Load attendances from CSV
  private async loadAttendancesFromCsv(
    month: number,
    year: number,
    employeeId: string
  ): Promise<Attendance[]> {
    try {
      const filePath = this.getFilePath(month, year, employeeId, "csv");
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent || fileContent.trim().length === 0) {
        return [];
      }

      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      return results.data.map((row: any) => ({
        employeeId: employeeId || "",
        day: parseInt(row.day),
        month: month || 0,
        year: year || 0,
        timeIn: row.timeIn ? row.timeIn : null,
        timeOut: row.timeOut ? row.timeOut : null,
      })) as Attendance[];
    } catch (error) {
      console.error(
        `Error loading CSV attendance for ${employeeId} ${year}-${month}:`,
        error
      );
      return [];
    }
  }

  // Load attendances from JSON
  private async loadAttendancesFromJson(
    month: number,
    year: number,
    employeeId: string
  ): Promise<Attendance[]> {
    try {
      const jsonFilePath = this.getFilePath(month, year, employeeId, "json");
      const jsonExists = await window.electron.fileExists(jsonFilePath);

      if (!jsonExists) {
        return []; // Return empty array if file doesn't exist
      }

      const fileContent = await window.electron.readFile(jsonFilePath);
      if (!fileContent || fileContent.trim().length === 0) {
        return []; // Return empty array if file is empty
      }

      const jsonData = JSON.parse(fileContent) as AttendanceJsonMonth;
      const attendances: Attendance[] = [];

      // Convert JSON days to Attendance array
      Object.entries(jsonData.days).forEach(([dayStr, dayData]) => {
        const day = parseInt(dayStr);
        if (isNaN(day)) return;

        attendances.push({
          employeeId,
          day,
          month,
          year,
          timeIn: dayData.timeIn,
          timeOut: dayData.timeOut,
          schedule: dayData.schedule,
        });
      });

      // Sort by day
      return attendances.sort((a, b) => a.day - b.day);
    } catch (error) {
      console.error(
        `Error loading JSON attendance for ${employeeId} ${year}-${month}:`,
        error
      );
      return []; // Return empty array on error
    }
  }

  // Implement the original public API methods
  // NOTE: These maintain the same interface for backward compatibility

  /**
   * Load ALL attendances from all employees and all their respective files.
   * This method is intended for full data sync operations.
   */
  public async loadAttendances(): Promise<Attendance[]> {
    const allAttendances: Attendance[] = [];
    // this.folderPath is expected to be like `dbPath/SweldoDB/attendances`

    if (this.isWebMode()) {
      return [];
    }

    try {
      const employeeDirs = await window.electron.readDir(this.folderPath);

      for (const dirEntry of employeeDirs) {
        if (dirEntry.isDirectory) {
          const employeeId = dirEntry.name;
          const employeePath = `${this.folderPath}/${employeeId}`;

          try {
            const filesInEmployeeDir = await window.electron.readDir(
              employeePath
            );
            for (const fileEntry of filesInEmployeeDir) {
              // Prioritize JSON files for loading all attendances
              if (
                fileEntry.isFile &&
                fileEntry.name.endsWith("_attendance.json") &&
                !fileEntry.name.includes("_backup")
              ) {
                const filePath = `${employeePath}/${fileEntry.name}`;
                try {
                  const fileContent = await window.electron.readFile(filePath);
                  if (fileContent && fileContent.trim().length > 0) {
                    const jsonData = JSON.parse(
                      fileContent
                    ) as AttendanceJsonMonth;
                    Object.entries(jsonData.days).forEach(
                      ([dayStr, dayData]) => {
                        const day = parseInt(dayStr);
                        if (isNaN(day)) return;
                        allAttendances.push({
                          employeeId: jsonData.meta.employeeId,
                          day,
                          month: jsonData.meta.month,
                          year: jsonData.meta.year,
                          timeIn: dayData.timeIn,
                          timeOut: dayData.timeOut,
                          schedule: dayData.schedule,
                        });
                      }
                    );
                  }
                } catch (fileReadError) {}
              }
            }
          } catch (readDirError) {}
        }
      }
    } catch (error) {}

    return allAttendances;
  }

  /**
   * Load attendances for a specific month, year, and employee
   * @param month The month to load data for
   * @param year The year to load data for
   * @param id The employee ID
   * @returns Array of attendance records
   */
  public async loadAttendancesById(
    month?: number,
    year?: number,
    id?: string
  ): Promise<Attendance[]> {
    if (!month || !year || !id) {
      return [];
    }

    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      return loadAttendanceFirestore(id, year, month, companyName);
    }

    // Desktop mode - use local file storage
    // First try JSON format if that's preferred
    if (this.useJsonFormat) {
      const jsonExists = await this.jsonFileExists(month, year, id);
      if (jsonExists) {
        return this.loadAttendancesFromJson(month, year, id);
      }
    }

    // Fall back to CSV if JSON doesn't exist or is not preferred
    const csvExists = await this.csvFileExists(month, year, id);
    if (csvExists) {
      return this.loadAttendancesFromCsv(month, year, id);
    }

    return []; // Return empty if neither exists
  }

  /**
   * Load a single attendance record by day
   */
  public async loadAttendanceByDay(
    day: number,
    month: number,
    year: number,
    employeeId: string
  ): Promise<Attendance | null> {
    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      return loadAttendanceByDayFirestore(
        day,
        month,
        year,
        employeeId,
        companyName
      );
    }

    // Desktop mode - use local file storage
    const attendances = await this.loadAttendancesById(month, year, employeeId);
    return attendances.find((att) => att.day === day) || null;
  }

  /**
   * Save attendances to storage - Legacy method, kept for compatibility
   * @deprecated Use saveOrUpdateAttendances instead
   */
  public async saveAttendances(
    attendances: Attendance[],
    month?: number,
    year?: number,
    id?: string
  ): Promise<void> {
    if (!month || !year || !id) {
      throw new Error("Month, year, and employee ID are required");
    }

    await this.saveOrUpdateAttendances(
      attendances.map((att) => ({
        day: att.day,
        timeIn: att.timeIn,
        timeOut: att.timeOut,
      })),
      month,
      year,
      id
    );
  }

  /**
   * Save or update attendance records
   */
  public async saveOrUpdateAttendances(
    attendancesToSave: (Omit<
      Attendance,
      "timeIn" | "timeOut" | "employeeId" | "month" | "year" | "day"
    > & {
      day: number;
      timeIn?: string | null;
      timeOut?: string | null;
    })[],
    month: number,
    year: number,
    employeeId: string
  ): Promise<void> {
    if (!attendancesToSave.length) return;

    // If in web mode, use Firestore
    if (this.isWebMode()) {
      // Convert to full Attendance objects
      const fullAttendances: Attendance[] = attendancesToSave.map((att) => ({
        employeeId,
        day: att.day,
        month,
        year,
        timeIn: att.timeIn ?? null,
        timeOut: att.timeOut ?? null,
        schedule: att.schedule,
      }));

      // Save to Firestore
      const companyName = await getCompanyName();
      await saveAttendanceFirestore(
        fullAttendances,
        employeeId,
        year,
        month,
        companyName
      );

      // Also update alternatives in Firestore if needed
      try {
        // Pass year and month for web mode too
        const currentAlternatives = await this.loadAlternativeTimes(
          employeeId,
          year,
          month
        );
        const alternativesSet = new Set(currentAlternatives);
        let alternativesChanged = false;

        // Iterate through the records to save/update
        for (const record of attendancesToSave) {
          const timesToAdd = [record.timeIn, record.timeOut];

          for (const time of timesToAdd) {
            // Check if time is valid (not null/empty and basic HH:MM format)
            if (
              time &&
              typeof time === "string" &&
              /^\d{1,2}:\d{2}$/.test(time)
            ) {
              if (!alternativesSet.has(time)) {
                alternativesSet.add(time);
                alternativesChanged = true;
              }
            }
          }
        }

        if (alternativesChanged) {
          const updatedAlternatives = Array.from(alternativesSet).sort();
          // Pass year and month for web mode too
          await this.saveAlternativeTimes(
            employeeId,
            year,
            month,
            updatedAlternatives
          );
        }
      } catch (altError) {
        console.warn(
          `Warning: Failed to update alternative times for employee ${employeeId} ${year}-${month}:`,
          altError
        );
      }

      return;
    }

    // Desktop mode - use local file storage
    try {
      // Ensure directory exists
      const directoryPath = `${this.folderPath}/${employeeId}`;
      await window.electron.ensureDir(directoryPath);

      // Load existing records
      const existingAttendances = await this.loadAttendancesById(
        month,
        year,
        employeeId
      );
      const recordsToBackup: Attendance[] = [];

      // Process each record to be saved/updated
      for (const newAttendance of attendancesToSave) {
        const existingAttendanceIndex = existingAttendances.findIndex(
          (att) => att.day === newAttendance.day
        );

        if (existingAttendanceIndex !== -1) {
          const existingRecord = existingAttendances[existingAttendanceIndex];
          // Update existing attendance
          const updatedRecord: Attendance = {
            ...existingRecord,
            timeIn:
              newAttendance.timeIn !== undefined
                ? newAttendance.timeIn
                : existingRecord.timeIn,
            timeOut:
              newAttendance.timeOut !== undefined
                ? newAttendance.timeOut
                : existingRecord.timeOut,
          };

          // Check if data changed
          if (
            updatedRecord.timeIn !== existingRecord.timeIn ||
            updatedRecord.timeOut !== existingRecord.timeOut
          ) {
            existingAttendances[existingAttendanceIndex] = updatedRecord;
            recordsToBackup.push(updatedRecord);
          }
        } else {
          // Add new attendance
          const addedRecord: Attendance = {
            employeeId: employeeId,
            month: month,
            year: year,
            day: newAttendance.day,
            timeIn: newAttendance.timeIn ?? null,
            timeOut: newAttendance.timeOut ?? null,
          };
          existingAttendances.push(addedRecord);
          recordsToBackup.push(addedRecord);
        }
      }

      if (recordsToBackup.length > 0) {
        // Sort records by day before saving
        existingAttendances.sort((a, b) => a.day - b.day);

        // Check if we're using JSON format
        if (this.useJsonFormat) {
          await this.saveAttendancesToJson(
            existingAttendances,
            month,
            year,
            employeeId
          );
        } else {
          await this.saveAttendancesToCsv(
            existingAttendances,
            month,
            year,
            employeeId
          );
        }

        // Add times to alternatives
        try {
          // Pass year and month for desktop mode
          const currentAlternatives = await this.loadAlternativeTimes(
            employeeId,
            year,
            month
          );
          const alternativesSet = new Set(currentAlternatives);
          let alternativesChanged = false;

          // Iterate through the records that were actually saved/updated
          for (const record of recordsToBackup) {
            const timesToAdd = [record.timeIn, record.timeOut];

            for (const time of timesToAdd) {
              // Check if time is valid (not null/empty and basic HH:MM format)
              if (
                time &&
                typeof time === "string" &&
                /^\d{1,2}:\d{2}$/.test(time)
              ) {
                if (!alternativesSet.has(time)) {
                  alternativesSet.add(time);
                  alternativesChanged = true;
                }
              }
            }
          }

          if (alternativesChanged) {
            const updatedAlternatives = Array.from(alternativesSet).sort();
            // Pass year and month for desktop mode
            await this.saveAlternativeTimes(
              employeeId,
              year,
              month,
              updatedAlternatives
            );
          }
        } catch (altError) {
          console.warn(
            `Warning: Failed to update alternative times for employee ${employeeId} ${year}-${month}:`,
            altError
          );
        }
      }
    } catch (error) {
      console.error(
        `Error saving or updating attendances for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Save attendances to CSV format
   */
  private async saveAttendancesToCsv(
    attendances: Attendance[],
    month: number,
    year: number,
    employeeId: string
  ): Promise<void> {
    try {
      const filePath = this.getFilePath(month, year, employeeId, "csv");

      // Map data for CSV
      const csvData = attendances.map((attendance) => ({
        employeeId: attendance.employeeId,
        day: attendance.day,
        month: attendance.month,
        year: attendance.year,
        timeIn: attendance.timeIn,
        timeOut: attendance.timeOut,
      }));

      // Explicitly define headers for main CSV file
      const mainHeaders = [
        "employeeId",
        "day",
        "month",
        "year",
        "timeIn",
        "timeOut",
      ];

      const csv = Papa.unparse(csvData, {
        header: true,
        columns: mainHeaders,
      });

      await window.electron.writeFile(filePath, csv);
      await this.appendToBackup(attendances, filePath);
    } catch (error) {
      console.error(
        `Error saving attendances to CSV for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Save attendances to JSON format
   */
  private async saveAttendancesToJson(
    attendances: Attendance[],
    month: number,
    year: number,
    employeeId: string
  ): Promise<void> {
    try {
      const jsonFilePath = this.getFilePath(month, year, employeeId, "json");
      const directoryPath = `${this.folderPath}/${employeeId}`;

      await window.electron.ensureDir(directoryPath);

      // Check if JSON file already exists
      let existingData: AttendanceJsonMonth = {
        meta: {
          employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
        },
        days: {},
      };

      const jsonExists = await window.electron.fileExists(jsonFilePath);
      if (jsonExists) {
        try {
          const existingContent = await window.electron.readFile(jsonFilePath);
          if (existingContent && existingContent.trim().length > 0) {
            existingData = JSON.parse(existingContent) as AttendanceJsonMonth;
          }
        } catch (readError) {
          console.warn(
            `Could not read existing JSON file ${jsonFilePath}, creating new one.`
          );
        }
      }

      // Create backup entries for the changes
      const backupEntries: {
        day: number;
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }[] = [];

      // Update the days in existing data
      for (const attendance of attendances) {
        const dayStr = attendance.day.toString();
        const existingDay = existingData.days[dayStr];

        // Check if timeIn changed
        if (existingDay && existingDay.timeIn !== attendance.timeIn) {
          backupEntries.push({
            day: attendance.day,
            field: "timeIn",
            oldValue: existingDay.timeIn,
            newValue: attendance.timeIn,
          });
        }

        // Check if timeOut changed
        if (existingDay && existingDay.timeOut !== attendance.timeOut) {
          backupEntries.push({
            day: attendance.day,
            field: "timeOut",
            oldValue: existingDay.timeOut,
            newValue: attendance.timeOut,
          });
        }

        // Update or add the day
        existingData.days[dayStr] = {
          timeIn: attendance.timeIn,
          timeOut: attendance.timeOut,
          schedule: attendance.schedule,
        };
      }

      // Update last modified timestamp
      existingData.meta.lastModified = new Date().toISOString();

      // Write the updated JSON
      await window.electron.writeFile(
        jsonFilePath,
        JSON.stringify(existingData, null, 2)
      );

      // If we have backup entries, save them
      if (backupEntries.length > 0) {
        await this.appendToJsonBackup(backupEntries, month, year, employeeId);
      }
    } catch (error) {
      console.error(
        `Error saving JSON attendance for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error;
    }
  }

  // --- Methods for handling alternatives ---

  // MODIFIED: Path for month-specific alternatives
  private getAlternativesFilePath(employeeId: string): string {
    // this.folderPath is [dbPath]/SweldoDB/attendances
    // Store alternatives within the employee's folder, alongside attendance files
    return `${this.folderPath}/${employeeId}/alternatives.json`;
  }

  /**
   * Loads the shared alternative time list for an employee.
   * Returns an empty list if the file doesn't exist or is invalid.
   */
  public async loadAlternativeTimes(
    employeeId: string,
    year: number,
    month: number
  ): Promise<string[]> {
    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      // console.log(
      //   `[Alternatives] Loading alternatives from Firestore for ${employeeId} ${year}-${month}`
      // );
      try {
        // Pass year and month to Firestore function (Firestore still uses month-specific)
        const times = await loadAlternativeTimesFirestore(
          employeeId,
          year,
          month,
          companyName
        );
        return times;
      } catch (error) {
        console.error(
          `[Alternatives] Error loading alternatives from Firestore: `,
          error
        );
        return []; // Return empty array on error
      }
    }

    // Desktop mode - use local file storage
    const filePath = this.getAlternativesFilePath(employeeId);
    try {
      console.log(
        `[Alternatives] Checking for alternatives file at: ${filePath}`
      );
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) {
        console.log(
          `[Alternatives] No alternatives file found for ${employeeId}`
        );
        return []; // Return empty array if file doesn't exist
      }
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent || fileContent.trim().length === 0) {
        console.log(
          `[Alternatives] Alternatives file exists but is empty for ${employeeId}`
        );
        return []; // Return empty array if file is empty
      }
      const data = JSON.parse(fileContent);
      // Basic validation for the structure { "times": [...] }
      if (
        typeof data === "object" &&
        data !== null &&
        Array.isArray(data.times)
      ) {
        console.log(
          `[Alternatives] Loaded ${data.times.length} alternatives for ${employeeId}`
        );
        return data.times;
      }
      console.warn(
        `Invalid format in alternatives file: ${filePath}. Expected { "times": [...] }. Returning empty list.`
      );
      return [];
    } catch (error) {
      console.error(
        `Error loading alternative times for ${employeeId} from ${filePath}:`,
        error
      );
      return []; // Return empty array on error
    }
  }

  /**
   * Saves the shared alternative time list for an employee.
   * Overwrites the existing file.
   */
  public async saveAlternativeTimes(
    employeeId: string,
    year: number,
    month: number,
    times: string[]
  ): Promise<void> {
    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      console.log(
        `[Alternatives] Saving ${times.length} alternatives to Firestore for ${employeeId} ${year}-${month}`
      );
      // Pass year and month to Firestore function (Firestore still uses month-specific)
      return saveAlternativeTimesFirestore(
        employeeId,
        year,
        month,
        times,
        companyName
      );
    }

    // Desktop mode - use local file storage
    const filePath = this.getAlternativesFilePath(employeeId);
    // The directory path should be for the employee's attendance folder
    const directoryPath = `${this.folderPath}/${employeeId}`;
    try {
      console.log(`[Alternatives] Ensuring directory exists: ${directoryPath}`);
      await window.electron.ensureDir(directoryPath);

      if (!Array.isArray(times)) {
        console.error(
          `[Alternatives] Invalid alternatives format provided for ${employeeId}. Expected array, got: ${typeof times}`
        );
        throw new Error(
          "Invalid alternatives format provided for saving. Expected an array of strings."
        );
      }
      console.log(
        `[Alternatives] Saving ${times.length} alternatives for ${employeeId} to: ${filePath}`
      );
      const dataToSave: SharedAlternatives = { times: times };
      const fileContent = JSON.stringify(dataToSave, null, 2);
      await window.electron.writeFile(filePath, fileContent);
      console.log(
        `[Alternatives] Successfully saved alternatives for ${employeeId}`
      );
    } catch (error) {
      console.error(
        `Error saving alternative times for ${employeeId} to ${filePath}:`,
        error
      );
      throw error;
    }
  }
}

// --- Utility Functions ---

/**
 * Migrates attendance data from CSV format to JSON format
 * @param dbPath The base path to the SweldoDB directory
 * @param onProgress Optional callback to report progress
 */
export async function migrateCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const attendancesBasePath = `${dbPath}/SweldoDB/attendances`;

  try {
    onProgress?.(`Starting CSV to JSON migration in: ${attendancesBasePath}`);
    const employeeDirs = await window.electron.readDir(attendancesBasePath);

    for (const dirEntry of employeeDirs) {
      if (dirEntry.isDirectory) {
        const employeeId = dirEntry.name;
        const employeePath = `${attendancesBasePath}/${employeeId}`;
        onProgress?.(`Processing employee: ${employeeId}`);

        try {
          const filesInEmployeeDir = await window.electron.readDir(
            employeePath
          );
          const csvFilesToMigrate: string[] = [];

          // Find all attendance CSV files for this employee
          for (const fileEntry of filesInEmployeeDir) {
            if (
              fileEntry.isFile &&
              fileEntry.name.endsWith("_attendance.csv") &&
              !fileEntry.name.includes("_backup")
            ) {
              csvFilesToMigrate.push(fileEntry.name);
            }
          }

          onProgress?.(
            `Found ${csvFilesToMigrate.length} CSV files to migrate for employee ${employeeId}`
          );

          for (const csvFileName of csvFilesToMigrate) {
            try {
              // Parse year and month from filename
              const fileNameMatch = csvFileName.match(
                /(\d+)_(\d+)_attendance\.csv/
              );
              if (!fileNameMatch) {
                onProgress?.(
                  `  - Skipping ${csvFileName}: Invalid filename format`
                );
                continue;
              }

              const year = parseInt(fileNameMatch[1]);
              const month = parseInt(fileNameMatch[2]);
              const csvFilePath = `${employeePath}/${csvFileName}`;

              onProgress?.(
                `  - Processing ${csvFileName} for ${year}-${month}`
              );

              // Read the CSV file
              const fileContent = await window.electron.readFile(csvFilePath);
              if (!fileContent || fileContent.trim().length === 0) {
                onProgress?.(`  - Skipping ${csvFileName}: File is empty`);
                continue;
              }

              // Parse CSV to attendance records
              const results = Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h) => h.trim(),
              });

              // Create JSON structure
              const jsonData: AttendanceJsonMonth = {
                meta: {
                  employeeId,
                  year,
                  month,
                  lastModified: new Date().toISOString(),
                },
                days: {},
              };

              // Convert each row to the days object
              results.data.forEach((row: any) => {
                const day = parseInt(row.day);
                if (isNaN(day)) return;

                jsonData.days[day.toString()] = {
                  timeIn: row.timeIn || null,
                  timeOut: row.timeOut || null,
                };

                // Add schedule if it exists
                if (
                  row.scheduleTimeIn &&
                  row.scheduleTimeOut &&
                  row.scheduleDayOfWeek
                ) {
                  jsonData.days[day.toString()].schedule = {
                    timeIn: row.scheduleTimeIn,
                    timeOut: row.scheduleTimeOut,
                    dayOfWeek: parseInt(row.scheduleDayOfWeek),
                  };
                }
              });

              // Create JSON file path
              const jsonFilePath = `${employeePath}/${year}_${month}_attendance.json`;

              // Write JSON file
              await window.electron.writeFile(
                jsonFilePath,
                JSON.stringify(jsonData, null, 2)
              );

              onProgress?.(`  - Created JSON file: ${jsonFilePath}`);

              // Process backup file if it exists
              const backupCsvPath = csvFilePath.replace(
                "_attendance.csv",
                "_attendance_backup.csv"
              );
              const backupExists = await window.electron.fileExists(
                backupCsvPath
              );

              if (backupExists) {
                onProgress?.(`  - Processing backup file for ${csvFileName}`);
                await migrateBackupFile(
                  backupCsvPath,
                  employeePath,
                  employeeId,
                  year,
                  month,
                  onProgress
                );
              }
            } catch (fileError) {
              const message =
                fileError instanceof Error
                  ? fileError.message
                  : String(fileError);
              onProgress?.(`  - Error processing ${csvFileName}: ${message}`);
            }
          }
        } catch (employeeError) {
          const message =
            employeeError instanceof Error
              ? employeeError.message
              : String(employeeError);
          onProgress?.(
            `  - Error reading employee directory ${employeePath}: ${message}`
          );
        }
      }
    }
    onProgress?.("CSV to JSON migration process completed successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`Migration failed: ${message}`);
    console.error("Migration Error:", error);
    throw error;
  }
}

/**
 * Migrates a backup CSV file to JSON format
 */
async function migrateBackupFile(
  backupCsvPath: string,
  employeePath: string,
  employeeId: string,
  year: number,
  month: number,
  onProgress?: (message: string) => void
): Promise<void> {
  // Force direct console output regardless of progress callback
  const logMsg = (msg: string) => {
    console.log(`[MIGRATION DEBUG] ${msg}`);
    onProgress?.(msg);
  };

  try {
    console.log(
      `[MIGRATION DEBUG] Starting migration for backup file: ${backupCsvPath}`
    );
    // Read the backup CSV file
    const backupContent = await window.electron.readFile(backupCsvPath);
    if (!backupContent || backupContent.trim().length === 0) {
      logMsg(`    - Skipping backup migration: Backup file is empty`);
      return;
    }

    logMsg(
      `    - [DEBUG] Raw backup file content length: ${backupContent.length} characters`
    );

    // Process the file directly line by line
    const lines = backupContent
      .split("\n")
      .filter((line) => line.trim() !== "");
    logMsg(`    - [DEBUG] Found ${lines.length} non-empty lines in file`);

    // Group lines by timestamp - find all lines that start with a timestamp
    const backupsByTimestamp = new Map<string, any[]>();
    let currentTimestamp: string | null = null;

    lines.forEach((line, index) => {
      // Try to extract a timestamp from the beginning of the line
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[^,]+)/);

      if (timestampMatch) {
        // This line starts with a timestamp, set it as the current one
        currentTimestamp = timestampMatch[1];
        logMsg(
          `    - [DEBUG] Found timestamp in line ${
            index + 1
          }: ${currentTimestamp}`
        );

        if (!backupsByTimestamp.has(currentTimestamp)) {
          backupsByTimestamp.set(currentTimestamp, []);
        }
      }

      if (currentTimestamp) {
        // Try to extract a record from this line
        // Format should be: timestamp,employeeId,day,month,year,timeIn,timeOut
        const parts = line.split(",");

        // We need at least 6 parts to have a valid record (last field might be empty)
        if (parts.length >= 6) {
          // Extract day, month, year, timeIn, timeOut from the line
          // The timestamp is already known (currentTimestamp)

          // Find employeeId, day, month, year indices
          let dataStartIndex = 0;
          if (timestampMatch) {
            // If this line starts with a timestamp, data starts after it
            dataStartIndex = 1; // Skip the timestamp part
          }

          // Extract the fields we need
          const extractedEmployeeId = parts[dataStartIndex] || employeeId;
          const day = parts[dataStartIndex + 1] || "";
          const extractedMonth = parts[dataStartIndex + 2] || month.toString();
          const extractedYear = parts[dataStartIndex + 3] || year.toString();
          const timeIn = parts[dataStartIndex + 4] || "";
          const timeOut = parts[dataStartIndex + 5] || "";

          // Check if this looks like valid data
          if (
            day &&
            !isNaN(parseInt(day)) &&
            parseInt(day) > 0 &&
            parseInt(day) <= 31
          ) {
            const record = {
              timestamp: currentTimestamp,
              employeeId: extractedEmployeeId,
              day,
              month: extractedMonth,
              year: extractedYear,
              timeIn,
              timeOut,
            };

            backupsByTimestamp.get(currentTimestamp)?.push(record);
            logMsg(
              `    - [DEBUG] Added record for day ${day} with timeIn=${timeIn}, timeOut=${timeOut}`
            );
          }
        }
      }
    });

    // Display what we found
    const timestamps = Array.from(backupsByTimestamp.keys());
    logMsg(`    - [DEBUG] Found ${timestamps.length} unique timestamps`);

    if (timestamps.length > 0) {
      logMsg(
        `    - [DEBUG] First 5 timestamps: ${timestamps.slice(0, 5).join(", ")}`
      );

      for (const [timestamp, records] of backupsByTimestamp.entries()) {
        logMsg(
          `    - [DEBUG] Timestamp ${timestamp} has ${records.length} records`
        );
      }
    }

    // Create the JSON backup structure
    const backupJsonData: BackupJsonMonth = {
      employeeId,
      year,
      month,
      backups: [],
    };

    logMsg(`    - Processing ${timestamps.length} unique timestamps`);

    // Process each timestamp separately
    timestamps.forEach((timestamp, index) => {
      const records = backupsByTimestamp.get(timestamp) || [];
      logMsg(
        `    - [DEBUG] Processing timestamp ${timestamp} with ${records.length} records`
      );

      if (records.length === 0) {
        logMsg(
          `    - [DEBUG] No records found for timestamp ${timestamp}, skipping`
        );
        return;
      }

      const changes: {
        day: number;
        field: string;
        oldValue: string | null;
        newValue: string | null;
      }[] = [];

      // Process each record in this timestamp group
      records.forEach((record) => {
        const day = parseInt(record.day);
        if (isNaN(day)) {
          logMsg(
            `    - [DEBUG] Skipping record with invalid day: ${record.day}`
          );
          return;
        }

        // Helper function to clean time values
        const cleanTimeValue = (
          value: string | null | undefined
        ): string | null => {
          if (!value) return null;

          // Extract just the HH:MM part, assuming time is in the format HH:MM
          const timePattern = /(\d{1,2}:\d{2})/;
          const match = value.match(timePattern);
          if (match) {
            return match[1];
          }

          return value.trim() || null;
        };

        // Add timeIn change if it exists
        if (record.timeIn !== undefined) {
          const cleanedTimeIn = cleanTimeValue(record.timeIn);
          changes.push({
            day: day,
            field: "timeIn",
            oldValue: null, // The old CSV format doesn't track old values
            newValue: cleanedTimeIn,
          });
          logMsg(
            `    - [DEBUG] Added timeIn change for day ${day}: ${record.timeIn} → ${cleanedTimeIn}`
          );
        }

        // Add timeOut change if it exists
        if (record.timeOut !== undefined) {
          const cleanedTimeOut = cleanTimeValue(record.timeOut);
          changes.push({
            day: day,
            field: "timeOut",
            oldValue: null, // The old CSV format doesn't track old values
            newValue: cleanedTimeOut,
          });
          logMsg(
            `    - [DEBUG] Added timeOut change for day ${day}: ${record.timeOut} → ${cleanedTimeOut}`
          );
        }
      });

      // Only add backup entry if there are changes
      if (changes.length > 0) {
        backupJsonData.backups.push({
          timestamp,
          changes,
        });
        logMsg(
          `    - [DEBUG] Added backup entry for timestamp ${timestamp} with ${changes.length} changes`
        );
      } else {
        logMsg(
          `    - [DEBUG] No changes found for timestamp ${timestamp}, skipping`
        );
      }

      if (index % 10 === 0 || index === timestamps.length - 1) {
        logMsg(
          `    - Processed ${index + 1}/${timestamps.length} backup entries`
        );
      }
    });

    logMsg(
      `    - Total backup entries processed: ${backupJsonData.backups.length}`
    );

    // Debug: Show first few entries in final JSON
    if (backupJsonData.backups.length > 0) {
      const firstEntry = backupJsonData.backups[0];
      logMsg(
        `    - [DEBUG] First backup entry: timestamp=${firstEntry.timestamp}, changes=${firstEntry.changes.length}`
      );
      if (backupJsonData.backups.length > 1) {
        const secondEntry = backupJsonData.backups[1];
        logMsg(
          `    - [DEBUG] Second backup entry: timestamp=${secondEntry.timestamp}, changes=${secondEntry.changes.length}`
        );
      }
    }

    // Create JSON backup file path
    const backupJsonPath = `${employeePath}/${year}_${month}_attendance_backup.json`;

    // Write JSON backup file
    await window.electron.writeFile(
      backupJsonPath,
      JSON.stringify(backupJsonData, null, 2)
    );

    logMsg(
      `    - Created backup JSON file: ${backupJsonPath} with ${backupJsonData.backups.length} entries`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logMsg(`    - Error migrating backup file: ${message}`);
  }
}

// MODIFIED: Direct implementation of alternative times migration
export async function migrateAttendanceAlternatives(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  onProgress?.("Starting migration of old alternative times (new model)...");
  // Uses createAttendanceModel from *this* file (attendance.ts)
  const model = createAttendanceModel(dbPath);
  const baseAttendancesPath = `${dbPath}/SweldoDB/attendances`; // Base path for employee folders

  try {
    // Discover employee folders directly within the SweldoDB/attendances directory
    // The model.folderPath is already SweldoDB/attendances, so we use it directly or its parent for employee discovery
    const employeeFolders = await window.electron.readDir(baseAttendancesPath);
    const employeeIds = employeeFolders
      .filter((f) => f.isDirectory)
      .map((f) => f.name);

    if (!employeeIds || employeeIds.length === 0) {
      onProgress?.("No employee IDs found to migrate alternatives for.");
      return;
    }
    onProgress?.(
      `Found ${employeeIds.length} employees to check for old alternatives.`
    );

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JS months are 0-indexed

    for (const empId of employeeIds) {
      // Path to the old, non-month-specific alternatives file
      const oldAlternativesFilePath = `${baseAttendancesPath}/${empId}/alternatives.json`;

      try {
        const fileExists = await window.electron.fileExists(
          oldAlternativesFilePath
        );
        if (fileExists) {
          const fileContent = await window.electron.readFile(
            oldAlternativesFilePath
          );
          if (fileContent && fileContent.trim().length > 0) {
            const oldData: SharedAlternatives = JSON.parse(fileContent);
            if (oldData.times && oldData.times.length > 0) {
              onProgress?.(
                `Migrating ${oldData.times.length} alternatives for ${empId} to ${currentYear}-${currentMonth}...`
              );
              // Save to the new month-specific location (current month for simplicity)
              // This now calls saveAlternativeTimes from the model in attendance.ts
              await model.saveAlternativeTimes(
                empId,
                currentYear,
                currentMonth,
                oldData.times
              );
              onProgress?.(
                `Successfully migrated alternatives for ${empId}. Old file can be reviewed and deleted: ${oldAlternativesFilePath}`
              );
              // Optionally, you might want to rename or delete the old file here
              // await window.electron.deleteFile(oldAlternativesFilePath);
            } else {
              // onProgress?.(`No alternatives to migrate in old file for ${empId}.`);
            }
          }
        } else {
          // onProgress?.(`No old alternatives file found for ${empId}.`);
        }
      } catch (migrateError) {
        onProgress?.(
          `Error migrating alternatives for ${empId}: ${migrateError}`
        );
        console.error(`Error during migration for ${empId}:`, migrateError);
      }
    }
    onProgress?.("Alternative times migration process completed (new model).");
  } catch (err) {
    onProgress?.(`Overall migration error (new model): ${err}`);
    console.error(
      "Error during overall alternatives migration (new model):",
      err
    );
  }
}

// Factory function to create AttendanceModel instance
export const createAttendanceModel = (dbPath: string): AttendanceModel => {
  // No need to modify the path for web mode, as the constructor now handles it
  return new AttendanceModel(dbPath);
};

// --- AttendanceSettings Model ---

export interface AttendanceSettings {
  overtimeEnabled: boolean;
  overtimeHourlyMultiplier: number;
  overtimeThresholdHours: number;
  autoClockOutEnabled: boolean;
  autoClockOutHour: number;
  autoClockOutMinute: number;
  hoursPerWorkDay: number;
}

export class AttendanceSettingsModel {
  private folderPath: string;
  private fileName: string = "attendance_settings.json";
  private filePathWithName: string;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
    this.filePathWithName = `${folderPath}/${this.fileName}`;
  }

  /**
   * Detect if running in web mode (as opposed to desktop/Electron mode)
   */
  private isWebMode(): boolean {
    return isWebEnvironment();
  }

  /**
   * Gets the default attendance settings
   */
  private getDefaultSettings(): AttendanceSettings {
    return {
      overtimeEnabled: false,
      overtimeHourlyMultiplier: 1.25,
      overtimeThresholdHours: 8,
      autoClockOutEnabled: false,
      autoClockOutHour: 17,
      autoClockOutMinute: 0,
      hoursPerWorkDay: 8,
    };
  }

  /**
   * Load attendance settings
   */
  public async loadSettings(): Promise<AttendanceSettings> {
    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      return loadAttendanceSettingsFirestore(companyName);
    }

    // Desktop mode - use local file storage
    try {
      // Check if file exists
      const fileExists = await window.electron.fileExists(
        this.filePathWithName
      );
      if (!fileExists) {
        // If file does not exist, create with default settings
        const defaultSettings = this.getDefaultSettings();
        await this.saveSettings(defaultSettings);
        return defaultSettings;
      }

      // Read and parse settings file
      const fileContent = await window.electron.readFile(this.filePathWithName);
      if (!fileContent || fileContent.trim().length === 0) {
        const defaultSettings = this.getDefaultSettings();
        await this.saveSettings(defaultSettings);
        return defaultSettings;
      }

      // Parse JSON
      const settings = JSON.parse(fileContent) as AttendanceSettings;

      // Ensure all properties exist (useful when adding new settings)
      const defaultSettings = this.getDefaultSettings();
      const mergedSettings = {
        ...defaultSettings,
        ...settings,
      };

      return mergedSettings;
    } catch (error) {
      console.error("Error loading attendance settings:", error);
      // Return default settings on error
      return this.getDefaultSettings();
    }
  }

  /**
   * Save attendance settings
   */
  public async saveSettings(settings: AttendanceSettings): Promise<void> {
    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      return saveAttendanceSettingsFirestore(settings, companyName);
    }

    // Desktop mode - use local file storage
    try {
      // Ensure directory exists
      await window.electron.ensureDir(this.folderPath);

      // Write settings to file
      const fileContent = JSON.stringify(settings, null, 2);
      await window.electron.writeFile(this.filePathWithName, fileContent);
    } catch (error) {
      console.error("Error saving attendance settings:", error);
      throw error;
    }
  }
}

// Factory function to create AttendanceSettingsModel instance
export const createAttendanceSettingsModel = (
  dbPath: string
): AttendanceSettingsModel => {
  const folderPath = `${dbPath}/SweldoDB/settings`;
  return new AttendanceSettingsModel(folderPath);
};

// Add any other missing functions from attendance_old.ts below
// If there are any attendance calculation or utility functions that were in the original file
// but haven't been migrated, add them here

/**
 * Calculate hours between two time strings (e.g., "08:00" and "17:00")
 * @returns Hours as a number, or 0 if input is invalid
 */
export function calculateHoursBetween(
  startTime: string | null,
  endTime: string | null
): number {
  if (!startTime || !endTime) return 0;

  // Parse time strings (HH:MM format)
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  if (
    isNaN(startHour) ||
    isNaN(startMinute) ||
    isNaN(endHour) ||
    isNaN(endMinute)
  ) {
    return 0;
  }

  // Calculate decimal hours
  const startDecimal = startHour + startMinute / 60;
  const endDecimal = endHour + endMinute / 60;

  // Handle cases where end time is the next day
  if (endDecimal < startDecimal) {
    return 24 - startDecimal + endDecimal;
  }

  return endDecimal - startDecimal;
}

/**
 * Determine if an employee is eligible for overtime based on settings and hours worked
 */
export function isEligibleForOvertime(
  hoursWorked: number,
  settings: AttendanceSettings
): boolean {
  return (
    settings.overtimeEnabled && hoursWorked > settings.overtimeThresholdHours
  );
}

/**
 * Calculate overtime hours based on settings and hours worked
 */
export function calculateOvertimeHours(
  hoursWorked: number,
  settings: AttendanceSettings
): number {
  if (!isEligibleForOvertime(hoursWorked, settings)) {
    return 0;
  }
  return Math.max(0, hoursWorked - settings.overtimeThresholdHours);
}

/**
 * Calculate regular (non-overtime) hours based on settings and hours worked
 */
export function calculateRegularHours(
  hoursWorked: number,
  settings: AttendanceSettings
): number {
  if (!settings.overtimeEnabled) {
    return hoursWorked;
  }
  return Math.min(hoursWorked, settings.overtimeThresholdHours);
}

/**
 * Calculate overtime pay based on settings, hours worked, and hourly rate
 */
export function calculateOvertimePay(
  hoursWorked: number,
  hourlyRate: number,
  settings: AttendanceSettings
): number {
  const overtimeHours = calculateOvertimeHours(hoursWorked, settings);
  return overtimeHours * hourlyRate * settings.overtimeHourlyMultiplier;
}

/**
 * Calculate regular pay based on settings, hours worked, and hourly rate
 */
export function calculateRegularPay(
  hoursWorked: number,
  hourlyRate: number,
  settings: AttendanceSettings
): number {
  const regularHours = calculateRegularHours(hoursWorked, settings);
  return regularHours * hourlyRate;
}

/**
 * Calculate total pay including overtime
 */
export function calculateTotalPay(
  hoursWorked: number,
  hourlyRate: number,
  settings: AttendanceSettings
): number {
  const regularPay = calculateRegularPay(hoursWorked, hourlyRate, settings);
  const overtimePay = calculateOvertimePay(hoursWorked, hourlyRate, settings);
  return regularPay + overtimePay;
}

/**
 * Specifically migrates attendance backup files from CSV to JSON format
 * @param dbPath The base path to the SweldoDB directory
 * @param onProgress Optional callback to report progress
 */
export async function migrateBackupCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const attendancesBasePath = `${dbPath}/SweldoDB/attendances`;
  let totalFilesProcessed = 0;

  try {
    console.log(
      `[MIGRATION] Starting backup CSV to JSON migration in: ${attendancesBasePath}`
    );
    onProgress?.(
      `Starting backup CSV to JSON migration in: ${attendancesBasePath}`
    );

    // First, try to process specific test file in backups directory
    try {
      const testBackupPath = `${dbPath}/backups/2025_4_attendance_backup.csv`;

      const testBackupExists = await window.electron.fileExists(testBackupPath);

      if (testBackupExists) {
        onProgress?.(`Found test backup file: ${testBackupPath}`);

        const testEmployeePath = `${dbPath}/backups`;
        await migrateBackupFile(
          testBackupPath,
          testEmployeePath,
          "2", // Assuming employeeId 2 based on your CSV sample
          2025, // Year from filename
          4, // Month from filename
          onProgress
        );

        totalFilesProcessed++;
        onProgress?.(`Test backup file processed successfully`);
      } else {
        console.log(
          `[MIGRATION] Test backup file not found at ${testBackupPath}`
        );
      }
    } catch (testError) {
      console.error(
        `[MIGRATION] Error processing test backup file:`,
        testError
      );
      onProgress?.(`Error processing test backup file: ${String(testError)}`);
    }

    // Now proceed with normal processing
    const employeeDirs = await window.electron.readDir(attendancesBasePath);

    for (const dirEntry of employeeDirs) {
      if (dirEntry.isDirectory) {
        const employeeId = dirEntry.name;
        const employeePath = `${attendancesBasePath}/${employeeId}`;
        onProgress?.(`Processing employee: ${employeeId}`);

        try {
          const filesInEmployeeDir = await window.electron.readDir(
            employeePath
          );
          const backupCsvFilesToMigrate: string[] = [];

          // Find all attendance backup CSV files for this employee
          for (const fileEntry of filesInEmployeeDir) {
            if (
              fileEntry.isFile &&
              fileEntry.name.endsWith("_attendance_backup.csv")
            ) {
              backupCsvFilesToMigrate.push(fileEntry.name);
            }
          }

          onProgress?.(
            `Found ${backupCsvFilesToMigrate.length} backup CSV files to migrate for employee ${employeeId}`
          );

          for (const backupCsvFileName of backupCsvFilesToMigrate) {
            try {
              // Parse year and month from filename
              const fileNameMatch = backupCsvFileName.match(
                /(\d+)_(\d+)_attendance_backup\.csv/
              );
              if (!fileNameMatch) {
                onProgress?.(
                  `  - Skipping ${backupCsvFileName}: Invalid filename format`
                );
                continue;
              }

              const year = parseInt(fileNameMatch[1]);
              const month = parseInt(fileNameMatch[2]);
              const backupCsvFilePath = `${employeePath}/${backupCsvFileName}`;

              onProgress?.(
                `  - Processing ${backupCsvFileName} for ${year}-${month}`
              );

              // Process backup file
              const backupExists = await window.electron.fileExists(
                backupCsvFilePath
              );

              if (backupExists) {
                onProgress?.(
                  `  - Processing backup file: ${backupCsvFileName}`
                );
                await migrateBackupFile(
                  backupCsvFilePath,
                  employeePath,
                  employeeId,
                  year,
                  month,
                  onProgress
                );
                totalFilesProcessed++;
              } else {
                console.log(
                  `[MIGRATION] Backup file doesn't exist: ${backupCsvFilePath}`
                );
                onProgress?.(
                  `  - Backup file doesn't exist: ${backupCsvFilePath}`
                );
              }
            } catch (fileError) {
              const message =
                fileError instanceof Error
                  ? fileError.message
                  : String(fileError);
              console.error(`[MIGRATION] Error processing file: ${message}`);
              onProgress?.(
                `  - Error processing backup file ${backupCsvFileName}: ${message}`
              );
            }
          }
        } catch (employeeError) {
          const message =
            employeeError instanceof Error
              ? employeeError.message
              : String(employeeError);
          console.error(
            `[MIGRATION] Error reading employee directory ${employeePath}: ${message}`
          );
          onProgress?.(
            `  - Error reading employee directory ${employeePath}: ${message}`
          );
        }
      }
    }

    if (totalFilesProcessed === 0) {
      onProgress?.(
        `WARNING: No backup files were processed. Please check file paths and permissions.`
      );
    } else {
      console.log(
        `[MIGRATION] Successfully processed ${totalFilesProcessed} backup files.`
      );
    }

    onProgress?.(
      `Backup CSV to JSON migration process completed successfully. Files processed: ${totalFilesProcessed}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MIGRATION] Backup migration failed: ${message}`);
    onProgress?.(`Backup migration failed: ${message}`);
    throw error;
  }
}
