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
  deleteField,
} from "../lib/firestoreService";
import { CashAdvance } from "./cashAdvance";
import { Short } from "./shorts";
import { z } from "zod";
import { createEmployeeModel } from "./employee";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
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
  // The format in Firestore is "payroll_{employeeId}_{year}_{month}"
  return `payroll_${employeeId}_${year}_${month}`;
};

// Add a function to check if a document ID matches an employee's payroll
const isEmployeePayrollDoc = (docId: string, employeeId: string): boolean => {
  // Check common formats
  if (docId === `payroll_${employeeId}`) return true;
  if (docId.startsWith(`payroll_${employeeId}_`)) return true;

  // Also check for potential alternative formats
  if (docId === `${employeeId}_payroll`) return true;
  if (docId.startsWith(`${employeeId}_`)) return true;

  return false;
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
    // Try specific month document first
    const docId = createPayrollDocId(employeeId, year, month);

    let payrollData = await fetchDocument<PayrollFirestoreData>(
      "payrolls",
      docId,
      companyName
    );

    if (!payrollData) {
      // If specific month document is not found, try to query for all payroll docs for this employee
      try {
        // Import the necessary Firestore functions
        const { collection, query, where, getDocs, orderBy } = await import(
          "firebase/firestore"
        );
        const { getFirestoreInstance } = await import(
          "../lib/firestoreService"
        );

        const db = getFirestoreInstance();
        const payrollsRef = collection(db, `companies/${companyName}/payrolls`);

        // Query for all documents with IDs that start with our prefix
        // Note: Firestore doesn't support startsWith directly for document IDs, so we'll filter client-side
        const querySnapshot = await getDocs(payrollsRef);

        // Find documents that match our pattern using the helper function
        const matchingDocs: Array<{ id: string; data: PayrollFirestoreData }> =
          [];
        querySnapshot.forEach((doc) => {
          // Log ALL document IDs to help diagnose the structure

          if (isEmployeePayrollDoc(doc.id, employeeId)) {
            matchingDocs.push({
              id: doc.id,
              data: doc.data() as PayrollFirestoreData,
            });
          }
        });

        // Log the first document structure to help with debugging
        if (matchingDocs.length > 0) {
          const sampleDoc = matchingDocs[0];
        }

        // Extract and combine payrolls from all matching documents
        const allPayrolls: PayrollSummaryModel[] = [];
        for (const doc of matchingDocs) {
          const data = doc.data;

          // Check if the document has a payrolls array
          if (data && data.payrolls && Array.isArray(data.payrolls)) {
            // Process each payroll in the array - don't filter by date yet, just convert and collect
            data.payrolls.forEach((payroll: any) => {
              try {
                // Basic validation that minimum required fields exist - ID at minimum
                if (payroll && payroll.id) {
                  // Create a standardized payroll object with all required fields
                  const processedPayroll: PayrollSummaryModel = {
                    id: payroll.id,
                    employeeId: payroll.employeeId || employeeId,
                    employeeName: payroll.employeeName || "Unknown",
                    startDate: parseFirestoreDate(payroll.startDate),
                    endDate: parseFirestoreDate(payroll.endDate),
                    paymentDate:
                      payroll.paymentDate || new Date().toISOString(),
                    dailyRate: payroll.dailyRate || 0,
                    daysWorked: payroll.daysWorked || 0,
                    basicPay: payroll.basicPay || 0,
                    grossPay: payroll.grossPay || 0,
                    netPay: payroll.netPay || 0,
                    allowances: payroll.allowances || 0,
                    overtime: payroll.overtime || 0,
                    undertimeDeduction: payroll.undertimeDeduction || 0,
                    lateDeduction: payroll.lateDeduction || 0,
                    cashAdvanceIDs: payroll.cashAdvanceIDs || [],
                    shortIDs: payroll.shortIDs || [],
                    deductions: {
                      sss: payroll.deductions?.sss || 0,
                      philHealth: payroll.deductions?.philHealth || 0,
                      pagIbig: payroll.deductions?.pagIbig || 0,
                      cashAdvanceDeductions:
                        payroll.deductions?.cashAdvanceDeductions || 0,
                      shortDeductions: payroll.deductions?.shortDeductions || 0,
                      others: payroll.deductions?.others || 0,
                    },
                    absences: payroll.absences || 0,
                  };

                  allPayrolls.push(processedPayroll);
                }
              } catch (err) {
                console.error(
                  `[PayrollFirestore] Error processing payroll in ${doc.id}:`,
                  err
                );
              }
            });
          } else {
            console.warn(
              `[PayrollFirestore] Document ${doc.id} has invalid or missing payrolls array`
            );
          }
        }

        if (allPayrolls.length > 0) {
          // Sort payrolls by date (newest first)
          return allPayrolls.sort(
            (a, b) => b.startDate.getTime() - a.startDate.getTime()
          );
        } else {
          return [];
        }
      } catch (queryError) {
        console.error(
          `[PayrollFirestore] Error querying payroll documents:`,
          queryError
        );
        return [];
      }
    }

    // Process data from specific month document
    if (!payrollData.payrolls || !Array.isArray(payrollData.payrolls)) {
      console.warn(
        `[PayrollFirestore] Invalid payroll data format for ${docId}`
      );
      return [];
    }

    // Here we process the payrolls from the specific document we found
    const payrolls: PayrollSummaryModel[] = [];

    for (const payroll of payrollData.payrolls) {
      try {
        // Basic validation that minimum required fields exist
        if (payroll && payroll.id) {
          // Create a standardized payroll object with all required fields
          const processedPayroll: PayrollSummaryModel = {
            id: payroll.id,
            employeeId: payroll.employeeId || employeeId,
            employeeName: payroll.employeeName || "Unknown",
            startDate: parseFirestoreDate(payroll.startDate),
            endDate: parseFirestoreDate(payroll.endDate),
            paymentDate: payroll.paymentDate || new Date().toISOString(),
            dailyRate: payroll.dailyRate || 0,
            daysWorked: payroll.daysWorked || 0,
            basicPay: payroll.basicPay || 0,
            grossPay: payroll.grossPay || 0,
            netPay: payroll.netPay || 0,
            allowances: payroll.allowances || 0,
            overtime: payroll.overtime || 0,
            undertimeDeduction: payroll.undertimeDeduction || 0,
            lateDeduction: payroll.lateDeduction || 0,
            cashAdvanceIDs: payroll.cashAdvanceIDs || [],
            shortIDs: payroll.shortIDs || [],
            deductions: {
              sss: payroll.deductions?.sss || 0,
              philHealth: payroll.deductions?.philHealth || 0,
              pagIbig: payroll.deductions?.pagIbig || 0,
              cashAdvanceDeductions:
                payroll.deductions?.cashAdvanceDeductions || 0,
              shortDeductions: payroll.deductions?.shortDeductions || 0,
              others: payroll.deductions?.others || 0,
            },
            absences: payroll.absences || 0,
          };

          payrolls.push(processedPayroll);
        }
      } catch (err) {
        console.error(
          `[PayrollFirestore] Error processing payroll in ${docId}:`,
          err
        );
      }
    }

    // Sort payrolls by date (newest first)
    return payrolls.sort(
      (a, b) => b.startDate.getTime() - a.startDate.getTime()
    );
  } catch (error) {
    console.error(
      `[PayrollFirestore] Error loading payroll summaries from Firestore for ${year}-${month}:`,
      error
    );
    // Return empty array instead of throwing to prevent breaking the UI
    return [];
  }
}

/**
 * Save a payroll summary to Firestore
 */
export async function savePayrollSummaryFirestore(
  summary: PayrollSummaryModel,
  companyName: string
): Promise<void> {
  try {
    const db = getFirestoreInstance();

    // Extract the date info from the summary
    const startDate = new Date(summary.startDate);
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;

    // Create the document ID
    const docId = createPayrollDocId(summary.employeeId, year, month);

    // Get the existing payrolls for this employee/month/year
    const payrollsRef = doc(db, `companies/${companyName}/payrolls`, docId);
    const docSnap = await getDoc(payrollsRef);

    let payrolls: PayrollSummaryModel[] = [];
    if (docSnap.exists()) {
      const data = docSnap.data();
      payrolls = data.payrolls || [];

      // Filter out any existing entry with the same ID
      payrolls = payrolls.filter((p) => p.id !== summary.id);
    }

    // Add the new summary and sort by date
    payrolls.push(summary);
    payrolls.sort(
      (a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    // Save the updated payrolls
    await setDoc(payrollsRef, { payrolls }, { merge: true });

    // Also update the statistics
    await updatePayrollStatisticsFirestore([summary], year, companyName);
  } catch (error) {
    console.error(`[PayrollFirestore] Error saving payroll summary:`, error);
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
): Promise<PayrollSummaryModel | null> {
  try {
    const db = getFirestoreInstance();
    const payrollId = `${employeeId}_${startDate.getTime()}_${endDate.getTime()}`;

    // Create document ID
    const docId = createPayrollDocId(employeeId, year, month);

    // Get the existing document
    const payrollsRef = doc(db, `companies/${companyName}/payrolls`, docId);
    const docSnap = await getDoc(payrollsRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const payrolls = data.payrolls || [];

    // Find the payroll to delete
    const payrollToDelete = payrolls.find(
      (p: PayrollSummaryModel) => p.id === payrollId
    );
    if (!payrollToDelete) {
      return null;
    }

    // Filter out the payroll to delete
    const updatedPayrolls = payrolls.filter(
      (p: PayrollSummaryModel) => p.id !== payrollId
    );

    // Update the document
    if (updatedPayrolls.length > 0) {
      await setDoc(payrollsRef, { payrolls: updatedPayrolls }, { merge: true });
    } else {
      await deleteDoc(payrollsRef);
    }

    return payrollToDelete;
  } catch (error) {
    console.error(`[PayrollFirestore] Error deleting payroll summary:`, error);
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
      return;
    }

    if (!summaries || summaries.length === 0) {
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
        // Desktop mode: Prepare and upload data from local storage to Firestore
        // Web mode: This operation should not be performed (checked in useFirestoreSync)
        if (isWebEnvironment()) {
          console.warn(
            "[PayrollFirestore] syncToFirestore should not be called in web environment"
          );
          onProgress?.(
            "Syncing TO Firestore is only available in desktop mode"
          );
          return;
        }

        onProgress?.("Starting payroll sync to Firestore...");
        const companyName = await getCompanyName();

        // Get all employees
        const employeeModel = createEmployeeModel(dbPath);
        const employees = await employeeModel.loadEmployees();
        onProgress?.(`Found ${employees.length} employees to process`);

        // Get current date for reference
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        // We'll search for payroll data across the past 12 months
        const monthsToCheck = 12;

        // Process each employee
        for (const employee of employees) {
          try {
            onProgress?.(`Processing payroll for employee ${employee.name}...`);

            let employeeHasData = false;

            // Check the last 12 months for payroll data
            for (let i = 0; i < monthsToCheck; i++) {
              // Calculate the month and year to check (going backward from current)
              const checkDate = new Date(currentDate);
              checkDate.setMonth(currentDate.getMonth() - i);
              const year = checkDate.getFullYear();
              const month = checkDate.getMonth() + 1;

              // Get all payroll summaries for this employee in this month/year
              const summaries = await Payroll.loadPayrollSummaries(
                dbPath,
                employee.id,
                year,
                month
              );

              if (summaries.length > 0) {
                employeeHasData = true;

                // Save existing summaries to Firestore
                const docId = createPayrollDocId(employee.id, year, month);

                await saveDocument(
                  "payrolls",
                  docId,
                  { payrolls: summaries },
                  companyName
                );

                // Update statistics
                await updatePayrollStatisticsFirestore(
                  summaries,
                  year,
                  companyName
                );
              } else {
              }
            }

            if (employeeHasData) {
              onProgress?.(`Successfully synced payroll for ${employee.name}`);
            } else {
              onProgress?.(
                `No payroll data found for ${employee.name}. Skipping.`
              );
            }
          } catch (employeeError) {
            console.error(
              `[PayrollFirestore] Error syncing payroll for employee ${employee.name}:`,
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
        console.error(
          "[PayrollFirestore] Error in payroll sync to Firestore:",
          error
        );
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        const db = getFirestoreInstance();

        // Web mode should not sync FROM Firestore (web already uses it directly)
        if (!isWebEnvironment()) {
        } else {
          console.warn(
            "[PayrollFirestore] syncFromFirestore should not be called in web environment"
          );
          onProgress?.(
            "Syncing FROM Firestore is only available in desktop mode"
          );
          return;
        }

        onProgress?.("Starting payroll sync from Firestore...");
        const companyName = await getCompanyName();

        // Get all employees
        const employeeModel = createEmployeeModel(dbPath);
        const employees = await employeeModel.loadEmployees();
        onProgress?.(`Found ${employees.length} employees to process`);

        // Get current date for reference
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        // We'll search for payroll data across the past 12 months
        const monthsToCheck = 12;

        // Process each employee
        for (const employee of employees) {
          try {
            onProgress?.(`Processing payroll for employee ${employee.name}...`);

            let employeeHasData = false;

            // Check the last 12 months for payroll data
            for (let i = 0; i < monthsToCheck; i++) {
              // Calculate the month and year to check (going backward from current)
              const checkDate = new Date(currentDate);
              checkDate.setMonth(currentDate.getMonth() - i);
              const year = checkDate.getFullYear();
              const month = checkDate.getMonth() + 1;

              // Try to load payroll summaries from Firestore
              try {
                const docId = createPayrollDocId(employee.id, year, month);
                const payrollsRef = doc(
                  db,
                  `companies/${companyName}/payrolls`,
                  docId
                );
                const payrollDoc = await getDoc(payrollsRef);

                if (payrollDoc.exists()) {
                  const data = payrollDoc.data();
                  const payrolls = data.payrolls || [];

                  if (payrolls.length > 0) {
                    employeeHasData = true;

                    // Save to local JSON file
                    const jsonStructure = {
                      meta: {
                        employeeId: employee.id,
                        year,
                        month,
                        lastModified: new Date().toISOString(),
                      },
                      payrolls: payrolls,
                    };

                    // Ensure directory exists
                    const payrollDir = `${dbPath}/SweldoDB/payrolls/${employee.id}`;
                    await window.electron.ensureDir(payrollDir);

                    // Write the JSON file
                    const filePath = `${payrollDir}/${year}_${month}_payroll.json`;
                    await window.electron.writeFile(
                      filePath,
                      JSON.stringify(jsonStructure, null, 2)
                    );
                    onProgress?.(
                      `Synced ${payrolls.length} payroll records for ${employee.name} (${year}-${month})`
                    );
                  }
                } else {
                }
              } catch (firestoreError) {
                console.error(
                  `[PayrollFirestore] Error retrieving Firestore data for ${year}-${month}:`,
                  firestoreError
                );
              }
            }

            if (!employeeHasData) {
              onProgress?.(
                `No payroll data found in Firestore for ${employee.name}`
              );
            }
          } catch (employeeError) {
            console.error(
              `[PayrollFirestore] Error syncing payroll for employee ${employee.name}:`,
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
        console.error(
          "[PayrollFirestore] Error in payroll sync from Firestore:",
          error
        );
        throw error;
      }
    },
  };
}

// Add this helper function at the top of the file after the imports
function parseFirestoreDate(dateInput: any): Date {
  if (!dateInput) return new Date();

  try {
    // If it's already a Date object
    if (dateInput instanceof Date) {
      return dateInput;
    }

    // Handle Firestore timestamp objects
    if (typeof dateInput === "object" && dateInput !== null) {
      // Firestore timestamp format with seconds and nanoseconds
      if (
        dateInput.seconds !== undefined &&
        dateInput.nanoseconds !== undefined
      ) {
        return new Date(dateInput.seconds * 1000);
      }

      // Handle serialized timestamp objects
      if (
        dateInput._seconds !== undefined &&
        dateInput._nanoseconds !== undefined
      ) {
        return new Date(dateInput._seconds * 1000);
      }
    }

    // If it's a timestamp (number)
    if (typeof dateInput === "number") {
      return new Date(dateInput);
    }

    // If it's a string representation of a timestamp
    if (typeof dateInput === "string" && !isNaN(Number(dateInput))) {
      return new Date(Number(dateInput));
    }

    // Regular date string
    if (typeof dateInput === "string") {
      const parsedDate = new Date(dateInput);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }

      // Try to parse stringified Firestore timestamps
      if (dateInput.includes("seconds") && dateInput.includes("nanoseconds")) {
        try {
          const parsedObj = JSON.parse(dateInput);
          if (parsedObj.seconds) {
            return new Date(parsedObj.seconds * 1000);
          }
        } catch (e) {
          // Ignore parsing errors and continue with other methods
        }
      }
    }

    // Default fallback
    return new Date();
  } catch (e) {
    console.error("[PayrollFirestore] Error parsing date:", e, dateInput);
    return new Date();
  }
}

/**
 * Get all payroll documents for a specific year
 * This can be used to populate a dropdown of available payroll periods
 */
export async function getPayrollDocumentsForYear(
  year: number,
  companyName: string
): Promise<{ id: string; startDate: Date; endDate: Date }[]> {
  try {
    // Import the necessary Firestore functions
    const { collection, query, getDocs } = await import("firebase/firestore");
    const { getFirestoreInstance } = await import("../lib/firestoreService");

    const db = getFirestoreInstance();
    const payrollsRef = collection(db, `companies/${companyName}/payrolls`);

    console.log(
      `[PayrollFirestore] Searching for payroll documents for year ${year} in company: ${companyName}`
    );

    const querySnapshot = await getDocs(payrollsRef);

    console.log(
      `[PayrollFirestore] Found ${querySnapshot.size} total payroll documents`
    );

    // We'll collect all payroll periods across all documents
    const payrollPeriods: { id: string; startDate: Date; endDate: Date }[] = [];

    // Go through each document in the collection
    querySnapshot.forEach((doc) => {
      const docId = doc.id;
      console.log(`[PayrollFirestore] Examining document: ${docId}`);

      // Don't filter by document ID pattern initially, check the actual payroll data instead
      const data = doc.data();

      // Each payroll document contains an array of payroll objects
      if (data && data.payrolls && Array.isArray(data.payrolls)) {
        console.log(
          `[PayrollFirestore] Document ${docId} has ${data.payrolls.length} payrolls`
        );

        // Process all payrolls in this document to find ones that match our year
        data.payrolls.forEach((payroll: any) => {
          try {
            if (payroll && (payroll.startDate || payroll.endDate)) {
              // Parse dates, with fallbacks
              const startDate = payroll.startDate
                ? parseFirestoreDate(payroll.startDate)
                : new Date();
              const endDate = payroll.endDate
                ? parseFirestoreDate(payroll.endDate)
                : new Date();

              console.log(
                `[PayrollFirestore] Found payroll period: ${startDate.toISOString()} to ${endDate.toISOString()}`
              );

              // Check if the year matches either start or end date
              if (
                startDate.getFullYear() === year ||
                endDate.getFullYear() === year
              ) {
                payrollPeriods.push({
                  id: payroll.id || docId,
                  startDate,
                  endDate,
                });
                console.log(
                  `[PayrollFirestore] Added payroll period to results: ${startDate.toISOString()} to ${endDate.toISOString()}`
                );
              } else {
                console.log(
                  `[PayrollFirestore] Payroll period years (${startDate.getFullYear()}, ${endDate.getFullYear()}) don't match target year ${year}`
                );
              }
            } else {
              console.log(
                `[PayrollFirestore] Payroll missing date range in document ${docId}:`,
                payroll
              );
            }
          } catch (parseError) {
            console.error(
              `[PayrollFirestore] Error parsing payroll dates in document ${docId}:`,
              parseError
            );
          }
        });
      } else {
        console.log(
          `[PayrollFirestore] Document ${docId} has no valid payrolls array`
        );
      }
    });

    console.log(
      `[PayrollFirestore] Final result: ${payrollPeriods.length} payroll periods for year ${year}`
    );

    // Remove duplicates based on start and end date
    const uniquePeriods = payrollPeriods.reduce((acc, current) => {
      const key = `${current.startDate.getTime()}-${current.endDate.getTime()}`;
      if (
        !acc.some(
          (item) =>
            `${item.startDate.getTime()}-${item.endDate.getTime()}` === key
        )
      ) {
        acc.push(current);
      }
      return acc;
    }, [] as typeof payrollPeriods);

    console.log(
      `[PayrollFirestore] After removing duplicates: ${uniquePeriods.length} unique periods`
    );

    // Sort by start date (most recent first)
    return uniquePeriods.sort(
      (a, b) => b.startDate.getTime() - a.startDate.getTime()
    );
  } catch (error) {
    console.error(
      `[PayrollFirestore] Error getting payroll documents for year ${year}:`,
      error
    );
    return [];
  }
}
