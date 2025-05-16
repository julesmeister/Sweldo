import { useState, useCallback } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { Payroll, PayrollSummaryModel } from "../model/payroll";
import { toast } from "sonner";

interface PayrollSummaryOptions {
  employeeId: string;
  startDate?: Date;
  endDate?: Date;
}

interface UsePayrollSummaryResult {
  summary: PayrollSummaryModel | null;
  summaries: PayrollSummaryModel[];
  isLoading: boolean;
  error: string | null;

  // Generation and management
  generateSummary: (
    startDate: Date,
    endDate: Date,
    deductions?: {
      sss: number;
      philHealth: number;
      pagIbig: number;
      cashAdvanceDeductions: number;
      shortDeductions?: number;
    }
  ) => Promise<PayrollSummaryModel | null>;

  deleteSummary: (summaryId: string) => Promise<void>;
  loadSummaries: (year: number, month: number) => Promise<void>;
}

/**
 * Hook to manage payroll summary generation and retrieval
 *
 * This hook provides functionality to generate new payroll summaries,
 * load existing summaries, and delete summaries using the Payroll class methods.
 */
export function usePayrollSummary({
  employeeId,
  startDate,
  endDate,
}: PayrollSummaryOptions): UsePayrollSummaryResult {
  const { dbPath } = useSettingsStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PayrollSummaryModel | null>(null);
  const [summaries, setSummaries] = useState<PayrollSummaryModel[]>([]);

  /**
   * Generate a new payroll summary
   */
  const generateSummary = useCallback(
    async (
      start: Date,
      end: Date,
      deductions?: {
        sss: number;
        philHealth: number;
        pagIbig: number;
        cashAdvanceDeductions: number;
        shortDeductions?: number;
      }
    ) => {
      if (!dbPath || !employeeId) {
        setError("Missing required parameters");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create a new Payroll instance (we don't need rows since we're just using the methods)
        const payroll = new Payroll([], "json", dbPath);
        const newSummary = await payroll.generatePayrollSummary(
          employeeId,
          start,
          end,
          deductions
        );

        setSummary(newSummary);
        return newSummary;
      } catch (err) {
        console.error("Error generating payroll summary:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to generate payroll summary";
        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId]
  );

  /**
   * Load payroll summaries for a specific month and year
   */
  const loadSummaries = useCallback(
    async (year: number, month: number) => {
      if (!dbPath || !employeeId) {
        setError("Missing required parameters");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loadedSummaries = await Payroll.loadPayrollSummaries(
          dbPath,
          employeeId,
          year,
          month
        );
        setSummaries(loadedSummaries);

        // If start and end dates are provided, try to find a matching summary
        if (startDate && endDate) {
          const startTime = startDate.getTime();
          const endTime = endDate.getTime();
          const found = loadedSummaries.find((sum) => {
            const sumStartTime = new Date(sum.startDate).getTime();
            const sumEndTime = new Date(sum.endDate).getTime();
            return (
              Math.abs(sumStartTime - startTime) < 86400000 &&
              Math.abs(sumEndTime - endTime) < 86400000
            );
          });
          if (found) {
            setSummary(found);
          }
        }
      } catch (err) {
        console.error("Error loading payroll summaries:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load payroll summaries";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, startDate, endDate]
  );

  /**
   * Delete a payroll summary
   */
  const deleteSummary = useCallback(
    async (summaryId: string) => {
      if (!dbPath || !employeeId) {
        setError("Missing required parameters");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Find the summary to delete
        const summaryToDelete = summaries.find((s) => s.id === summaryId);
        if (!summaryToDelete) {
          throw new Error(`Payroll summary with ID ${summaryId} not found`);
        }

        // Use the static method from Payroll
        await Payroll.deletePayrollSummary(
          dbPath,
          employeeId,
          new Date(summaryToDelete.startDate),
          new Date(summaryToDelete.endDate)
        );

        // Update state after deletion
        setSummaries(summaries.filter((s) => s.id !== summaryId));
        if (summary?.id === summaryId) {
          setSummary(null);
        }

        toast.success("Payroll summary deleted successfully");
      } catch (err) {
        console.error("Error deleting payroll summary:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to delete payroll summary";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [dbPath, employeeId, summaries, summary]
  );

  return {
    summary,
    summaries,
    isLoading,
    error,
    generateSummary,
    deleteSummary,
    loadSummaries,
  };
}
