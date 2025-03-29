import { Attendance } from "@/renderer/model/attendance";
import { AttendanceModel } from "@/renderer/model/attendance";
import {
  CompensationModel,
  Compensation,
  DayType,
} from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import { createHolidayModel } from "@/renderer/model/holiday";
import { getScheduleForDay } from "@/renderer/model/settings";
import { AttendanceSettingsModel } from "@/renderer/model/settings";
import { MissingTimeModel } from "@/renderer/model/missingTime";

interface UseTimesheetCheckboxProps {
  attendanceModel: AttendanceModel;
  compensationModel: CompensationModel;
  attendanceSettingsModel: AttendanceSettingsModel;
  employee: Employee | null;
  selectedEmployeeId: string;
  compensationEntries: Compensation[];
  month: number;
  year: number;
  dbPath: string; // Add dbPath for holiday model
  onDataUpdate: (
    newAttendance: Attendance[],
    newCompensations: Compensation[]
  ) => void;
}

export const useTimesheetCheckbox = ({
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
}: UseTimesheetCheckboxProps) => {
  const handleCheckboxChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    foundEntry: Attendance
  ) => {
    try {
      e.stopPropagation();
      const isPresent = e.target.checked;

      // For non-time-tracking employees, we only store a marker for presence
      const updatedEntry = {
        ...foundEntry,
        timeIn: isPresent ? "present" : "",
        timeOut: isPresent ? "present" : "",
      };

      // If marked as present, delete any missing time logs
      if (isPresent) {
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
          console.log("Deleted missing time log:", missingLog);
        }
      }

      // Save the attendance record
      await attendanceModel.saveOrUpdateAttendances(
        [updatedEntry],
        month,
        year,
        selectedEmployeeId
      );

      // Create or update compensation record with manualOverride
      const existingCompensation = compensationEntries.find(
        (c) => c.day === foundEntry.day
      );

      // Check for holidays
      const holidayModel = createHolidayModel(dbPath, year, month);
      const holidays = await holidayModel.loadHolidays();

      // Load time settings to get employment type
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const employmentType = timeSettings.find(
        (type) => type.type === employee?.employmentType
      );

      const date = new Date(year, month - 1, foundEntry.day);
      const jsDay = date.getDay(); // 0-6 (0 = Sunday)
      const scheduleDay = jsDay === 0 ? 7 : jsDay; // Convert Sunday from 0 to 7

      // Get schedule for the day using found employment type
      const schedule = employmentType
        ? getScheduleForDay(employmentType, scheduleDay)
        : null;

      const isWorkday = !!schedule; // Update workday check based on schedule

      const holiday = holidays.find((h) => {
        const entryDate = new Date(year, month - 1, foundEntry.day);
        return (
          entryDate >=
            new Date(
              h.startDate.getFullYear(),
              h.startDate.getMonth(),
              h.startDate.getDate()
            ) &&
          entryDate <=
            new Date(
              h.endDate.getFullYear(),
              h.endDate.getMonth(),
              h.endDate.getDate(),
              23,
              59,
              59
            )
        );
      });

      // Only set dailyRate and pay if both timeIn and timeOut are present
      const hasCompleteAttendance =
        (updatedEntry.timeIn && updatedEntry.timeOut) ||
        (updatedEntry.timeIn === "present" &&
          updatedEntry.timeOut === "present");

      const dailyRate = hasCompleteAttendance ? employee?.dailyRate || 0 : 0;

      const isHoliday = !!holiday;
      const hasTimeEntries = isPresent; // Using the checkbox state
      const isAbsent = isWorkday && !isHoliday && !hasTimeEntries;

      const compensation: Compensation = {
        ...(existingCompensation || {}),
        employeeId: selectedEmployeeId,
        month,
        year,
        day: foundEntry.day,
        manualOverride: true,
        dailyRate,
        absence: isAbsent,
        grossPay: isHoliday
          ? dailyRate * (holiday?.multiplier || 1)
          : hasTimeEntries
          ? dailyRate
          : 0,
        netPay: isHoliday
          ? dailyRate * (holiday?.multiplier || 1)
          : hasTimeEntries
          ? dailyRate
          : 0,
        dayType: "Regular" as DayType,
        nightDifferentialHours: 0,
        nightDifferentialPay: 0,
      };

      await compensationModel.saveOrUpdateCompensations(
        [compensation],
        month,
        year,
        selectedEmployeeId
      );

      // Reload data
      const [updatedAttendanceData, updatedCompensationData] =
        await Promise.all([
          attendanceModel.loadAttendancesById(month, year, selectedEmployeeId),
          compensationModel.loadRecords(month, year, selectedEmployeeId),
        ]);

      // Update parent component with new data
      onDataUpdate(updatedAttendanceData, updatedCompensationData);
    } catch (error) {
      console.error("Error updating timesheet:", error);
      // You might want to add error handling/notification here
    }
  };

  return { handleCheckboxChange };
};
