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
    // Ensure dbPath is a directory path
    this.filePath = dbPath.endsWith("/") ? dbPath : `${dbPath}/`;
    this.year = year || new Date().getFullYear();
    console.log(
      `StatisticsModel initialized with path: ${this.filePath}, year: ${this.year}`
    );
  }

  async ensureDirectoryExists(): Promise<void> {
    try {
      const statisticsPath = `${this.filePath}`;
      await window.electron.ensureDir(statisticsPath);
      console.log(`Ensured directory exists: ${statisticsPath}`);
    } catch (error) {
      console.error(`Failed to ensure directory exists: ${error}`);
      throw error;
    }
  }

  async loadStatistics(year?: number): Promise<StatisticsData> {
    try {
      const targetYear = year || this.year;
      console.log(`Loading statistics for year: ${targetYear}`);

      const filePath = `${this.filePath}${targetYear}_statistics.json`;
      console.log(`Reading file: ${filePath}`);

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
        console.log("Successfully loaded statistics file");
        return JSON.parse(data) as StatisticsData;
      } catch (error) {
        // If file doesn't exist, return empty data structure
        if ((error as any)?.message?.includes("no such file")) {
          console.log(
            `No statistics file found for year ${targetYear}, returning empty data`
          );
          return this.getEmptyStatisticsData();
        }
        console.error("Error reading statistics file:", error);
        throw new Error(
          `Failed to read statistics file: ${(error as any).message}`
        );
      }
    } catch (error) {
      console.error("Unexpected error loading statistics:", error as any);
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
  console.log(`Creating statistics model for year: ${year || "current"}`);

  if (!dbPath) {
    console.error("dbPath is not set in settings store");
    throw new Error(
      "Database path is not set. Please configure your settings first."
    );
  }

  // Ensure the path ends with a slash
  const normalizedDbPath = dbPath.endsWith("/") ? dbPath : `${dbPath}/`;
  const folderPath = `${normalizedDbPath}SweldoDB/statistics`;

  // Create the statistics model
  const model = new StatisticsModel(folderPath, year);

  // Ensure the directory exists
  model.ensureDirectoryExists().catch((error) => {
    console.error("Failed to ensure statistics directory exists:", error);
  });

  return model;
};
