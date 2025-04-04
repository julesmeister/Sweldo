export interface DailyRateHistory {
  employee: string;
  date: string;
  rate: number;
}

export interface MonthlyPayroll {
  month: string;
  amount: number;
  days: number;
  employees: number;
  absences: number;
}

export interface DeductionChange {
  date: string;
  amount: number;
}

export interface DeductionHistory {
  type: string;
  changes: DeductionChange[];
}

export interface StatisticsData {
  dailyRateHistory: DailyRateHistory[];
  currentDailyRate: number;
  previousDailyRate: number;
  rateChangePercentage: string;
  monthlyPayrolls: MonthlyPayroll[];
  yearlyTotal: number;
  yearlyAverage: number;
  deductionsHistory: DeductionHistory[];
}

export class StatisticsModel {
  filePath: string;
  year: number;

  constructor(dbPath: string, year?: number) {
    // Ensure dbPath is a directory path and includes SweldoDB/statistics
    this.filePath = dbPath.endsWith("/")
      ? `${dbPath}SweldoDB/statistics/`
      : `${dbPath}/SweldoDB/statistics/`;
    this.year = year || new Date().getFullYear();
    console.log("=== Statistics Model Initialized ===");
    console.log("File Path:", this.filePath);
    console.log("Year:", this.year);
  }

  async ensureDirectoryExists(): Promise<void> {
    try {
      const statisticsPath = `${this.filePath}`;
      console.log("=== Ensuring Directory Exists ===");
      console.log("Statistics Path:", statisticsPath);
      await window.electron.ensureDir(statisticsPath);
      console.log("Directory exists or was created successfully");
    } catch (error) {
      console.error("=== Error Ensuring Directory ===");
      console.error(error);
      throw error;
    }
  }

  async loadStatistics(year?: number): Promise<StatisticsData> {
    try {
      const targetYear = year || this.year;
      console.log("=== Loading Statistics File ===");
      console.log("Target Year:", targetYear);

      const filePath = `${this.filePath}${targetYear}_statistics.json`;
      console.log("Reading from file:", filePath);

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
        console.log("=== Successfully Loaded Statistics File ===");
        console.log("Raw Data Length:", data.length);
        const parsedData = JSON.parse(data) as StatisticsData;
        console.log("Parsed Data Summary:");
        console.log(
          "- Monthly Payrolls Count:",
          parsedData.monthlyPayrolls.length
        );
        console.log(
          "- Daily Rate History Count:",
          parsedData.dailyRateHistory.length
        );
        console.log(
          "- Deductions History Count:",
          parsedData.deductionsHistory.length
        );
        return parsedData;
      } catch (error) {
        // If file doesn't exist, return empty data structure
        if ((error as any)?.message?.includes("no such file")) {
          console.log(`No statistics file found at: ${filePath}`);
          console.log("Returning empty data structure");
          return this.getEmptyStatisticsData();
        }
        console.error("=== Error Reading Statistics File ===");
        console.error(error);
        throw new Error(
          `Failed to read statistics file: ${(error as any).message}`
        );
      }
    } catch (error) {
      console.error("=== Unexpected Error Loading Statistics ===");
      console.error(error);
      throw new Error(`Failed to load statistics: ${(error as any).message}`);
    }
  }

  async saveStatistics(
    statistics: StatisticsData,
    year?: number
  ): Promise<void> {
    try {
      const targetYear = year || this.year;
      console.log(`Saving statistics for year: ${targetYear}`);

      const filePath = `${this.filePath}${targetYear}_statistics.json`;
      console.log(`Writing to file: ${filePath}`);

      // Ensure directory exists before saving
      await this.ensureDirectoryExists();

      // Save the statistics data
      await window.electron.writeFile(
        filePath,
        JSON.stringify(statistics, null, 2)
      );
      console.log(`Successfully saved statistics to ${filePath}`);
    } catch (error) {
      console.error("Error saving statistics:", error);
      throw new Error(`Failed to save statistics: ${(error as any).message}`);
    }
  }

  async updateDailyRateHistory(
    dailyRateHistory: DailyRateHistory
  ): Promise<void> {
    try {
      console.log("Updating daily rate history:", dailyRateHistory);

      // Load existing statistics
      const statistics = await this.loadStatistics();

      // Check if this exact entry already exists to prevent duplicates
      const isDuplicate = statistics.dailyRateHistory.some(
        (entry) =>
          entry.employee === dailyRateHistory.employee &&
          entry.date === dailyRateHistory.date &&
          entry.rate === dailyRateHistory.rate
      );

      if (!isDuplicate) {
        // Add new daily rate history entry
        statistics.dailyRateHistory.push(dailyRateHistory);

        // Update current and previous daily rates
        if (statistics.dailyRateHistory.length > 0) {
          // Sort by date in descending order
          const sortedHistory = [...statistics.dailyRateHistory].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          // Update current and previous rates
          statistics.currentDailyRate = sortedHistory[0].rate;
          if (sortedHistory.length > 1) {
            statistics.previousDailyRate = sortedHistory[1].rate;

            // Calculate rate change percentage
            const change =
              statistics.currentDailyRate - statistics.previousDailyRate;
            const percentage = (change / statistics.previousDailyRate) * 100;
            statistics.rateChangePercentage = `${
              percentage >= 0 ? "+" : ""
            }${percentage.toFixed(1)}%`;
          }
        }

        // Save updated statistics
        await this.saveStatistics(statistics);
        console.log("Daily rate history updated successfully");
      } else {
        console.log("Duplicate daily rate history entry, skipping update");
      }
    } catch (error) {
      console.error("Error updating daily rate history:", error);
      throw error;
    }
  }

  async updateMonthlyPayroll(monthlyPayroll: MonthlyPayroll): Promise<void> {
    try {
      console.log("Updating monthly payroll:", monthlyPayroll);

      // Load existing statistics
      const statistics = await this.loadStatistics();

      // Find if the month already exists
      const monthIndex = statistics.monthlyPayrolls.findIndex(
        (item) => item.month === monthlyPayroll.month
      );

      if (monthIndex >= 0) {
        // Update existing month
        statistics.monthlyPayrolls[monthIndex] = monthlyPayroll;
      } else {
        // Add new month
        statistics.monthlyPayrolls.push(monthlyPayroll);
      }

      // Recalculate yearly totals
      statistics.yearlyTotal = statistics.monthlyPayrolls.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      statistics.yearlyAverage =
        statistics.yearlyTotal / statistics.monthlyPayrolls.length;

      // Save updated statistics
      await this.saveStatistics(statistics);
      console.log("Monthly payroll updated successfully");
    } catch (error) {
      console.error("Error updating monthly payroll:", error);
      throw error;
    }
  }

  async updateDeductionHistory(
    deductionHistory: DeductionHistory
  ): Promise<void> {
    try {
      console.log("Updating deduction history:", deductionHistory);

      // Load existing statistics
      const statistics = await this.loadStatistics();

      // Find if the deduction type already exists
      const deductionIndex = statistics.deductionsHistory.findIndex(
        (item) => item.type === deductionHistory.type
      );

      if (deductionIndex >= 0) {
        // Append new changes to existing deduction type
        statistics.deductionsHistory[deductionIndex].changes.push(
          ...deductionHistory.changes
        );

        // Sort changes by date in descending order
        statistics.deductionsHistory[deductionIndex].changes.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      } else {
        // Add new deduction type
        statistics.deductionsHistory.push(deductionHistory);
      }

      // Save updated statistics
      await this.saveStatistics(statistics);
      console.log("Deduction history updated successfully");
    } catch (error) {
      console.error("Error updating deduction history:", error);
      throw error;
    }
  }

  /**
   * Updates payroll statistics based on payroll data
   * This method handles partial months and replaces existing data for the same month
   * @param payrolls Array of payroll summaries to update statistics with
   * @param year Optional year to update statistics for (defaults to current year)
   */
  async updatePayrollStatistics(payrolls: any[], year?: number): Promise<void> {
    try {
      console.log("=== Starting updatePayrollStatistics ===");
      console.log("Number of payrolls:", payrolls.length);
      console.log("Year:", year);
      console.log("File Path:", this.filePath);

      // Load existing statistics
      const statistics = await this.loadStatistics(year);
      console.log("Loaded existing statistics:", statistics);

      // Group payrolls by month
      const payrollsByMonth: Record<string, any[]> = {};

      payrolls.forEach((payroll) => {
        const endDate = new Date(payroll.endDate);
        const monthKey = `${endDate.getFullYear()}-${String(
          endDate.getMonth() + 1
        ).padStart(2, "0")}`;

        console.log("Processing payroll for month:", monthKey);
        console.log("Payroll details:", {
          employeeName: payroll.employeeName,
          startDate: payroll.startDate,
          endDate: payroll.endDate,
          netPay: payroll.netPay,
          dailyRate: payroll.dailyRate,
        });

        if (!payrollsByMonth[monthKey]) {
          payrollsByMonth[monthKey] = [];
        }

        payrollsByMonth[monthKey].push(payroll);
      });

      console.log("Grouped payrolls by month:", Object.keys(payrollsByMonth));

      // Process each month's payrolls
      for (const [monthKey, monthPayrolls] of Object.entries(payrollsByMonth)) {
        console.log(`\nProcessing month: ${monthKey}`);

        // Calculate total amount, days, employees, and absences for this month
        const totalAmount = monthPayrolls.reduce((sum, p) => sum + p.netPay, 0);
        const totalDays = monthPayrolls.reduce(
          (sum, p) => sum + (p.daysWorked || 0),
          0
        );
        const uniqueEmployees = new Set(monthPayrolls.map((p) => p.employeeId))
          .size;
        const totalAbsences = monthPayrolls.reduce(
          (sum, p) => sum + (p.absences || 0),
          0
        );

        console.log("Month totals:", {
          amount: totalAmount,
          days: totalDays,
          employees: uniqueEmployees,
          absences: totalAbsences,
        });

        // Create or update monthly payroll entry
        const monthlyPayroll: MonthlyPayroll = {
          month: monthKey,
          amount: totalAmount,
          days: totalDays,
          employees: uniqueEmployees,
          absences: totalAbsences,
        };

        // Find if the month already exists
        const monthIndex = statistics.monthlyPayrolls.findIndex(
          (item) => item.month === monthKey
        );

        if (monthIndex >= 0) {
          console.log("Updating existing month record");
          statistics.monthlyPayrolls[monthIndex] = monthlyPayroll;
        } else {
          console.log("Adding new month record");
          statistics.monthlyPayrolls.push(monthlyPayroll);
        }

        // Update daily rate history for each employee
        for (const payroll of monthPayrolls) {
          const dailyRateHistory: DailyRateHistory = {
            employee: payroll.employeeName,
            date: payroll.endDate,
            rate: payroll.dailyRate,
          };

          // Check if this exact entry already exists to prevent duplicates
          const isDuplicate = statistics.dailyRateHistory.some(
            (entry) =>
              entry.employee === dailyRateHistory.employee &&
              entry.date === dailyRateHistory.date &&
              entry.rate === dailyRateHistory.rate
          );

          if (!isDuplicate) {
            console.log("Adding new daily rate history:", dailyRateHistory);
            statistics.dailyRateHistory.push(dailyRateHistory);
          } else {
            console.log("Skipping duplicate daily rate history");
          }
        }
      }

      // Update current and previous daily rates
      if (statistics.dailyRateHistory.length > 0) {
        // Sort by date in descending order
        const sortedHistory = [...statistics.dailyRateHistory].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Update current and previous rates
        statistics.currentDailyRate = sortedHistory[0].rate;
        if (sortedHistory.length > 1) {
          statistics.previousDailyRate = sortedHistory[1].rate;

          // Calculate rate change percentage
          const change =
            statistics.currentDailyRate - statistics.previousDailyRate;
          const percentage = (change / statistics.previousDailyRate) * 100;
          statistics.rateChangePercentage = `${
            percentage >= 0 ? "+" : ""
          }${percentage.toFixed(1)}%`;
        }
      }

      // Recalculate yearly totals
      statistics.yearlyTotal = statistics.monthlyPayrolls.reduce(
        (sum, item) => sum + item.amount,
        0
      );
      statistics.yearlyAverage =
        statistics.yearlyTotal / statistics.monthlyPayrolls.length;

      console.log("\n=== Final Statistics ===");
      console.log("Monthly Payrolls:", statistics.monthlyPayrolls.length);
      console.log("Daily Rate History:", statistics.dailyRateHistory.length);
      console.log("Yearly Total:", statistics.yearlyTotal);
      console.log("Yearly Average:", statistics.yearlyAverage);

      // Save updated statistics
      await this.saveStatistics(statistics, year);
      console.log("Statistics saved successfully");
    } catch (error) {
      console.error("=== Error in updatePayrollStatistics ===");
      console.error("Error details:", error);
      throw error;
    }
  }

  private getEmptyStatisticsData(): StatisticsData {
    return {
      dailyRateHistory: [],
      currentDailyRate: 0,
      previousDailyRate: 0,
      rateChangePercentage: "0%",
      monthlyPayrolls: [],
      yearlyTotal: 0,
      yearlyAverage: 0,
      deductionsHistory: [],
    };
  }
}

// Factory function to create StatisticsModel instance
export const createStatisticsModel = (
  dbPath: string,
  year?: number
): StatisticsModel => {
  console.log("=== Creating Statistics Model ===");
  console.log("Input dbPath:", dbPath);
  console.log("Input year:", year || "current");

  if (!dbPath) {
    console.error("dbPath is not set in settings store");
    throw new Error(
      "Database path is not set. Please configure your settings first."
    );
  }

  // Ensure the path ends with a slash
  const normalizedDbPath = dbPath.endsWith("/") ? dbPath : `${dbPath}/`;
  console.log("Normalized dbPath:", normalizedDbPath);

  const folderPath = `${normalizedDbPath}SweldoDB/statistics`;
  console.log("Final folder path:", folderPath);

  // Create the statistics model
  const model = new StatisticsModel(folderPath, year);

  // Ensure the directory exists
  model.ensureDirectoryExists().catch((error) => {
    console.error("Failed to ensure statistics directory exists:", error);
  });

  return model;
};
