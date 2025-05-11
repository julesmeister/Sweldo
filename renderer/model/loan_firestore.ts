/**
 * Firestore implementation for loan-related operations
 *
 * This module provides Firestore implementations for all loan-related
 * operations that mirror the local filesystem operations in loan.ts.
 */

import { Loan, LoanModel } from "./loan";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  createTimeBasedDocId,
  queryCollection,
  getCompanyName,
} from "../lib/firestoreService";
import { Timestamp } from "firebase/firestore";

/**
 * Firestore structure for loans document
 */
interface LoanFirestoreData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
    docId?: string;
  };
  loans: {
    [id: string]: {
      employeeId: string;
      date: string;
      amount: number;
      type: "Personal" | "Housing" | "Emergency" | "Other";
      status: "Pending" | "Approved" | "Rejected" | "Completed";
      interestRate: number;
      term: number;
      monthlyPayment: number;
      remainingBalance: number;
      nextPaymentDate: string;
      reason: string;
    };
  };
}

/**
 * Creates a loan document ID for a specific employee, year, and month
 */
const createLoanDocId = (
  employeeId: string,
  year: number,
  month: number
): string => {
  return `loan_${employeeId}_${year}_${month}`;
};

/**
 * Helper function to check if a document ID matches the loan pattern for a given employee
 */
const isEmployeeLoanDoc = (docId: string, employeeId: string): boolean => {
  // Check if docId matches pattern: loan_{employeeId}_{year}_{month}
  const pattern = new RegExp(`^loan_${employeeId}_\\d+_\\d+$`);
  return pattern.test(docId);
};

/**
 * Parse date strings from Firestore to Date objects
 * This handles different date formats consistently
 */
export const parseDate = (
  dateStr: string | { seconds: number; nanoseconds: number }
): Date => {
  if (typeof dateStr === "string") {
    const date = new Date(dateStr);
    // Check if the parsed date string is a valid date
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date string provided: "${dateStr}"`);
    }
    return date;
  } else {
    // At this point, TypeScript should know that dateStr is of type { seconds: number, nanoseconds: number }
    // We assign it to a new variable for clarity, though it's not strictly necessary.
    const timestampObject = dateStr;

    // Perform runtime checks to ensure the object structure is as expected,
    // even though types should guarantee this at compile time.
    if (timestampObject && typeof timestampObject.seconds === "number") {
      return new Date(timestampObject.seconds * 1000);
    } else {
      // This block would be hit if dateStr, despite not being a string,
      // doesn't conform to the expected { seconds: number, ... } structure.
      throw new Error(
        `Invalid Firestore Timestamp-like object. Expected { seconds: number, ... }, but received: ${JSON.stringify(
          timestampObject
        )}`
      );
    }
  }
  // Original code had a throw statement here after the else-if.
  // The structure above ensures that all paths either return a Date or throw an error,
  // so a fallback throw here should be unreachable if the input strictly matches the type signature.
};

/**
 * Load loans for a specific year and month from Firestore
 */
export async function loadLoansFirestore(
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<Loan[]> {
  try {
    console.log(
      `[LoanFirestore] Loading loans for employee ${employeeId}, ${year}-${month} in company ${companyName}`
    );

    // First try to load the specific month's document
    const docId = createLoanDocId(employeeId, year, month);
    console.log(
      `[LoanFirestore] Attempting to fetch document with ID: ${docId}`
    );

    let data = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    // If the specific document is found, extract loans
    if (data && data.loans) {
      console.log(
        `[LoanFirestore] Found specific document for ${year}-${month}`
      );

      // Convert to Loan array
      const loans: Loan[] = Object.entries(data.loans).map(([id, loan]) => ({
        id,
        employeeId: loan.employeeId,
        date: parseDate(loan.date),
        amount: loan.amount,
        type: loan.type,
        status: loan.status,
        interestRate: loan.interestRate,
        term: loan.term,
        monthlyPayment: loan.monthlyPayment,
        remainingBalance: loan.remainingBalance,
        nextPaymentDate: parseDate(loan.nextPaymentDate),
        reason: loan.reason,
      }));

      console.log(
        `[LoanFirestore] Returning ${loans.length} loans from specific document`
      );
      return loans;
    }

    // If specific document is not found, query all documents and filter by employee
    console.log(
      `[LoanFirestore] Specific document not found. Querying all loan documents...`
    );

    // Query all documents in the loans collection
    const documents = await queryCollection<LoanFirestoreData>(
      "loans",
      [],
      companyName
    );

    console.log(
      `[LoanFirestore] Found ${documents.length} total loan documents`
    );

    // Filter documents for the specific employee
    const employeeLoans: Loan[] = [];

    for (const doc of documents) {
      // Skip documents that don't have loans data
      if (!doc.loans) continue;

      // Extract document ID to check if it belongs to this employee
      const docIdParts = doc.meta?.docId?.split("_");
      const isEmployeeDoc =
        docIdParts && docIdParts.length > 1 && docIdParts[1] === employeeId;

      // If document ID format is unknown, check using regex pattern
      const isMatchingDoc = doc.meta?.docId
        ? isEmployeeLoanDoc(doc.meta.docId, employeeId)
        : isEmployeeDoc;

      if (isMatchingDoc || doc.meta?.employeeId === employeeId) {
        // Extract loans for this employee from the document
        Object.entries(doc.loans).forEach(([id, loan]) => {
          // Check if the loan is for the requested month/year
          const loanDate = parseDate(loan.date);
          const loanMonth = loanDate.getMonth() + 1; // Convert to 1-based
          const loanYear = loanDate.getFullYear();

          if (loanYear === year && loanMonth === month) {
            employeeLoans.push({
              id,
              employeeId: loan.employeeId,
              date: loanDate,
              amount: loan.amount,
              type: loan.type,
              status: loan.status,
              interestRate: loan.interestRate,
              term: loan.term,
              monthlyPayment: loan.monthlyPayment,
              remainingBalance: loan.remainingBalance,
              nextPaymentDate: parseDate(loan.nextPaymentDate),
              reason: loan.reason,
            });
          }
        });
      }
    }

    console.log(
      `[LoanFirestore] Found ${employeeLoans.length} loans for employee ${employeeId} in ${year}-${month} after filtering`
    );
    return employeeLoans;
  } catch (error) {
    console.error(
      `[LoanFirestore] Error loading loans from Firestore for emp ${employeeId}, ${year}-${month}:`,
      error
    );
    return [];
  }
}

/**
 * Create a new loan in Firestore
 */
export async function createLoanFirestore(
  loan: Loan,
  companyName: string
): Promise<void> {
  try {
    const year = loan.date.getFullYear();
    const month = loan.date.getMonth() + 1;
    const docId = createLoanDocId(loan.employeeId, year, month);

    console.log(
      `[LoanFirestore] Creating/updating loan with ID ${loan.id} in document ${docId}`
    );

    // First check if document exists
    const existingDoc = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    if (!existingDoc) {
      // Create new document if it doesn't exist
      const newDoc: LoanFirestoreData = {
        meta: {
          employeeId: loan.employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
          docId: docId, // Include the docId in meta for easier retrieval
        },
        loans: {
          [loan.id]: {
            employeeId: loan.employeeId,
            date: loan.date.toISOString(),
            amount: loan.amount,
            type: loan.type,
            status: loan.status,
            interestRate: loan.interestRate,
            term: loan.term,
            monthlyPayment: loan.monthlyPayment,
            remainingBalance: loan.remainingBalance,
            nextPaymentDate: loan.nextPaymentDate.toISOString(),
            reason: loan.reason,
          },
        },
      };

      console.log(`[LoanFirestore] Creating new loan document: ${docId}`);
      await saveDocument("loans", docId, newDoc, companyName);
    } else {
      // Update existing document to add the new loan
      console.log(`[LoanFirestore] Updating existing loan document: ${docId}`);

      const loanData = {
        [`loans.${loan.id}`]: {
          employeeId: loan.employeeId,
          date: loan.date.toISOString(),
          amount: loan.amount,
          type: loan.type,
          status: loan.status,
          interestRate: loan.interestRate,
          term: loan.term,
          monthlyPayment: loan.monthlyPayment,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate: loan.nextPaymentDate.toISOString(),
          reason: loan.reason,
        },
        "meta.lastModified": new Date().toISOString(),
      };

      // Ensure docId is included in meta
      if (!existingDoc.meta?.docId) {
        loanData["meta.docId"] = docId;
      }

      await updateDocument("loans", docId, loanData, companyName);
    }
    console.log(`[LoanFirestore] Successfully saved loan with ID ${loan.id}`);
  } catch (error) {
    console.error(
      `[LoanFirestore] Error creating/updating loan in Firestore (ID: ${loan.id}):`,
      error
    );
    throw error;
  }
}

/**
 * Update a loan in Firestore
 */
export async function updateLoanFirestore(
  loan: Loan,
  companyName: string
): Promise<void> {
  try {
    // This essentially calls createLoanFirestore which handles both create and update via replacement of the loan map entry.
    await createLoanFirestore(loan, companyName);
  } catch (error) {
    console.error(
      `[LoanFirestore] Error updating loan in Firestore (ID: ${loan.id}) - (invoked createLoanFirestore):`,
      error
    );
    throw error;
  }
}

/**
 * Delete a loan from Firestore
 */
export async function deleteLoanFirestore(
  id: string,
  loan: Loan,
  companyName: string
): Promise<void> {
  try {
    const year = loan.date.getFullYear();
    const month = loan.date.getMonth() + 1;
    const docId = createLoanDocId(loan.employeeId, year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    if (!existingDoc) {
      return; // Nothing to delete
    }

    // Update the document to remove the specific loan
    const updateData = {
      [`loans.${id}`]: deleteField(),
      "meta.lastModified": new Date().toISOString(),
    };

    await updateDocument("loans", docId, updateData, companyName);
  } catch (error) {
    console.error(
      `[LoanFirestore] Error deleting loan from Firestore (ID: ${id}):`,
      error
    );
    throw error;
  }
}

/**
 * Load all loans for an employee (across all months)
 */
export async function loadAllLoansForEmployeeFirestore(
  employeeId: string,
  companyName: string
): Promise<Loan[]> {
  try {
    // Query all documents in the loans collection that match the employeeId
    const conditions: [string, string, any][] = [
      ["meta.employeeId", "==", employeeId],
    ];

    const documents = await queryCollection<LoanFirestoreData>(
      "loans",
      conditions,
      companyName
    );

    // Extract loans from all documents
    const allLoans: Loan[] = [];

    documents.forEach((doc) => {
      if (doc.loans) {
        const loans = Object.entries(doc.loans).map(([id, loan]) => ({
          id,
          employeeId: loan.employeeId,
          date: parseDate(loan.date),
          amount: loan.amount,
          type: loan.type,
          status: loan.status,
          interestRate: loan.interestRate,
          term: loan.term,
          monthlyPayment: loan.monthlyPayment,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate: parseDate(loan.nextPaymentDate),
          reason: loan.reason,
        }));

        allLoans.push(...loans);
      }
    });

    return allLoans;
  } catch (error) {
    console.error(
      `[LoanFirestore] Error loading all loans for employee ${employeeId} from Firestore:`,
      error
    );
    return [];
  }
}

/**
 * Load active loans for an employee
 */
export async function loadActiveLoansFirestore(
  employeeId: string,
  companyName: string
): Promise<Loan[]> {
  try {
    // First load all loans for the employee
    const allLoans = await loadAllLoansForEmployeeFirestore(
      employeeId,
      companyName
    );

    // Filter to only include active loans (not Completed or Rejected)
    return allLoans.filter(
      (loan) => loan.status !== "Completed" && loan.status !== "Rejected"
    );
  } catch (error) {
    console.error(
      `[LoanFirestore] Error loading active loans for employee ${employeeId} from Firestore:`,
      error
    );
    return [];
  }
}

/**
 * Create a Firestore instance for the loan model
 */
export function createLoanFirestoreInstance(model: LoanModel) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      onProgress?.("Starting loan sync to Firestore...");
      try {
        const companyName = await getCompanyName();
        if (!companyName) {
          console.error(
            "[LoanFirestore] syncToFirestore: Critical - Company name not found for loan sync."
          );
          onProgress?.("Error: Company name not found for loan sync.");
          throw new Error("Company name not found for loan sync.");
        }

        const allLoans = await model.loadAllLoansForSync();
        onProgress?.(`Loaded ${allLoans.length} local loan records for sync.`);

        if (allLoans.length === 0) {
          onProgress?.("No local loan data to sync.");
          return;
        }

        let processedCount = 0;
        const totalToProcess = allLoans.length;

        for (const loan of allLoans) {
          processedCount++;
          const progressMessage = `Syncing loan ID ${loan.id} for ${loan.employeeId} (${processedCount}/${totalToProcess})`;
          onProgress?.(progressMessage);
          try {
            await createLoanFirestore(loan, companyName);
          } catch (loanSyncError) {
            const errorMsg = `Error syncing loan ID ${loan.id} for emp ${
              loan.employeeId
            }: ${
              loanSyncError instanceof Error
                ? loanSyncError.message
                : String(loanSyncError)
            }`;
            console.error(
              `[LoanFirestore] syncToFirestore: ${errorMsg}`,
              loanSyncError
            );
            onProgress?.(errorMsg);
          }
        }
        onProgress?.("Loan sync to Firestore completed.");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[LoanFirestore] syncToFirestore: Overall ERROR:", error);
        onProgress?.(`Overall error in loan sync: ${errorMsg}`);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      onProgress?.("Starting loan sync from Firestore...");
      try {
        const companyName = await getCompanyName();
        if (!companyName) {
          console.error(
            "[LoanFirestore] syncFromFirestore: Critical - Company name not found."
          );
          onProgress?.("Error: Company name not found.");
          throw new Error(
            "Company name not found for loan sync from Firestore."
          );
        }
        const conditions: [string, string, any][] = [];
        const documents = await queryCollection<LoanFirestoreData>(
          "loans",
          conditions,
          companyName
        );
        if (!documents || documents.length === 0) {
          onProgress?.("No loans found in Firestore.");
          return;
        }
        onProgress?.(
          `Retrieved ${documents.length} loan documents from Firestore.`
        );

        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (!doc.loans) continue;
          const loans = Object.entries(doc.loans).map(([id, loanData]) => ({
            id,
            employeeId: loanData.employeeId,
            date: parseDate(loanData.date),
            amount: loanData.amount,
            type: loanData.type,
            status: loanData.status,
            interestRate: loanData.interestRate,
            term: loanData.term,
            monthlyPayment: loanData.monthlyPayment,
            remainingBalance: loanData.remainingBalance,
            nextPaymentDate: parseDate(loanData.nextPaymentDate),
            reason: loanData.reason,
          }));
          onProgress?.(
            `Processing doc ${i + 1}/${documents.length} with ${
              loans.length
            } loans`
          );
          for (const loan of loans) {
            try {
              await model.createLoan(loan); // Using createLoan as it handles add/update logic for local file
            } catch (error) {
              console.error(
                `[LoanFirestore] Error saving loan ID ${loan.id} locally from Firestore sync:`,
                error
              );
              onProgress?.(
                `Error saving loan ID ${loan.id} locally: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }
        }
        onProgress?.("Loan sync from Firestore completed.");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          "[LoanFirestore] syncFromFirestore: Overall ERROR:",
          error
        );
        onProgress?.(`Overall error syncing loans from Firestore: ${errorMsg}`);
        throw error;
      }
    },
  };
}

export const toFirestoreDate = (
  date: Date | null | undefined
): Timestamp | null => {
  if (date instanceof Date) {
    return Timestamp.fromDate(date);
  } else if (date === null || date === undefined) {
    return null;
  } else {
    throw new Error("Invalid date format");
  }
};
