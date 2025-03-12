import Papa from "papaparse";

export type DayType = 'Regular' | 'Holiday' | 'Rest Day' | 'Special';

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
  leaveType?: 'Vacation' | 'Sick' | 'Unpaid' | 'None';
  leavePay?: number;
  grossPay?: number;
  deductions?: number;
  netPay?: number;
  manualOverride?: boolean;
  notes?: string;
}

export class CompensationModel {
  private folderPath: string;
  
  constructor(filePath: string) {
    this.folderPath = filePath;
  }

  // Load compensation records from CSV
  public async loadRecords(month?: number, year?: number, employeeId?: string): Promise<Compensation[]> {
    console.log(`Loading compensation records from ${this.folderPath} with params:`, { month, year, employeeId });
    try {
      const filePath = employeeId ? 
        `${this.folderPath}/${employeeId}/${year}_${month}_compensation.csv` :
        this.folderPath;

      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent) {
        console.log(`Compensation records file ${filePath} doesn't exist, returning empty array`);
        return []; // Return empty array if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      console.log(`Loaded ${results.data.length} compensation records`);
      return results.data.map((row: any) => ({
        employeeId: row.employeeId,
        month: parseInt(row.month, 10),
        year: parseInt(row.year, 10),
        day: parseInt(row.day, 10),
        dayType: (row.dayType || 'Regular') as DayType,
        hoursWorked: row.hoursWorked ? parseFloat(row.hoursWorked) : undefined,
        overtimeMinutes: row.overtimeMinutes ? parseFloat(row.overtimeMinutes) : undefined,
        overtimePay: row.overtimePay ? parseFloat(row.overtimePay) : undefined,
        undertimeMinutes: row.undertimeMinutes ? parseFloat(row.undertimeMinutes) : undefined,
        undertimeDeduction: row.undertimeDeduction ? parseFloat(row.undertimeDeduction) : undefined,
        lateMinutes: row.lateMinutes ? parseFloat(row.lateMinutes) : undefined,
        lateDeduction: row.lateDeduction ? parseFloat(row.lateDeduction) : undefined,
        holidayBonus: row.holidayBonus ? parseFloat(row.holidayBonus) : undefined,
        leaveType: row.leaveType,
        leavePay: row.leavePay ? parseFloat(row.leavePay) : undefined,
        grossPay: row.grossPay ? parseFloat(row.grossPay) : undefined,
        deductions: row.deductions ? parseFloat(row.deductions) : undefined,
        netPay: row.netPay ? parseFloat(row.netPay) : undefined,
        manualOverride: row.manualOverride === 'true',
        notes: row.notes,
      })) as Compensation[];
    } catch (error) {
      console.error('Error reading compensation records:', error);
      return []; // Return empty array if there's an error
    }
  }

  // Load compensation records for a specific employee
  public async loadEmployeeRecords(employeeId: string): Promise<Compensation[]> {
    const allRecords = await this.loadRecords(undefined, undefined, employeeId);
    return allRecords;
  }

  // Save compensation records
  public async saveOrUpdateRecords(employeeId: string, year: number, month: number, records: Compensation[]): Promise<void> {
    try {
      const filePath = `${this.folderPath}/${employeeId}/${year}_${month}_compensation.csv`;
      const csv = Papa.unparse(records);
      await window.electron.saveFile(filePath, csv);
      console.log(`Compensation records saved successfully to ${filePath}`);
    } catch (error) {
      console.error(`Failed to save compensation records: ${error}`);
      throw error;
    }
  }

  // Save or update specific compensation records
  public async saveOrUpdateCompensations(compensations: Compensation[], month: number, year: number, employeeId: string): Promise<void> {
    try {
      // Validate input compensations
      for (const compensation of compensations) {
        if (!Number.isInteger(compensation.month) || compensation.month < 1 || compensation.month > 12) {
          throw new Error(`Invalid month value: ${compensation.month}`);
        }
        if (!Number.isInteger(compensation.year) || compensation.year < 1) {
          throw new Error(`Invalid year value: ${compensation.year}`);
        }
        if (!Number.isInteger(compensation.day) || compensation.day < 1 || compensation.day > 31) {
          throw new Error(`Invalid day value: ${compensation.day}`);
        }
      }

      // Load existing records
      const existingRecords = await this.loadRecords(month, year, employeeId);
      
      // Update or add new records
      const updatedRecords = [...existingRecords];
      for (const compensation of compensations) {
        const index = updatedRecords.findIndex(r => 
          r.month === compensation.month && 
          r.year === compensation.year && 
          r.day === compensation.day
        );
        
        if (index >= 0) {
          updatedRecords[index] = compensation;
        } else {
          updatedRecords.push(compensation);
        }
      }
      
      // Save all records
      await this.saveOrUpdateRecords(employeeId, year, month, updatedRecords);
    } catch (error) {
      console.error(`Failed to save/update compensations: ${error}`);
      throw error;
    }
  }
}

// Factory function to create CompensationModel instance
export const createCompensationModel = (dbPath: string): CompensationModel => {
  const filePath = `${dbPath}/SweldoDB/attendances`;
  return new CompensationModel(filePath);
};