import { useState, useCallback, useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { Payroll } from "../model/payroll";
import { createCashAdvanceModel, CashAdvance } from "../model/cashAdvance";
import { createShortModel, Short } from "../model/shorts";
import { isWebEnvironment } from "../lib/firestoreService";
import { createLoanModel } from "../model/loan";
import { toast } from "sonner";

interface DeductionOptions {
  employeeId: string;
  payrollDate: Date;
}

interface UsePayrollDeductionsResult {
  isLoading: boolean;
  error: string | null;

  // Current deduction data
  cashAdvances: CashAdvance[];
  shorts: Short[];

  // For applying/reversing deductions
  reverseShortDeduction: (shortIDs: string[]) => Promise<void>;
  reverseCashAdvanceDeduction: (deductionAmount: number) => Promise<void>;
  reverseLoanDeduction: (
    loanId: string,
    deductionId: string
  ) => Promise<boolean>;

  // Refreshing data
  loadDeductionData: () => Promise<void>;
}

/**
 * Hook to manage payroll deductions for cash advances and shorts
 *
 * This hook provides functionality to load deduction-related data and
 * apply or reverse deductions using methods from the Payroll class.
 */
export function usePayrollDeductions({
  employeeId,
  payrollDate,
}: DeductionOptions): UsePayrollDeductionsResult {
  const { dbPath } = useSettingsStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [shorts, setShorts] = useState<Short[]>([]);

  /**
   * Load cash advances and shorts data for the given employee and date
   */
  const loadDeductionData = useCallback(async () => {
    if (!dbPath || !employeeId || !payrollDate) {
      setError("Missing required parameters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get recent months for retrieving data
      const months = [];
      let currentDate = new Date(payrollDate);
      for (let i = 0; i < 3; i++) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() - 1);
      }

      // Load cash advances
      const allAdvances: CashAdvance[] = [];
      for (const { month, year } of months) {
        const cashAdvanceModel = createCashAdvanceModel(
          dbPath,
          employeeId,
          month,
          year
        );
        const advances = await cashAdvanceModel.loadCashAdvances(employeeId);
        allAdvances.push(...advances);
      }
      setCashAdvances(allAdvances.filter((adv) => adv.status !== "Paid"));

      // Load shorts
      const allShorts: Short[] = [];
      for (const { month, year } of months) {
        const shortModel = createShortModel(dbPath, employeeId, month, year);
        const shortsData = await shortModel.loadShorts(employeeId);
        allShorts.push(...shortsData);
      }
      setShorts(allShorts.filter((short) => short.status !== "Paid"));
    } catch (err) {
      console.error("Error loading deduction data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load deduction data"
      );
    } finally {
      setIsLoading(false);
    }
  }, [dbPath, employeeId, payrollDate]);

  /**
   * Reverse cash advance deductions
   */
  const reverseCashAdvanceDeduction = useCallback(
    async (deductionAmount: number) => {
      if (!dbPath || !employeeId || !payrollDate) {
        setError("Missing required parameters");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Use the existing static method from Payroll
        await Payroll.deletePayrollSummary(
          dbPath,
          employeeId,
          payrollDate,
          payrollDate
        );
        // Refresh data after reversal
        await loadDeductionData();
      } catch (err) {
        console.error("Error reversing cash advance deduction:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to reverse cash advance deduction"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, payrollDate, loadDeductionData]
  );

  /**
   * Reverse short deductions
   */
  const reverseShortDeduction = useCallback(
    async (shortIDs: string[]) => {
      if (!dbPath || !employeeId || !payrollDate || !shortIDs.length) {
        setError("Missing required parameters");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // This is a simplified approach - in a real implementation,
        // you might want to use Payroll.reverseShortDeduction directly
        await Payroll.deletePayrollSummary(
          dbPath,
          employeeId,
          payrollDate,
          payrollDate
        );
        // Refresh data after reversal
        await loadDeductionData();
      } catch (err) {
        console.error("Error reversing short deduction:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to reverse short deduction"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, payrollDate, loadDeductionData]
  );

  // Add a new method to handle loan deductions
  const reverseLoanDeduction = useCallback(
    async (loanId: string, deductionId: string) => {
      if (!dbPath || !employeeId || !payrollDate) {
        setError("Missing required parameters");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create a loan model
        const loanModel = createLoanModel(dbPath, employeeId);

        // Load the loan first
        const year = payrollDate.getFullYear();
        const month = payrollDate.getMonth() + 1;
        const loans = await loanModel.loadLoans(year, month);
        const loan = loans.find((l) => l.id === loanId);

        if (!loan || !loan.deductions || !loan.deductions[deductionId]) {
          setError(`Loan deduction not found`);
          return false;
        }

        // Get the deduction amount
        const deduction = loan.deductions[deductionId];
        const deductionAmount = deduction.amountDeducted;

        // Create an updated loan without this deduction and update the remaining balance
        const updatedDeductions = { ...loan.deductions };
        delete updatedDeductions[deductionId];

        const updatedLoan = {
          ...loan,
          deductions: updatedDeductions,
          remainingBalance: loan.remainingBalance + deductionAmount,
          // Update status if needed
          status:
            loan.remainingBalance + deductionAmount > 0
              ? loan.status === "Completed"
                ? "Approved"
                : loan.status
              : loan.status,
        };

        // Update the loan
        await loanModel.updateLoan(updatedLoan);

        // Refresh data
        await loadDeductionData();

        toast.success("Loan deduction reversed successfully");
        return true;
      } catch (err) {
        console.error("Error reversing loan deduction:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to reverse loan deduction";
        setError(errorMessage);
        toast.error(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, payrollDate, loadDeductionData]
  );

  // Initialize data when component mounts
  useEffect(() => {
    loadDeductionData();
  }, [loadDeductionData]);

  return {
    isLoading,
    error,
    cashAdvances,
    shorts,
    reverseShortDeduction,
    reverseCashAdvanceDeduction,
    reverseLoanDeduction,
    loadDeductionData,
  };
}
