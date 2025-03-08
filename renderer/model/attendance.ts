import { Employee } from './employee';

export interface Attendance {
  employeeId: string;
  day: number;
  month: number;
  year: number;
  timeIn: string | null;
  timeOut: string | null;
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
import { useState } from 'react';

export class AttendanceModel {
  private folderPath: string;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
    console.log('Initialized AttendanceModel with folder path:', this.folderPath); // Log the folder path
  }

  // Load attendances from CSV
  public async loadAttendances(): Promise<Attendance[]> {
    console.log('Loading attendances from file path:', this.folderPath);
    try {
      const fileContent = await window.electron.readFile(this.folderPath);
      if (!fileContent) {
        console.log('Attendance file is empty or doesn\'t exist, returning empty array');
        return []; // Return empty array if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      console.log('Loaded attendances:', results.data);
      return results.data.map((row: any) => ({
        day: row.day,
        timeIn: row.timeIn ? row.timeIn : null,
        timeOut: row.timeOut ? row.timeOut : null,
      })) as Attendance[];
    } catch (error) {
      console.error('Error reading attendance file:', error);
      return []; // Return empty array if there's an error
    }
  }
  // Load attendances from CSV based on month, year, and employee ID
  public async loadAttendancesById(month?: number, year?: number, id?: string): Promise<Attendance[]> {
    try {
      console.log('this.folderPath:', this.folderPath);
      const filePath = `${this.folderPath}/${id}/${year}_${month}_attendance.csv`;
      console.log('Loading attendances with params:', { month, year, id, filePath });
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent) {
        return []; // Return empty array if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      return results.data.map((row: any) => ({
        employeeId: id || '',
        day: parseInt(row.day),
        month: month || 0,
        year: year || 0,
        timeIn: row.timeIn ? row.timeIn : null,
        timeOut: row.timeOut ? row.timeOut : null,
      })) as Attendance[];
    } catch (error) {
      console.error('Error reading attendance file:', error);
      return []; // Return empty array if there's an error
    }
  }

  public async loadAttendanceByDay(day: number, month: number, year: number, employeeId: string): Promise<Attendance | null> {
    try {
      const filePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.csv`;
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent) {
        return null;
      }
      type AttendanceRow = {
        day: string;
        timeIn: string;
        timeOut: string;
      };
      
      const results = Papa.parse<AttendanceRow>(fileContent, { header: true, skipEmptyLines: true });
      const attendance = results.data.find(row => 
        parseInt(row.day) === day
      );
      return attendance ? {
        employeeId,
        day: parseInt(attendance.day),
        month,
        year,
        timeIn: attendance.timeIn ? attendance.timeIn : null,
        timeOut: attendance.timeOut ? attendance.timeOut : null,
      } : null;
    } catch (error) {
      console.error('Error reading attendance file:', error);
      return null;
    }
  }

  // Save attendances to CSV
  public async saveAttendances(
    attendances: Attendance[],
    month?: number,
    year?: number,
    id?: string,
  ): Promise<void> {
    try {
      const csv = Papa.unparse(attendances);
      await window.electron.saveFile(this.folderPath + '/' + id + '/' + year + '_' + month + '_' + 'attendance', csv);
      console.log(`Attendances saved successfully to ${this.folderPath}`);
    } catch (error) {
      console.error(`Failed to save attendances: ${error}`);
      throw error;
    }
  }

  // Save or update attendances to CSV
  public async saveOrUpdateAttendances(
    attendances: (Omit<Attendance, 'timeIn' | 'timeOut'> & { timeIn?: string | null; timeOut?: string | null })[],
    month: number,
    year: number,
    employeeId: string,
  ): Promise<void> {
    try {
      // Construct the file path
      const filePath = `${this.folderPath}/${employeeId}/${year}_${month}_attendance.csv`;
      const directoryPath = `${this.folderPath}/${employeeId}`;

      // Ensure directory exists
      await window.electron.ensureDir(directoryPath);

      // Load existing attendances
      const existingAttendances = await this.loadAttendancesById(month, year, employeeId) || []; // Use an empty array if not found
      if(existingAttendances === null) {
        console.log(`No existing attendances found for ${employeeId} in ${year}-${month}`);
        return;
      }

      // Iterate through the new attendances
      for (const newAttendance of attendances) {
        const attendanceIndex = existingAttendances.findIndex(att => 
          att.day === newAttendance.day
        );

        if (attendanceIndex !== -1) {
          // Update existing attendance
          existingAttendances[attendanceIndex] = {
            ...newAttendance,
            timeIn: newAttendance.timeIn ?? null,
            timeOut: newAttendance.timeOut ?? null
          };
        } else {
          // Add new attendance
          existingAttendances.push({
            ...newAttendance,
            timeIn: newAttendance.timeIn ?? null,
            timeOut: newAttendance.timeOut ?? null
          });
        }
      }

      // Save updated attendances to CSV
      const csv = Papa.unparse(existingAttendances);
      await window.electron.saveFile(filePath, csv);
      console.log(`Attendances saved successfully to ${filePath}`);
    } catch (error) {
      console.error(`Failed to save attendances: ${error}`);
      throw error;
    }
  }

}

// Factory function to create AttendanceModel instance
export const createAttendanceModel = (dbPath: string): AttendanceModel => {
  const folderPath = `${dbPath}/SweldoDB/attendances`; // Adjust the path as needed
  console.log(`Creating AttendanceModel instance with folder path: ${folderPath}`);
  return new AttendanceModel(folderPath);
};

function row(value: unknown, index: number, obj: unknown[]): value is unknown {
  throw new Error('Function not implemented.');
}
