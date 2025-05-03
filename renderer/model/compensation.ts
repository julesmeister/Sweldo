import Papa from "papaparse";

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

export class CompensationModel {
  private folderPath: string;

  constructor(filePath: string) {
    this.folderPath = filePath;
  }

  // Helper function to append records to the backup file
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
      // Log and continue, or re-throw if backup failure should halt the process
      // throw new Error(`Failed to write backup file: ${backupFilePath}`);
    }
  }

  // Load compensation records from CSV
  public async loadRecords(
    month?: number,
    year?: number,
    employeeId?: string
  ): Promise<Compensation[]> {
    try {
      const filePath = employeeId
        ? `${this.folderPath}/${employeeId}/${year}_${month}_compensation.csv`
        : this.folderPath;

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
          : undefined,
        nightDifferentialPay: row.nightDifferentialPay
          ? parseFloat(row.nightDifferentialPay)
          : undefined,
      })) as Compensation[];
    } catch (error) {
      return []; // Return empty array if there's an error
    }
  }

  // Load compensation records for a specific employee
  public async loadEmployeeRecords(
    employeeId: string
  ): Promise<Compensation[]> {
    const allRecords = await this.loadRecords(undefined, undefined, employeeId);
    return allRecords;
  }

  // Save compensation records (overwrites file, used by saveOrUpdateCompensations)
  // This function WILL now also trigger the backup append
  public async saveOrUpdateRecords(
    employeeId: string,
    year: number,
    month: number,
    records: Compensation[],
    recordsToBackup: Compensation[] // Pass the records that changed
  ): Promise<void> {
    try {
      const filePath = `${this.folderPath}/${employeeId}/${year}_${month}_compensation.csv`;
      const csv = Papa.unparse(records, { header: true }); // Ensure headers for main file
      await window.electron.writeFile(filePath, csv);

      // Append the changed records to the backup file
      await this.appendToBackup(recordsToBackup, filePath);
    } catch (error) {
      console.error(
        `Error saving compensation records for ${employeeId} ${year}-${month}:`,
        error
      );
      throw error; // Re-throw error
    }
  }

  // Save or update specific compensation records
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

      // Load existing records
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
          // For more complex objects or specific checks, compare fields individually
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
          // Add to map as well if subsequent updates in the same batch might reference it
          // existingRecordsMap.set(compensation.day, compensation);
        }
      }

      // Only save if changes were actually made
      if (changesMade) {
        // Sort records by day before saving
        updatedRecordsList.sort((a, b) => a.day - b.day);

        // Save all records (overwrites main file) and pass changed records for backup
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
}

// Factory function to create CompensationModel instance
export const createCompensationModel = (dbPath: string): CompensationModel => {
  const filePath = `${dbPath}/SweldoDB/attendances`;
  return new CompensationModel(filePath);
};
