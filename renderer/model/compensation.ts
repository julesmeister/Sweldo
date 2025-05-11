import Papa from "papaparse";
import {
  loadCompensationFirestore,
  loadEmployeeCompensationFirestore,
  saveCompensationFirestore,
  saveOrUpdateCompensationsFirestore,
} from "./compensation_firestore";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";

export type DayType = "Regular" | "Holiday" | "Rest Day" | "Special";

export interface Compensation {
  employeeId: string;
  month: number;
  year: number;
  day: number;
  dayType: DayType;
  dailyRate: number;
  hoursWorked?: number;
  overtimeMinutes?: number;
  overtimePay?: number;
  undertimeMinutes?: number;
  undertimeDeduction?: number;
  lateMinutes?: number;
  lateDeduction?: number;
  holidayBonus?: number;
  leaveType?: "Vacation" | "Sick" | "Unpaid" | "None";
  leavePay?: number;
  grossPay?: number;
  deductions?: number;
  netPay?: number;
  manualOverride?: boolean;
  notes?: string;
  absence?: boolean;
  nightDifferentialHours: number;
  nightDifferentialPay: number;
}

// New JSON structure interfaces - export them so they can be used by Firestore implementations
export interface CompensationJsonDay {
  dayType: DayType;
  dailyRate: number;
  hoursWorked?: number;
  overtimeMinutes?: number;
  overtimePay?: number;
  undertimeMinutes?: number;
  undertimeDeduction?: number;
  lateMinutes?: number;
  lateDeduction?: number;
  holidayBonus?: number;
  leaveType?: "Vacation" | "Sick" | "Unpaid" | "None";
  leavePay?: number;
  grossPay?: number;
  deductions?: number;
  netPay?: number;
  manualOverride?: boolean;
  notes?: string;
  absence?: boolean;
  nightDifferentialHours: number;
  nightDifferentialPay: number;
}

export interface CompensationJsonMonth {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  days: {
    [day: string]: CompensationJsonDay;
  };
}

export interface BackupEntry {
  timestamp: string;
  changes: {
    day: number;
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface BackupJsonMonth {
  employeeId: string;
  year: number;
  month: number;
  backups: BackupEntry[];
}

export class CompensationModel {
  private folderPath: string;
  private useJsonFormat: boolean = true; // Default to JSON format

  constructor(filePath: string) {
    this.folderPath = filePath;
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
    const jsonFilePath = `${this.folderPath}/${employeeId}/${year}_${month}_compensation.json`;
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
    const csvFilePath = `${this.folderPath}/${employeeId}/${year}_${month}_compensation.csv`;
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
    return `${this.folderPath}/${employeeId}/${year}_${month}_compensation.${format}`;
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
    return `${this.folderPath}/${employeeId}/${year}_${month}_compensation_backup.${format}`;
  }

  // Helper function to append records to the backup file (CSV mode)
  private async appendToBackup(
    recordsToBackup: Compensation[],
    filePath: string
  ): Promise<void> {
    if (!recordsToBackup || recordsToBackup.length === 0) {
      return; // Nothing to backup or invalid input
    }

    const backupFilePath = filePath.replace(
      "_compensation.csv",
      "_compensation_backup.csv"
    );
    const timestamp = new Date().toISOString();

    // Map records to include the timestamp
    const backupData = recordsToBackup.map((record) => ({
      timestamp: timestamp,
      ...record,
    }));

    // Define headers specifically for the backup file, including timestamp
    const backupHeaders = [
      "timestamp",
      "employeeId",
      "month",
      "year",
      "day",
      "dayType",
      "dailyRate",
      "hoursWorked",
      "overtimeMinutes",
      "overtimePay",
      "undertimeMinutes",
      "undertimeDeduction",
      "lateMinutes",
      "lateDeduction",
      "holidayBonus",
      "leaveType",
      "leavePay",
      "grossPay",
      "deductions",
      "netPay",
      "manualOverride",
      "notes",
      "absence",
      "nightDifferentialHours",
      "nightDifferentialPay",
    ];

    try {
      const backupExists = await window.electron.fileExists(backupFilePath);

      // Convert to CSV. Only include headers if the file doesn't exist.
      const csvToAppend = Papa.unparse(backupData, {
        header: !backupExists,
        columns: backupHeaders, // Ensure consistent column order
      });

      // Ensure content starts on a new line if appending to existing file
      const contentToAppend = backupExists ? `\n${csvToAppend}` : csvToAppend;

      await window.electron.appendFile(backupFilePath, contentToAppend);
    } catch (error) {
      console.error(
        "Error appending to compensation backup file:",
        backupFilePath,
        error
      );
    }
  }

  /**
   * Helper method to append to JSON backup file
   */
  private async appendToJsonBackup(
    changes: {
      day: number;
      field: string;
      oldValue: any;
      newValue: any;
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

  // Load compensation records from CSV
  private async loadRecordsFromCsv(
    month: number,
    year: number,
    employeeId: string
  ): Promise<Compensation[]> {
    try {
      const filePath = this.getFilePath(month, year, employeeId, "csv");

      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent) {
        return []; // Return empty array if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });
      return results.data.map((row: any) => ({
        employeeId: row.employeeId,
        month: parseInt(row.month, 10),
        year: parseInt(row.year, 10),
        day: parseInt(row.day, 10),
        dayType: (row.dayType || "Regular") as DayType,
        dailyRate: row.dailyRate ? parseFloat(row.dailyRate) : undefined,
        hoursWorked: row.hoursWorked ? parseFloat(row.hoursWorked) : undefined,
        overtimeMinutes: row.overtimeMinutes
          ? parseFloat(row.overtimeMinutes)
          : undefined,
        overtimePay: row.overtimePay ? parseFloat(row.overtimePay) : undefined,
        undertimeMinutes: row.undertimeMinutes
          ? parseFloat(row.undertimeMinutes)
          : undefined,
        undertimeDeduction: row.undertimeDeduction
          ? parseFloat(row.undertimeDeduction)
          : undefined,
        lateMinutes: row.lateMinutes ? parseFloat(row.lateMinutes) : undefined,
        lateDeduction: row.lateDeduction
          ? parseFloat(row.lateDeduction)
          : undefined,
        holidayBonus: row.holidayBonus
          ? parseFloat(row.holidayBonus)
          : undefined,
        leaveType: row.leaveType,
        leavePay: row.leavePay ? parseFloat(row.leavePay) : undefined,
        grossPay: row.grossPay ? parseFloat(row.grossPay) : undefined,
        deductions: row.deductions ? parseFloat(row.deductions) : undefined,
        netPay: row.netPay ? parseFloat(row.netPay) : undefined,
        manualOverride: row.manualOverride === "true",
        notes: row.notes,
        absence: row.absence === "true",
        nightDifferentialHours: row.nightDifferentialHours
          ? parseFloat(row.nightDifferentialHours)
          : 0,
        nightDifferentialPay: row.nightDifferentialPay
          ? parseFloat(row.nightDifferentialPay)
          : 0,
      })) as Compensation[];
    } catch (error) {
      console.error(
        `Error loading CSV compensation for ${employeeId} ${year}-${month}:`,
        error
      );
      return []; // Return empty array if there's an error
    }
  }

  // Load compensation records from JSON
  private async loadRecordsFromJson(
    month: number,
    year: number,
    employeeId: string
  ): Promise<Compensation[]> {
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

      const jsonData = JSON.parse(fileContent) as CompensationJsonMonth;
      const compensations: Compensation[] = [];

      // Convert JSON days to Compensation array
      Object.entries(jsonData.days).forEach(([dayStr, dayData]) => {
        const day = parseInt(dayStr);
        if (isNaN(day)) return;

        compensations.push({
          employeeId,
          day,
          month,
          year,
          dayType: dayData.dayType,
          dailyRate: dayData.dailyRate,
          hoursWorked: dayData.hoursWorked,
          overtimeMinutes: dayData.overtimeMinutes,
          overtimePay: dayData.overtimePay,
          undertimeMinutes: dayData.undertimeMinutes,
          undertimeDeduction: dayData.undertimeDeduction,
          lateMinutes: dayData.lateMinutes,
          lateDeduction: dayData.lateDeduction,
          holidayBonus: dayData.holidayBonus,
          leaveType: dayData.leaveType,
          leavePay: dayData.leavePay,
          grossPay: dayData.grossPay,
          deductions: dayData.deductions,
          netPay: dayData.netPay,
          manualOverride: dayData.manualOverride,
          notes: dayData.notes,
          absence: dayData.absence,
          nightDifferentialHours: dayData.nightDifferentialHours || 0,
          nightDifferentialPay: dayData.nightDifferentialPay || 0,
        });
      });

      // Sort by day
      return compensations.sort((a, b) => a.day - b.day);
    } catch (error) {
      console.error(
        `Error loading JSON compensation for ${employeeId} ${year}-${month}:`,
        error
      );
      return []; // Return empty array on error
    }
  }

  /**
   * Load compensation records
   */
  public async loadRecords(
    month?: number,
    year?: number,
    employeeId?: string
  ): Promise<Compensation[]> {
    if (!month || !year || !employeeId) {
      return [];
    }

    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      return loadCompensationFirestore(employeeId, year, month, companyName);
    }

    // First try JSON format if that's preferred
    if (this.useJsonFormat) {
      const jsonExists = await this.jsonFileExists(month, year, employeeId);
      if (jsonExists) {
        return this.loadRecordsFromJson(month, year, employeeId);
      }
    }

    // Fall back to CSV if JSON doesn't exist or is not preferred
    const csvExists = await this.csvFileExists(month, year, employeeId);
    if (csvExists) {
      return this.loadRecordsFromCsv(month, year, employeeId);
    }

    return []; // Return empty if neither exists
  }

  /**
   * Load ALL compensation records from all employees and all their respective files.
   * This method is intended for full data sync operations.
   * It mirrors the logic added to AttendanceModel.loadAttendances for sync.
   */
  public async loadAllCompensationRecords(): Promise<Compensation[]> {
    const allCompensations: Compensation[] = [];
    // this.folderPath is expected to be like `dbPath/SweldoDB/attendances` (or wherever compensations are stored)
    // NOTE: The path might need adjustment if compensations are not under `attendances` folder.
    // Assuming they follow the pattern: {folderPath}/{employeeId}/{year}_{month}_compensation.json

    if (this.isWebMode()) {
      return [];
    }

    try {
      // List directories in the base path (expecting employee IDs as directory names)
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
              // Look for JSON compensation files
              if (
                fileEntry.isFile &&
                fileEntry.name.endsWith("_compensation.json") &&
                !fileEntry.name.includes("_backup")
              ) {
                const filePath = `${employeePath}/${fileEntry.name}`;
                try {
                  const fileContent = await window.electron.readFile(filePath);
                  if (fileContent && fileContent.trim().length > 0) {
                    const jsonData = JSON.parse(
                      fileContent
                    ) as CompensationJsonMonth;
                    // Convert JSON days to Compensation array
                    Object.entries(jsonData.days).forEach(
                      ([dayStr, dayData]) => {
                        const day = parseInt(dayStr);
                        if (isNaN(day)) return;
                        allCompensations.push({
                          employeeId: jsonData.meta.employeeId,
                          day,
                          month: jsonData.meta.month,
                          year: jsonData.meta.year,
                          dayType: dayData.dayType,
                          dailyRate: dayData.dailyRate,
                          hoursWorked: dayData.hoursWorked,
                          overtimeMinutes: dayData.overtimeMinutes,
                          overtimePay: dayData.overtimePay,
                          undertimeMinutes: dayData.undertimeMinutes,
                          undertimeDeduction: dayData.undertimeDeduction,
                          lateMinutes: dayData.lateMinutes,
                          lateDeduction: dayData.lateDeduction,
                          holidayBonus: dayData.holidayBonus,
                          leaveType: dayData.leaveType,
                          leavePay: dayData.leavePay,
                          grossPay: dayData.grossPay,
                          deductions: dayData.deductions,
                          netPay: dayData.netPay,
                          manualOverride: dayData.manualOverride,
                          notes: dayData.notes,
                          absence: dayData.absence,
                          nightDifferentialHours:
                            dayData.nightDifferentialHours || 0,
                          nightDifferentialPay:
                            dayData.nightDifferentialPay || 0,
                        });
                      }
                    );
                  } else {
                  }
                } catch (fileReadError) {}
              }
            }
          } catch (readDirError) {}
        }
      }
    } catch (error) {}

    return allCompensations;
  }

  /**
   * Load compensation records for a specific employee
   */
  public async loadEmployeeRecords(
    employeeId: string
  ): Promise<Compensation[]> {
    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      return loadEmployeeCompensationFirestore(employeeId, companyName);
    }

    // Desktop mode - use existing implementation
    const allRecords = await this.loadRecords(undefined, undefined, employeeId);
    return allRecords;
  }

  /**
   * Save or update records - maintains compatibility with old method
   */
  public async saveOrUpdateRecords(
    employeeId: string,
    year: number,
    month: number,
    records: Compensation[],
    recordsToBackup?: Compensation[]
  ): Promise<void> {
    // If in web mode, use Firestore
    if (this.isWebMode()) {
      const companyName = await getCompanyName();
      await saveCompensationFirestore(
        employeeId,
        year,
        month,
        records,
        recordsToBackup || [],
        companyName
      );
      return;
    }

    // Desktop mode - use existing implementation
    if (this.useJsonFormat) {
      await this.saveRecordsToJson(
        employeeId,
        year,
        month,
        records,
        recordsToBackup || []
      );
    } else {
      await this.saveRecordsToCsv(
        employeeId,
        year,
        month,
        records,
        recordsToBackup || []
      );
    }
  }

  /**
   * Save or update specific compensation records
   */
  public async saveOrUpdateCompensations(
    compensationsToSave: Compensation[],
    month: number,
    year: number,
    employeeId: string
  ): Promise<void> {
    try {
      // Validate input compensations
      for (const compensation of compensationsToSave) {
        if (
          !Number.isInteger(compensation.month) ||
          compensation.month < 1 ||
          compensation.month > 12
        ) {
          throw new Error(`Invalid month value: ${compensation.month}`);
        }
        if (!Number.isInteger(compensation.year) || compensation.year < 1) {
          throw new Error(`Invalid year value: ${compensation.year}`);
        }
        if (
          !Number.isInteger(compensation.day) ||
          compensation.day < 1 ||
          compensation.day > 31
        ) {
          throw new Error(`Invalid day value: ${compensation.day}`);
        }
      }

      // If in web mode, use Firestore
      if (this.isWebMode()) {
        const companyName = await getCompanyName();
        await saveOrUpdateCompensationsFirestore(
          compensationsToSave,
          employeeId,
          year,
          month,
          companyName
        );
        return;
      }

      // Desktop mode - Load existing records
      const existingRecords = await this.loadRecords(month, year, employeeId);

      const recordsToBackup: Compensation[] = [];
      let changesMade = false;

      // Create a map for faster lookups of existing records by day
      const existingRecordsMap = new Map<number, Compensation>();
      existingRecords.forEach((record) =>
        existingRecordsMap.set(record.day, record)
      );

      // Prepare the list for updated records
      const updatedRecordsList: Compensation[] = [...existingRecords];

      for (const compensation of compensationsToSave) {
        const existingRecord = existingRecordsMap.get(compensation.day);

        if (existingRecord) {
          // Check if the record actually changed (simple JSON string comparison for now)
          if (JSON.stringify(existingRecord) !== JSON.stringify(compensation)) {
            const index = updatedRecordsList.findIndex(
              (r) => r.day === compensation.day
            );
            if (index !== -1) {
              updatedRecordsList[index] = compensation; // Update in the list
              recordsToBackup.push(compensation);
              changesMade = true;
            }
          }
        } else {
          // New record, add it
          updatedRecordsList.push(compensation);
          recordsToBackup.push(compensation);
          changesMade = true;
        }
      }

      // Only save if changes were actually made
      if (changesMade) {
        // Sort records by day before saving
        updatedRecordsList.sort((a, b) => a.day - b.day);

        // Save all records and pass changed records for backup
        await this.saveOrUpdateRecords(
          employeeId,
          year,
          month,
          updatedRecordsList,
          recordsToBackup
        );
      }
    } catch (error) {
      console.error(
        `Error saving or updating compensations for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error; // Re-throw error
    }
  }

  /**
   * Save compensation records to CSV format
   */
  private async saveRecordsToCsv(
    employeeId: string,
    year: number,
    month: number,
    records: Compensation[],
    recordsToBackup: Compensation[]
  ): Promise<void> {
    try {
      const filePath = this.getFilePath(month, year, employeeId, "csv");
      const directoryPath = `${this.folderPath}/${employeeId}`;
      await window.electron.ensureDir(directoryPath);

      const csv = Papa.unparse(records, { header: true }); // Ensure headers for main file
      await window.electron.writeFile(filePath, csv);

      // Append the changed records to the backup file
      if (recordsToBackup && recordsToBackup.length > 0) {
        await this.appendToBackup(recordsToBackup, filePath);
      }
    } catch (error) {
      console.error(
        `Error saving compensation records to CSV for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Save compensation records to JSON format
   */
  private async saveRecordsToJson(
    employeeId: string,
    year: number,
    month: number,
    records: Compensation[],
    recordsToBackup: Compensation[]
  ): Promise<void> {
    try {
      const jsonFilePath = this.getFilePath(month, year, employeeId, "json");
      const directoryPath = `${this.folderPath}/${employeeId}`;

      await window.electron.ensureDir(directoryPath);

      // Check if JSON file already exists
      let existingData: CompensationJsonMonth = {
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
            existingData = JSON.parse(existingContent) as CompensationJsonMonth;
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
        oldValue: any;
        newValue: any;
      }[] = [];

      // Update existingData with new records
      for (const record of records) {
        const dayStr = record.day.toString();
        const existingDay = existingData.days[dayStr];

        // If existing data for this day differs, add to backup
        if (
          recordsToBackup &&
          recordsToBackup.some((r) => r.day === record.day)
        ) {
          // For simplicity, just back up every field that's changed
          if (existingDay) {
            Object.entries(record).forEach(([key, value]) => {
              if (
                key !== "employeeId" &&
                key !== "month" &&
                key !== "year" &&
                key !== "day" &&
                existingDay[key as keyof CompensationJsonDay] !== value
              ) {
                backupEntries.push({
                  day: record.day,
                  field: key,
                  oldValue: existingDay[key as keyof CompensationJsonDay],
                  newValue: value,
                });
              }
            });
          } else {
            // New day added, record all fields
            Object.entries(record).forEach(([key, value]) => {
              if (
                key !== "employeeId" &&
                key !== "month" &&
                key !== "year" &&
                key !== "day"
              ) {
                backupEntries.push({
                  day: record.day,
                  field: key,
                  oldValue: null,
                  newValue: value,
                });
              }
            });
          }
        }

        // Now update the existingData with the new record
        existingData.days[dayStr] = {
          dayType: record.dayType,
          dailyRate: record.dailyRate,
          hoursWorked: record.hoursWorked,
          overtimeMinutes: record.overtimeMinutes,
          overtimePay: record.overtimePay,
          undertimeMinutes: record.undertimeMinutes,
          undertimeDeduction: record.undertimeDeduction,
          lateMinutes: record.lateMinutes,
          lateDeduction: record.lateDeduction,
          holidayBonus: record.holidayBonus,
          leaveType: record.leaveType,
          leavePay: record.leavePay,
          grossPay: record.grossPay,
          deductions: record.deductions,
          netPay: record.netPay,
          manualOverride: record.manualOverride,
          notes: record.notes,
          absence: record.absence,
          nightDifferentialHours: record.nightDifferentialHours,
          nightDifferentialPay: record.nightDifferentialPay,
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
        `Error saving JSON compensation for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error;
    }
  }
}

// Factory function to create CompensationModel instance
export const createCompensationModel = (dbPath: string): CompensationModel => {
  const filePath = `${dbPath}/SweldoDB/attendances`;
  return new CompensationModel(filePath);
};

/**
 * Migrates compensation data from CSV format to JSON format
 * @param dbPath The base path to the SweldoDB directory
 * @param onProgress Optional callback to report progress
 */
export async function migrateCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const compensationsBasePath = `${dbPath}/SweldoDB/attendances`;

  try {
    onProgress?.(`Starting CSV to JSON migration in: ${compensationsBasePath}`);
    const employeeDirs = await window.electron.readDir(compensationsBasePath);

    for (const dirEntry of employeeDirs) {
      if (dirEntry.isDirectory) {
        const employeeId = dirEntry.name;
        const employeePath = `${compensationsBasePath}/${employeeId}`;
        onProgress?.(`Processing employee: ${employeeId}`);

        try {
          const filesInEmployeeDir = await window.electron.readDir(
            employeePath
          );
          const csvFilesToMigrate: string[] = [];

          // Find all compensation CSV files for this employee
          for (const fileEntry of filesInEmployeeDir) {
            if (
              fileEntry.isFile &&
              fileEntry.name.endsWith("_compensation.csv") &&
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
                /(\d+)_(\d+)_compensation\.csv/
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

              // Parse CSV to compensation records
              const results = Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (h) => h.trim(),
              });

              // Create JSON structure
              const jsonData: CompensationJsonMonth = {
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
                  dayType: (row.dayType || "Regular") as DayType,
                  dailyRate: row.dailyRate ? parseFloat(row.dailyRate) : 0,
                  hoursWorked: row.hoursWorked
                    ? parseFloat(row.hoursWorked)
                    : undefined,
                  overtimeMinutes: row.overtimeMinutes
                    ? parseFloat(row.overtimeMinutes)
                    : undefined,
                  overtimePay: row.overtimePay
                    ? parseFloat(row.overtimePay)
                    : undefined,
                  undertimeMinutes: row.undertimeMinutes
                    ? parseFloat(row.undertimeMinutes)
                    : undefined,
                  undertimeDeduction: row.undertimeDeduction
                    ? parseFloat(row.undertimeDeduction)
                    : undefined,
                  lateMinutes: row.lateMinutes
                    ? parseFloat(row.lateMinutes)
                    : undefined,
                  lateDeduction: row.lateDeduction
                    ? parseFloat(row.lateDeduction)
                    : undefined,
                  holidayBonus: row.holidayBonus
                    ? parseFloat(row.holidayBonus)
                    : undefined,
                  leaveType: row.leaveType,
                  leavePay: row.leavePay ? parseFloat(row.leavePay) : undefined,
                  grossPay: row.grossPay ? parseFloat(row.grossPay) : undefined,
                  deductions: row.deductions
                    ? parseFloat(row.deductions)
                    : undefined,
                  netPay: row.netPay ? parseFloat(row.netPay) : undefined,
                  manualOverride: row.manualOverride === "true",
                  notes: row.notes,
                  absence: row.absence === "true",
                  nightDifferentialHours: row.nightDifferentialHours
                    ? parseFloat(row.nightDifferentialHours)
                    : 0,
                  nightDifferentialPay: row.nightDifferentialPay
                    ? parseFloat(row.nightDifferentialPay)
                    : 0,
                };
              });

              // Create JSON file path
              const jsonFilePath = `${employeePath}/${year}_${month}_compensation.json`;

              // Write JSON file
              await window.electron.writeFile(
                jsonFilePath,
                JSON.stringify(jsonData, null, 2)
              );

              onProgress?.(`  - Created JSON file: ${jsonFilePath}`);

              // Process backup file if it exists
              const backupCsvPath = csvFilePath.replace(
                "_compensation.csv",
                "_compensation_backup.csv"
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
    onProgress?.(`Error details: ${error}`);
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

    // Create the JSON backup structure
    const backupJsonData: BackupJsonMonth = {
      employeeId,
      year,
      month,
      backups: [],
    };

    // Process the file line by line instead of using Papa.parse on the entire file
    const lines = backupContent.split("\n");

    // Get headers from the first line
    const headers = lines[0].split(",");

    // Keep track of processed timestamps to group records by timestamp
    const processedTimestamps = new Map<
      string,
      {
        timestamp: string;
        changes: { day: number; field: string; oldValue: any; newValue: any }[];
      }
    >();

    // Process each line after the header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      // Parse this line manually
      const values = Papa.parse(line, { delimiter: ",", header: false })
        .data[0] as string[];

      // Skip if we don't have enough values
      if (!values || values.length < 4) continue;

      // Create a record object from the values
      const record: any = {};
      for (let j = 0; j < headers.length && j < values.length; j++) {
        record[headers[j]] = values[j];
      }

      // Skip records without timestamp or day
      const timestamp = record.timestamp;
      const day = parseInt(record.day);
      if (!timestamp || isNaN(day)) continue;

      // Get or create entry for this timestamp
      if (!processedTimestamps.has(timestamp)) {
        processedTimestamps.set(timestamp, {
          timestamp,
          changes: [],
        });
      }

      // Get the current entry
      const entry = processedTimestamps.get(timestamp)!;

      // Extract every field except timestamp, day, month, year, employeeId
      const fieldNames = Object.keys(record).filter(
        (key) =>
          !["timestamp", "day", "month", "year", "employeeId"].includes(key)
      );

      // Add each field as a change
      fieldNames.forEach((field) => {
        const value = record[field];
        if (value !== undefined && value !== null && value !== "") {
          entry.changes.push({
            day,
            field,
            oldValue: null, // We don't have the old value in the backup format
            newValue: value,
          });
        }
      });
    }

    // Add all processed entries to the backup data
    processedTimestamps.forEach((entry) => {
      if (entry.changes.length > 0) {
        backupJsonData.backups.push({
          timestamp: entry.timestamp,
          changes: entry.changes,
        });
      }
    });

    // Create JSON backup file path
    const backupJsonPath = `${employeePath}/${year}_${month}_compensation_backup.json`;

    // Write JSON backup file
    await window.electron.writeFile(
      backupJsonPath,
      JSON.stringify(backupJsonData, null, 2)
    );

    onProgress?.(
      `    - Created backup JSON file: ${backupJsonPath} with ${backupJsonData.backups.length} entries`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`    - Error migrating backup file: ${message}`);
  }
}

/**
 * Specifically migrates compensation backup files from CSV to JSON format
 * This is a dedicated function similar to the one in attendance.ts
 * @param dbPath The base path to the SweldoDB directory
 * @param onProgress Optional callback to report progress
 */
export async function migrateBackupCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const compensationsBasePath = `${dbPath}/SweldoDB/attendances`;
  let totalFilesProcessed = 0;

  try {
    onProgress?.(
      `Starting compensation backup CSV to JSON migration in: ${compensationsBasePath}`
    );

    // First, try to process specific test file in backups directory if it exists
    try {
      const testBackupPath = `${dbPath}/backups/2025_4_compensation_backup.csv`;
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
      }
    } catch (testError) {
      onProgress?.(`Error processing test backup file: ${String(testError)}`);
    }

    // Now proceed with normal processing
    const employeeDirs = await window.electron.readDir(compensationsBasePath);

    for (const dirEntry of employeeDirs) {
      if (dirEntry.isDirectory) {
        const employeeId = dirEntry.name;
        const employeePath = `${compensationsBasePath}/${employeeId}`;
        onProgress?.(`Processing employee: ${employeeId}`);

        try {
          const filesInEmployeeDir = await window.electron.readDir(
            employeePath
          );
          const backupCsvFilesToMigrate: string[] = [];

          // Find all compensation backup CSV files for this employee
          for (const fileEntry of filesInEmployeeDir) {
            if (
              fileEntry.isFile &&
              fileEntry.name.endsWith("_compensation_backup.csv")
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
                /(\d+)_(\d+)_compensation_backup\.csv/
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
                onProgress?.(
                  `  - Backup file doesn't exist: ${backupCsvFilePath}`
                );
              }
            } catch (fileError) {
              const message =
                fileError instanceof Error
                  ? fileError.message
                  : String(fileError);
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
          onProgress?.(
            `  - Error reading employee directory ${employeePath}: ${message}`
          );
        }
      }
    }

    if (totalFilesProcessed === 0) {
      onProgress?.(
        `WARNING: No compensation backup files were processed. Please check file paths and permissions.`
      );
    }

    onProgress?.(
      `Compensation backup CSV to JSON migration process completed successfully. Files processed: ${totalFilesProcessed}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`Compensation backup migration failed: ${message}`);
    throw error;
  }
}
