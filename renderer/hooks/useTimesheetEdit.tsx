import { Attendance, AttendanceModel } from "@/renderer/model/attendance";
import {
  Compensation,
  CompensationModel,
  DayType,
} from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import {
  AttendanceSettingsModel,
  EmploymentType,
  DailySchedule,
} from "@/renderer/model/settings";
import { createHolidayModel } from "@/renderer/model/holiday";
import {
  createDateString,
  calculateTimeDifference,
  calculateDeductionMinutes,
  createBaseCompensation,
  isHolidayDate,
  createTimeObjects,
  calculateTimeMetrics,
  calculatePayMetrics,
  createCompensationRecord,
} from "./utils/compensationUtils";
import { MissingTimeModel } from "@/renderer/model/missingTime";
import { toast } from "sonner";

interface UseTimesheetEditProps {
  attendanceModel: AttendanceModel;
  compensationModel: CompensationModel;
  attendanceSettingsModel: AttendanceSettingsModel;
  employee: Employee | null;
  selectedEmployeeId: string;
  compensationEntries: Compensation[];
  month: number;
  year: number;
  dbPath: string;
  onDataUpdate: (
    newAttendance: Attendance[],
    newCompensations: Compensation[]
  ) => void;
  hasEditAccess?: boolean;
}

export const useTimesheetEdit = ({
  attendanceModel,
  compensationModel,
  attendanceSettingsModel,
  employee,
  selectedEmployeeId,
  compensationEntries,
  month,
  year,
  dbPath,
  onDataUpdate,
  hasEditAccess = true,
}: UseTimesheetEditProps) => {
  const calculateCompensationMetrics = async (
    timeMetrics: any,
    employmentType: EmploymentType | null | undefined,
    nightDiffHours?: number
  ) => {
    const attendanceSettings =
      await attendanceSettingsModel.loadAttendanceSettings();
    const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
    const standardHours = employmentType?.hoursOfWork || 8;
    const hourlyRate = dailyRate / standardHours;

    // Night differential calculation
    const nightDiffMultiplier =
      attendanceSettings?.nightDifferentialMultiplier || 0.1;
    const NIGHT_DIFF_MIN_HOURS = 1;

    let nightDifferentialHours =
      nightDiffHours ?? timeMetrics?.nightDifferentialHours ?? 0;
    let nightDifferentialPay = 0;

    if (nightDifferentialHours >= NIGHT_DIFF_MIN_HOURS) {
      nightDifferentialPay =
        nightDifferentialHours * hourlyRate * nightDiffMultiplier;
    } else {
      nightDifferentialHours = 0;
    }

    // Overtime calculation
    const overtimeHours = Math.floor((timeMetrics?.overtimeMinutes || 0) / 60);
    const overtimePay =
      overtimeHours *
      hourlyRate *
      (attendanceSettings?.overtimeHourlyMultiplier || 1.25);

    return {
      nightDifferentialHours,
      nightDifferentialPay,
      overtimePay,
      hourlyRate,
      attendanceSettings,
    };
  };

  const handleTimesheetEdit = async (
    value: string,
    foundEntry: Attendance,
    columnKey: string
  ) => {
    try {
      // Update attendance
      const updatedEntry = {
        ...foundEntry,
        [columnKey]: value,
      };

      // Check if both time in and time out are now present
      if (updatedEntry.timeIn && updatedEntry.timeOut) {
        // Create MissingTimeModel instance
        const missingTimeModel =
          MissingTimeModel.createMissingTimeModel(dbPath);

        // Load missing time logs for this month/year
        const missingLogs = await missingTimeModel.getMissingTimeLogs(
          month,
          year
        );

        // Find and delete the missing time log for this employee and day
        const missingLog = missingLogs.find(
          (log) =>
            log.employeeId === selectedEmployeeId &&
            log.day === foundEntry.day.toString()
        );

        if (missingLog) {
          await missingTimeModel.deleteMissingTimeLog(
            missingLog.id,
            month,
            year
          );
        }
      }

      await attendanceModel.saveOrUpdateAttendances(
        [updatedEntry],
        month,
        year,
        selectedEmployeeId
      );

      // Load settings for compensation calculation
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const employmentType = timeSettings.find(
        (type) => type.type === employee?.employmentType
      );

      // Check for holidays
      const holidayModel = createHolidayModel(dbPath, year, month);
      const holidays = await holidayModel.loadHolidays();
      const holiday = holidays.find((h) => {
        const entryDate = new Date(year, month - 1, foundEntry.day);
        return isHolidayDate(entryDate, h);
      });

      // Find existing compensation
      const existingCompensation = compensationEntries.find(
        (c) => c.day === foundEntry.day
      );

      // Get schedule for the day using the async model method
      const date = new Date(year, month - 1, foundEntry.day);
      // Use await and the model instance
      const schedule: DailySchedule | null = employmentType
        ? await attendanceSettingsModel.getScheduleForDate(employmentType, date)
        : null;

      // Check if it's a scheduled off day or no schedule exists
      if (!schedule || schedule.isOff) {
        // If it's an off day or no schedule, potentially update compensation to reflect this
        // (e.g., zero out hours worked, pay, etc. if applicable)
        // This might involve calling createBaseCompensation or similar logic
        console.log(
          `Day ${foundEntry.day} is an off day or has no schedule. Skipping detailed computation.`
        );

        // Re-fetch and update state to reflect the saved attendance
        const [updatedAttendanceData, updatedCompensationData] =
          await Promise.all([
            attendanceModel.loadAttendancesById(
              month,
              year,
              selectedEmployeeId
            ),
            compensationModel.loadRecords(month, year, selectedEmployeeId),
          ]);
        onDataUpdate(updatedAttendanceData, updatedCompensationData);
        toast.success("Timesheet updated (Off Day/No Schedule)");
        return; // Stop further processing if it's an off day
      }

      // Create time objects and calculate metrics (only if it's a scheduled work day)
      const { actual, scheduled } = createTimeObjects(
        year,
        month,
        foundEntry.day,
        updatedEntry.timeIn ?? "",
        updatedEntry.timeOut ?? "",
        schedule // Pass the fetched DailySchedule object
      );

      // Ensure scheduled times could be created
      if (!scheduled) {
        console.warn(
          `[useTimesheetEdit] Could not create scheduled times for day ${foundEntry.day}.`
        );
        // Handle this case - perhaps log an error and skip compensation update?
        // For now, just proceed but compensation might be inaccurate.
      }

      const timeMetrics = calculateTimeMetrics(
        actual,
        scheduled, // Pass the potentially null scheduled object
        await attendanceSettingsModel.loadAttendanceSettings(),
        employmentType || null
      );

      const {
        nightDifferentialHours,
        nightDifferentialPay,
        overtimePay,
        hourlyRate,
        attendanceSettings,
      } = await calculateCompensationMetrics(timeMetrics, employmentType);

      const dailyRate = parseFloat((employee?.dailyRate || 0).toString());

      // Add this before creating compensation
      const isWorkday = !!schedule;
      const isHoliday = !!holiday;
      const hasTimeEntries = !!(updatedEntry.timeIn && updatedEntry.timeOut);
      const isAbsent = isWorkday && !isHoliday && !hasTimeEntries;

      // For non-time-tracking employees or missing time entries
      if (!employmentType?.requiresTimeTracking || !hasTimeEntries) {
        const compensation = createBaseCompensation(
          updatedEntry,
          employee,
          month,
          year,
          holiday
        );

        // Set absence and pay based on conditions
        const isPresent =
          !employmentType?.requiresTimeTracking &&
          (updatedEntry.timeIn === "present" ||
            updatedEntry.timeOut === "present");

        compensation.absence = !isPresent && isAbsent;
        compensation.grossPay = isHoliday
          ? dailyRate * (holiday?.multiplier || 1)
          : isPresent
            ? dailyRate
            : 0;
        compensation.netPay = compensation.grossPay;

        try {
          console.log("[useTimesheetEdit] Attempting to save non-time-tracking compensation...", compensation);
          await compensationModel.saveOrUpdateCompensations(
            [compensation],
            month,
            year,
            selectedEmployeeId
          );
          console.log("[useTimesheetEdit] Successfully saved non-time-tracking compensation.");
        } catch (saveError) {
          console.error("[useTimesheetEdit] Error saving non-time-tracking compensation:", saveError);
          throw saveError;
        }

        const [updatedAttendanceData, updatedCompensationData] =
          await Promise.all([
            attendanceModel.loadAttendancesById(
              month,
              year,
              selectedEmployeeId
            ),
            compensationModel.loadRecords(month, year, selectedEmployeeId),
          ]);

        onDataUpdate(updatedAttendanceData, updatedCompensationData);
        return;
      }

      // Create updated compensation
      const compensation = createCompensationRecord(
        updatedEntry,
        employee,
        timeMetrics,
        await calculatePayMetrics(
          timeMetrics,
          attendanceSettings,
          dailyRate,
          holiday,
          actual.timeIn,
          actual.timeOut,
          scheduled,
          employmentType
        ),
        month,
        year,
        holiday,
        existingCompensation
      );

      // Save compensation
      try {
        console.log("[useTimesheetEdit] Attempting to save compensation...", compensation);
        await compensationModel.saveOrUpdateCompensations(
          [compensation],
          month,
          year,
          selectedEmployeeId
        );
        console.log("[useTimesheetEdit] Successfully saved compensation.");
      } catch (saveError) {
        console.error("[useTimesheetEdit] Error saving compensation:", saveError);
        throw saveError;
      }

      // Reload data
      const [updatedAttendanceData, updatedCompensationData] =
        await Promise.all([
          attendanceModel.loadAttendancesById(month, year, selectedEmployeeId),
          compensationModel.loadRecords(month, year, selectedEmployeeId),
        ]);

      // Update parent component
      onDataUpdate(updatedAttendanceData, updatedCompensationData);

      // Show success toast
      toast.success("Timesheet updated successfully");
    } catch (error) {
      console.error("[useTimesheetEdit] Error in handleTimesheetEdit (outer catch):", error);
      toast.error("Failed to update timesheet");
      throw error;
    }
  };

  const handleInputChange = async (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    formData: Compensation,
    setFormData: React.Dispatch<React.SetStateAction<Compensation>>
  ) => {
    const { name, value } = e.target;

    if (!hasEditAccess) {
      toast.error("You do not have permission to edit compensation records");
      return;
    }

    const isComputedField = [
      "lateMinutes",
      "undertimeMinutes",
      "overtimeMinutes",
      "hoursWorked",
      "grossPay",
      "deductions",
      "netPay",
      "overtimePay",
      "undertimeDeduction",
      "lateDeduction",
      "holidayBonus",
      "nightDifferentialHours",
      "nightDifferentialPay",
    ].includes(name);

    if (isComputedField && !formData.manualOverride) {
      toast.error("Enable manual override to edit computed fields");
      return;
    }

    const numericValue = parseFloat(value) || 0;

    setFormData((prev) => {
      const newData = { ...prev };
      const key = name as keyof Compensation;
      (newData[key] as string | number) =
        name.includes("Pay") ||
          name.includes("Deduction") ||
          name.includes("Hours") ||
          name.includes("Minutes")
          ? numericValue
          : value;
      return newData;
    });
  };

  return { handleTimesheetEdit, handleInputChange };
};
