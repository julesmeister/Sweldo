export interface DailyRateHistory {
  employee: string;
  date: string;
  rate: number;
}

export interface Statistics {
  id: string;
  year: number;
  month: number;
  totalEmployees: number;
  totalPayroll: number;
  totalDeductions: number;
  totalNetPay: number;
  totalOvertime: number;
  totalUndertime: number;
  totalLate: number;
  totalAbsences: number;
  totalHolidays: number;
  totalLeaves: number;
  totalNightDifferential: number;
  totalCashAdvance: number;
  totalSSS: number;
  totalPhilHealth: number;
  totalPagIbig: number;
  totalOthers: number;
  dailyRateHistory: DailyRateHistory[];
}

export class StatisticsModel {
  private filePath: string;
  private year: number;
  private statistics: Statistics;

  constructor(dbPath: string, year: number) {
    this.year = year;
    this.filePath = `${dbPath}/SweldoDB/statistics/${year}_statistics.json`;
    this.statistics = {
      id: `${year}_statistics`,
      year,
      month: 0,
      totalEmployees: 0,
      totalPayroll: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      totalOvertime: 0,
      totalUndertime: 0,
      totalLate: 0,
      totalAbsences: 0,
      totalHolidays: 0,
      totalLeaves: 0,
      totalNightDifferential: 0,
      totalCashAdvance: 0,
      totalSSS: 0,
      totalPhilHealth: 0,
      totalPagIbig: 0,
      totalOthers: 0,
      dailyRateHistory: [],
    };
  }

  private async ensureDirectoryExists(): Promise<void> {
    const dirPath = this.filePath.substring(0, this.filePath.lastIndexOf("/"));
    await window.electron.ensureDir(dirPath);
  }

  private async loadStatistics(): Promise<void> {
    try {
      const exists = await window.electron.fileExists(this.filePath);
      if (exists) {
        const data = await window.electron.readFile(this.filePath);
        const parsedData = JSON.parse(data);
        this.statistics = {
          ...parsedData,
          dailyRateHistory: parsedData.dailyRateHistory || [],
        };
      }
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }

  private async saveStatistics(): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      await window.electron.writeFile(
        this.filePath,
        JSON.stringify(this.statistics, null, 2)
      );
    } catch (error) {
      console.error("Error saving statistics:", error);
    }
  }

  public async updatePayrollStatistics(
    payrollSummaries: any[],
    year: number
  ): Promise<void> {
    try {
      await this.loadStatistics();

      let totalPayroll = 0;
      let totalDeductions = 0;
      let totalNetPay = 0;
      let totalOvertime = 0;
      let totalUndertime = 0;
      let totalLate = 0;
      let totalAbsences = 0;
      let totalHolidays = 0;
      let totalLeaves = 0;
      let totalNightDifferential = 0;
      let totalCashAdvance = 0;
      let totalSSS = 0;
      let totalPhilHealth = 0;
      let totalPagIbig = 0;
      let totalOthers = 0;

      for (const summary of payrollSummaries) {
        totalPayroll += summary.basicPay || 0;
        totalDeductions +=
          (summary.deductions?.sss || 0) +
          (summary.deductions?.philHealth || 0) +
          (summary.deductions?.pagIbig || 0) +
          (summary.deductions?.cashAdvanceDeductions || 0) +
          (summary.deductions?.others || 0);
        totalNetPay += summary.netPay || 0;
        totalOvertime += summary.overtime || 0;
        totalUndertime += summary.undertimeDeduction || 0;
        totalLate += summary.lateDeduction || 0;
        totalAbsences += summary.absences || 0;
        totalHolidays += summary.holidayBonus || 0;
        totalLeaves += summary.leavePay || 0;
        totalNightDifferential += summary.nightDifferentialPay || 0;
        totalCashAdvance += summary.deductions?.cashAdvanceDeductions || 0;
        totalSSS += summary.deductions?.sss || 0;
        totalPhilHealth += summary.deductions?.philHealth || 0;
        totalPagIbig += summary.deductions?.pagIbig || 0;
        totalOthers += summary.deductions?.others || 0;
      }

      this.statistics = {
        ...this.statistics,
        year,
        totalEmployees: payrollSummaries.length,
        totalPayroll,
        totalDeductions,
        totalNetPay,
        totalOvertime,
        totalUndertime,
        totalLate,
        totalAbsences,
        totalHolidays,
        totalLeaves,
        totalNightDifferential,
        totalCashAdvance,
        totalSSS,
        totalPhilHealth,
        totalPagIbig,
        totalOthers,
      };

      await this.saveStatistics();
    } catch (error) {
      console.error("Error updating payroll statistics:", error);
    }
  }

  public async updateDailyRateHistory(
    dailyRateHistory: DailyRateHistory
  ): Promise<void> {
    try {
      await this.loadStatistics();

      console.log("Updating daily rate history:", dailyRateHistory);

      // Check for duplicates
      const isDuplicate = this.statistics.dailyRateHistory.some(
        (entry) =>
          entry.employee === dailyRateHistory.employee &&
          entry.date === dailyRateHistory.date &&
          entry.rate === dailyRateHistory.rate
      );

      if (!isDuplicate) {
        this.statistics.dailyRateHistory.push(dailyRateHistory);

        // Sort by date
        if (this.statistics.dailyRateHistory.length > 0) {
          const sortedHistory = [...this.statistics.dailyRateHistory].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          this.statistics.dailyRateHistory = sortedHistory;
        }

        await this.saveStatistics();
      }
    } catch (error) {
      console.error("Error updating daily rate history:", error);
    }
  }

  public async getStatistics(): Promise<Statistics> {
    await this.loadStatistics();
    return this.statistics;
  }
}

export function createStatisticsModel(
  dbPath: string,
  year: number
): StatisticsModel {
  return new StatisticsModel(dbPath, year);
}
