import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { createLoanModel, Loan, Deduction } from "../model/loan";
import { toast } from "sonner";

interface UseLoanManagementOptions {
  employeeId: string;
  year?: number;
  month?: number;
}

export function useLoanManagement({
  employeeId,
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
}: UseLoanManagementOptions) {
  const { dbPath } = useSettingsStore();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load loans
  const loadLoans = useCallback(async () => {
    if (!dbPath || !employeeId) {
      setError("Missing required parameters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loanModel = createLoanModel(dbPath, employeeId);
      const loadedLoans = await loanModel.loadLoans(year, month);
      setLoans(loadedLoans);
    } catch (err) {
      console.error("Error loading loans:", err);
      setError(err instanceof Error ? err.message : "Failed to load loans");
      toast.error("Failed to load loans. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dbPath, employeeId, year, month]);

  // Create loan
  const createLoan = useCallback(
    async (loanData: Omit<Loan, "id">) => {
      if (!dbPath || !employeeId) {
        setError("Missing required parameters");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loanModel = createLoanModel(dbPath, employeeId);
        const newLoan = {
          ...loanData,
          id: crypto.randomUUID(),
          employeeId,
        };
        await loanModel.createLoan(newLoan);
        toast.success("Loan created successfully");
        await loadLoans(); // Refresh loans
        return newLoan;
      } catch (err) {
        console.error("Error creating loan:", err);
        setError(err instanceof Error ? err.message : "Failed to create loan");
        toast.error("Failed to create loan. Please try again.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, loadLoans]
  );

  // Update loan
  const updateLoan = useCallback(
    async (loanData: Loan) => {
      if (!dbPath || !employeeId) {
        setError("Missing required parameters");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loanModel = createLoanModel(dbPath, employeeId);
        await loanModel.updateLoan(loanData);
        toast.success("Loan updated successfully");
        await loadLoans(); // Refresh loans
        return true;
      } catch (err) {
        console.error("Error updating loan:", err);
        setError(err instanceof Error ? err.message : "Failed to update loan");
        toast.error("Failed to update loan. Please try again.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, loadLoans]
  );

  // Delete loan
  const deleteLoan = useCallback(
    async (id: string, loan: Loan) => {
      if (!dbPath || !employeeId) {
        setError("Missing required parameters");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loanModel = createLoanModel(dbPath, employeeId);
        await loanModel.deleteLoan(id, loan);
        toast.success("Loan deleted successfully");
        await loadLoans(); // Refresh loans
        return true;
      } catch (err) {
        console.error("Error deleting loan:", err);
        setError(err instanceof Error ? err.message : "Failed to delete loan");
        toast.error("Failed to delete loan. Please try again.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, loadLoans]
  );

  // Add deduction to loan
  const addDeduction = useCallback(
    async (
      loanId: string,
      deduction: Omit<Deduction, "id"> & { id?: string }
    ) => {
      if (!dbPath || !employeeId) {
        setError("Missing required parameters");
        return false;
      }

      const loan = loans.find((l) => l.id === loanId);
      if (!loan) {
        setError(`Loan with ID ${loanId} not found`);
        toast.error("Loan not found");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const deductionId = deduction.id || crypto.randomUUID();
        const updatedLoan: Loan = {
          ...loan,
          deductions: {
            ...(loan.deductions || {}),
            [deductionId]: {
              ...deduction,
              amountDeducted: deduction.amountDeducted,
              dateDeducted: deduction.dateDeducted || new Date(),
            } as Deduction,
          },
          remainingBalance: loan.remainingBalance - deduction.amountDeducted,
          status:
            loan.remainingBalance - deduction.amountDeducted <= 0
              ? "Completed"
              : loan.status,
        };

        const loanModel = createLoanModel(dbPath, employeeId);
        await loanModel.updateLoan(updatedLoan);
        toast.success("Deduction added successfully");
        await loadLoans(); // Refresh loans
        return true;
      } catch (err) {
        console.error("Error adding deduction:", err);
        setError(
          err instanceof Error ? err.message : "Failed to add deduction"
        );
        toast.error("Failed to add deduction. Please try again.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, loans, loadLoans]
  );

  // Initial load
  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  return {
    loans,
    isLoading,
    error,
    loadLoans,
    createLoan,
    updateLoan,
    deleteLoan,
    addDeduction,
  };
}

export function useAllYearLoanManagement({
  employeeId,
  year = new Date().getFullYear(),
}: Omit<UseLoanManagementOptions, "month">) {
  const { dbPath } = useSettingsStore();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load loans from all months of the year
  const loadLoans = useCallback(async () => {
    if (!dbPath || !employeeId) {
      setError("Missing required parameters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allLoans: Loan[] = [];

      // Load loans from all months of the year
      for (let month = 1; month <= 12; month++) {
        try {
          const loanModel = createLoanModel(dbPath, employeeId);
          const monthLoans = await loanModel.loadLoans(year, month);
          allLoans.push(...monthLoans);
        } catch (err) {
          console.warn(`Error loading loans for month ${month}:`, err);
          // Continue with other months even if one fails
        }
      }

      // Remove any duplicate loans (same ID)
      const uniqueLoans = Array.from(
        new Map(allLoans.map((loan) => [loan.id, loan])).values()
      );

      console.log(
        `Loaded ${allLoans.length} total loans (${uniqueLoans.length} unique) from all months of year ${year}`
      );

      setLoans(uniqueLoans);
    } catch (err) {
      console.error("Error loading loans:", err);
      setError(err instanceof Error ? err.message : "Failed to load loans");
      toast.error("Failed to load loans. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [dbPath, employeeId, year]);

  // Initial load
  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  return {
    loans,
    isLoading,
    error,
    loadLoans,
  };
}

// Note: useLoanManagement is already exported at the top of the file
// Do not add another export statement here to avoid duplicate exports
