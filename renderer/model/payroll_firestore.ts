/**
 * Firestore implementation for payroll operations
 *
 * This module provides Firestore implementations for all payroll-related
 * operations that mirror the local filesystem operations in payroll.ts.
 */

import { PayrollSummaryModel } from "./payroll";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  createTimeBasedDocId,
  deleteDocument,
  queryCollection,
} from "../lib/firestoreService";
import { CashAdvance } from "./cashAdvance";
import { Short } from "./shorts";

/**
 * Firestore structure for payroll document
 */
interface PayrollFirestoreData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  payrolls: PayrollSummaryModel[];
}

/**
 * Firestore structure for payroll statistics
 */
interface PayrollStatisticsFirestoreData {
  meta: {
    year: number;
    lastModified: string;
  };
  monthlyTotals: {
    [month: string]: {
      totalGrossPay: number;
      totalNetPay: number;
      totalEmployees: number;
      employeeIds: string[];
    };
  };
  employeeStats: {
    [employeeId: string]: {
      totalGrossPay: number;
      totalNetPay: number;
      payrollCount: number;
      lastPayrollDate: string;
    };
  };
  totals: {
    grossPay: number;
    netPay: number;
    employeeCount: number;
  };
}

/**
 * Creates a payroll document ID for a specific employee, year and month
 */
const createPayrollDocId = (
  employeeId: string,
  year: number,
  month: number
): string => {
  return `payroll_${employeeId}_${year}_${month}`;
};

/**
 * Creates a statistics document ID for a specific year
 */
const createStatisticsDocId = (year: number): string => {
  return `statistics_${year}`;
};

/**
 * Load payroll summaries for a specific employee, month and year from Firestore
 */
export async function loadPayrollSummariesFirestore(
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<PayrollSummaryModel[]> {
  try {
    const docId = createPayrollDocId(employeeId, year, month);
    const data = await fetchDocument<PayrollFirestoreData>(
      "payrolls",
      docId,
      companyName
    );

    if (!data || !data.payrolls) {
      return [];
    }

    // Convert string dates back to Date objects
    const payrolls = data.payrolls.map((payroll) => ({
      ...payroll,
      startDate:
        payroll.startDate instanceof Date
          ? payroll.startDate
          : new Date(payroll.startDate),
      endDate:
        payroll.endDate instanceof Date
          ? payroll.endDate
          : new Date(payroll.endDate),
    }));

    return payrolls;
  } catch (error) {
    console.error(`Error loading payroll summaries from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Save a payroll summary to Firestore
 */
export async function savePayrollSummaryFirestore(
  payrollSummary: PayrollSummaryModel,
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createPayrollDocId(employeeId, year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<PayrollFirestoreData>(
      "payrolls",
      docId,
      companyName
    );

    if (!existingDoc) {
      // Create new document if it doesn't exist
      const newDoc: PayrollFirestoreData = {
        meta: {
          employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
        },
        payrolls: [payrollSummary],
      };

      await saveDocument("payrolls", docId, newDoc, companyName);
    } else {
      // Update existing document
      // Remove any existing payroll with the same ID
      const updatedPayrolls = existingDoc.payrolls.filter(
        (p) => p.id !== payrollSummary.id
      );

      // Add the new payroll summary
      updatedPayrolls.push(payrollSummary);

      // Sort by start date (newest first)
      updatedPayrolls.sort((a, b) => {
        const aDate =
          a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
        const bDate =
          b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
        return bDate.getTime() - aDate.getTime();
      });

      // Update document
      const updateData = {
        payrolls: updatedPayrolls,
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("payrolls", docId, updateData, companyName);
    }
  } catch (error) {
    console.error(`Error saving payroll summary to Firestore:`, error);
    throw error;
  }
}

/**
 * Delete a payroll summary from Firestore
 */
export async function deletePayrollSummaryFirestore(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  year: number,
  month: number,
  companyName: string
): Promise<PayrollSummaryModel | undefined> {
  try {
    const docId = createPayrollDocId(employeeId, year, month);
    const payrollId = `${employeeId}_${startDate.getTime()}_${endDate.getTime()}`;

    // Check if document exists
    const existingDoc = await fetchDocument<PayrollFirestoreData>(
      "payrolls",
      docId,
      companyName
    );

    if (!existingDoc) {
      console.warn(
        `Payroll document for ${month}/${year} not found in Firestore.`
      );
      return undefined;
    }

    // Find the payroll to be deleted (so we can return it)
    const payrollToDelete = existingDoc.payrolls.find(
      (p) => p.id === payrollId
    );
    if (!payrollToDelete) {
      console.warn(
        `Payroll with ID ${payrollId} not found in Firestore document.`
      );
      return undefined;
    }

    // Filter out the payroll with the specified ID
    const updatedPayrolls = existingDoc.payrolls.filter(
      (p) => p.id !== payrollId
    );

    // Only update if we actually removed a payroll
    if (updatedPayrolls.length < existingDoc.payrolls.length) {
      const updateData = {
        payrolls: updatedPayrolls,
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("payrolls", docId, updateData, companyName);
      return payrollToDelete;
    }

    return undefined;
  } catch (error) {
    console.error(`Error deleting payroll summary from Firestore:`, error);
    throw error;
  }
}

/**
 * Update payroll statistics in Firestore after saving a payroll summary
 */
export async function updatePayrollStatisticsFirestore(
  payrollSummaries: PayrollSummaryModel[],
  year: number,
  companyName: string
): Promise<void> {
  try {
    if (!payrollSummaries || payrollSummaries.length === 0) {
      return;
    }

    const docId = createStatisticsDocId(year);
    const existingStats = await fetchDocument<PayrollStatisticsFirestoreData>(
      "statistics",
      docId,
      companyName
    );

    // Initialize statistics structure if it doesn't exist
    const stats: PayrollStatisticsFirestoreData = existingStats || {
      meta: {
        year,
        lastModified: new Date().toISOString(),
      },
      monthlyTotals: {},
      employeeStats: {},
      totals: {
        grossPay: 0,
        netPay: 0,
        employeeCount: 0,
      },
    };

    // Process each payroll summary
    for (const payroll of payrollSummaries) {
      const endDate = new Date(
        payroll.endDate instanceof Date
          ? payroll.endDate
          : new Date(payroll.endDate)
      );
      const month = endDate.getMonth() + 1;
      const monthKey = month.toString();
      const employeeId = payroll.employeeId;

      // Update or initialize monthly totals
      if (!stats.monthlyTotals[monthKey]) {
        stats.monthlyTotals[monthKey] = {
          totalGrossPay: 0,
          totalNetPay: 0,
          totalEmployees: 0,
          employeeIds: [],
        };
      }

      // Check if this is a new entry or an update for the month
      const isNewEmployeeForMonth =
        !stats.monthlyTotals[monthKey].employeeIds.includes(employeeId);

      // Update monthly totals
      stats.monthlyTotals[monthKey].totalGrossPay += payroll.grossPay;
      stats.monthlyTotals[monthKey].totalNetPay += payroll.netPay;

      if (isNewEmployeeForMonth) {
        stats.monthlyTotals[monthKey].employeeIds.push(employeeId);
        stats.monthlyTotals[monthKey].totalEmployees =
          stats.monthlyTotals[monthKey].employeeIds.length;
      }

      // Update or initialize employee stats
      if (!stats.employeeStats[employeeId]) {
        stats.employeeStats[employeeId] = {
          totalGrossPay: 0,
          totalNetPay: 0,
          payrollCount: 0,
          lastPayrollDate: endDate.toISOString(),
        };
      }

      // Update employee totals
      stats.employeeStats[employeeId].totalGrossPay += payroll.grossPay;
      stats.employeeStats[employeeId].totalNetPay += payroll.netPay;
      stats.employeeStats[employeeId].payrollCount += 1;

      // Update last payroll date only if it's newer
      const currentLastDate = new Date(
        stats.employeeStats[employeeId].lastPayrollDate
      );
      if (endDate > currentLastDate) {
        stats.employeeStats[employeeId].lastPayrollDate = endDate.toISOString();
      }
    }

    // Recalculate overall totals
    let totalGrossPay = 0;
    let totalNetPay = 0;
    const uniqueEmployeeIds = new Set<string>();

    Object.keys(stats.employeeStats).forEach((empId) => {
      totalGrossPay += stats.employeeStats[empId].totalGrossPay;
      totalNetPay += stats.employeeStats[empId].totalNetPay;
      uniqueEmployeeIds.add(empId);
    });

    stats.totals = {
      grossPay: totalGrossPay,
      netPay: totalNetPay,
      employeeCount: uniqueEmployeeIds.size,
    };

    // Update the last modified timestamp
    stats.meta.lastModified = new Date().toISOString();

    // Save the updated statistics
    await saveDocument("statistics", docId, stats, companyName);
  } catch (error) {
    console.error(`Error updating payroll statistics in Firestore:`, error);
    throw error;
  }
}

/**
 * Reverse cash advance deduction in Firestore when a payroll is deleted
 */
export async function reverseCashAdvanceDeductionFirestore(
  employeeId: string,
  deductionAmount: number,
  payrollDate: Date,
  companyName: string
): Promise<void> {
  try {
    if (deductionAmount <= 0) {
      return; // Nothing to reverse
    }

    const months = [];
    let currentDate = new Date(payrollDate);
    // Look at the current month and previous two months
    for (let i = 0; i < 3; i++) {
      months.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
      });
      currentDate.setMonth(currentDate.getMonth() - 1);
    }

    // Get all cash advances for the relevant months
    const allAdvances: CashAdvance[] = [];
    for (const { month, year } of months) {
      const docId = `cash_advance_${employeeId}_${year}_${month}`;
      const result = await fetchDocument<{ advances: CashAdvance[] }>(
        "cash_advances",
        docId,
        companyName
      );

      if (result && result.advances) {
        allAdvances.push(...result.advances);
      }
    }

    // Sort from newest to oldest (for reversal)
    allAdvances.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    let amountToProcess = deductionAmount;

    // Process each advance
    for (const advance of allAdvances) {
      if (amountToProcess <= 0) break;

      const advanceDate = new Date(advance.date);
      const docId = `cash_advance_${employeeId}_${advanceDate.getFullYear()}_${
        advanceDate.getMonth() + 1
      }`;

      const refundable = Math.min(
        advance.amount - advance.remainingUnpaid,
        amountToProcess
      );

      if (refundable > 0) {
        const newRemaining = advance.remainingUnpaid + refundable;
        const newStatus = newRemaining > 0 ? "Unpaid" : "Paid";

        // Get current document
        const cashAdvanceDoc = await fetchDocument<{ advances: CashAdvance[] }>(
          "cash_advances",
          docId,
          companyName
        );

        if (cashAdvanceDoc && cashAdvanceDoc.advances) {
          // Update the specific advance
          const updatedAdvances = cashAdvanceDoc.advances.map((adv) =>
            adv.id === advance.id
              ? { ...adv, remainingUnpaid: newRemaining, status: newStatus }
              : adv
          );

          // Save the updated document
          await updateDocument(
            "cash_advances",
            docId,
            { advances: updatedAdvances },
            companyName
          );

          amountToProcess -= refundable;
        }
      }
    }
  } catch (error) {
    console.error(
      `Error reversing cash advance deduction in Firestore:`,
      error
    );
    throw error;
  }
}

/**
 * Reverse short deduction in Firestore when a payroll is deleted
 */
export async function reverseShortDeductionFirestore(
  employeeId: string,
  shortIDs: string[],
  payrollDate: Date,
  companyName: string
): Promise<void> {
  try {
    if (!shortIDs || shortIDs.length === 0) {
      return; // Nothing to reverse
    }

    const months = [];
    let currentDate = new Date(payrollDate);
    // Look at the current month and previous two months
    for (let i = 0; i < 3; i++) {
      months.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
      });
      currentDate.setMonth(currentDate.getMonth() - 1);
    }

    // Process each month to find and update the shorts
    for (const { month, year } of months) {
      const docId = `short_${employeeId}_${year}_${month}`;
      const shortsDoc = await fetchDocument<{ shorts: Short[] }>(
        "shorts",
        docId,
        companyName
      );

      if (shortsDoc && shortsDoc.shorts) {
        const updatedShorts = shortsDoc.shorts.map((short) => {
          if (shortIDs.includes(short.id) && short.status === "Paid") {
            return {
              ...short,
              status: "Unpaid",
              remainingUnpaid: short.amount,
            };
          }
          return short;
        });

        // Check if any shorts were actually updated
        const hasChanges = updatedShorts.some(
          (short, idx) =>
            shortIDs.includes(short.id) &&
            JSON.stringify(short) !== JSON.stringify(shortsDoc.shorts[idx])
        );

        if (hasChanges) {
          // Save the updated document
          await updateDocument(
            "shorts",
            docId,
            { shorts: updatedShorts },
            companyName
          );
        }
      }
    }
  } catch (error) {
    console.error(`Error reversing short deduction in Firestore:`, error);
    throw error;
  }
}
