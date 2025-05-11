import { Attendance, createAttendanceModel } from "@/renderer/model/attendance";
import { loadAttendanceFirestore } from "@/renderer/model/attendance_firestore";
import {
  Compensation,
  createCompensationModel,
} from "@/renderer/model/compensation";
import { loadCompensationFirestore } from "@/renderer/model/compensation_firestore";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

/**
 * Service responsible for loading and managing timesheet data
 */
export class TimesheetService {
  private dbPath: string;
  private companyName: string;

  constructor(dbPath: string, companyName: string) {
    this.dbPath = dbPath;
    this.companyName = companyName;
  }

  /**
   * Load attendance data for a specific employee and time period
   */
  async loadAttendanceData(
    employeeId: string,
    year: number,
    month: number
  ): Promise<Attendance[]> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      if (!this.companyName) {
        throw new Error("Company name not set for web mode");
      }

      try {
        const data = await loadAttendanceFirestore(
          employeeId,
          year,
          month,
          this.companyName
        );
        return data;
      } catch (error) {
        throw error;
      }
    } else {
      // Desktop mode - use local DB
      if (!this.dbPath) {
        throw new Error("Database path not configured");
      }

      try {
        const attendanceModel = createAttendanceModel(this.dbPath);
        const data = await attendanceModel.loadAttendancesById(
          month,
          year,
          employeeId
        );
        return data;
      } catch (error) {
        throw error;
      }
    }
  }

  /**
   * Load compensation data for a specific employee and time period
   */
  async loadCompensationData(
    employeeId: string,
    year: number,
    month: number
  ): Promise<Compensation[]> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      if (!this.companyName) {
        throw new Error("Company name not set for web mode");
      }

      try {
        const data = await loadCompensationFirestore(
          employeeId,
          year,
          month,
          this.companyName
        );
        return data;
      } catch (error) {
        throw error;
      }
    } else {
      // Desktop mode - use local DB
      if (!this.dbPath) {
        throw new Error("Database path not configured");
      }

      try {
        const compensationModel = createCompensationModel(this.dbPath);
        const data = await compensationModel.loadRecords(
          month,
          year,
          employeeId
        );
        return data;
      } catch (error) {
        throw error;
      }
    }
  }

  /**
   * Load both attendance and compensation data
   */
  async loadTimesheetData(
    employeeId: string,
    year: number,
    month: number
  ): Promise<{ attendance: Attendance[]; compensation: Compensation[] }> {
    try {
      const [attendance, compensation] = await Promise.all([
        this.loadAttendanceData(employeeId, year, month),
        this.loadCompensationData(employeeId, year, month),
      ]);

      return { attendance, compensation };
    } catch (error) {
      throw error;
    }
  }
}
