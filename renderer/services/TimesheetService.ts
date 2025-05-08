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
    console.log("TimesheetService.loadAttendanceData - params:", {
      employeeId,
      year,
      month,
      dbPath: this.dbPath,
      companyName: this.companyName,
      isWebMode: isWebEnvironment(),
    });

    if (isWebEnvironment()) {
      // Web mode - use Firestore
      if (!this.companyName) {
        console.error("TimesheetService - Company name not set for web mode");
        throw new Error("Company name not set for web mode");
      }

      try {
        console.log("TimesheetService - Loading attendance from Firestore");
        const data = await loadAttendanceFirestore(
          employeeId,
          year,
          month,
          this.companyName
        );
        console.log(
          `TimesheetService - Loaded ${data.length} attendance records from Firestore`
        );
        return data;
      } catch (error) {
        console.error(
          "TimesheetService - Error loading attendance from Firestore:",
          error
        );
        throw error;
      }
    } else {
      // Desktop mode - use local DB
      if (!this.dbPath) {
        console.error("TimesheetService - Database path not configured");
        throw new Error("Database path not configured");
      }

      try {
        console.log("TimesheetService - Loading attendance from local DB");
        const attendanceModel = createAttendanceModel(this.dbPath);
        const data = await attendanceModel.loadAttendancesById(
          month,
          year,
          employeeId
        );
        console.log(
          `TimesheetService - Loaded ${data.length} attendance records from local DB`
        );
        return data;
      } catch (error) {
        console.error(
          "TimesheetService - Error loading attendance from local DB:",
          error
        );
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
    console.log("TimesheetService.loadCompensationData - params:", {
      employeeId,
      year,
      month,
      dbPath: this.dbPath,
      companyName: this.companyName,
      isWebMode: isWebEnvironment(),
    });

    if (isWebEnvironment()) {
      // Web mode - use Firestore
      if (!this.companyName) {
        console.error("TimesheetService - Company name not set for web mode");
        throw new Error("Company name not set for web mode");
      }

      try {
        console.log("TimesheetService - Loading compensation from Firestore");
        const data = await loadCompensationFirestore(
          employeeId,
          year,
          month,
          this.companyName
        );
        console.log(
          `TimesheetService - Loaded ${data.length} compensation records from Firestore`
        );
        return data;
      } catch (error) {
        console.error(
          "TimesheetService - Error loading compensation from Firestore:",
          error
        );
        throw error;
      }
    } else {
      // Desktop mode - use local DB
      if (!this.dbPath) {
        console.error("TimesheetService - Database path not configured");
        throw new Error("Database path not configured");
      }

      try {
        console.log("TimesheetService - Loading compensation from local DB");
        const compensationModel = createCompensationModel(this.dbPath);
        const data = await compensationModel.loadRecords(
          month,
          year,
          employeeId
        );
        console.log(
          `TimesheetService - Loaded ${data.length} compensation records from local DB`
        );
        return data;
      } catch (error) {
        console.error(
          "TimesheetService - Error loading compensation from local DB:",
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
      console.log(
        "TimesheetService.loadTimesheetData - Starting combined load"
      );
      const [attendance, compensation] = await Promise.all([
        this.loadAttendanceData(employeeId, year, month),
        this.loadCompensationData(employeeId, year, month),
      ]);

      console.log(
        "TimesheetService.loadTimesheetData - Completed combined load:",
        {
          attendanceCount: attendance.length,
          compensationCount: compensation.length,
        }
      );

      return { attendance, compensation };
    } catch (error) {
      console.error(
        "TimesheetService.loadTimesheetData - Error loading data:",
        error
      );
      throw error;
    }
  }
}
