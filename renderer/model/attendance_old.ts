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
            employeeId,
            year,
            month
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
            await this.saveAlternativeTimes(
              employeeId,
              year,
              month,
              updatedAlternatives
            );
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

  // NEW/MODIFIED helper to get the path for month-specific alternatives
  private getAlternativesFilePath(
    employeeId: string,
    year: number,
    month: number
  ): string {
    // Construct path like: [dbPath]/employees/[employeeId]/attendances/alternatives_[employeeId]_[year]_[month].json
    return `${this.folderPath}/employees/${employeeId}/attendances/alternatives_${employeeId}_${year}_${month}.json`;
  }

  // MODIFIED: Load alternative times for a specific employee, year, and month
  public async loadAlternativeTimes(
    employeeId: string,
    year: number,
    month: number
  ): Promise<string[]> {
    const filePath = this.getAlternativesFilePath(employeeId, year, month);
    try {
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) {
        // console.log(`Alternatives file not found for ${employeeId} ${year}-${month}, returning empty array.`);
        return [];
      }
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent || fileContent.trim().length === 0) {
        return [];
      }
      const data: SharedAlternatives = JSON.parse(fileContent);
      return data.times || [];
    } catch (error) {
      console.error(`Error loading alternative times from ${filePath}:`, error);
      return [];
    }
  }

  // MODIFIED: Save alternative times for a specific employee, year, and month
  public async saveAlternativeTimes(
    employeeId: string,
    year: number,
    month: number,
    times: string[]
  ): Promise<void> {
    const filePath = this.getAlternativesFilePath(employeeId, year, month);
    const data: SharedAlternatives = { times };
    try {
      // Ensure directory exists before writing
      const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
      await window.electron.ensureDir(dirPath); // You might need to implement/use your actual ensureDir function

      await window.electron.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error saving alternative times to ${filePath}:`, error);
      throw error; // Re-throw to allow UI to handle
    }
  }
} // End of AttendanceModel class

// Migration function - THIS WILL LIKELY NEED ADJUSTMENT
// If you run this, it will attempt to move old alternatives (from a single shared file per employee)
// to the *current* month/year. You might need a more sophisticated migration.
export async function migrateAttendanceAlternatives(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  onProgress?.("Starting migration of old alternative times...");
  const model = createAttendanceModel(dbPath);

  try {
    // This needs a way to get all employee IDs.
    // Assuming you have an employee service or can list employee directories.
    // For demonstration, let's imagine a function getEmployeeIds() exists.
    // const employeeIds = await getEmployeeIdsFromSomewhere(dbPath);

    // Placeholder: Manually list employee IDs if you don't have a dynamic way
    // const employeeIds = ["employee1", "employee2"]; // Replace with actual IDs or discovery method

    // As a simple example, let's assume we need to discover employee folders
    const employeesDir = `${dbPath}/employees`;
    const employeeFolders = await window.electron.readDir(employeesDir);
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
      const oldAlternativesFilePath = `${dbPath}/employees/${empId}/attendances/alternatives.json`; // Old path

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
    onProgress?.("Alternative times migration process completed.");
  } catch (err) {
    onProgress?.(`Overall migration error: ${err}`);
    console.error("Error during overall alternatives migration:", err);
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
