import Papa from 'papaparse';
import { createEmployeeModel } from './employee';
import { Attendance } from './attendance';

export interface MissingTimeLog {
  id: string;
  employeeId: string;
  employeeName: string;
  day: number;
  month: number;
  year: number;
  missingType: 'timeIn' | 'timeOut';
  createdAt: string; // ISO string
}

export class MissingTimeModel {
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async saveMissingTimeLog(log: MissingTimeLog, month: number, year: number): Promise<void> {
    const filePath = `${this.dbPath}/SweldoDB/missing_time_logs/${year}_${month}_missing_times.csv`;
    
    // Ensure directory exists
    await window.electron.ensureDir(`${this.dbPath}/SweldoDB/missing_time_logs`);
    
    let csvContent = '';
    const fileExists = await window.electron.fileExists(filePath);
    
    if (fileExists) {
      // Read existing content and append new row
      const existingContent = await window.electron.readFile(filePath);
      const parsedData = Papa.parse(existingContent, { header: true });
      parsedData.data.push(log);
      csvContent = Papa.unparse(parsedData.data);
    } else {
      // Create new file with header and first row
      csvContent = Papa.unparse([log]);
    }
    
    try {
      await window.electron.writeFile(filePath, csvContent);
    } catch (error) {
      console.error('Error writing to file:', error);
      throw error;
    }
  }

  async getMissingTimeLogs(
    month: number,
    year: number
  ): Promise<MissingTimeLog[]> {
    const filePath = `${this.dbPath}/SweldoDB/missing_time_logs/${year}_${month}_missing_times.csv`;
    
    if (!await window.electron.fileExists(filePath)) {
      return [];
    }

    try {
      const content = await window.electron.readFile(filePath);
      const parsedData = Papa.parse(content, { header: true });
      return parsedData.data as MissingTimeLog[];
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  async deleteMissingTimeLog(id: string, month: number, year: number): Promise<void> {
    const filePath = `${this.dbPath}/SweldoDB/missing_time_logs/${year}_${month}_missing_times.csv`;
    
    if (!await window.electron.fileExists(filePath)) {
      return;
    }

    try {
      const content = await window.electron.readFile(filePath);
      const parsedData = Papa.parse(content, { header: true });
      const updatedData = parsedData.data.filter((row: any) => row.id !== id);
      const csvContent = Papa.unparse(updatedData);
      await window.electron.writeFile(filePath, csvContent);
    } catch (error) {
      console.error('Error deleting missing time log:', error);
      throw error;
    }
  }

  static createMissingTimeModel(dbPath: string): MissingTimeModel {
    return new MissingTimeModel(dbPath);
  }
}
