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
    const payroll = payrolls.find((p) => p.id === payrollId);
    if (!payroll) {
      toast.error("Payroll record not found");
      return;
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
      console.error("Error deleting payroll:", error);
      toast.error("Failed to delete payroll");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deletePayroll,
    isDeleting,
  };
};
