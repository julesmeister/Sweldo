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

/**
 * Firestore structure for loans document
 */
interface LoanFirestoreData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
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
  return createTimeBasedDocId(employeeId, year, month);
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
    const docId = createLoanDocId(employeeId, year, month);
    const data = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    if (!data || !data.loans) {
      return [];
    }

    // Convert to Loan array
    const loans: Loan[] = Object.entries(data.loans).map(([id, loan]) => ({
      id,
      employeeId: loan.employeeId,
      date: new Date(loan.date),
      amount: loan.amount,
      type: loan.type,
      status: loan.status,
      interestRate: loan.interestRate,
      term: loan.term,
      monthlyPayment: loan.monthlyPayment,
      remainingBalance: loan.remainingBalance,
      nextPaymentDate: new Date(loan.nextPaymentDate),
      reason: loan.reason,
    }));

    return loans;
  } catch (error) {
    console.error(`Error loading loans from Firestore:`, error);
    return []; // Return empty array on error
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

      await saveDocument("loans", docId, newDoc, companyName);
    } else {
      // Update existing document to add the new loan
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

      await updateDocument("loans", docId, loanData, companyName);
    }
  } catch (error) {
    console.error(`Error creating loan in Firestore:`, error);
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
    const year = loan.date.getFullYear();
    const month = loan.date.getMonth() + 1;
    const docId = createLoanDocId(loan.employeeId, year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<LoanFirestoreData>(
      "loans",
      docId,
      companyName
    );

    if (!existingDoc) {
      // If document doesn't exist, create it (should be rare in update case)
      await createLoanFirestore(loan, companyName);
    } else {
      // Update the loan in the existing document
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

      await updateDocument("loans", docId, loanData, companyName);
    }
  } catch (error) {
    console.error(`Error updating loan in Firestore:`, error);
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
    console.error(`Error deleting loan from Firestore:`, error);
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
          date: new Date(loan.date),
          amount: loan.amount,
          type: loan.type,
          status: loan.status,
          interestRate: loan.interestRate,
          term: loan.term,
          monthlyPayment: loan.monthlyPayment,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate: new Date(loan.nextPaymentDate),
          reason: loan.reason,
        }));

        allLoans.push(...loans);
      }
    });

    return allLoans;
  } catch (error) {
    console.error(
      `Error loading all loans for employee from Firestore:`,
      error
    );
    return []; // Return empty array on error
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
    console.error(`Error loading active loans from Firestore:`, error);
    return []; // Return empty array on error
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
      try {
        // Load all loans from the model
        const loans = await model.loadLoans(0, 0); // 0 for year/month to get all loans
        onProgress?.("Starting loan sync to Firestore...");

        // Group loans by employee, year, and month
        const loansByEmployeeMonth = loans.reduce(
          (acc: Record<string, Loan[]>, loan: Loan) => {
            const year = loan.date.getFullYear();
            const month = loan.date.getMonth() + 1;
            const key = `${loan.employeeId}_${year}_${month}`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(loan);
            return acc;
          },
          {}
        );

        // Process each employee's loans by month
        const employeeMonths = Object.keys(loansByEmployeeMonth);
        for (let i = 0; i < employeeMonths.length; i++) {
          const [employeeId, year, month] = employeeMonths[i].split("_");
          const monthLoans = loansByEmployeeMonth[employeeMonths[i]];

          onProgress?.(
            `Processing loans for employee ${employeeId} (${year}-${month}) (${
              i + 1
            }/${employeeMonths.length})`
          );

          // Save each loan individually
          for (const loan of monthLoans) {
            await createLoanFirestore(loan, await getCompanyName());
          }
        }

        onProgress?.("Loan sync to Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing loans to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting loan sync from Firestore...");
        const companyName = await getCompanyName();

        // Query all documents in the loans collection
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

        onProgress?.(`Found ${documents.length} loan documents in Firestore.`);

        // Process each document
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (!doc.loans) continue;

          const loans = Object.entries(doc.loans).map(([id, loan]) => ({
            id,
            employeeId: loan.employeeId,
            date: new Date(loan.date),
            amount: loan.amount,
            type: loan.type,
            status: loan.status,
            interestRate: loan.interestRate,
            term: loan.term,
            monthlyPayment: loan.monthlyPayment,
            remainingBalance: loan.remainingBalance,
            nextPaymentDate: new Date(loan.nextPaymentDate),
            reason: loan.reason,
          }));

          onProgress?.(
            `Processing document ${i + 1}/${documents.length} with ${
              loans.length
            } loans`
          );

          // Save each loan
          for (const loan of loans) {
            try {
              await model.createLoan(loan);
            } catch (error) {
              console.error(`Error saving loan ${loan.id}:`, error);
              throw new Error("Failed to sync loans from Firestore");
            }
          }
        }

        onProgress?.("Loan sync from Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing loans from Firestore:", error);
        throw new Error("Failed to sync loans from Firestore");
      }
    },
  };
}
