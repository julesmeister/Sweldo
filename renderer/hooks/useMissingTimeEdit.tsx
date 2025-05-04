import {
  Attendance,
  AttendanceModel,
  createAttendanceModel,
} from "@/renderer/model/attendance";
import { CompensationModel, Compensation } from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import {
  AttendanceSettingsModel,
  DailySchedule,
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
      const date = new Date(year, month - 1, updatedAttendance.day);
      const holiday = holidays.find((h) => isHolidayDate(date, h));
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

      // Get schedule for the specific date using the async model method
      const schedule: DailySchedule | null = employmentType
        ? await attendanceSettingsModel.getScheduleForDate(employmentType, date)
        : null;
      console.log("[useMissingTimeEdit] Schedule found:", schedule);

      // Create time objects and calculate metrics only if it's a workday
      if (employmentType?.requiresTimeTracking && schedule && !schedule.isOff) {
        const { actual, scheduled } = createTimeObjects(
          year,
          month,
          updatedAttendance.day,
          updatedAttendance.timeIn || "",
          updatedAttendance.timeOut || "",
          schedule // Pass the fetched DailySchedule object
        );
        console.log("[useMissingTimeEdit] Time objects created:", {
          actual,
          scheduled,
        });

        // Ensure scheduled object was created
        if (!scheduled) {
          console.warn(
            "[useMissingTimeEdit] Scheduled time objects could not be created."
          );
          // Potentially update compensation to a base/error state or just skip?
          // For now, let's skip the detailed comp record creation
          toast.error(
            "Could not calculate detailed compensation: Missing schedule times."
          );
        } else {
          // Proceed with detailed calculation only if scheduled exists
          const timeMetrics = calculateTimeMetrics(
            actual,
            scheduled,
            attendanceSettings,
            employmentType
          );
          console.log(
            "[useMissingTimeEdit] Time metrics calculated:",
            timeMetrics
          );

          const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
          // Removed unused variables: hourlyRate, overtimeHours, overtimePay

          const payMetrics = calculatePayMetrics(
            timeMetrics,
            attendanceSettings,
            dailyRate,
            holiday,
            actual.timeIn,
            actual.timeOut,
            scheduled,
            employmentType
          );

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
            schedule // Pass the DailySchedule object directly
          );

          // Save compensation
          await compensationModel.saveOrUpdateCompensations(
            [compensation],
            month,
            year,
            selectedLog.employeeId
          );
          console.log("[useMissingTimeEdit] Compensation saved successfully");
        }
      } else {
        // Handle non-time-tracking or off day
        const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
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

        compensation.absence = !isPresent && !holiday;
        compensation.grossPay = holiday
          ? dailyRate * (holiday?.multiplier || 1)
          : isPresent
          ? dailyRate
          : 0;
        compensation.netPay = compensation.grossPay;

        await compensationModel.saveOrUpdateCompensations(
          [compensation],
          month,
          year,
          selectedLog.employeeId
        );
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
