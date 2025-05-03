import { Employee } from "./employee";

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

// Interface for the shared alternatives file content (Simplified)
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

import Papa from "papaparse";
import { useState } from "react";

export class AttendanceModel {
  private folderPath: string;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
  }

  // Helper function to append records to the backup file
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

    // Map record without alternative times
    const backupData = recordsToBackup.map((record) => ({
      timestamp: timestamp,
      ...record,
    }));

    // Define headers specifically for the backup file (removed alternatives)
    const backupHeaders = [
      "timestamp",
      "employeeId",
      "day",
      "month",
      "year",
      "timeIn",
      "timeOut",
      // Removed alternativeTimeIns, alternativeTimeOuts
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

  // Load attendances from CSV
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

  // Load attendances from CSV based on month, year, and employee ID
  public async loadAttendancesById(
    month?: number,
    year?: number,
    id?: string
  ): Promise<Attendance[]> {
    try {
      const filePath = `${this.folderPath}/${id}/${year}_${month}_attendance.csv`;
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent || fileContent.trim().length === 0) {
        return [];
      }

      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      // Map without alternative times
      return results.data.map((row: any) => ({
        employeeId: id || "",
        day: parseInt(row.day),
        month: month || 0,
        year: year || 0,
        timeIn: row.timeIn ? row.timeIn : null,
        timeOut: row.timeOut ? row.timeOut : null,
      })) as Attendance[];
    } catch (error) {
      console.error(
        `Error loading attendance for ${id} ${year}-${month}:`,
        error
      );
      return [];
    }
  }

  // Load single attendance by day
  public async loadAttendanceByDay(
    day: number,
    month: number,
    year: number,
    employeeId: string
  ): Promise<Attendance | null> {
    try {
      const filePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.csv`;
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent || fileContent.trim().length === 0) {
        return null;
      }

      // Adjust type - remove alternativeTimeIns
      type AttendanceRow = {
        day: string;
        timeIn: string;
        timeOut: string;
        // alternativeTimeIns: string; // Removed
      };

      const results = Papa.parse<AttendanceRow>(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      const attendance = results.data.find((row) => parseInt(row.day) === day);

      // Map without alternative times
      return attendance
        ? {
            employeeId,
            day: parseInt(attendance.day),
            month,
            year,
            timeIn: attendance.timeIn ? attendance.timeIn : null,
            timeOut: attendance.timeOut ? attendance.timeOut : null,
            // alternativeTimeIns: attendance.alternativeTimeIns // Removed
            //   ? JSON.parse(attendance.alternativeTimeIns)
            //   : [],
          }
        : null;
    } catch (error) {
      console.error(
        `Error loading attendance for ${employeeId} on ${year}-${month}-${day}:`,
        error
      );
      return null;
    }
  }

  // Save attendances to CSV - DEPRECATED? Consider removing or updating.
  // Note: This method does NOT handle backups and has issues with array stringification.
  // Use saveOrUpdateAttendances instead.
  public async saveAttendances(
    attendances: Attendance[],
    month?: number,
    year?: number,
    id?: string
  ): Promise<void> {
    try {
      const filePath = `${this.folderPath}/${id}/${year}_${month}_attendance.csv`;
      // Warning: This does not stringify arrays correctly for CSV
      // Also, alternatives are no longer part of Attendance interface
      const csv = Papa.unparse(
        attendances.map((att) => ({
          // Map to exclude schedule if needed
          employeeId: att.employeeId,
          day: att.day,
          month: att.month,
          year: att.year,
          timeIn: att.timeIn,
          timeOut: att.timeOut,
        }))
      );
      await window.electron.writeFile(filePath, csv);
      // No backup implemented here
    } catch (error) {
      throw error;
    }
  }

  // Save or update attendances to CSV
  public async saveOrUpdateAttendances(
    // Input type no longer needs alternativeTimeIns/Outs
    attendancesToSave: (Omit<
      Attendance,
      "timeIn" | "timeOut" | "employeeId" | "month" | "year" | "day"
    > & {
      day: number;
      timeIn?: string | null;
      timeOut?: string | null;
      // alternativeTimeIns?: string[]; // Removed
      // alternativeTimeOuts?: string[]; // Removed
    })[],
    month: number,
    year: number,
    employeeId: string
  ): Promise<void> {
    try {
      const filePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.csv`;
      const directoryPath = `${this.folderPath}/${employeeId}`;

      await window.electron.ensureDir(directoryPath);

      const existingAttendances =
        (await this.loadAttendancesById(month, year, employeeId)) || [];

      const recordsToBackup: Attendance[] = [];

      for (const newAttendance of attendancesToSave) {
        const existingAttendanceIndex = existingAttendances.findIndex(
          (att) => att.day === newAttendance.day
        );

        if (existingAttendanceIndex !== -1) {
          const existingRecord = existingAttendances[existingAttendanceIndex];
          // Update existing attendance without alternatives
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
            // Removed alternativeTimeIns/Outs update logic
          };

          // Check if only timeIn or timeOut changed
          if (
            updatedRecord.timeIn !== existingRecord.timeIn ||
            updatedRecord.timeOut !== existingRecord.timeOut
            // Removed alternativeTimeIns/Outs comparison
          ) {
            existingAttendances[existingAttendanceIndex] = updatedRecord;
            recordsToBackup.push(updatedRecord);
          }
        } else {
          // Add new attendance without alternatives
          const addedRecord: Attendance = {
            employeeId: employeeId,
            month: month,
            year: year,
            day: newAttendance.day,
            timeIn: newAttendance.timeIn ?? null,
            timeOut: newAttendance.timeOut ?? null,
            // Removed alternativeTimeIns/Outs initialization
          };
          existingAttendances.push(addedRecord);
          recordsToBackup.push(addedRecord);
        }
      }

      if (recordsToBackup.length > 0) {
        // Sort records by day before saving
        existingAttendances.sort((a, b) => a.day - b.day);

        // Map data for CSV without alternatives
        const csvData = existingAttendances.map((attendance) => ({
          employeeId: attendance.employeeId,
          day: attendance.day,
          month: attendance.month,
          year: attendance.year,
          timeIn: attendance.timeIn,
          timeOut: attendance.timeOut,
          // Removed alternativeTimeIns/Outs stringification
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
        await this.appendToBackup(recordsToBackup, filePath);

        // --- Add/Update Alternatives ---
        try {
          const currentAlternatives = await this.loadAlternativeTimes(
            employeeId
          );
          const alternativesSet = new Set(currentAlternatives); // Use a Set for efficient checking
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
            const updatedAlternatives = Array.from(alternativesSet).sort(); // Keep it sorted
            await this.saveAlternativeTimes(employeeId, updatedAlternatives);
            console.log(`Updated alternatives for employee ${employeeId}`); // Optional logging
          }
        } catch (altError) {
          // Log the error but don't let it block the main save operation success
          console.warn(
            `Warning: Failed to update alternative times for employee ${employeeId}:`,
            altError
          );
        }
        // --- End Add/Update Alternatives ---
      }
    } catch (error) {
      console.error(
        `Error saving or updating attendances for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error;
    }
  }

  // --- Methods for Shared Alternatives ---

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
      // Basic validation for the new structure { "times": [...] }
      if (
        typeof data === "object" &&
        data !== null &&
        Array.isArray(data.times)
      ) {
        // Further validation could be added here to check if elements are strings/valid times
        return data.times; // Return the times array directly
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
        // Check if input is an array
        throw new Error(
          "Invalid alternatives format provided for saving. Expected an array of strings."
        );
      }
      // Structure the data for JSON file
      const dataToSave: SharedAlternatives = { times: times };
      const fileContent = JSON.stringify(dataToSave, null, 2); // Pretty print JSON { "times": [...] }
      await window.electron.writeFile(filePath, fileContent);
    } catch (error) {
      console.error(
        `Error saving alternative times for ${employeeId} to ${filePath}:`,
        error
      );
      throw error; // Re-throw to notify caller
    }
  }
} // End of AttendanceModel class

// --- Migration Function --- (Add this function outside the class)

/**
 * Migrates old attendance CSVs containing alternativeTimeIns/Outs columns.
 * Extracts unique times into a shared alternatives.json file for each employee.
 * Rewrites the CSVs to remove the old columns.
 * @param dbPath The base path to the SweldoDB directory.
 * @param onProgress Optional callback to report progress (e.g., processed employee ID).
 */
export async function migrateAttendanceAlternatives(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const attendancesBasePath = `${dbPath}/SweldoDB/attendances`;
  const model = createAttendanceModel(dbPath); // Use existing factory

  try {
    onProgress?.(`Starting migration in: ${attendancesBasePath}`);
    const employeeDirs = await window.electron.readDir(attendancesBasePath);

    for (const dirEntry of employeeDirs) {
      if (dirEntry.isDirectory) {
        const employeeId = dirEntry.name;
        const employeePath = `${attendancesBasePath}/${employeeId}`;
        onProgress?.(`Processing employee: ${employeeId}`);

        const allAlternativeTimes = new Set<string>();
        let migrationNeeded = false;

        try {
          const filesInEmployeeDir = await window.electron.readDir(
            employeePath
          );
          const csvFilesToMigrate: string[] = [];

          // --- Pass 1: Read all CSVs, collect unique alternatives ---
          for (const fileEntry of filesInEmployeeDir) {
            if (
              fileEntry.isFile &&
              fileEntry.name.endsWith("_attendance.csv")
            ) {
              const csvFilePath = `${employeePath}/${fileEntry.name}`;
              try {
                const fileContent = await window.electron.readFile(csvFilePath);
                if (fileContent && fileContent.trim().length > 0) {
                  const results = Papa.parse(fileContent, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (h) => h.trim(),
                  });

                  // Check if old columns exist
                  if (
                    results.meta.fields?.includes("alternativeTimeIns") ||
                    results.meta.fields?.includes("alternativeTimeOuts")
                  ) {
                    migrationNeeded = true; // Mark that this employee needs migration
                    csvFilesToMigrate.push(csvFilePath);
                    onProgress?.(`  - Found old format in: ${fileEntry.name}`);

                    results.data.forEach((row: any) => {
                      // Extract from both potential columns
                      const alternatives = [
                        row.alternativeTimeIns,
                        row.alternativeTimeOuts,
                      ];
                      alternatives.forEach((altString) => {
                        if (
                          altString &&
                          typeof altString === "string" &&
                          altString.trim().startsWith("[")
                        ) {
                          try {
                            const times: string[] = JSON.parse(altString);
                            if (Array.isArray(times)) {
                              times.forEach((time) => {
                                if (
                                  typeof time === "string" &&
                                  time.match(/^\d{1,2}:\d{2}$/)
                                ) {
                                  // Basic time format check
                                  allAlternativeTimes.add(time);
                                }
                              });
                            }
                          } catch (parseError) {
                            // Ignore parse errors for individual rows
                            onProgress?.(
                              `    - Warning: Could not parse alternatives in row for ${fileEntry.name}`
                            );
                          }
                        }
                      });
                    });
                  }
                }
              } catch (readError) {
                // Safely access error message
                const message =
                  readError instanceof Error
                    ? readError.message
                    : String(readError);
                onProgress?.(`  - Error reading ${csvFilePath}: ${message}`);
              }
            }
          }

          // --- Save collected alternatives if migration was needed for this employee ---
          if (migrationNeeded) {
            const uniqueTimesArray = Array.from(allAlternativeTimes).sort();
            onProgress?.(
              `  - Saving ${uniqueTimesArray.length} unique alternative times to alternatives.json`
            );
            try {
              await model.saveAlternativeTimes(employeeId, uniqueTimesArray);
            } catch (saveAltError) {
              // Safely access error message
              const message =
                saveAltError instanceof Error
                  ? saveAltError.message
                  : String(saveAltError);
              onProgress?.(
                `  - Error saving alternatives.json for ${employeeId}: ${message}. Skipping CSV rewrite for this employee.`
              );
              continue; // Skip to next employee if saving alternatives failed
            }

            // --- Pass 2: Rewrite CSVs to remove old columns ---
            onProgress?.(
              `  - Rewriting ${csvFilesToMigrate.length} CSV files...`
            );
            const finalHeaders = [
              "employeeId",
              "day",
              "month",
              "year",
              "timeIn",
              "timeOut",
            ];

            for (const csvFilePath of csvFilesToMigrate) {
              try {
                const fileContent = await window.electron.readFile(csvFilePath);
                const results = Papa.parse(fileContent, {
                  header: true,
                  skipEmptyLines: true,
                  transformHeader: (h) => h.trim(),
                });

                // Filter data to keep only the final columns
                const cleanedData = results.data.map((row: any) => ({
                  employeeId: row.employeeId || employeeId,
                  day: row.day,
                  month: row.month,
                  year: row.year,
                  timeIn: row.timeIn || null,
                  timeOut: row.timeOut || null,
                }));

                const newCsvContent = Papa.unparse(cleanedData, {
                  columns: finalHeaders,
                  header: true,
                });

                await window.electron.writeFile(csvFilePath, newCsvContent);
                onProgress?.(`    - Rewrote: ${csvFilePath.split("/").pop()}`);
              } catch (rewriteError) {
                // Safely access error message
                const message =
                  rewriteError instanceof Error
                    ? rewriteError.message
                    : String(rewriteError);
                onProgress?.(
                  `    - Error rewriting ${csvFilePath
                    .split("/")
                    .pop()}: ${message}`
                );
              }
            }
          } else {
            onProgress?.(
              `  - No migration needed (no old format files found).`
            );
          }
        } catch (employeeReadError) {
          // Safely access error message
          const message =
            employeeReadError instanceof Error
              ? employeeReadError.message
              : String(employeeReadError);
          onProgress?.(
            `  - Error reading employee directory ${employeePath}: ${message}`
          );
        }
      }
    }
    onProgress?.("Migration process completed.");
  } catch (error) {
    // Safely access error message
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`Migration failed: ${message}`);
    console.error("Migration Error:", error);
    throw error; // Re-throw error after logging
  }
}

// Factory function to create AttendanceModel instance
export const createAttendanceModel = (dbPath: string): AttendanceModel => {
  const folderPath = `${dbPath}/SweldoDB/attendances`; // Adjust the path as needed
  return new AttendanceModel(folderPath);
};

function row(value: unknown, index: number, obj: unknown[]): value is unknown {
  throw new Error("Function not implemented.");
}
