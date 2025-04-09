import { useState } from "react";
import { toast } from "sonner";
import { createStatisticsModel } from "@/renderer/model/statistics";
import { PayrollSummary } from "@/renderer/types/payroll";
import { PayrollSummaryModel } from "@/renderer/model/payroll";

/**
 * Hook for managing payroll statistics generation
 */
export function usePayrollStatistics() {
  const [isGeneratingStatistics, setIsGeneratingStatistics] = useState(false);

  /**
   * Generate payroll statistics for a given set of payroll summaries
   * @param payrolls Array of payroll summaries
   * @param dbPath Path to the database directory
   * @param year Optional year parameter. If not provided, will be extracted from the first payroll's end date
   * @returns Promise that resolves when statistics are generated
   */
  const generatePayrollStatistics = async (
    payrolls: PayrollSummary[],
    dbPath: string,
    year?: number
  ): Promise<void> => {
    if (!payrolls || payrolls.length === 0) {
      toast.error("No payroll data provided for statistics generation");
      return;
    }

    try {
      setIsGeneratingStatistics(true);

      // Get the year from the first payroll's end date if not provided
      const targetYear = year || new Date(payrolls[0].endDate).getFullYear();

      // Create statistics model and update statistics
      const statisticsModel = createStatisticsModel(dbPath, targetYear);
      await statisticsModel.updatePayrollStatistics(payrolls);

      toast.success("Payroll statistics updated successfully");
    } catch (error) {
      toast.error("Failed to generate payroll statistics");
    } finally {
      setIsGeneratingStatistics(false);
    }
  };

  /**
   * Update statistics for a specific month using the optimized approach
   * @param payrolls Array of payroll summaries
   * @param dbPath Path to the database directory
   * @param monthName Name of the month (e.g., "January")
   * @param year Year for the statistics
   * @returns Promise that resolves when statistics are updated
   */
  const updateMonthStatistics = async (
    payrolls: PayrollSummaryModel[],
    dbPath: string,
    monthName: string,
    year: number
  ): Promise<void> => {
    if (!payrolls || payrolls.length === 0) {
      toast.info(`No payroll data available for ${monthName}`);
      return;
    }

    try {
      setIsGeneratingStatistics(true);

      // Create a statistics model for the selected year
      const statisticsModel = createStatisticsModel(dbPath, year);

      // Get current statistics
      const currentStats = await statisticsModel.getStatistics();

      // Find the month in the monthly payrolls
      const monthData = currentStats.monthlyPayrolls.find(
        (m) => m.month === monthName
      );

      if (monthData) {
        // Calculate new totals for this month
        const monthTotals = payrolls.reduce(
          (acc, curr) => {
            return {
              amount: acc.amount + (curr.netPay || 0),
              days: acc.days + (curr.daysWorked || 0),
              employees: acc.employees + 1,
              absences: acc.absences + (curr.absences || 0),
            };
          },
          { amount: 0, days: 0, employees: 0, absences: 0 }
        );

        // Update the month data
        monthData.amount = monthTotals.amount;
        monthData.days = monthTotals.days;
        monthData.employees = monthTotals.employees;
        monthData.absences = monthTotals.absences;

        // Update the statistics
        await statisticsModel.updatePayrollStatistics(payrolls);

        toast.success(`Statistics for ${monthName} updated successfully`);
      } else {
        // If month data doesn't exist, just update the statistics
        await statisticsModel.updatePayrollStatistics(payrolls);
        toast.info(`Statistics updated for ${monthName}`);
      }
    } catch (error) {
      console.error("Error updating month statistics:", error);
      toast.error(`Failed to update statistics for ${monthName}`);
    } finally {
      setIsGeneratingStatistics(false);
    }
  };

  return {
    isGeneratingStatistics,
    generatePayrollStatistics,
    updateMonthStatistics,
  };
}
