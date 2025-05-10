import { Attendance } from "@/renderer/model/attendance";
import { Compensation } from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import { toast } from "sonner";
import { EmploymentType } from "@/renderer/model/settings";

interface UseTimesheetEditParams {
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
}: UseTimesheetEditParams) => {
  /**
   * Handle timesheet cell edits
   */
  const handleTimesheetEdit = async (
    value: string,
    rowData: any,
    columnKey: string
  ) => {
    try {
      console.log("useTimesheetEdit.handleTimesheetEdit - Starting edit:", {
        employeeId: selectedEmployeeId,
        day: rowData.day,
        column: columnKey,
        value,
        month,
        year,
      });

      // Create a new attendance record with the updated value
      const updatedEntry = { ...rowData };
      updatedEntry[columnKey] = value;

      // If one field is present but the other is not, set both to present (for non-time-tracking)
      if (!employee) return;

      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const employeeType = timeSettings.find(
        (type: EmploymentType) =>
          type.type.toLowerCase() === employee?.employmentType?.toLowerCase()
      );

      if (!employeeType) {
        toast.error("Employee type settings not found");
        throw new Error("Employee type settings not found");
      }

      // For non-time tracking employees, update both fields
      if (!employeeType.requiresTimeTracking) {
        updatedEntry.timeIn = value;
        updatedEntry.timeOut = value;
      }

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

      // Find existing compensation for this day or create a new one
      const existingComp = compensationEntries.find(
        (comp) => comp.day === rowData.day
      );

      const updatedComp = existingComp
        ? { ...existingComp }
        : {
            employeeId: selectedEmployeeId,
            day: rowData.day,
            month,
            year,
            dayType: "Regular",
            dailyRate: employee?.dailyRate || 0,
            hoursWorked: 0,
            grossPay: 0,
            netPay: 0,
            absence: !(rowData.timeIn || rowData.timeOut),
            nightDifferentialHours: 0,
            nightDifferentialPay: 0,
          };

      // Update the absence status - if timeIn or timeOut is filled, the employee is present
      const hasTimeEntry = updatedEntry.timeIn || updatedEntry.timeOut;
      updatedComp.absence = !hasTimeEntry;

      // Save the updated compensation
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

      console.log("useTimesheetEdit.handleTimesheetEdit - Completed edit:", {
        employeeId: selectedEmployeeId,
        day: rowData.day,
        column: columnKey,
        attendanceCount: newAttendance.length,
        compensationCount: newCompensations.length,
      });

      // Update the UI with the new data
      onDataUpdate(newAttendance, newCompensations);
      toast.success("Timesheet entry updated");
    } catch (error) {
      console.error(
        "useTimesheetEdit - Error updating timesheet entry:",
        error
      );
      toast.error("Failed to update timesheet entry");
    }
  };

  return {
    handleTimesheetEdit,
  };
};
