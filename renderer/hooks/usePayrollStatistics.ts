import { useState } from "react";
import { toast } from "sonner";
import { createStatisticsModel } from "@/renderer/model/statistics";
import { PayrollSummary } from "@/renderer/types/payroll";

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

      console.log(`Generating payroll statistics for year ${targetYear}`);
      console.log(`Processing ${payrolls.length} payroll records`);

      // Create statistics model and update statistics
      const statisticsModel = createStatisticsModel(dbPath, targetYear);
      await statisticsModel.updatePayrollStatistics(payrolls);

      console.log("Payroll statistics generated successfully");
      toast.success("Payroll statistics updated successfully");
    } catch (error) {
      console.error("Error generating payroll statistics:", error);
      toast.error("Failed to generate payroll statistics");
    } finally {
      setIsGeneratingStatistics(false);
    }
  };

  return {
    isGeneratingStatistics,
    generatePayrollStatistics,
  };
}
