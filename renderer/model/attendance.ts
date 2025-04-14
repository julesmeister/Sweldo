import { Employee } from "./employee";

export interface Attendance {
  employeeId: string;
  day: number;
  month: number;
  year: number;
  timeIn: string | null;
  timeOut: string | null;
  alternativeTimeIns?: string[]; // Additional time in entries
  alternativeTimeOuts?: string[]; // Additional time out entries
  schedule?: {
    timeIn: string;
    timeOut: string;
    dayOfWeek: number;
  } | null; // Schedule information for the day
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
        return []; // Return empty array if file is empty or doesn't exist
      }

      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      return results.data.map((row: any) => ({
        employeeId: id || "",
        day: parseInt(row.day),
        month: month || 0,
        year: year || 0,
        timeIn: row.timeIn ? row.timeIn : null,
        timeOut: row.timeOut ? row.timeOut : null,
        alternativeTimeIns: row.alternativeTimeIns
          ? JSON.parse(row.alternativeTimeIns)
          : [],
        alternativeTimeOuts: row.alternativeTimeOuts
          ? JSON.parse(row.alternativeTimeOuts)
          : [],
      })) as Attendance[];
    } catch (error) {
      return []; // Return empty array if there's an error
    }
  }

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

      type AttendanceRow = {
        day: string;
        timeIn: string;
        timeOut: string;
        alternativeTimeIns: string;
      };

      const results = Papa.parse<AttendanceRow>(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      const attendance = results.data.find((row) => parseInt(row.day) === day);

      return attendance
        ? {
            employeeId,
            day: parseInt(attendance.day),
            month,
            year,
            timeIn: attendance.timeIn ? attendance.timeIn : null,
            timeOut: attendance.timeOut ? attendance.timeOut : null,
            alternativeTimeIns: attendance.alternativeTimeIns
              ? JSON.parse(attendance.alternativeTimeIns)
              : [],
          }
        : null;
    } catch (error) {
      return null;
    }
  }

  // Save attendances to CSV
  public async saveAttendances(
    attendances: Attendance[],
    month?: number,
    year?: number,
    id?: string
  ): Promise<void> {
    try {
      const filePath = `${this.folderPath}/${id}/${year}_${month}_attendance.csv`;
      const csv = Papa.unparse(attendances);
      await window.electron.writeFile(filePath, csv);
    } catch (error) {
      throw error;
    }
  }

  // Save or update attendances to CSV
  public async saveOrUpdateAttendances(
    attendances: (Omit<Attendance, "timeIn" | "timeOut"> & {
      timeIn?: string | null;
      timeOut?: string | null;
      alternativeTimeIns?: string[];
      alternativeTimeOuts?: string[];
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

      // Iterate through the new attendances
      for (const newAttendance of attendances) {
        const existingAttendance = existingAttendances.find(
          (att) => att.day === newAttendance.day
        );

        if (existingAttendance) {
          // Update existing attendance with new values
          const updatedAttendance = {
            ...existingAttendance,
            timeIn:
              newAttendance.timeIn !== undefined
                ? newAttendance.timeIn
                : existingAttendance.timeIn,
            timeOut:
              newAttendance.timeOut !== undefined
                ? newAttendance.timeOut
                : existingAttendance.timeOut,
            alternativeTimeIns:
              newAttendance.alternativeTimeIns ||
              existingAttendance.alternativeTimeIns ||
              [],
            alternativeTimeOuts:
              newAttendance.alternativeTimeOuts ||
              existingAttendance.alternativeTimeOuts ||
              [],
          };

          const index = existingAttendances.findIndex(
            (att) => att.day === newAttendance.day
          );
          existingAttendances[index] = updatedAttendance;
        } else {
          // Add new attendance
          existingAttendances.push({
            ...newAttendance,
            timeIn: newAttendance.timeIn ?? null,
            timeOut: newAttendance.timeOut ?? null,
            alternativeTimeIns: newAttendance.alternativeTimeIns || [],
            alternativeTimeOuts: newAttendance.alternativeTimeOuts || [],
          });
        }
      }

      // Convert arrays to JSON strings for CSV storage
      const csvData = existingAttendances.map((attendance) => ({
        ...attendance,
        alternativeTimeIns: JSON.stringify(attendance.alternativeTimeIns || []),
        alternativeTimeOuts: JSON.stringify(
          attendance.alternativeTimeOuts || []
        ),
      }));

      const csv = Papa.unparse(csvData);
      await window.electron.writeFile(filePath, csv);
    } catch (error) {
      throw error;
    }
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
