import { Attendance } from "@/renderer/model/attendance";
import { AttendanceModel } from "@/renderer/model/attendance";
import {
  CompensationModel,
  Compensation,
  DayType,
} from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import { createHolidayModel } from "@/renderer/model/holiday";
import {
  AttendanceSettings,
  AttendanceSettingsModel,
  EmploymentType,
  DailySchedule,
} from "@/renderer/model/settings";
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
      // Get schedule for the day using the async model method
      const schedule: DailySchedule | null = employmentType
        ? await attendanceSettingsModel.getScheduleForDate(employmentType, date)
        : null;

      // Use the fetched schedule object
      const isWorkday = schedule && !schedule.isOff ? true : false;

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

      // Use the standard calculation logic
      const dailyRate = employee?.dailyRate || 0;
      const isHoliday = !!holiday;
      const isPaidHoliday = holiday && holiday.multiplier > 0;

      // Determine pay based on presence and holiday status
      let calculatedGrossPay = 0;
      let calculatedHolidayBonus = 0;
      let isMarkedAbsent = false;

      if (isPresent) {
        if (isPaidHoliday) {
          // Present on a paid holiday
          calculatedGrossPay = dailyRate * holiday.multiplier;
          calculatedHolidayBonus = calculatedGrossPay; // Store total holiday pay in bonus field
        } else {
          // Present on a regular day
          calculatedGrossPay = dailyRate;
          calculatedHolidayBonus = 0;
        }
        isMarkedAbsent = false;
      } else {
        // Absent
        if (isPaidHoliday) {
          // Absent on a paid holiday (e.g., Regular Holiday) - pay base rate
          calculatedGrossPay = dailyRate * 1.0; // Assuming 100% pay for absence on Reg Hol
          calculatedHolidayBonus = 0; // No work premium earned
          isMarkedAbsent = false; // Not technically absent if paid
        } else {
          // Absent on regular day or unpaid holiday
          calculatedGrossPay = 0;
          calculatedHolidayBonus = 0;
          isMarkedAbsent = true;
        }
      }

      // Only set dailyRate and pay if both timeIn and timeOut are present
      // const hasCompleteAttendance =
      //   (updatedEntry.timeIn && updatedEntry.timeOut) ||
      //   (updatedEntry.timeIn === "present" &&
      //     updatedEntry.timeOut === "present");
      // const dailyRate = hasCompleteAttendance ? employee?.dailyRate || 0 : 0;
      // const isHoliday = !!holiday;
      // const hasTimeEntries = isPresent; // Using the checkbox state
      // const isAbsent = isWorkday && !isHoliday && !hasTimeEntries;

      const compensation: Compensation = {
        ...(existingCompensation || {}),
        employeeId: selectedEmployeeId,
        month,
        year,
        day: foundEntry.day,
        manualOverride: true, // Checkbox implies manual setting of presence
        dailyRate: employee?.dailyRate || 0, // Store base rate
        absence: isMarkedAbsent, // Use the determined absence status
        grossPay: calculatedGrossPay, // Use calculated gross
        netPay: calculatedGrossPay, // Assuming no deductions in this simplified scenario
        holidayBonus: calculatedHolidayBonus, // Store calculated bonus (total pay if worked, 0 if absent)
        dayType: isHoliday
          ? holiday.type === "Regular"
            ? "Holiday"
            : "Special"
          : "Regular",
        // Zero out other time-based fields
        hoursWorked: 0,
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
        deductions: 0,
        overtimePay: 0,
        lateDeduction: 0,
        undertimeDeduction: 0,
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
