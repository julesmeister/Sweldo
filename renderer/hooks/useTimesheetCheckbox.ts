import { Attendance } from "@/renderer/model/attendance";
import { Compensation } from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import { toast } from "sonner";
import { EmploymentType } from "@/renderer/model/settings";

interface UseTimesheetCheckboxParams {
  attendanceModel: any;
  compensationModel: any;
  attendanceSettingsModel: any;
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
}: UseTimesheetCheckboxParams) => {
  /**
   * Handle checkbox change for attendance status
   */
  const handleCheckboxChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    entry: Attendance
  ) => {
    try {
      console.log(
        "useTimesheetCheckbox.handleCheckboxChange - Starting checkbox update:",
        {
          employeeId: selectedEmployeeId,
          day: entry.day,
          month,
          year,
          checked: e.target.checked,
        }
      );

      // Create a new attendance record
      const updatedEntry = { ...entry };
      const isPresent = e.target.checked;

      // Update attendance status
      updatedEntry.timeIn = isPresent ? "present" : "";
      updatedEntry.timeOut = isPresent ? "present" : "";

      // Save to database
      await attendanceModel.saveOrUpdateAttendances(
        [updatedEntry],
        month,
        year,
        selectedEmployeeId
      );

      // Get updated attendance data
      const newAttendance = await attendanceModel.loadAttendancesById(
        month,
        year,
        selectedEmployeeId
      );

      // Get all time settings for computing compensation
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();

      // Find the employee's settings
      const employeeType = timeSettings.find(
        (type: EmploymentType) =>
          type.type.toLowerCase() === employee?.employmentType?.toLowerCase()
      );

      if (!employeeType) {
        toast.error("Employee type settings not found");
        throw new Error("Employee type settings not found");
      }

      // Find existing compensation for this day
      const existingComp = compensationEntries.find(
        (comp) => comp.day === entry.day
      );

      const updatedComp = existingComp
        ? { ...existingComp }
        : {
            employeeId: selectedEmployeeId,
            day: entry.day,
            month,
            year,
            dayType: "Regular", // Default
            dailyRate: employee?.dailyRate || 0,
            hoursWorked: 0,
            grossPay: 0,
            netPay: 0,
            absence: !isPresent,
            nightDifferentialHours: 0,
            nightDifferentialPay: 0,
          };

      // Update the absence status based on the checkbox
      updatedComp.absence = !isPresent;

      // Compute the compensation based on the new attendance
      const entryWithUpdatedComp = {
        ...updatedEntry,
        compensation: updatedComp,
      };

      // Save to database
      await compensationModel.saveOrUpdateCompensations(
        [updatedComp],
        month,
        year,
        selectedEmployeeId
      );

      // Get all updated compensations
      const newCompensations = await compensationModel.loadRecords(
        month,
        year,
        selectedEmployeeId
      );

      console.log(
        "useTimesheetCheckbox.handleCheckboxChange - Completed checkbox update:",
        {
          employeeId: selectedEmployeeId,
          day: entry.day,
          month,
          year,
          attendanceCount: newAttendance.length,
          compensationCount: newCompensations.length,
        }
      );

      // Update the UI with the new data
      onDataUpdate(newAttendance, newCompensations);
      toast.success("Attendance status updated");
    } catch (error) {
      console.error(
        "useTimesheetCheckbox - Error updating attendance status:",
        error
      );
      toast.error("Failed to update attendance status");
    }
  };

  return {
    handleCheckboxChange,
  };
};
