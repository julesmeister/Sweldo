import { Employee } from "./employee";
import Papa from "papaparse";

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
interface AttendanceJsonDay {
  timeIn: string | null;
  timeOut: string | null;
  schedule?: {
    timeIn: string;
    timeOut: string;
    dayOfWeek: number;
  } | null;
}

interface AttendanceJsonMonth {
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

interface BackupEntry {
  timestamp: string;
  changes: {
    day: number;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[];
}

interface BackupJsonMonth {
  employeeId: string;
  year: number;
  month: number;
  backups: BackupEntry[];
}

export class AttendanceModel {
  private folderPath: string;
  private useJsonFormat: boolean = true; // Default to JSON format

  constructor(folderPath: string) {
    this.folderPath = folderPath;
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
   * Load attendances from CSV - Legacy method, kept for compatibility
   * @deprecated Use loadAttendancesById instead
   */
  public async loadAttendances(): Promise<Attendance[]> {
    try {
      const fileContent = await window.electron.readFile(this.folderPath);
      if (!fileContent || fileContent.trim().length === 0) {
        return []; // Return empty array if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });
      return results.data.map((row: any) => ({
        day: parseInt(row.day),
        timeIn: row.timeIn ? row.timeIn : null,
        timeOut: row.timeOut ? row.timeOut : null,
      })) as Attendance[];
    } catch (error) {
      return []; // Return empty array if there's an error
    }
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
          const currentAlternatives = await this.loadAlternativeTimes(
            employeeId
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
            await this.saveAlternativeTimes(employeeId, updatedAlternatives);
          }
        } catch (altError) {
          console.warn(
            `Warning: Failed to update alternative times for employee ${employeeId}:`,
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

  private getAlternativesFilePath(employeeId: string): string {
    return `${this.folderPath}/${employeeId}/alternatives.json`;
  }

  /**
   * Loads the shared alternative time list for an employee.
   * Returns an empty list if the file doesn't exist or is invalid.
   */
  public async loadAlternativeTimes(employeeId: string): Promise<string[]> {
    const filePath = this.getAlternativesFilePath(employeeId);
    try {
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) {
        return []; // Return empty array if file doesn't exist
      }
      const fileContent = await window.electron.readFile(filePath);
      const data = JSON.parse(fileContent);
      // Basic validation for the structure { "times": [...] }
      if (
        typeof data === "object" &&
        data !== null &&
        Array.isArray(data.times)
      ) {
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
    times: string[]
  ): Promise<void> {
    const filePath = this.getAlternativesFilePath(employeeId);
    const directoryPath = `${this.folderPath}/${employeeId}`;
    try {
      await window.electron.ensureDir(directoryPath); // Ensure directory exists
      // Basic validation before saving
      if (!Array.isArray(times)) {
        throw new Error(
          "Invalid alternatives format provided for saving. Expected an array of strings."
        );
      }
      // Structure the data for JSON file
      const dataToSave: SharedAlternatives = { times: times };
      const fileContent = JSON.stringify(dataToSave, null, 2); // Pretty print JSON
      await window.electron.writeFile(filePath, fileContent);
    } catch (error) {
      console.error(
        `Error saving alternative times for ${employeeId} to ${filePath}:`,
        error
      );
      throw error; // Re-throw to notify caller
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
  try {
    // Read the backup CSV file
    const backupContent = await window.electron.readFile(backupCsvPath);
    if (!backupContent || backupContent.trim().length === 0) {
      onProgress?.(`    - Skipping backup migration: Backup file is empty`);
      return;
    }

    // Parse CSV backup data
    const backupResults = Papa.parse(backupContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    // Create a map to organize backups by timestamp
    const backupsByTimestamp = new Map<string, any[]>();

    backupResults.data.forEach((row: any) => {
      const timestamp = row.timestamp;
      if (!timestamp) return;

      if (!backupsByTimestamp.has(timestamp)) {
        backupsByTimestamp.set(timestamp, []);
      }
      backupsByTimestamp.get(timestamp)?.push(row);
    });

    // Create the JSON backup structure
    const backupJsonData: BackupJsonMonth = {
      employeeId,
      year,
      month,
      backups: [],
    };

    // Convert each timestamp group to a backup entry
    backupsByTimestamp.forEach((rows, timestamp) => {
      const changes = rows.map((row) => {
        return {
          day: parseInt(row.day),
          field: row.timeIn !== undefined ? "timeIn" : "timeOut",
          oldValue: null, // We don't have the old value in the current backup format
          newValue: row.timeIn !== undefined ? row.timeIn : row.timeOut,
        };
      });

      backupJsonData.backups.push({
        timestamp,
        changes,
      });
    });

    // Create JSON backup file path
    const backupJsonPath = `${employeePath}/${year}_${month}_attendance_backup.json`;

    // Write JSON backup file
    await window.electron.writeFile(
      backupJsonPath,
      JSON.stringify(backupJsonData, null, 2)
    );

    onProgress?.(`    - Created backup JSON file: ${backupJsonPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`    - Error migrating backup file: ${message}`);
  }
}

// Re-export the legacy function (redirect to the old implementation)
export async function migrateAttendanceAlternatives(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // This will be imported from attendance_old.ts
  const oldModule = await import("./attendance_old");
  return oldModule.migrateAttendanceAlternatives(dbPath, onProgress);
}

// Factory function to create AttendanceModel instance
export const createAttendanceModel = (dbPath: string): AttendanceModel => {
  const folderPath = `${dbPath}/SweldoDB/attendances`;
  return new AttendanceModel(folderPath);
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
