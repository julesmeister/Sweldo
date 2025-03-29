import {
  Attendance,
  AttendanceModel,
  createAttendanceModel,
} from "@/renderer/model/attendance";
import { CompensationModel, Compensation } from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import {
  AttendanceSettingsModel,
  getScheduleForDay,
} from "@/renderer/model/settings";
import { MissingTimeLog, MissingTimeModel } from "@/renderer/model/missingTime";
import { createHolidayModel } from "@/renderer/model/holiday";
import { toast } from "sonner";
import {
  createTimeObjects,
  calculateTimeMetrics,
  calculatePayMetrics,
  createCompensationRecord,
  isHolidayDate,
  createBaseCompensation,
} from "./utils/compensationUtils";

interface UseMissingTimeEditProps {
  dbPath: string;
  month: number;
  year: number;
  employee: Employee | null;
  attendanceModel: AttendanceModel;
  compensationModel: CompensationModel;
  attendanceSettingsModel: AttendanceSettingsModel;
  onMissingLogsUpdate: () => Promise<void>;
}

interface TimeUpdates {
  timeIn: string | null;
  timeOut: string | null;
}

export const useMissingTimeEdit = ({
  dbPath,
  month,
  year,
  employee,
  attendanceModel,
  compensationModel,
  attendanceSettingsModel,
  onMissingLogsUpdate,
}: UseMissingTimeEditProps) => {
  const handleMissingTimeEdit = async (
    selectedLog: MissingTimeLog,
    updates: TimeUpdates
  ) => {
    console.log("[useMissingTimeEdit] Starting edit:", {
      selectedLog,
      updates,
    });

    try {
      const missingTimeModel = MissingTimeModel.createMissingTimeModel(dbPath);

      // Load current attendance if it exists
      const attendance = await loadAttendance(selectedLog);
      console.log("[useMissingTimeEdit] Current attendance:", attendance);

      // Create or update attendance
      const updatedAttendance: Attendance = attendance
        ? {
            ...attendance,
            timeIn: updates.timeIn ?? attendance.timeIn,
            timeOut: updates.timeOut ?? attendance.timeOut,
          }
        : {
            employeeId: selectedLog.employeeId,
            day: parseInt(selectedLog.day),
            month: selectedLog.month,
            year: selectedLog.year,
            timeIn: updates.timeIn,
            timeOut: updates.timeOut,
          };

      console.log("[useMissingTimeEdit] Saving attendance:", updatedAttendance);

      // Save attendance
      await attendanceModel.saveOrUpdateAttendances(
        [updatedAttendance],
        month,
        year,
        selectedLog.employeeId
      );
      console.log("[useMissingTimeEdit] Attendance saved successfully");

      // Load settings for compensation calculation
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const attendanceSettings =
        await attendanceSettingsModel.loadAttendanceSettings();
      const employmentType = timeSettings.find(
        (type) => type.type === employee?.employmentType
      );
      console.log("[useMissingTimeEdit] Loaded settings:", {
        employmentType,
        attendanceSettings,
      });

      // Check for holidays
      const holidayModel = createHolidayModel(dbPath, year, month);
      const holidays = await holidayModel.loadHolidays();
      const holiday = holidays.find((h) => {
        const entryDate = new Date(year, month - 1, updatedAttendance.day);
        return isHolidayDate(entryDate, h);
      });
      console.log("[useMissingTimeEdit] Holiday check:", { holiday });

      // Load existing compensation
      const existingCompensations = await compensationModel.loadRecords(
        month,
        year,
        selectedLog.employeeId
      );
      const existingCompensation = existingCompensations.find(
        (c) => c.day === updatedAttendance.day
      );
      console.log(
        "[useMissingTimeEdit] Existing compensation:",
        existingCompensation
      );

      // Get schedule for the day
      const date = new Date(year, month - 1, updatedAttendance.day);
      const jsDay = date.getDay(); // 0-6 (0 = Sunday)
      const scheduleDay = jsDay === 0 ? 7 : jsDay; // Convert Sunday from 0 to 7
      const schedule = employmentType
        ? getScheduleForDay(employmentType, scheduleDay)
        : null;
      if (!schedule) {
        console.log("[useMissingTimeEdit] No schedule found for day:", {
          jsDay,
          scheduleDay,
          date,
        });
        return;
      }
      console.log("[useMissingTimeEdit] Schedule found:", schedule);

      // Create time objects and calculate metrics
      const { actual, scheduled } = createTimeObjects(
        year,
        month,
        updatedAttendance.day,
        updatedAttendance.timeIn || "",
        updatedAttendance.timeOut || "",
        schedule
      );
      console.log("[useMissingTimeEdit] Time objects created:", {
        actual,
        scheduled,
      });

      const timeMetrics = calculateTimeMetrics(
        actual,
        scheduled,
        attendanceSettings
      );
      console.log("[useMissingTimeEdit] Time metrics calculated:", timeMetrics);

      const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
      const payMetrics = calculatePayMetrics(
        timeMetrics,
        attendanceSettings,
        dailyRate,
        holiday
      );
      console.log("[useMissingTimeEdit] Pay metrics calculated:", payMetrics);

      // Add this before creating compensation
      const isWorkday = !!schedule;
      const isHoliday = !!holiday;
      const hasTimeEntries = !!(updates.timeIn && updates.timeOut);
      const isAbsent = isWorkday && !isHoliday && !hasTimeEntries;

      if (!employmentType?.requiresTimeTracking || !hasTimeEntries) {
        console.log(
          "[useMissingTimeEdit] Creating base compensation for non-time-tracking employee"
        );
        const compensation = createBaseCompensation(
          updatedAttendance,
          employee,
          month,
          year,
          holiday
        );

        // Set absence and pay based on conditions
        const isPresent =
          !employmentType?.requiresTimeTracking &&
          (updates.timeIn === "present" || updates.timeOut === "present");
        compensation.absence = !isPresent && isAbsent;
        compensation.grossPay = isHoliday
          ? dailyRate * (holiday?.multiplier || 1)
          : isPresent
          ? dailyRate
          : 0;
        compensation.netPay = compensation.grossPay;

        console.log(
          "[useMissingTimeEdit] Base compensation created:",
          compensation
        );

        try {
          await compensationModel.saveOrUpdateCompensations(
            [compensation],
            month,
            year,
            selectedLog.employeeId
          );
          console.log(
            "[useMissingTimeEdit] Base compensation saved successfully"
          );
        } catch (saveError) {
          console.error(
            "[useMissingTimeEdit] Error saving base compensation:",
            saveError
          );
          throw saveError;
        }
      } else {
        // Create updated compensation
        const compensation = createCompensationRecord(
          updatedAttendance,
          employee,
          timeMetrics,
          payMetrics,
          month,
          year,
          holiday,
          existingCompensation,
          { ...schedule, dayOfWeek: updatedAttendance.day }
        );

        compensation.absence = isAbsent;
        console.log(
          "[useMissingTimeEdit] Compensation record created:",
          compensation
        );

        // Save compensation
        try {
          await compensationModel.saveOrUpdateCompensations(
            [compensation],
            month,
            year,
            selectedLog.employeeId
          );
          console.log("[useMissingTimeEdit] Compensation saved successfully");
        } catch (saveError) {
          console.error(
            "[useMissingTimeEdit] Error saving compensation:",
            saveError
          );
          throw saveError;
        }
      }

      // Check if both times are now present
      const hasBothTimes = updates.timeIn !== null && updates.timeOut !== null;

      if (hasBothTimes) {
        // Delete the missing time log if both times are present
        await missingTimeModel.deleteMissingTimeLog(
          selectedLog.id,
          month,
          year
        );
        toast.success("Time updated and missing log removed");
      } else {
        // Otherwise, update the missing time log
        await missingTimeModel.saveMissingTimeLog(
          {
            ...selectedLog,
            ...updates,
          },
          month,
          year
        );
        toast.success("Time updated successfully");
      }

      // Refresh the missing logs
      await onMissingLogsUpdate();
    } catch (error: any) {
      console.error("[useMissingTimeEdit] Error:", error);
      toast.error(`Error updating time: ${error.message}`);
      throw error;
    }
  };

  const loadAttendance = async (
    log: MissingTimeLog
  ): Promise<Attendance | null> => {
    try {
      const attendances = await attendanceModel.loadAttendancesById(
        log.month,
        log.year,
        log.employeeId
      );
      return (
        attendances.find(
          (a) =>
            a.day === parseInt(log.day) &&
            a.month === log.month &&
            a.year === log.year
        ) || null
      );
    } catch (error) {
      console.error("[useMissingTimeEdit] Error loading attendance:", error);
      return null;
    }
  };

  return { handleMissingTimeEdit };
};
