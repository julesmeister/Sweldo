/**
 * Firestore implementation for cash advance operations
 *
 * This module provides Firestore implementations for all cash advance related
 * operations that mirror the local filesystem operations in cashAdvance.ts.
 */

import { CashAdvance, CashAdvanceModel } from "./cashAdvance";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  createTimeBasedDocId,
  getCompanyName,
  queryCollection,
} from "../lib/firestoreService";

/**
 * Firestore structure for cash advance document
 */
interface CashAdvanceFirestoreData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  advances: {
    [id: string]: {
      employeeId: string;
      date: string;
      amount: number;
      remainingUnpaid: number;
      reason: string;
      approvalStatus: "Pending" | "Approved" | "Rejected";
      status: "Paid" | "Unpaid";
      paymentSchedule: "One-time" | "Installment";
      installmentDetails?: {
        numberOfPayments: number;
        amountPerPayment: number;
        remainingPayments: number;
      };
    };
  };
}

/**
 * Creates a cash advance document ID for a specific employee, year and month
 */
const createCashAdvanceDocId = (
  employeeId: string,
  year: number,
  month: number
): string => {
  return `${employeeId}_${year}_${month}`;
};

/**
 * Load cash advances for a specific employee, month and year from Firestore
 */
export async function loadCashAdvancesFirestore(
  employeeId: string,
  month: number,
  year: number,
  companyName: string
): Promise<CashAdvance[]> {
  try {
    const docId = createCashAdvanceDocId(employeeId, year, month);
    const data = await fetchDocument<CashAdvanceFirestoreData>(
      "cash_advances",
      docId,
      companyName
    );

    if (!data || !data.advances) {
      return [];
    }

    // Transform the data to CashAdvance array
    return Object.entries(data.advances).map(([id, advance]) => ({
      id,
      employeeId: advance.employeeId,
      date: new Date(advance.date),
      amount: advance.amount,
      remainingUnpaid: advance.remainingUnpaid,
      reason: advance.reason,
      approvalStatus: advance.approvalStatus,
      status: advance.status,
      paymentSchedule: advance.paymentSchedule,
      installmentDetails: advance.installmentDetails,
    }));
  } catch (error) {
    console.error(`Error loading cash advances from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Save a cash advance to Firestore
 */
export async function saveCashAdvanceFirestore(
  advance: CashAdvance,
  month: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createCashAdvanceDocId(advance.employeeId, year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<CashAdvanceFirestoreData>(
      "cash_advances",
      docId,
      companyName
    );

    if (!existingDoc) {
      // Create new document if it doesn't exist
      const newDoc: CashAdvanceFirestoreData = {
        meta: {
          employeeId: advance.employeeId,
          month,
          year,
          lastModified: new Date().toISOString(),
        },
        advances: {
          [advance.id]: {
            employeeId: advance.employeeId,
            date: advance.date.toISOString(),
            amount: advance.amount,
            remainingUnpaid: advance.remainingUnpaid,
            reason: advance.reason,
            approvalStatus: advance.approvalStatus,
            status: advance.status,
            paymentSchedule: advance.paymentSchedule,
            installmentDetails: advance.installmentDetails,
          },
        },
      };

      await saveDocument("cash_advances", docId, newDoc, companyName);
    } else {
      // Update existing document
      const updateData = {
        [`advances.${advance.id}`]: {
          employeeId: advance.employeeId,
          date: advance.date.toISOString(),
          amount: advance.amount,
          remainingUnpaid: advance.remainingUnpaid,
          reason: advance.reason,
          approvalStatus: advance.approvalStatus,
          status: advance.status,
          paymentSchedule: advance.paymentSchedule,
          installmentDetails: advance.installmentDetails,
        },
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("cash_advances", docId, updateData, companyName);
    }
  } catch (error) {
    console.error(`Error saving cash advance to Firestore:`, error);
    throw error;
  }
}

/**
 * Delete a cash advance from Firestore
 */
export async function deleteCashAdvanceFirestore(
  id: string,
  employeeId: string,
  month: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createCashAdvanceDocId(employeeId, year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<CashAdvanceFirestoreData>(
      "cash_advances",
      docId,
      companyName
    );

    if (!existingDoc) {
      console.warn(
        `Document for ${employeeId}_${year}_${month} not found in Firestore.`
      );
      return;
    }

    // Delete the specific advance
    const updateData = {
      [`advances.${id}`]: deleteField(),
      "meta.lastModified": new Date().toISOString(),
    };

    await updateDocument("cash_advances", docId, updateData, companyName);
  } catch (error) {
    console.error(`Error deleting cash advance from Firestore:`, error);
    throw error;
  }
}

/**
 * Get all cash advances across all months for an employee
 */
export async function getAllCashAdvancesForEmployeeFirestore(
  employeeId: string,
  companyName: string
): Promise<CashAdvance[]> {
  try {
    // Query all documents in the cash_advances collection that match the employeeId
    const conditions: [string, string, any][] = [
      ["meta.employeeId", "==", employeeId],
    ];

    const documents = await queryCollection<CashAdvanceFirestoreData>(
      "cash_advances",
      conditions,
      companyName
    );

    // Extract advances from all documents
    const allAdvances: CashAdvance[] = [];

    documents.forEach((doc) => {
      if (doc.advances) {
        const advances = Object.entries(doc.advances).map(([id, advance]) => ({
          id,
          employeeId: advance.employeeId,
          date: new Date(advance.date),
          amount: advance.amount,
          remainingUnpaid: advance.remainingUnpaid,
          reason: advance.reason,
          approvalStatus: advance.approvalStatus,
          status: advance.status,
          paymentSchedule: advance.paymentSchedule,
          installmentDetails: advance.installmentDetails,
        }));

        allAdvances.push(...advances);
      }
    });

    return allAdvances;
  } catch (error) {
    console.error(`Error loading all cash advances from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Create a Firestore instance for the cash advance model
 */
export function createCashAdvanceFirestoreInstance(model: CashAdvanceModel) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        // Load all cash advances from the model
        const advances = await model.loadCashAdvances(model.employeeId);
        onProgress?.("Starting cash advance sync to Firestore...");

        // Group advances by year and month
        const advancesByMonth = advances.reduce(
          (acc: Record<string, CashAdvance[]>, advance: CashAdvance) => {
            const year = advance.date.getFullYear();
            const month = advance.date.getMonth() + 1;
            const key = `${year}_${month}`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(advance);
            return acc;
          },
          {}
        );

        // Process each month's advances
        const months = Object.keys(advancesByMonth);
        for (let i = 0; i < months.length; i++) {
          const [year, month] = months[i].split("_");
          const monthAdvances = advancesByMonth[months[i]];

          onProgress?.(
            `Processing cash advances for ${year}-${month} (${i + 1}/${
              months.length
            })`
          );

          // Save each advance individually
          for (const advance of monthAdvances) {
            await saveCashAdvanceFirestore(
              advance,
              parseInt(month),
              parseInt(year),
              await getCompanyName()
            );
          }
        }

        onProgress?.("Cash advance sync to Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing cash advances to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting cash advance sync from Firestore...");
        const companyName = await getCompanyName();

        // Query all cash advance documents for this employee
        const conditions: [string, string, any][] = [
          ["meta.employeeId", "==", model.employeeId],
        ];

        const docs = await queryCollection<CashAdvanceFirestoreData>(
          "cash_advances",
          conditions,
          companyName
        );

        if (!docs || docs.length === 0) {
          onProgress?.("No cash advances found in Firestore.");
          return;
        }

        onProgress?.(
          `Found ${docs.length} cash advance documents in Firestore.`
        );

        // Process each document
        let totalAdvances = 0;
        for (const doc of docs) {
          if (!doc.advances) {
            console.warn(
              `Invalid document structure in ${doc.meta?.year}-${doc.meta?.month}`
            );
            continue;
          }

          const advances = Object.entries(doc.advances).map(
            ([id, advance]) => ({
              id,
              employeeId: advance.employeeId,
              date: new Date(advance.date),
              amount: advance.amount,
              remainingUnpaid: advance.remainingUnpaid,
              reason: advance.reason,
              approvalStatus: advance.approvalStatus,
              status: advance.status,
              paymentSchedule: advance.paymentSchedule,
              installmentDetails: advance.installmentDetails,
            })
          );

          onProgress?.(
            `Processing ${advances.length} advances for ${doc.meta?.year}-${doc.meta?.month}`
          );

          // Save each advance individually
          for (const advance of advances) {
            await model.createCashAdvance(advance);
            totalAdvances++;
          }
        }

        onProgress?.(
          `Cash advance sync from Firestore completed successfully. Processed ${totalAdvances} advances.`
        );
      } catch (error) {
        console.error("Error syncing cash advances from Firestore:", error);
        throw new Error("Failed to sync cash advances from Firestore");
      }
    },
  };
}
