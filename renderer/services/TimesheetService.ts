import { Attendance, createAttendanceModel } from "@/renderer/model/attendance";
import { loadAttendanceFirestore } from "@/renderer/model/attendance_firestore";
import {
  Compensation,
  createCompensationModel,
} from "@/renderer/model/compensation";
import {
  loadCompensationFirestore,
  saveOrUpdateCompensationsFirestore,
} from "@/renderer/model/compensation_firestore";
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
   * Save a compensation record
   */
  async saveCompensation(compensation: Compensation): Promise<void> {
    console.log("[TimesheetService] Saving compensation:", compensation);

    if (isWebEnvironment()) {
      // Web mode - use Firestore
      if (!this.companyName) {
        throw new Error("Company name not set for web mode");
      }

      try {
        console.log("[TimesheetService] Using Firestore to save compensation");
        await saveOrUpdateCompensationsFirestore(
          [compensation],
          compensation.month,
          compensation.year,
          compensation.employeeId,
          this.companyName
        );
        console.log(
          "[TimesheetService] Compensation saved to Firestore successfully"
        );
      } catch (error) {
        console.error(
          "[TimesheetService] Error saving compensation to Firestore:",
          error
        );
        throw error;
      }
    } else {
      // Desktop mode - use local DB
      if (!this.dbPath) {
        throw new Error("Database path not configured");
      }

      try {
        console.log(
          "[TimesheetService] Using local model to save compensation"
        );
        const compensationModel = createCompensationModel(this.dbPath);
        await compensationModel.saveOrUpdateCompensations(
          [compensation],
          compensation.month,
          compensation.year,
          compensation.employeeId
        );
        console.log(
          "[TimesheetService] Compensation saved locally successfully"
        );
      } catch (error) {
        console.error(
          "[TimesheetService] Error saving compensation locally:",
          error
        );
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
