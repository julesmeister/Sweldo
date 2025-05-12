import { Attendance } from "../model/attendance";
import {
  Compensation,
  CompensationModel,
  DayType,
} from "../model/compensation"; // Import Compensation types/model
import { toast } from "sonner";

/**
 * Hook for handling history-related operations (swap, revert attendance, revert compensation)
 */
interface UseTimesheetHistoryOperationsProps {
  hasAccess: (code: string) => boolean;
  handleTimesheetEdit: (
    value: string,
    foundEntry: Attendance,
    columnKey: string
  ) => Promise<void>; // Keep this for attendance revert
  compensationModel: CompensationModel; // Add compensation model
  timesheetEntries: Attendance[];
  compensationEntries: Compensation[]; // Add current compensation state
  storedMonthInt: number;
  year: number;
  selectedEmployeeId: string | null;
  employee: any | null;
  // Add a callback for when data updates after revert (can be same as edit)
  onDataUpdate: (
    newAttendance: Attendance[],
    newCompensations: Compensation[]
  ) => void;
}

export const useTimesheetHistoryOperations = ({
  hasAccess,
  handleTimesheetEdit,
  compensationModel, // Destructure new prop
  timesheetEntries,
  compensationEntries, // Destructure new prop
  storedMonthInt,
  year,
  selectedEmployeeId,
  employee,
  onDataUpdate, // Destructure new prop
}: UseTimesheetHistoryOperationsProps) => {
  // --- Attendance Swap --- (No changes needed here)
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

      await handleTimesheetEdit(originalTimeOut || "", rowData, "timeIn");

      const updatedRowData = {
        ...rowData,
        timeIn: originalTimeOut,
      };

      await handleTimesheetEdit(
        originalTimeIn || "",
        updatedRowData,
        "timeOut"
      );
    } catch (error) {
      throw error;
    }
  };

  // --- Attendance Revert --- (Rename for clarity)
  const handleRevertAttendanceToHistory = async (
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

      await handleTimesheetEdit(timeIn || "", existingAttendance, "timeIn");

      const updatedAttendance = {
        ...existingAttendance,
        timeIn: timeIn,
      };

      await handleTimesheetEdit(timeOut || "", updatedAttendance, "timeOut");
    } catch (error) {
      console.error(`Error reverting attendance for day ${day}:`, error);
      throw error;
    }
  };

  // --- NEW: Compensation Revert ---
  const handleRevertCompensationToHistory = async (
    day: number,
    backupCompensationData: any // Type corresponds to CompensationBackupEntry fields we parse
  ) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      // Check Payroll permission
      toast.error("You don't have permission to modify compensation records");
      throw new Error("Permission denied");
    }
    if (!employee || !selectedEmployeeId) {
      toast.error("Employee context missing.");
      throw new Error("Missing employee data");
    }
    if (!backupCompensationData) {
      toast.error("Backup compensation data is missing for this entry.");
      throw new Error("Missing backup data");
    }

    try {
      // Find the CURRENT compensation record for this day
      const currentCompensation = compensationEntries.find(
        (entry) =>
          entry.day === day &&
          entry.month === storedMonthInt &&
          entry.year === year
      );

      if (!currentCompensation) {
        toast.error(
          `No current compensation record found for day ${day} to revert.`
        );
        throw new Error(`No current compensation record found for day ${day}`);
      }

      // Create the reverted record based on current, overriding with backup values
      const revertedCompensation: Compensation = {
        ...currentCompensation, // Start with current data (esp. dailyRate, employeeId etc.)
        grossPay:
          backupCompensationData.grossPay ?? currentCompensation.grossPay,
        netPay: backupCompensationData.netPay ?? currentCompensation.netPay,
        deductions:
          backupCompensationData.deductions ?? currentCompensation.deductions,
        hoursWorked:
          backupCompensationData.hoursWorked ?? currentCompensation.hoursWorked,
        dayType: (backupCompensationData.dayType ||
          currentCompensation.dayType) as DayType,
        absence: backupCompensationData.absence ?? currentCompensation.absence,
        // --- UNCOMMENTED: Revert specific calculated fields if they exist in backup ---
        overtimePay:
          backupCompensationData.overtimePay ?? currentCompensation.overtimePay,
        undertimeDeduction:
          backupCompensationData.undertimeDeduction ??
          currentCompensation.undertimeDeduction,
        lateDeduction:
          backupCompensationData.lateDeduction ??
          currentCompensation.lateDeduction,
        holidayBonus:
          backupCompensationData.holidayBonus ??
          currentCompensation.holidayBonus,
        nightDifferentialHours:
          backupCompensationData.nightDifferentialHours ??
          currentCompensation.nightDifferentialHours,
        nightDifferentialPay:
          backupCompensationData.nightDifferentialPay ??
          currentCompensation.nightDifferentialPay,
        // Note: We probably don't revert minutes (overtime, undertime, late) as they are derived
        // Reverting pay/deduction amounts and hours is usually sufficient.
        // Also, don't revert dailyRate unless it changed in backup (unlikely)
        manualOverride: true, // Mark as manually overridden since we are setting calculated values
        notes: `${currentCompensation.notes || ""
          } (Reverted compensation from backup ${new Date().toISOString()})`.trim(),
      };

      // Save the single reverted record
      await compensationModel.saveOrUpdateCompensations(
        [revertedCompensation],
        storedMonthInt,
        year,
        selectedEmployeeId
      );

      // Reload data using the passed callback
      // This assumes onDataUpdate reloads both attendance and compensation
      const updatedCompensationData = await compensationModel.loadRecords(
        storedMonthInt,
        year,
        selectedEmployeeId
      );
      // Pass current attendance state, assuming it didn't change,
      // or reload if necessary depending on onDataUpdate implementation
      onDataUpdate(timesheetEntries, updatedCompensationData);

      toast.success(`Compensation for day ${day} reverted successfully.`);
    } catch (error) {
      console.error(`Error reverting compensation for day ${day}:`, error);
      toast.error(`Failed to revert compensation for day ${day}.`);
      throw error; // Re-throw for the dialog to potentially handle
    }
  };

  return {
    handleSwapTimes,
    handleRevertAttendanceToHistory, // Keep original name
    handleRevertCompensationToHistory, // Add new function
  };
};
