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

export interface Statistics {
  totalEmployees: number;
  totalPayroll: number;
  totalDeductions: number;
  totalNetPay: number;
  totalOvertime: number;
  totalAbsences: number;
  dailyRateHistory: DailyRateHistory[];
  monthlyPayrolls: MonthlyPayroll[];
  deductionsHistory: DeductionHistory[];
  yearlyTotal: number;
  yearlyAverage: number;
}

export class StatisticsModel {
  private dbPath: string;
  private year: number;
  private statistics: Statistics;
  private filePath: string;

  constructor(dbPath: string, year: number) {
    this.dbPath = dbPath;
    this.year = year;
    this.filePath = `${this.dbPath}/SweldoDB/statistics/${this.year}_statistics.json`;
    this.statistics = {
      totalEmployees: 0,
      totalPayroll: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      totalOvertime: 0,
      totalAbsences: 0,
      dailyRateHistory: [],
      monthlyPayrolls: [],
      deductionsHistory: [],
      yearlyTotal: 0,
      yearlyAverage: 0,
    };
  }

  private async loadStatistics(): Promise<Statistics> {
    try {
      // Ensure directory exists
      await window.electron.ensureDir(`${this.dbPath}/SweldoDB/statistics`);

      // Check if file exists
      const fileExists = await window.electron.fileExists(this.filePath);
      if (!fileExists) {
        // If file doesn't exist, create it with default values
        this.statistics = {
          totalEmployees: 0,
          totalPayroll: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          totalOvertime: 0,
          totalAbsences: 0,
          dailyRateHistory: [],
          monthlyPayrolls: [],
          deductionsHistory: [],
          yearlyTotal: 0,
          yearlyAverage: 0,
        };
        await this.saveStatistics();
        return this.statistics;
      }

      // Read the file content
      const content = await window.electron.readFile(this.filePath);
      this.statistics = JSON.parse(content);
      return this.statistics;
    } catch (error) {
      console.error("Error loading statistics:", error);
      throw error;
    }
  }

  private async saveStatistics(): Promise<void> {
    try {
      // Ensure directory exists
      await window.electron.ensureDir(`${this.dbPath}/SweldoDB/statistics`);

      // Write the statistics to the file
      await window.electron.writeFile(
        this.filePath,
        JSON.stringify(this.statistics, null, 2)
      );
    } catch (error) {
      console.error("Error saving statistics:", error);
      throw error;
    }
  }

  async updatePayrollStatistics(payrolls: any[]): Promise<void> {
    try {
      // Load existing statistics
      await this.loadStatistics();

      // Calculate totals
      const totals = payrolls.reduce(
        (acc, curr) => {
          return {
            totalEmployees: acc.totalEmployees + 1,
            totalPayroll: acc.totalPayroll + (curr.grossPay || 0),
            totalDeductions:
              acc.totalDeductions + (curr.deductions?.totalDeduction || 0),
            totalNetPay: acc.totalNetPay + (curr.netPay || 0),
            totalOvertime: acc.totalOvertime + (curr.overtime || 0),
            totalAbsences: acc.totalAbsences + (curr.absences || 0),
          };
        },
        {
          totalEmployees: 0,
          totalPayroll: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          totalOvertime: 0,
          totalAbsences: 0,
        }
      );

      // Update statistics
      this.statistics = {
        ...this.statistics,
        ...totals,
      };

      // Update monthly payrolls
      this.updateMonthlyPayrolls(payrolls);

      // Save updated statistics
      await this.saveStatistics();
    } catch (error) {
      console.error("Error updating payroll statistics:", error);
      throw error;
    }
  }

  private updateMonthlyPayrolls(payrolls: any[]): void {
    // Group payrolls by month
    const monthlyData = new Map<string, MonthlyPayroll>();

    // Initialize all months
    for (let month = 1; month <= 12; month++) {
      const monthName = new Date(this.year, month - 1, 1).toLocaleString(
        "default",
        { month: "long" }
      );
      monthlyData.set(monthName, {
        month: monthName,
        amount: 0,
        days: 0,
        employees: 0,
        absences: 0,
      });
    }

    // Process each payroll
    payrolls.forEach((payroll) => {
      const startDate = new Date(payroll.startDate);
      const monthName = startDate.toLocaleString("default", { month: "long" });

      if (monthlyData.has(monthName)) {
        const monthData = monthlyData.get(monthName)!;
        monthData.amount += payroll.grossPay || 0;
        if (monthData.days === 0) {
          monthData.days = payroll.daysWorked || 0;
        }
        monthData.employees += 1;
        monthData.absences += payroll.absences || 0;
      }
    });

    // Convert map to array and sort by month
    this.statistics.monthlyPayrolls = Array.from(monthlyData.values()).sort(
      (a, b) => {
        const months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        return months.indexOf(a.month) - months.indexOf(b.month);
      }
    );
  }

  async updateDailyRateHistory(
    employeeId: string,
    dailyRate: number
  ): Promise<void> {
    try {
      // Load existing statistics
      await this.loadStatistics();

      // Add new daily rate history entry
      this.statistics.dailyRateHistory.push({
        employee: employeeId,
        date: new Date().toISOString(),
        rate: dailyRate,
      });

      // Save updated statistics
      await this.saveStatistics();
    } catch (error) {
      console.error("Error updating daily rate history:", error);
      throw error;
    }
  }

  async getStatistics(): Promise<Statistics> {
    return this.loadStatistics();
  }
}

export function createStatisticsModel(
  dbPath: string,
  year: number
): StatisticsModel {
  return new StatisticsModel(dbPath, year);
}
