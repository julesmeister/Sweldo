/**
 * Firestore implementation for loan-related operations
 *
 * This module provides Firestore implementations for all loan-related
 * operations that mirror the local filesystem operations in loan.ts.
 */

import { Loan, LoanModel, Deduction, StoredDeduction } from "./loan";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  queryCollection,
  getCompanyName,
} from "../lib/firestoreService";
import { Timestamp } from "firebase/firestore";

// Re-define Deduction structure for Firestore, dates as string or Timestamp for flexibility
// StoredDeduction from loan.ts uses string. Firestore might use Timestamp or string.
interface FirestoreDeduction {
  amountDeducted: number;
  dateDeducted: string | Timestamp; // Store as ISO string or allow Timestamp
  payrollId?: string;
  notes?: string;
}

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
      // Represents a stored loan in Firestore
      employeeId: string;
      date: string | Timestamp; // Allow ISO string or Timestamp
      amount: number;
      type: "Personal" | "PagIbig" | "SSS" | "Other";
      status: "Pending" | "Approved" | "Rejected" | "Completed";
      remainingBalance: number;
      deductions?: Record<string, FirestoreDeduction>; // Added
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
 * Parse date strings or Timestamps from Firestore to Date objects
 */
export const parseDate = (
  dateInput: string | Timestamp | { seconds: number; nanoseconds: number }
): Date => {
  if (typeof dateInput === "string") {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date string provided to parseDate: "${dateInput}"`);
      // throw new Error(`Invalid date string provided: "${dateInput}"`);
      return new Date(); // Fallback to current date or handle error as preferred
    }
    return date;
  } else if (dateInput instanceof Timestamp) {
    return dateInput.toDate();
  } else if (dateInput && typeof (dateInput as any).seconds === "number") {
    // Handling plain objects that look like Timestamps (e.g., from JSON serialization)
    return new Date((dateInput as any).seconds * 1000);
  } else {
    console.warn(
      `Invalid date input for parseDate: ${JSON.stringify(dateInput)}`
    );
    // throw new Error(
    //   `Invalid date input. Expected string, Timestamp, or { seconds: number, ... }, but received: ${JSON.stringify(
    //     dateInput
    //   )}`
    // );
    return new Date(); // Fallback
  }
};

// Helper to parse deductions from Firestore format to in-memory format
const parseFirestoreDeductions = (
  firestoreDeductions?: Record<string, FirestoreDeduction>
): Record<string, Deduction> | undefined => {
  if (!firestoreDeductions) return undefined;
  const parsedDeductions: Record<string, Deduction> = {};
  for (const key in firestoreDeductions) {
    const fd = firestoreDeductions[key];
    parsedDeductions[key] = {
      ...fd,
      dateDeducted: parseDate(fd.dateDeducted),
    };
  }
  return parsedDeductions;
};

// Helper to convert in-memory deductions to Firestore storable format (ISO strings for dates)
const toFirestoreDeductions = (
  deductions?: Record<string, Deduction>
):
  | Record<
      string,
      {
        amountDeducted: number;
        dateDeducted: string;
        payrollId?: string;
        notes?: string;
      }
    >
  | undefined => {
  if (!deductions) return undefined;
  const firestoreReadyDeductions: Record<
    string,
    {
      amountDeducted: number;
      dateDeducted: string;
      payrollId?: string;
      notes?: string;
    }
  > = {};
  for (const key in deductions) {
    const d = deductions[key];
    firestoreReadyDeductions[key] = {
      ...d,
      dateDeducted: d.dateDeducted.toISOString(),
    };
  }
  return firestoreReadyDeductions;
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
    // console.log(`[LoanFirestore] Loading loans for employee ${employeeId}, ${year}-${month} in company ${companyName}`);
    const docId = createLoanDocId(employeeId, year, month);
    // console.log(`[LoanFirestore] Attempting to fetch document with ID: ${docId}`);

    let data = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    if (data && data.loans) {
      // console.log(`[LoanFirestore] Found specific document for ${year}-${month}`);
      const loans: Loan[] = Object.entries(data.loans).map(([id, loan]) => ({
        id,
        employeeId: loan.employeeId,
        date: parseDate(loan.date),
        amount: loan.amount,
        type: loan.type,
        status: loan.status,
        remainingBalance: loan.remainingBalance,
        deductions: parseFirestoreDeductions(loan.deductions),
      }));
      // console.log(`[LoanFirestore] Returning ${loans.length} loans from specific document`);
      return loans;
    }

    // console.log(`[LoanFirestore] Specific document not found. Querying all loan documents...`);
    const documents = await queryCollection<LoanFirestoreData>(
      "loans",
      [],
      companyName
    );
    // console.log(`[LoanFirestore] Found ${documents.length} total loan documents`);

    const employeeLoans: Loan[] = [];
    for (const doc of documents) {
      if (!doc.loans) continue;
      const docIdParts = doc.meta?.docId?.split("_");
      const isEmployeeDoc =
        docIdParts && docIdParts.length > 1 && docIdParts[1] === employeeId;
      const isMatchingDoc = doc.meta?.docId
        ? isEmployeeLoanDoc(doc.meta.docId, employeeId)
        : isEmployeeDoc;

      if (isMatchingDoc || doc.meta?.employeeId === employeeId) {
        Object.entries(doc.loans).forEach(([id, loan]) => {
          const loanDate = parseDate(loan.date);
          const loanMonth = loanDate.getMonth() + 1;
          const loanYear = loanDate.getFullYear();

          if (loanYear === year && loanMonth === month) {
            employeeLoans.push({
              id,
              employeeId: loan.employeeId,
              date: loanDate,
              amount: loan.amount,
              type: loan.type,
              status: loan.status,
              remainingBalance: loan.remainingBalance,
              deductions: parseFirestoreDeductions(loan.deductions),
            });
          }
        });
      }
    }
    // console.log(`[LoanFirestore] Found ${employeeLoans.length} loans for employee ${employeeId} in ${year}-${month} after filtering`);
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
    // console.log(`[LoanFirestore] Creating/updating loan with ID ${loan.id} in document ${docId}`);

    const existingDoc = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    const firestoreLoanData = {
      employeeId: loan.employeeId,
      date: loan.date.toISOString(), // Store as ISO string
      amount: loan.amount,
      type: loan.type,
      status: loan.status,
      remainingBalance: loan.remainingBalance,
      deductions: toFirestoreDeductions(loan.deductions),
    };

    if (!existingDoc) {
      const newDoc: LoanFirestoreData = {
        meta: {
          employeeId: loan.employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
          docId: docId,
        },
        loans: {
          [loan.id]: firestoreLoanData,
        },
      };
      // console.log(`[LoanFirestore] Creating new loan document: ${docId}`);
      await saveDocument("loans", docId, newDoc, companyName);
    } else {
      // console.log(`[LoanFirestore] Updating existing loan document: ${docId}`);
      const updatePayload: { [key: string]: any } = {
        [`loans.${loan.id}`]: firestoreLoanData,
        "meta.lastModified": new Date().toISOString(),
      };
      if (!existingDoc.meta?.docId) {
        updatePayload["meta.docId"] = docId;
      }
      await updateDocument("loans", docId, updatePayload, companyName);
    }
    // console.log(`[LoanFirestore] Successfully saved loan with ID ${loan.id}`);
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
  id: string, // loan ID to delete
  loan: Loan, // Loan object primarily for date to find the document
  companyName: string
): Promise<void> {
  try {
    const year = loan.date.getFullYear();
    const month = loan.date.getMonth() + 1;
    const docId = createLoanDocId(loan.employeeId, year, month);

    const existingDoc = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    if (!existingDoc || !existingDoc.loans || !existingDoc.loans[id]) {
      console.log(
        `[LoanFirestore] Loan ID ${id} not found in document ${docId} for deletion.`
      );
      return;
    }

    const updateData = {
      [`loans.${id}`]: deleteField(),
      "meta.lastModified": new Date().toISOString(),
    };

    await updateDocument("loans", docId, updateData, companyName);
    // console.log(`[LoanFirestore] Successfully deleted loan ID ${id} from document ${docId}`);
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
    const conditions: [string, string, any][] = [
      ["meta.employeeId", "==", employeeId],
    ];

    const documents = await queryCollection<LoanFirestoreData>(
      "loans",
      conditions,
      companyName
    );

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
          remainingBalance: loan.remainingBalance,
          deductions: parseFirestoreDeductions(loan.deductions),
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
    const allLoans = await loadAllLoansForEmployeeFirestore(
      employeeId,
      companyName
    );
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
          const errorMsg = "Critical - Company name not found for loan sync.";
          console.error(`[LoanFirestore] syncToFirestore: ${errorMsg}`);
          onProgress?.(`Error: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        const allLocalLoans = await model.loadAllLoansForSync(); // This now returns Loan[] with Deduction
        onProgress?.(
          `Loaded ${allLocalLoans.length} local loan records for sync.`
        );

        if (allLocalLoans.length === 0) {
          onProgress?.("No local loan data to sync.");
          return;
        }

        let processedCount = 0;
        for (const loan of allLocalLoans) {
          processedCount++;
          const progressMessage = `Syncing loan ID ${loan.id} for ${loan.employeeId} (${processedCount}/${allLocalLoans.length})`;
          onProgress?.(progressMessage);
          try {
            // createLoanFirestore expects Loan with Deduction, will convert to FirestoreDeduction internally
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
          const errorMsg =
            "Critical - Company name not found for loan sync from Firestore.";
          console.error(`[LoanFirestore] syncFromFirestore: ${errorMsg}`);
          onProgress?.(`Error: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        const documents = await queryCollection<LoanFirestoreData>(
          "loans",
          [], // Query all loan documents for the company
          companyName
        );

        if (!documents || documents.length === 0) {
          onProgress?.("No loans found in Firestore to sync locally.");
          return;
        }
        onProgress?.(
          `Retrieved ${documents.length} loan documents from Firestore.`
        );

        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (!doc.loans) continue;

          const loansFromDoc: Loan[] = Object.entries(doc.loans).map(
            ([id, loanData]) => ({
              id,
              employeeId: loanData.employeeId,
              date: parseDate(loanData.date),
              amount: loanData.amount,
              type: loanData.type,
              status: loanData.status,
              remainingBalance: loanData.remainingBalance,
              deductions: parseFirestoreDeductions(loanData.deductions),
            })
          );

          onProgress?.(
            `Processing doc ${i + 1}/${documents.length} (Emp: ${
              doc.meta.employeeId
            }, ${doc.meta.year}-${doc.meta.month}) with ${
              loansFromDoc.length
            } loans`
          );

          for (const loan of loansFromDoc) {
            try {
              // model.createLoan expects Loan with Deduction, which is what we have
              await model.createLoan(loan);
            } catch (error) {
              const errorMsg = `Error saving loan ID ${
                loan.id
              } locally from Firestore sync: ${
                error instanceof Error ? error.message : String(error)
              }`;
              console.error(
                `[LoanFirestore] syncFromFirestore: ${errorMsg}`,
                error
              );
              onProgress?.(errorMsg);
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
    // This case should ideally not be hit if types are correct,
    // but as a safeguard if a non-Date, non-null/undefined value is passed.
    console.warn("Invalid date format passed to toFirestoreDate:", date);
    // throw new Error("Invalid date format");
    return null; // Or handle as appropriate for your application logic
  }
};
