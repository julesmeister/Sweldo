import { Attendance } from "@/renderer/model/attendance";
import { Compensation } from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import { toast } from "sonner";

interface UseTimesheetHistoryOperationsParams {
  hasAccess: (code: string) => boolean;
  handleTimesheetEdit: (
    value: string,
    rowData: any,
    columnKey: string
  ) => Promise<void>;
  compensationModel: any;
  timesheetEntries: Attendance[];
  compensationEntries: Compensation[];
  storedMonthInt: number;
  year: number;
  selectedEmployeeId: string | null;
  employee: Employee | null;
  onDataUpdate: (
    newAttendance: Attendance[],
    newCompensations: Compensation[]
  ) => void;
}

/**
 * Hook for handling timesheet history operations
 */
export const useTimesheetHistoryOperations = ({
  hasAccess,
  handleTimesheetEdit,
  compensationModel,
  timesheetEntries,
  compensationEntries,
  storedMonthInt,
  year,
  selectedEmployeeId,
  employee,
  onDataUpdate,
}: UseTimesheetHistoryOperationsParams) => {
  /**
   * Swap timeIn and timeOut values
   */
  const handleSwapTimes = async (rowData: any) => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You don't have permission to modify attendance records");
      return;
    }

    try {
      console.log(
        "useTimesheetHistoryOperations.handleSwapTimes - Starting time swap:",
        {
          employeeId: selectedEmployeeId,
          day: rowData.day,
          timeIn: rowData.timeIn,
          timeOut: rowData.timeOut,
        }
      );

      // Get current values
      const timeIn = rowData.timeIn;
      const timeOut = rowData.timeOut;

      // Check if both values exist
      if (!timeIn || !timeOut) {
        toast.error("Both Time In and Time Out must have values to swap");
        return;
      }

      // Update with swapped values
      const updatedEntry = { ...rowData, timeIn: timeOut, timeOut: timeIn };

      // Call the timesheet edit function twice to update both values
      await handleTimesheetEdit(timeOut, rowData, "timeIn");
      await handleTimesheetEdit(timeIn, updatedEntry, "timeOut");

      toast.success("Time values swapped successfully");

      console.log(
        "useTimesheetHistoryOperations.handleSwapTimes - Completed time swap"
      );
    } catch (error) {
      console.error(
        "useTimesheetHistoryOperations - Error swapping times:",
        error
      );
      toast.error("Failed to swap time values");
    }
  };

  /**
   * Revert attendance to a historical version
   */
  const handleRevertAttendanceToHistory = async (
    historicalAttendance: Attendance
  ) => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You don't have permission to modify attendance records");
      return;
    }

    try {
      console.log(
        "useTimesheetHistoryOperations.handleRevertAttendanceToHistory - Starting revert:",
        {
          employeeId: selectedEmployeeId,
          day: historicalAttendance.day,
          month: storedMonthInt,
          year: year,
        }
      );

      // Find the current entry for this day
      const currentEntry = timesheetEntries.find(
        (entry) => entry.day === historicalAttendance.day
      );

      if (!currentEntry) {
        toast.error("Current entry not found for this day");
        return;
      }

      // Update time in
      await handleTimesheetEdit(
        historicalAttendance.timeIn || "",
        currentEntry,
        "timeIn"
      );

      // Update time out (make sure to get the updated entry with the new timeIn)
      const updatedEntries = timesheetEntries.map((entry) =>
        entry.day === historicalAttendance.day
          ? { ...entry, timeIn: historicalAttendance.timeIn }
          : entry
      );

      const updatedEntry = updatedEntries.find(
        (entry) => entry.day === historicalAttendance.day
      );

      if (!updatedEntry) {
        toast.error("Updated entry not found");
        return;
      }

      await handleTimesheetEdit(
        historicalAttendance.timeOut || "",
        updatedEntry,
        "timeOut"
      );

      toast.success("Attendance reverted to historical value");

      console.log(
        "useTimesheetHistoryOperations.handleRevertAttendanceToHistory - Completed revert"
      );
    } catch (error) {
      console.error(
        "useTimesheetHistoryOperations - Error reverting attendance:",
        error
      );
      toast.error("Failed to revert attendance");
    }
  };

  /**
   * Revert compensation to a historical version
   */
  const handleRevertCompensationToHistory = async (
    historicalCompensation: Compensation
  ) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to modify compensation records");
      return;
    }

    if (!selectedEmployeeId) {
      toast.error("No employee selected");
      return;
    }

    try {
      console.log(
        "useTimesheetHistoryOperations.handleRevertCompensationToHistory - Starting revert:",
        {
          employeeId: selectedEmployeeId,
          day: historicalCompensation.day,
          month: storedMonthInt,
          year: year,
        }
      );

      // Find the current entry for this day
      const existingComp = compensationEntries.find(
        (comp) => comp.day === historicalCompensation.day
      );

      // If there's an existing comp, update it with the historical values
      // Otherwise create a new one
      const updatedComp = existingComp
        ? { ...existingComp, ...historicalCompensation }
        : historicalCompensation;

      // Make sure we have the required fields
      updatedComp.employeeId = selectedEmployeeId;
      updatedComp.month = storedMonthInt;
      updatedComp.year = year;
      updatedComp.day = historicalCompensation.day;

      // Save to database
      await compensationModel.saveOrUpdateCompensations(
        [updatedComp],
        storedMonthInt,
        year,
        selectedEmployeeId
      );

      // Get updated compensations
      const newCompensations = await compensationModel.loadRecords(
        storedMonthInt,
        year,
        selectedEmployeeId
      );

      // Update UI
      onDataUpdate(timesheetEntries, newCompensations);

      toast.success("Compensation reverted to historical value");

      console.log(
        "useTimesheetHistoryOperations.handleRevertCompensationToHistory - Completed revert:",
        {
          compensationCount: newCompensations.length,
        }
      );
    } catch (error) {
      console.error(
        "useTimesheetHistoryOperations - Error reverting compensation:",
        error
      );
      toast.error("Failed to revert compensation");
    }
  };

  return {
    handleSwapTimes,
    handleRevertAttendanceToHistory,
    handleRevertCompensationToHistory,
  };
};
