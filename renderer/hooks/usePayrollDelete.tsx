import { useState } from "react";
import { toast } from "sonner";
import { Payroll, PayrollSummaryModel } from "@/renderer/model/payroll";
import { createCashAdvanceModel } from "@/renderer/model/cashAdvance";

interface UsePayrollDeleteProps {
  dbPath: string;
  selectedEmployeeId: string;
  onPayrollDeleted: () => void;
}

export const usePayrollDelete = ({
  dbPath,
  selectedEmployeeId,
  onPayrollDeleted,
}: UsePayrollDeleteProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const deletePayroll = async (
    payrollId: string,
    payrolls: PayrollSummaryModel[]
  ) => {
    // Extract employeeId, startDate, and endDate from the payrollId
    // Format is: employeeId_startDateTimestamp_endDateTimestamp
    const parts = payrollId.split("_");
    if (parts.length !== 3) {
      toast.error("Invalid payroll ID format");
      return;
    }

    const employeeId = parts[0];
    const startDateTimestamp = parseInt(parts[1]);
    const endDateTimestamp = parseInt(parts[2]);

    if (isNaN(startDateTimestamp) || isNaN(endDateTimestamp)) {
      toast.error("Invalid payroll ID format");
      return;
    }

    const startDate = new Date(startDateTimestamp);
    const endDate = new Date(endDateTimestamp);

    // Try to find the payroll in the provided array first
    let payroll = payrolls.find((p) => p.id === payrollId);

    // If not found in the array but we have valid data from the ID, create a minimal payroll object
    if (!payroll) {
      payroll = {
        id: payrollId,
        employeeId,
        employeeName: "Unknown", // We don't have this info from just the ID
        startDate,
        endDate,
        dailyRate: 0,
        basicPay: 0,
        overtime: 0,
        grossPay: 0,
        allowances: 0,
        deductions: {
          sss: 0,
          philHealth: 0,
          pagIbig: 0,
          cashAdvanceDeductions: 0,
          shortDeductions: 0,
          others: 0,
        },
        netPay: 0,
        paymentDate: endDate.toISOString(),
        daysWorked: 0,
        absences: 0,
        cashAdvanceIDs: [],
        shortIDs: [],
      };
    }

    setIsDeleting(true);
    try {
      // First, reverse the cash advance deductions
      if (payroll.cashAdvanceIDs && payroll.cashAdvanceIDs.length > 0) {
        for (const advanceId of payroll.cashAdvanceIDs) {
          // Get the month and year from the payroll dates
          const payrollMonth = new Date(payroll.startDate).getMonth() + 1;
          const payrollYear = new Date(payroll.startDate).getFullYear();

          // Create cash advance model for the specific month/year
          const cashAdvanceModel = createCashAdvanceModel(
            dbPath,
            selectedEmployeeId,
            payrollMonth,
            payrollYear
          );

          // Load the cash advance to get its current state
          const advances = await cashAdvanceModel.loadCashAdvances(
            selectedEmployeeId
          );

          const advance = advances.find((a) => a.id === advanceId);

          if (advance) {
            // Get the deduction amount directly since it's already a number
            const amountToReverse =
              payroll.deductions.cashAdvanceDeductions || 0;

            // Update the remaining unpaid amount
            const updatedAdvance = {
              ...advance,
              remainingUnpaid: advance.remainingUnpaid + amountToReverse,
            };

            // Save the updated cash advance
            await cashAdvanceModel.updateCashAdvance(updatedAdvance);
          }
        }
      }

      // Then delete the payroll record
      await Payroll.deletePayrollSummary(
        dbPath,
        selectedEmployeeId,
        new Date(payroll.startDate),
        new Date(payroll.endDate)
      );

      // Notify parent component
      onPayrollDeleted();

      toast.success("Payroll deleted successfully");
    } catch (error) {
      toast.error("Failed to delete payroll");
      throw error; // Re-throw to be caught by the caller
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deletePayroll,
    isDeleting,
  };
};
