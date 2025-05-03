import { Attendance } from "@/renderer/model/attendance";
import { toast } from "sonner";

/**
 * A hook for specialized attendance operations like swap and revert
 * @param {Object} props - Properties for the hook
 * @returns {Object} - Object containing specialized attendance operation functions
 */
interface UseAttendanceOperationsProps {
  hasAccess: (code: string) => boolean;
  handleTimesheetEdit: (
    value: string,
    foundEntry: Attendance,
    columnKey: string
  ) => Promise<void>;
  timesheetEntries: Attendance[];
  storedMonthInt: number;
  year: number;
  selectedEmployeeId: string | null;
  employee: any | null; // We can use a more specific type if needed
}

export const useAttendanceOperations = ({
  hasAccess,
  handleTimesheetEdit,
  timesheetEntries,
  storedMonthInt,
  year,
  selectedEmployeeId,
  employee,
}: UseAttendanceOperationsProps) => {
  /**
   * Swaps the timeIn and timeOut values for an attendance record
   * @param {Attendance} rowData - The attendance row to modify
   * @returns {Promise<void>}
   */
  const handleSwapTimes = async (rowData: Attendance) => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You don't have permission to modify attendance records");
      return;
    }
    if (!rowData || !rowData.employeeId) {
      toast.error("Cannot swap times: Missing employee data.");
      return;
    }

    try {
      const originalTimeIn = rowData.timeIn;
      const originalTimeOut = rowData.timeOut;

      // First update timeIn (to timeOut value)
      await handleTimesheetEdit(
        originalTimeOut || "", // New timeIn is old timeOut
        rowData,
        "timeIn"
      );

      // Then update timeOut with the original timeIn value
      // We need to create an updated rowData with the new timeIn already set
      const updatedRowData = {
        ...rowData,
        timeIn: originalTimeOut, // Reflect the first change
      };

      await handleTimesheetEdit(
        originalTimeIn || "", // New timeOut is old timeIn
        updatedRowData,
        "timeOut"
      );
    } catch (error) {
      throw error; // Re-throw so EditableCell can catch it
    }
  };

  /**
   * Reverts an attendance record to a previous state from history
   * @param {number} day - The day to revert
   * @param {string|null} timeIn - The timeIn value to revert to
   * @param {string|null} timeOut - The timeOut value to revert to
   * @returns {Promise<void>}
   */
  const handleRevertToHistory = async (
    day: number,
    timeIn: string | null,
    timeOut: string | null
  ) => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You don't have permission to modify attendance records");
      throw new Error("Permission denied");
    }
    if (!employee || !selectedEmployeeId) {
      toast.error("Employee context missing.");
      throw new Error("Missing employee data");
    }

    try {
      // Find the existing attendance record for this day
      const existingAttendance = timesheetEntries.find(
        (entry) =>
          entry.day === day &&
          entry.month === storedMonthInt &&
          entry.year === year &&
          entry.employeeId === selectedEmployeeId
      );

      if (!existingAttendance) {
        throw new Error(`No attendance record found for day ${day}`);
      }

      // First update timeIn
      await handleTimesheetEdit(timeIn || "", existingAttendance, "timeIn");

      // Then update timeOut (use the updated record with new timeIn)
      const updatedAttendance = {
        ...existingAttendance,
        timeIn: timeIn,
      };

      await handleTimesheetEdit(timeOut || "", updatedAttendance, "timeOut");
    } catch (error) {
      console.error(`Error reverting day ${day}:`, error);
      throw error;
    }
  };

  return {
    handleSwapTimes,
    handleRevertToHistory,
  };
};
