/**
 * Firestore implementation for payroll operations
 *
 * This module provides Firestore implementations for all payroll-related
 * operations that mirror the local filesystem operations in payroll.ts.
 */

import { PayrollSummaryModel, Payroll } from "./payroll";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  createTimeBasedDocId,
  deleteDocument,
  queryCollection,
  getCompanyName,
  isWebEnvironment,
} from "../lib/firestoreService";
import { CashAdvance } from "./cashAdvance";
import { Short } from "./shorts";
import { z } from "zod";
import { createEmployeeModel } from "./employee";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreInstance } from "../lib/firestoreService";

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
 * Validation schema for payroll data
 */
const payrollSummarySchema = z.object({
  id: z.string(),
  employeeName: z.string(),
  employeeId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  dailyRate: z.number(),
  basicPay: z.number(),
  overtime: z.number(),
  overtimeMinutes: z.number().optional(),
  undertimeDeduction: z.number().optional(),
  undertimeMinutes: z.number().optional(),
  lateDeduction: z.number().optional(),
  lateMinutes: z.number().optional(),
  holidayBonus: z.number().optional(),
  nightDifferentialHours: z.number().optional(),
  nightDifferentialPay: z.number().optional(),
  dayType: z.enum(["Regular", "Holiday", "Rest Day", "Special"]).optional(),
  leaveType: z.enum(["Vacation", "Sick", "Unpaid", "None"]).optional(),
  leavePay: z.number().optional(),
  grossPay: z.number(),
  allowances: z.number(),
  cashAdvanceIDs: z.array(z.string()).optional(),
  shortIDs: z.array(z.string()).optional(),
  deductions: z.object({
    sss: z.number(),
    philHealth: z.number(),
    pagIbig: z.number(),
    cashAdvanceDeductions: z.number(),
    shortDeductions: z.number().optional(),
    others: z.number(),
  }),
  netPay: z.number(),
  paymentDate: z.string(),
  daysWorked: z.number(),
  absences: z.number(),
});

const payrollFirestoreDataSchema = z.object({
  meta: z.object({
    employeeId: z.string(),
    year: z.number(),
    month: z.number(),
    lastModified: z.string(),
  }),
  payrolls: z.array(payrollSummarySchema),
});

/**
 * Validation schema for statistics data
 */
const statisticsSchema = z.object({
  meta: z.object({
    year: z.number(),
    lastModified: z.string(),
  }),
  monthlyTotals: z.record(
    z.string(),
    z.object({
      totalGrossPay: z.number(),
      totalNetPay: z.number(),
      totalEmployees: z.number(),
      employeeIds: z.array(z.string()),
    })
  ),
  employeeStats: z.record(
    z.string(),
    z.object({
      totalGrossPay: z.number(),
      totalNetPay: z.number(),
      payrollCount: z.number(),
      lastPayrollDate: z.string(),
    })
  ),
  totals: z.object({
    grossPay: z.number(),
    netPay: z.number(),
    employeeCount: z.number(),
  }),
});

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
      `companies/${companyName}/payrolls`,
      docId
    );

    if (!data) {
      console.log(
        `No payroll data found for employee ${employeeId} in ${year}-${month}`
      );
      return [];
    }

    return data.payrolls.map((payroll) => ({
      ...payroll,
      startDate: new Date(payroll.startDate),
      endDate: new Date(payroll.endDate),
      overtime: payroll.overtime || 0,
    }));
  } catch (error) {
    console.error(`Error loading payroll summaries from Firestore:`, error);
    throw error;
  }
}

/**
 * Save a payroll summary to Firestore
 */
export async function savePayrollSummaryFirestore(
  payrollSummary: PayrollSummaryModel,
  companyName: string
): Promise<void> {
  try {
    const endDate = new Date(payrollSummary.endDate);
    const year = endDate.getFullYear();
    const month = endDate.getMonth() + 1;
    const docId = createPayrollDocId(payrollSummary.employeeId, year, month);

    // Get existing data
    const existingData = await fetchDocument<PayrollFirestoreData>(
      `companies/${companyName}/payrolls`,
      docId
    );

    let data: PayrollFirestoreData;
    if (existingData) {
      // Update existing data
      const existingPayrolls = existingData.payrolls || [];
      const existingIndex = existingPayrolls.findIndex(
        (p) => p.id === payrollSummary.id
      );

      if (existingIndex >= 0) {
        existingPayrolls[existingIndex] = payrollSummary;
      } else {
        existingPayrolls.push(payrollSummary);
      }

      data = {
        meta: existingData.meta,
        payrolls: existingPayrolls,
      };
    } else {
      // Create new data
      data = {
        meta: {
          employeeId: payrollSummary.employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
        },
        payrolls: [payrollSummary],
      };
    }

    // Validate data
    const validationResult = payrollFirestoreDataSchema.safeParse(data);
    if (!validationResult.success) {
      throw new Error(
        `Invalid payroll data structure: ${validationResult.error.message}`
      );
    }

    // Save to Firestore
    await saveDocument(`companies/${companyName}/payrolls`, docId, data);
  } catch (error) {
    console.error("Error saving payroll summary to Firestore:", error);
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

    // Get existing data
    const existingData = await fetchDocument<PayrollFirestoreData>(
      `companies/${companyName}/payrolls`,
      docId
    );

    if (!existingData) {
      console.warn(
        `Payroll document for ${month}/${year} not found in Firestore.`
      );
      return undefined;
    }

    // Find the payroll to be deleted
    const payrollToDelete = existingData.payrolls.find(
      (p) => p.id === payrollId
    );
    if (!payrollToDelete) {
      console.warn(
        `Payroll with ID ${payrollId} not found in Firestore document.`
      );
      return undefined;
    }

    // Filter out the payroll with the specified ID
    const updatedPayrolls = existingData.payrolls.filter(
      (p) => p.id !== payrollId
    );

    // Only update if we actually removed a payroll
    if (updatedPayrolls.length < existingData.payrolls.length) {
      const updateData = {
        payrolls: updatedPayrolls,
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument(
        `companies/${companyName}/payrolls`,
        docId,
        updateData
      );
      return payrollToDelete;
    }

    return undefined;
  } catch (error) {
    console.error(`Error deleting payroll summary from Firestore:`, error);
    throw error;
  }
}

/**
 * Update payroll statistics in Firestore
 */
export async function updatePayrollStatisticsFirestore(
  summaries: PayrollSummaryModel[],
  year: number,
  companyName: string
): Promise<void> {
  try {
    if (!isWebEnvironment()) {
      console.log("Firestore sync is only available in web environment");
      return;
    }

    if (!summaries || summaries.length === 0) {
      console.log("No payroll summaries provided for statistics update");
      return;
    }

    if (!companyName) {
      throw new Error("Company name is required for statistics update");
    }

    const docId = createStatisticsDocId(year);
    const data = await fetchDocument<PayrollStatisticsFirestoreData>(
      "payroll/statistics",
      docId,
      companyName
    );

    // Initialize or get current statistics
    const currentStats = data || {
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

    // Validate current statistics
    const currentStatsValidation = statisticsSchema.safeParse(currentStats);
    if (!currentStatsValidation.success) {
      throw new Error(
        `Invalid current statistics data: ${currentStatsValidation.error.message}`
      );
    }

    // Calculate new totals with validation
    const newTotals = summaries.reduce(
      (acc, summary) => {
        // Validate summary
        const summaryValidation = payrollSummarySchema.safeParse(summary);
        if (!summaryValidation.success) {
          console.warn(
            `Invalid summary data: ${summaryValidation.error.message}`
          );
          return acc;
        }

        // Update monthly totals
        const endDate = new Date(summary.endDate);
        const month = endDate.getMonth() + 1;
        const monthKey = month.toString();

        if (!acc.monthlyTotals[monthKey]) {
          acc.monthlyTotals[monthKey] = {
            totalGrossPay: 0,
            totalNetPay: 0,
            totalEmployees: 0,
            employeeIds: [],
          };
        }

        // Update employee stats
        if (!acc.employeeStats[summary.employeeId]) {
          acc.employeeStats[summary.employeeId] = {
            totalGrossPay: 0,
            totalNetPay: 0,
            payrollCount: 0,
            lastPayrollDate: summary.endDate.toISOString(),
          };
        }

        // Update monthly totals
        acc.monthlyTotals[monthKey].totalGrossPay += summary.grossPay;
        acc.monthlyTotals[monthKey].totalNetPay += summary.netPay;
        if (
          !acc.monthlyTotals[monthKey].employeeIds.includes(summary.employeeId)
        ) {
          acc.monthlyTotals[monthKey].employeeIds.push(summary.employeeId);
          acc.monthlyTotals[monthKey].totalEmployees =
            acc.monthlyTotals[monthKey].employeeIds.length;
        }

        // Update employee stats
        acc.employeeStats[summary.employeeId].totalGrossPay += summary.grossPay;
        acc.employeeStats[summary.employeeId].totalNetPay += summary.netPay;
        acc.employeeStats[summary.employeeId].payrollCount += 1;
        if (
          new Date(summary.endDate) >
          new Date(acc.employeeStats[summary.employeeId].lastPayrollDate)
        ) {
          acc.employeeStats[summary.employeeId].lastPayrollDate =
            summary.endDate.toISOString();
        }

        // Update overall totals
        acc.totals.grossPay += summary.grossPay;
        acc.totals.netPay += summary.netPay;
        acc.totals.employeeCount = Object.keys(acc.employeeStats).length;

        return acc;
      },
      {
        monthlyTotals: { ...currentStats.monthlyTotals },
        employeeStats: { ...currentStats.employeeStats },
        totals: { ...currentStats.totals },
      }
    );

    // Validate new totals
    const newTotalsValidation = statisticsSchema.safeParse(newTotals);
    if (!newTotalsValidation.success) {
      throw new Error(
        `Invalid new totals data: ${newTotalsValidation.error.message}`
      );
    }

    // Update statistics with validation
    const updatedStats: PayrollStatisticsFirestoreData = {
      meta: {
        year,
        lastModified: new Date().toISOString(),
      },
      monthlyTotals: newTotals.monthlyTotals,
      employeeStats: newTotals.employeeStats,
      totals: newTotals.totals,
    };

    // Validate final statistics
    const finalValidation = statisticsSchema.safeParse(updatedStats);
    if (!finalValidation.success) {
      throw new Error(
        `Invalid final statistics data: ${finalValidation.error.message}`
      );
    }

    // Save updated statistics
    await saveDocument("payroll/statistics", docId, updatedStats, companyName);
    console.log("Payroll statistics updated successfully");
  } catch (error) {
    console.error("Error updating payroll statistics:", error);
    throw error;
  }
}

/**
 * Reverse cash advance deduction in Firestore
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
        `companies/${companyName}/cash_advances`,
        docId
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
          `companies/${companyName}/cash_advances`,
          docId
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
            `companies/${companyName}/cash_advances`,
            docId,
            { advances: updatedAdvances }
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
 * Reverse short deduction in Firestore
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
        `companies/${companyName}/shorts`,
        docId
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
          await updateDocument(`companies/${companyName}/shorts`, docId, {
            shorts: updatedShorts,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reversing short deduction in Firestore:`, error);
    throw error;
  }
}

/**
 * Create a Firestore instance for the payroll model
 */
export function createPayrollFirestoreInstance(model: Payroll, dbPath: string) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        if (!isWebEnvironment()) {
          throw new Error(
            "Firestore sync is only available in web environment"
          );
        }

        onProgress?.("Starting payroll sync to Firestore...");
        const companyName = await getCompanyName();

        // Get all employees
        const employeeModel = createEmployeeModel(dbPath);
        const employees = await employeeModel.loadEmployees();
        onProgress?.(`Found ${employees.length} employees to process`);

        // Process each employee
        for (const employee of employees) {
          try {
            onProgress?.(`Processing payroll for employee ${employee.name}...`);

            // Get current year and month
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            // Get all payroll summaries for this employee
            const summaries = await Payroll.loadPayrollSummaries(
              dbPath,
              employee.id,
              year,
              month
            );

            if (summaries.length === 0) {
              // Generate a new payroll summary if none exists
              const startDate = new Date(year, month - 1, 1);
              const endDate = new Date(year, month, 0);

              const summary = await model.generatePayrollSummary(
                employee.id,
                startDate,
                endDate,
                {
                  sss: employee.sss || 0,
                  philHealth: employee.philHealth || 0,
                  pagIbig: employee.pagIbig || 0,
                  cashAdvanceDeductions: 0,
                  shortDeductions: 0,
                }
              );

              if (summary) {
                const docId = createPayrollDocId(employee.id, year, month);
                await saveDocument(
                  "payrolls",
                  docId,
                  { payrolls: [summary] },
                  companyName
                );
                await updatePayrollStatisticsFirestore(
                  [summary],
                  year,
                  companyName
                );
              }
            } else {
              // Save existing summaries to Firestore
              for (const summary of summaries) {
                const docId = createPayrollDocId(employee.id, year, month);
                await saveDocument(
                  "payrolls",
                  docId,
                  { payrolls: [summary] },
                  companyName
                );
              }
              await updatePayrollStatisticsFirestore(
                summaries,
                year,
                companyName
              );
            }

            onProgress?.(`Successfully synced payroll for ${employee.name}`);
          } catch (employeeError) {
            console.error(
              `Error syncing payroll for employee ${employee.name}:`,
              employeeError
            );
            onProgress?.(
              `Error syncing payroll for ${employee.name}: ${
                (employeeError as Error).message
              }`
            );
            // Continue with next employee
          }
        }

        onProgress?.("Payroll sync to Firestore completed");
      } catch (error) {
        console.error("Error in payroll sync to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        if (!isWebEnvironment()) {
          throw new Error(
            "Firestore sync is only available in web environment"
          );
        }

        onProgress?.("Starting payroll sync from Firestore...");
        const companyName = await getCompanyName();

        // Get all employees
        const employeeModel = createEmployeeModel(dbPath);
        const employees = await employeeModel.loadEmployees();
        onProgress?.(`Found ${employees.length} employees to process`);

        // Process each employee
        for (const employee of employees) {
          try {
            onProgress?.(`Processing payroll for employee ${employee.name}...`);

            // Get current year and month
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            // Load payroll summaries from Firestore
            const docId = createPayrollDocId(employee.id, year, month);
            const data = await fetchDocument<PayrollFirestoreData>(
              "payrolls",
              docId,
              companyName
            );

            if (!data || !data.payrolls || data.payrolls.length === 0) {
              onProgress?.(`No payroll summaries found for ${employee.name}`);
              continue;
            }

            // Save each summary locally and update Firestore
            for (const summary of data.payrolls) {
              try {
                // Generate the summary locally first
                const generatedSummary = await model.generatePayrollSummary(
                  employee.id,
                  new Date(summary.startDate),
                  new Date(summary.endDate),
                  summary.deductions
                );

                if (generatedSummary) {
                  // Save the generated summary back to Firestore
                  await saveDocument(
                    "payrolls",
                    docId,
                    { payrolls: [generatedSummary] },
                    companyName
                  );

                  // Update statistics
                  await updatePayrollStatisticsFirestore(
                    [generatedSummary],
                    year,
                    companyName
                  );
                }

                onProgress?.(
                  `Successfully synced payroll for ${employee.name}`
                );
              } catch (summaryError) {
                console.error(
                  `Error syncing payroll summary for ${employee.name}:`,
                  summaryError
                );
                onProgress?.(
                  `Error syncing payroll summary for ${employee.name}: ${
                    (summaryError as Error).message
                  }`
                );
                // Continue with next summary
              }
            }
          } catch (employeeError) {
            console.error(
              `Error syncing payroll for employee ${employee.name}:`,
              employeeError
            );
            onProgress?.(
              `Error syncing payroll for ${employee.name}: ${
                (employeeError as Error).message
              }`
            );
            // Continue with next employee
          }
        }

        onProgress?.("Payroll sync from Firestore completed");
      } catch (error) {
        console.error("Error in payroll sync from Firestore:", error);
        throw error;
      }
    },
  };
}
