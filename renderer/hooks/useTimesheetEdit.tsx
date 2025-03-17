import { Attendance, AttendanceModel } from "@/renderer/model/attendance";
import {
  Compensation,
  CompensationModel,
  DayType,
} from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import {
  AttendanceSettingsModel,
  getScheduleForDay,
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
}: UseTimesheetEditProps) => {
  const handleTimesheetEdit = async (
    value: string,
    foundEntry: Attendance,
    columnKey: string
  ) => {
    try {
      console.log("Starting timesheet edit:", { value, foundEntry, columnKey });

      // Update attendance
      const updatedEntry = {
        ...foundEntry,
        [columnKey]: value,
      };
      console.log("Updated entry to save:", updatedEntry);

      await attendanceModel.saveOrUpdateAttendances(
        [updatedEntry],
        month,
        year,
        selectedEmployeeId
      );
      console.log("Attendance saved successfully");

      // Load settings for compensation calculation
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const attendanceSettings =
        await attendanceSettingsModel.loadAttendanceSettings();
      const employmentType = timeSettings.find(
        (type) => type.type === employee?.employmentType
      );
      console.log("Loaded settings:", { employmentType, attendanceSettings });

      // Check for holidays
      const holidayModel = createHolidayModel(dbPath, year, month);
      const holidays = await holidayModel.loadHolidays();
      const holiday = holidays.find((h) => {
        const entryDate = new Date(year, month - 1, foundEntry.day);
        return isHolidayDate(entryDate, h);
      });
      console.log("Holiday check:", { holiday });

      // Find existing compensation
      const existingCompensation = compensationEntries.find(
        (c) => c.day === foundEntry.day
      );
      console.log("Existing compensation:", existingCompensation);

      // For non-time-tracking employees or missing time entries
      if (
        !employmentType?.requiresTimeTracking ||
        !updatedEntry.timeIn ||
        !updatedEntry.timeOut
      ) {
        console.log(
          "Creating base compensation for non-time-tracking employee"
        );
        const compensation = createBaseCompensation(
          updatedEntry,
          employee,
          month,
          year,
          holiday
        );
        console.log("Base compensation created:", compensation);

        try {
          await compensationModel.saveOrUpdateCompensations(
            [compensation],
            month,
            year,
            selectedEmployeeId
          );
          console.log("Base compensation saved successfully");
        } catch (saveError) {
          console.error("Error saving base compensation:", saveError);
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
        console.log("Data reloaded:", {
          attendanceCount: updatedAttendanceData.length,
          compensationCount: updatedCompensationData.length,
        });

        onDataUpdate(updatedAttendanceData, updatedCompensationData);
        return;
      }

      // Get schedule for the day
      const date = new Date(year, month - 1, foundEntry.day);
      const dayOfWeek = date.getDay() || 7; // Convert Sunday (0) to 7
      const schedule = getScheduleForDay(employmentType, dayOfWeek);
      if (!schedule) {
        console.log("No schedule found for day:", { dayOfWeek, date });
        return;
      }
      console.log("Schedule found:", schedule);

      // Create time objects and calculate metrics
      const { actual, scheduled } = createTimeObjects(
        year,
        month,
        foundEntry.day,
        updatedEntry.timeIn,
        updatedEntry.timeOut,
        schedule
      );
      console.log("Time objects created:", { actual, scheduled });

      const timeMetrics = calculateTimeMetrics(
        actual,
        scheduled,
        attendanceSettings
      );
      console.log("Time metrics calculated:", timeMetrics);

      const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
      const payMetrics = calculatePayMetrics(
        timeMetrics,
        attendanceSettings,
        dailyRate,
        holiday
      );
      console.log("Pay metrics calculated:", payMetrics);

      // Create updated compensation
      const compensation = createCompensationRecord(
        updatedEntry,
        employee,
        timeMetrics,
        payMetrics,
        month,
        year,
        holiday,
        existingCompensation
      );
      console.log("Compensation record created:", compensation);

      // Save compensation
      try {
        await compensationModel.saveOrUpdateCompensations(
          [compensation],
          month,
          year,
          selectedEmployeeId
        );
        console.log("Compensation saved successfully");
      } catch (saveError) {
        console.error("Error saving compensation:", saveError);
        throw saveError;
      }

      // Reload data
      const [updatedAttendanceData, updatedCompensationData] =
        await Promise.all([
          attendanceModel.loadAttendancesById(month, year, selectedEmployeeId),
          compensationModel.loadRecords(month, year, selectedEmployeeId),
        ]);
      console.log("Final data reload:", {
        attendanceCount: updatedAttendanceData.length,
        compensationCount: updatedCompensationData.length,
      });

      // Update parent component
      onDataUpdate(updatedAttendanceData, updatedCompensationData);
    } catch (error) {
      console.error("Error in handleTimesheetEdit:", error);
      throw error;
    }
  };

  return { handleTimesheetEdit };
};
