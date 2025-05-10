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
import { db } from "../lib/db";

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
      id: string;
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

// Type for queryCollection results
interface CashAdvanceRecord {
  id: string;
  employeeId: string;
  date: any; // Can be string or Firestore timestamp
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
 * Load cash advances for a specific employee from Firestore
 */
export async function loadCashAdvancesFirestore(
  employeeId: string,
  month: number,
  year: number,
  companyName: string
): Promise<CashAdvance[]> {
  console.log(
    `[DEBUG] loadCashAdvancesFirestore - Starting for employeeId: ${employeeId}, month: ${month}, year: ${year}, company: ${companyName}`
  );

  try {
    // Create a document ID using the same format as in syncToFirestore
    const docId = createCashAdvanceDocId(employeeId, year, month);

    console.log(
      `[DEBUG] loadCashAdvancesFirestore - Looking for document with ID: ${docId} in collection cash-advances`
    );

    // First try to get the document directly
    try {
      const doc = await fetchDocument<CashAdvanceFirestoreData>(
        "cash-advances",
        docId,
        companyName
      );

      if (doc) {
        console.log(
          `[DEBUG] loadCashAdvancesFirestore - Found document with ${
            Object.keys(doc.advances || {}).length
          } advances`
        );

        // Convert the document to CashAdvance objects
        const advances: CashAdvance[] = Object.values(doc.advances || {})
          .map((advance) => {
            try {
              const date = new Date(advance.date);

              if (isNaN(date.getTime())) {
                console.log(
                  `[DEBUG] loadCashAdvancesFirestore - Skip invalid date: ${advance.date}`
                );
                return null;
              }

              // Only return advances for the specified employee that are approved
              if (
                advance.employeeId === employeeId &&
                advance.approvalStatus === "Approved"
              ) {
                return {
                  ...advance,
                  date,
                  // Ensure numeric values
                  amount: Number(advance.amount),
                  remainingUnpaid: Number(
                    advance.remainingUnpaid || advance.amount
                  ),
                } as CashAdvance;
              }
              return null;
            } catch (error) {
              console.error(
                `[DEBUG] loadCashAdvancesFirestore - Error parsing advance: ${error}`
              );
              return null;
            }
          })
          .filter((advance): advance is CashAdvance => advance !== null);

        console.log(
          `[DEBUG] loadCashAdvancesFirestore - Returning ${advances.length} advances from document`
        );
        return advances;
      } else {
        console.log(
          `[DEBUG] loadCashAdvancesFirestore - No document found with ID: ${docId}`
        );
      }
    } catch (error) {
      console.log(
        `[DEBUG] loadCashAdvancesFirestore - Error getting document: ${error}`
      );
    }

    // If document not found, try querying for individual cash advance documents
    console.log(
      `[DEBUG] loadCashAdvancesFirestore - Trying collection query for employeeId: ${employeeId}`
    );

    // Use the correct query format
    const results = await queryCollection<CashAdvanceRecord>(
      "cash-advances",
      [
        ["employeeId", "==", employeeId],
        ["year", "==", year],
        ["month", "==", month],
        ["approvalStatus", "==", "Approved"],
      ],
      companyName
    );

    console.log(
      `[DEBUG] loadCashAdvancesFirestore - Query returned ${results.length} documents`
    );

    // Convert the Firestore documents to CashAdvance objects
    const advances: CashAdvance[] = results
      .map((result) => {
        try {
          // Parse date from timestamp or string
          let date: Date;
          if (
            result.date &&
            typeof result.date === "object" &&
            "toDate" in result.date
          ) {
            date = (result.date as any).toDate();
          } else if (typeof result.date === "string") {
            date = new Date(result.date as string);
          } else {
            date = new Date();
            console.log(
              `[DEBUG] loadCashAdvancesFirestore - Invalid date format: ${result.date}`
            );
          }

          return {
            id: result.id,
            employeeId: result.employeeId,
            date,
            amount: Number(result.amount),
            remainingUnpaid: Number(result.remainingUnpaid || result.amount),
            reason: result.reason,
            approvalStatus: result.approvalStatus,
            status: result.status || "Unpaid",
            paymentSchedule: result.paymentSchedule,
            installmentDetails: result.installmentDetails,
          } as CashAdvance;
        } catch (error) {
          console.error(
            `[DEBUG] loadCashAdvancesFirestore - Error parsing result: ${error}`
          );
          return null;
        }
      })
      .filter((advance): advance is CashAdvance => advance !== null);

    console.log(
      `[DEBUG] loadCashAdvancesFirestore - Final advances count: ${advances.length}`
    );
    return advances;
  } catch (error) {
    console.error("[DEBUG] loadCashAdvancesFirestore - Error:", error);
    throw new Error(`Failed to load cash advances: ${(error as any).message}`);
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
  console.log(
    `[DEBUG] saveCashAdvanceFirestore - Starting with advance ID: ${advance.id}, month: ${month}, year: ${year}`
  );
  try {
    const docId = createCashAdvanceDocId(advance.employeeId, year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<CashAdvanceFirestoreData>(
      "cash-advances",
      docId,
      companyName
    );

    if (!existingDoc) {
      // Create new document if it doesn't exist
      console.log(
        `[DEBUG] saveCashAdvanceFirestore - Creating new document for ID: ${docId}`
      );
      const newDoc: CashAdvanceFirestoreData = {
        meta: {
          employeeId: advance.employeeId,
          month,
          year,
          lastModified: new Date().toISOString(),
        },
        advances: {
          [advance.id]: {
            id: advance.id,
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

      await saveDocument("cash-advances", docId, newDoc, companyName);
    } else {
      // Update existing document
      console.log(
        `[DEBUG] saveCashAdvanceFirestore - Updating existing document for ID: ${docId}`
      );
      const updateData = {
        [`advances.${advance.id}`]: {
          id: advance.id,
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

      await updateDocument("cash-advances", docId, updateData, companyName);
    }
    console.log(
      `[DEBUG] saveCashAdvanceFirestore - Successfully saved cash advance`
    );
  } catch (error) {
    console.error(`[DEBUG] Error saving cash advance to Firestore:`, error);
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
  console.log(
    `[DEBUG] deleteCashAdvanceFirestore - Starting with id: ${id}, employeeId: ${employeeId}`
  );
  try {
    const docId = createCashAdvanceDocId(employeeId, year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<CashAdvanceFirestoreData>(
      "cash-advances",
      docId,
      companyName
    );

    if (!existingDoc) {
      console.warn(
        `[DEBUG] Document for ${employeeId}_${year}_${month} not found in Firestore.`
      );
      return;
    }

    // Delete the specific advance
    const updateData = {
      [`advances.${id}`]: deleteField(),
      "meta.lastModified": new Date().toISOString(),
    };

    await updateDocument("cash-advances", docId, updateData, companyName);
    console.log(
      `[DEBUG] deleteCashAdvanceFirestore - Successfully deleted cash advance with ID: ${id}`
    );
  } catch (error) {
    console.error(`[DEBUG] Error deleting cash advance from Firestore:`, error);
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
  console.log(
    `[DEBUG] getAllCashAdvancesForEmployeeFirestore - Starting for employeeId: ${employeeId}`
  );
  try {
    // Fix query format
    const conditions: [string, string, any][] = [
      ["meta.employeeId", "==", employeeId],
    ];

    const documents = await queryCollection<CashAdvanceFirestoreData>(
      "cash-advances",
      conditions,
      companyName
    );

    console.log(
      `[DEBUG] getAllCashAdvancesForEmployeeFirestore - Found ${documents.length} documents`
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

    console.log(
      `[DEBUG] getAllCashAdvancesForEmployeeFirestore - Extracted ${allAdvances.length} total advances`
    );
    return allAdvances;
  } catch (error) {
    console.error(
      `[DEBUG] Error loading all cash advances from Firestore:`,
      error
    );
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
        // Note: We need to load all employees and their cash advances
        onProgress?.("Starting cash advance sync to Firestore...");

        const dbPath = model.filePath.split("/cashAdvances/")[0]; // Extract the base dbPath
        console.log(`[DEBUG] syncToFirestore - Using base dbPath: ${dbPath}`);

        // Try to find the company name from path or get it from the service
        let companyName: string;
        try {
          companyName = await getCompanyName();
          if (!companyName) throw new Error("Company name not found");
        } catch (error) {
          throw new Error(`Failed to determine company name: ${error}`);
        }

        // Year range to search (last 5 years plus 1 year ahead)
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);

        // Loop through potential employee IDs to check if those folders exist
        const employeeIds: string[] = [];
        for (let i = 1; i <= 100; i++) {
          const potentialEmployeeId = i.toString();
          const employeeFolder = `${dbPath}/cashAdvances/${potentialEmployeeId}`;

          try {
            // Check if this folder exists
            const exists = await window.electron.fileExists(employeeFolder);
            if (exists) {
              employeeIds.push(potentialEmployeeId);
              onProgress?.(`Found employee folder: ${potentialEmployeeId}`);
            }
          } catch (error) {
            // Folder doesn't exist, continue checking
          }
        }

        onProgress?.(`Found ${employeeIds.length} employee folders to process`);

        // Process each employee folder
        for (const employeeId of employeeIds) {
          const employeeFolder = `${dbPath}/cashAdvances/${employeeId}`;
          onProgress?.(`Processing employee ID: ${employeeId}`);

          // For each year, check all 12 months
          for (const year of years) {
            onProgress?.(`Searching for cash advances in year ${year}...`);

            for (let month = 1; month <= 12; month++) {
              // First check if JSON file exists (preferred)
              const jsonFilePath = `${employeeFolder}/${year}_${month}_cashAdvances.json`;
              onProgress?.(`Checking file: ${jsonFilePath}`);

              let jsonExists = false;
              let jsonData: string | null = null;

              try {
                jsonData = await window.electron.readFile(jsonFilePath);
                jsonExists = true;
              } catch (error) {
                // JSON file doesn't exist, try CSV
                jsonExists = false;
              }

              if (jsonExists && jsonData) {
                try {
                  const cashAdvanceData = JSON.parse(jsonData);
                  onProgress?.(
                    `Found JSON data with ${
                      Object.keys(cashAdvanceData.advances || {}).length
                    } cash advances`
                  );

                  // Save this directly to Firestore
                  const employeeAdvancesData: CashAdvanceFirestoreData = {
                    meta: {
                      employeeId, // Use actual employee ID instead of "all"
                      year,
                      month,
                      lastModified: new Date().toISOString(),
                    },
                    advances: cashAdvanceData.advances || {},
                  };

                  // Save document with appropriate ID format
                  const docId = createCashAdvanceDocId(employeeId, year, month);
                  await saveDocument(
                    "cash-advances",
                    docId,
                    employeeAdvancesData,
                    companyName
                  );

                  onProgress?.(
                    `Uploaded JSON data for employee ${employeeId}, ${year}-${month} to Firestore`
                  );
                } catch (error) {
                  onProgress?.(
                    `Error processing JSON file ${jsonFilePath}: ${error}`
                  );
                }

                continue; // Skip CSV checking if JSON was found
              }

              // Try CSV next if JSON wasn't found
              const csvFilePath = `${employeeFolder}/${year}_${month}_cashAdvances.csv`;
              onProgress?.(`Checking file: ${csvFilePath}`);

              let fileExists = false;
              try {
                fileExists = await window.electron.fileExists(csvFilePath);
              } catch (error) {
                console.log(
                  `[DEBUG] syncToFirestore - Error checking file: ${error}`
                );
              }

              if (fileExists) {
                try {
                  const csvData = await window.electron.readFile(csvFilePath);
                  const lines = csvData
                    .split("\n")
                    .filter((line) => line.trim());

                  // Check for header
                  const hasHeader = lines[0]
                    ?.toLowerCase()
                    .includes("id,employeeid,date,amount");
                  const dataStartIndex = hasHeader ? 1 : 0;

                  // Process the CSV data
                  const advancesData: CashAdvanceFirestoreData = {
                    meta: {
                      employeeId,
                      year,
                      month,
                      lastModified: new Date().toISOString(),
                    },
                    advances: {},
                  };

                  for (let i = dataStartIndex; i < lines.length; i++) {
                    const line = lines[i];
                    const fields = line.split(",");

                    if (fields.length < 5) continue;

                    const [
                      id,
                      advanceEmployeeId,
                      dateStr,
                      amountStr,
                      reason,
                      approvalStatus = "Pending",
                      paymentSchedule = "One-time",
                      status = "Unpaid",
                      remainingUnpaidStr = amountStr,
                    ] = fields;

                    try {
                      // Parse date (M/D/YYYY)
                      const [month, day, year] = dateStr.split("/").map(Number);
                      const date = new Date(year, month - 1, day);

                      if (isNaN(date.getTime())) {
                        onProgress?.(
                          `Skipping line with invalid date: ${dateStr}`
                        );
                        continue;
                      }

                      const amount = parseFloat(amountStr);
                      if (isNaN(amount)) {
                        onProgress?.(
                          `Skipping line with invalid amount: ${amountStr}`
                        );
                        continue;
                      }

                      const remainingUnpaid = parseFloat(remainingUnpaidStr);

                      // Add to our advances object
                      advancesData.advances[id] = {
                        id,
                        employeeId: advanceEmployeeId,
                        date: date.toISOString(),
                        amount,
                        remainingUnpaid: isNaN(remainingUnpaid)
                          ? amount
                          : remainingUnpaid,
                        reason,
                        approvalStatus: approvalStatus as
                          | "Pending"
                          | "Approved"
                          | "Rejected",
                        status: status as "Paid" | "Unpaid",
                        paymentSchedule: paymentSchedule as
                          | "One-time"
                          | "Installment",
                        installmentDetails:
                          paymentSchedule === "Installment"
                            ? {
                                numberOfPayments: 3,
                                amountPerPayment: Math.ceil(amount / 3),
                                remainingPayments: Math.ceil(
                                  (isNaN(remainingUnpaid)
                                    ? amount
                                    : remainingUnpaid) /
                                    (amount / 3)
                                ),
                              }
                            : undefined,
                      };
                    } catch (error) {
                      onProgress?.(`Error processing line: ${error}`);
                    }
                  }

                  // Only upload if we found advances
                  if (Object.keys(advancesData.advances).length > 0) {
                    // Save document with appropriate ID format
                    const docId = createCashAdvanceDocId(
                      employeeId,
                      year,
                      month
                    );
                    await saveDocument(
                      "cash-advances",
                      docId,
                      advancesData,
                      companyName
                    );

                    onProgress?.(
                      `Uploaded ${
                        Object.keys(advancesData.advances).length
                      } cash advances for employee ${employeeId}, ${year}-${month} to Firestore`
                    );
                  } else {
                    onProgress?.(
                      `No valid cash advances found for ${year}-${month}, skipping upload`
                    );
                  }
                } catch (error) {
                  onProgress?.(
                    `Error processing CSV file ${csvFilePath}: ${error}`
                  );
                }
              }
            }
          }
        }

        onProgress?.("Cash advance sync to Firestore completed successfully");
      } catch (error) {
        console.error("Cash advance sync error:", error);
        onProgress?.(`Error: ${error}`);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting cash advance sync from Firestore...");
        const companyName = await getCompanyName();

        // Query all cash advance documents (not just for a specific employee)
        const docs = await queryCollection<CashAdvanceFirestoreData>(
          "cash-advances",
          [], // No conditions = all documents
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
          if (!doc.advances || !doc.meta) {
            console.warn(`Invalid document structure in document`);
            continue;
          }

          const employeeId = doc.meta.employeeId;
          const year = doc.meta.year;
          const month = doc.meta.month;

          // Create a proper model for this specific employee/month/year
          const dbPath = model.filePath.split("/cashAdvances/")[0]; // Extract the base dbPath
          const specificModel = new CashAdvanceModel(
            `${dbPath}/cashAdvances/${employeeId}`,
            employeeId,
            month,
            year
          );

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
            `Processing ${advances.length} advances for employee ${employeeId}, ${year}-${month}`
          );

          // Save each advance individually with the specific model
          for (const advance of advances) {
            await specificModel.createCashAdvance(advance);
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
