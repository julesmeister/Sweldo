import Papa from "papaparse";
import { Attendance } from "./attendance_old";

// Type definitions for the new JSON structure
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

/**
 * Migrates attendance data from CSV format to JSON format.
 * @param dbPath The base path to the SweldoDB directory.
 * @param onProgress Optional callback to report progress.
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

                // Add schedule if it exists (we'll need to adapt this based on your actual data structure)
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

/**
 * Extends the AttendanceModel with JSON capabilities.
 * This can be used to implement JSON-based versions of the model methods.
 */
export class JsonAttendanceModel {
  private folderPath: string;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
  }

  /**
   * Loads attendance data from JSON for a specific month and employee
   */
  public async loadAttendancesFromJson(
    month: number,
    year: number,
    employeeId: string
  ): Promise<Attendance[]> {
    try {
      const jsonFilePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.json`;
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

  /**
   * Saves or updates attendance data in JSON format
   */
  public async saveOrUpdateAttendancesAsJson(
    attendancesToSave: Attendance[],
    month: number,
    year: number,
    employeeId: string
  ): Promise<void> {
    if (!attendancesToSave.length) return;

    try {
      const jsonFilePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.json`;
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
      for (const attendance of attendancesToSave) {
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

  /**
   * Appends backup entries to the backup JSON file
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
      const backupJsonPath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance_backup.json`;
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
}

// Factory function to create JsonAttendanceModel instance
export const createJsonAttendanceModel = (
  dbPath: string
): JsonAttendanceModel => {
  const folderPath = `${dbPath}/SweldoDB/attendances`;
  return new JsonAttendanceModel(folderPath);
};
