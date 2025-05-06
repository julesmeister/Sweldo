/**
 * Firestore implementation for statistics operations
 *
 * This module provides Firestore implementations for all statistics-related
 * operations that mirror the local filesystem operations in statistics.ts.
 */

import {
  Statistics,
  DailyRateHistory,
  MonthlyPayroll,
  DeductionHistory,
} from "./statistics";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  getCompanyName,
} from "../lib/firestoreService";
import { StatisticsModel } from "./statistics";

/**
 * Creates a statistics document ID for a specific year
 */
const createStatisticsDocId = (year: number): string => {
  return `statistics_${year}`;
};

/**
 * Get statistics for a specific year from Firestore
 */
export async function getStatisticsFirestore(
  year: number,
  companyName: string
): Promise<Statistics> {
  try {
    const docId = createStatisticsDocId(year);
    const data = await fetchDocument<Statistics>(
      "statistics",
      docId,
      companyName
    );

    if (!data) {
      // Return default statistics object if not found
      return {
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

    return data;
  } catch (error) {
    console.error(`Error loading statistics from Firestore:`, error);
    // Return default statistics on error
    return {
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
}

/**
 * Update payroll statistics in Firestore
 */
export async function updatePayrollStatisticsFirestore(
  payrolls: any[],
  year: number,
  companyName: string
): Promise<void> {
  try {
    if (!payrolls || payrolls.length === 0) {
      return;
    }

    const docId = createStatisticsDocId(year);

    // Get current statistics or create default
    const currentStatistics = await getStatisticsFirestore(year, companyName);

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

    // Update statistics with new totals
    const updatedStatistics = {
      ...currentStatistics,
      ...totals,
    };

    // Update monthly payrolls
    updatedStatistics.monthlyPayrolls = updateMonthlyPayrollsData(
      payrolls,
      currentStatistics.monthlyPayrolls,
      year
    );

    // Calculate yearly totals
    updatedStatistics.yearlyTotal = updatedStatistics.monthlyPayrolls.reduce(
      (sum: number, monthlyPayroll: MonthlyPayroll) =>
        sum + monthlyPayroll.amount,
      0
    );

    const activeMonths = updatedStatistics.monthlyPayrolls.filter(
      (mp: MonthlyPayroll) => mp.amount > 0
    ).length;
    updatedStatistics.yearlyAverage =
      activeMonths > 0 ? updatedStatistics.yearlyTotal / activeMonths : 0;

    await saveDocument("statistics", docId, updatedStatistics, companyName);
  } catch (error) {
    console.error(`Error updating payroll statistics in Firestore:`, error);
    throw error;
  }
}

/**
 * Helper function to update monthly payrolls data
 */
function updateMonthlyPayrollsData(
  payrolls: any[],
  existingMonthlyPayrolls: MonthlyPayroll[],
  year: number
): MonthlyPayroll[] {
  // Group payrolls by month
  const monthlyData = new Map<string, MonthlyPayroll>();

  // Initialize with existing data or create new entries
  for (let month = 1; month <= 12; month++) {
    const monthName = new Date(year, month - 1, 1).toLocaleString("default", {
      month: "long",
    });

    // Find existing month data or create new
    const existingData = existingMonthlyPayrolls.find(
      (mp) => mp.month === monthName
    );

    monthlyData.set(
      monthName,
      existingData || {
        month: monthName,
        amount: 0,
        days: 0,
        employees: 0,
        absences: 0,
      }
    );
  }

  // Process each payroll
  payrolls.forEach((payroll) => {
    const startDate = new Date(payroll.startDate);
    const monthName = startDate.toLocaleString("default", { month: "long" });

    if (monthlyData.has(monthName)) {
      const monthData = monthlyData.get(monthName)!;
      monthData.amount += payroll.netPay || 0;
      if (monthData.days === 0) {
        monthData.days = payroll.daysWorked || 0;
      }
      monthData.employees += 1;
      monthData.absences += payroll.absences || 0;
    }
  });

  // Convert map to array and sort by month
  return Array.from(monthlyData.values()).sort((a, b) => {
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
  });
}

/**
 * Update daily rate history in Firestore
 */
export async function updateDailyRateHistoryFirestore(
  employeeId: string,
  dailyRate: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createStatisticsDocId(year);

    // Get current statistics or create default
    const currentStatistics = await getStatisticsFirestore(year, companyName);

    // Create new history entry
    const newEntry: DailyRateHistory = {
      employee: employeeId,
      date: new Date().toISOString(),
      rate: dailyRate,
    };

    // Add to existing history
    const updatedHistory = [...currentStatistics.dailyRateHistory, newEntry];

    // Sort by date (newest first)
    const sortedHistory = updatedHistory.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Update only the dailyRateHistory field
    await updateDocument(
      "statistics",
      docId,
      { dailyRateHistory: sortedHistory },
      companyName
    );
  } catch (error) {
    console.error(`Error updating daily rate history in Firestore:`, error);
    throw error;
  }
}

/**
 * Update deduction history in Firestore
 */
export async function updateDeductionHistoryFirestore(
  employeeId: string,
  employeeName: string,
  deductions: { type: string; amount: number }[],
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createStatisticsDocId(year);

    // Get current statistics or create default
    const currentStatistics = await getStatisticsFirestore(year, companyName);

    // Get current date
    const currentDate = new Date().toISOString();

    // Create copy of current deductions history
    const updatedDeductionsHistory: DeductionHistory[] = [
      ...currentStatistics.deductionsHistory,
    ];

    // Update deductions history
    deductions.forEach(({ type, amount }) => {
      // Find existing deduction type or create new one
      let deductionHistory = updatedDeductionsHistory.find(
        (d) => d.type === type
      );

      if (!deductionHistory) {
        deductionHistory = {
          type,
          changes: [],
        };
        updatedDeductionsHistory.push(deductionHistory);
      }

      // Add new deduction change
      deductionHistory.changes.push({
        employee: employeeName,
        date: currentDate,
        amount,
      });
    });

    // Update only the deductionsHistory field
    await updateDocument(
      "statistics",
      docId,
      { deductionsHistory: updatedDeductionsHistory },
      companyName
    );
  } catch (error) {
    console.error(`Error updating deductions history in Firestore:`, error);
    throw error;
  }
}

/**
 * Creates a Firestore instance for statistics operations
 */
export function createStatisticsFirestoreInstance(
  model: StatisticsModel,
  year: number
) {
  return {
    /**
     * Syncs statistics from the model to Firestore
     */
    async syncToFirestore(
      addProgressMessage: (msg: string) => void
    ): Promise<void> {
      try {
        addProgressMessage("Loading statistics from model...");
        const statistics = await model.getStatistics();

        addProgressMessage("Saving statistics to Firestore...");
        const docId = createStatisticsDocId(year);
        const companyName = await getCompanyName();
        await saveDocument("statistics", docId, statistics, companyName);

        addProgressMessage("Statistics sync completed successfully!");
      } catch (error) {
        console.error("Error syncing statistics to Firestore:", error);
        addProgressMessage("Error syncing statistics to Firestore");
        throw error;
      }
    },

    /**
     * Syncs statistics from Firestore to the model
     */
    async syncFromFirestore(
      addProgressMessage: (msg: string) => void
    ): Promise<void> {
      try {
        addProgressMessage("Loading statistics from Firestore...");
        const companyName = await getCompanyName();
        const statistics = await getStatisticsFirestore(year, companyName);

        addProgressMessage("Updating statistics in model...");
        // Update payroll statistics
        if (statistics.monthlyPayrolls.length > 0) {
          const payrolls = statistics.monthlyPayrolls.map((mp) => ({
            grossPay: mp.amount,
            netPay: mp.amount,
            deductions: { totalDeduction: 0 },
            overtime: 0,
            absences: mp.absences,
            startDate: new Date(
              year,
              new Date(`${mp.month} 1, ${year}`).getMonth(),
              1
            ).toISOString(),
            daysWorked: mp.days,
          }));
          await model.updatePayrollStatistics(payrolls);
        }

        // Update daily rate history
        for (const history of statistics.dailyRateHistory) {
          await model.updateDailyRateHistory(history.employee, history.rate);
        }

        // Update deduction history
        for (const deduction of statistics.deductionsHistory) {
          for (const change of deduction.changes) {
            await model.updateDeductionHistory(
              change.employee,
              change.employee, // Using employee ID as name since we don't have the name
              [{ type: deduction.type, amount: change.amount }]
            );
          }
        }

        addProgressMessage("Statistics sync completed successfully!");
      } catch (error) {
        console.error("Error syncing statistics from Firestore:", error);
        addProgressMessage("Error syncing statistics from Firestore");
        throw error;
      }
    },
  };
}
