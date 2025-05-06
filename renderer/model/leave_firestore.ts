/**
 * Firestore implementation for leave-related operations
 *
 * This module provides Firestore implementations for all leave-related
 * operations that mirror the local filesystem operations in leave.ts.
 */

import { Leave, LeaveModel } from "./leave";
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
 * Firestore structure for leaves document
 */
interface LeaveFirestoreData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  leaves: {
    [id: string]: {
      employeeId: string;
      startDate: string;
      endDate: string;
      type: "Sick" | "Vacation" | "Emergency" | "Other";
      status: "Pending" | "Approved" | "Rejected";
      reason: string;
    };
  };
}

/**
 * Creates a leave document ID for a specific employee, year, and month
 */
const createLeaveDocId = (
  employeeId: string,
  year: number,
  month: number
): string => {
  return createTimeBasedDocId(employeeId, year, month);
};

/**
 * Load leaves for a specific employee, year, and month from Firestore
 */
export async function loadLeavesFirestore(
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<Leave[]> {
  try {
    const docId = createLeaveDocId(employeeId, year, month);
    const data = await fetchDocument<LeaveFirestoreData>(
      "leaves",
      docId,
      companyName
    );

    if (!data || !data.leaves) {
      return [];
    }

    // Convert to Leave array
    const leaves: Leave[] = Object.entries(data.leaves).map(([id, leave]) => ({
      id,
      employeeId: leave.employeeId,
      startDate: new Date(leave.startDate),
      endDate: new Date(leave.endDate),
      type: leave.type,
      status: leave.status,
      reason: leave.reason,
    }));

    return leaves;
  } catch (error) {
    console.error(`Error loading leaves from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Create a new leave in Firestore
 */
export async function createLeaveFirestore(
  leave: Leave,
  companyName: string
): Promise<void> {
  try {
    await saveOrUpdateLeaveFirestore(leave, companyName);
  } catch (error) {
    console.error(`Error creating leave in Firestore:`, error);
    throw error;
  }
}

/**
 * Save or update a leave in Firestore
 */
export async function saveOrUpdateLeaveFirestore(
  leave: Leave,
  companyName: string
): Promise<void> {
  try {
    const year = leave.startDate.getFullYear();
    const month = leave.startDate.getMonth() + 1;
    const docId = createLeaveDocId(leave.employeeId, year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<LeaveFirestoreData>(
      "leaves",
      docId,
      companyName
    );

    if (!existingDoc) {
      // Create new document if it doesn't exist
      const newDoc: LeaveFirestoreData = {
        meta: {
          employeeId: leave.employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
        },
        leaves: {
          [leave.id]: {
            employeeId: leave.employeeId,
            startDate: leave.startDate.toISOString(),
            endDate: leave.endDate.toISOString(),
            type: leave.type,
            status: leave.status,
            reason: leave.reason,
          },
        },
      };

      await saveDocument("leaves", docId, newDoc, companyName);
    } else {
      // Update existing document
      const leaveData = {
        [`leaves.${leave.id}`]: {
          employeeId: leave.employeeId,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
          type: leave.type,
          status: leave.status,
          reason: leave.reason,
        },
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("leaves", docId, leaveData, companyName);
    }
  } catch (error) {
    console.error(`Error saving/updating leave in Firestore:`, error);
    throw error;
  }
}

/**
 * Delete a leave from Firestore
 */
export async function deleteLeaveFirestore(
  id: string,
  leave: Leave,
  companyName: string
): Promise<void> {
  try {
    const year = leave.startDate.getFullYear();
    const month = leave.startDate.getMonth() + 1;
    const docId = createLeaveDocId(leave.employeeId, year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<LeaveFirestoreData>(
      "leaves",
      docId,
      companyName
    );

    if (!existingDoc) {
      return; // Nothing to delete
    }

    // Update the document to remove the specific leave
    const updateData = {
      [`leaves.${id}`]: deleteField(),
      "meta.lastModified": new Date().toISOString(),
    };

    await updateDocument("leaves", docId, updateData, companyName);
  } catch (error) {
    console.error(`Error deleting leave from Firestore:`, error);
    throw error;
  }
}

/**
 * Load leaves for an employee across all months (useful for reports)
 */
export async function loadAllLeavesForEmployeeFirestore(
  employeeId: string,
  companyName: string
): Promise<Leave[]> {
  try {
    // Query all documents in the leaves collection that match the employeeId
    const conditions: [string, string, any][] = [
      ["meta.employeeId", "==", employeeId],
    ];

    const documents = await queryCollection<LeaveFirestoreData>(
      "leaves",
      conditions,
      companyName
    );

    // Extract leaves from all documents
    const allLeaves: Leave[] = [];

    documents.forEach((doc) => {
      if (doc.leaves) {
        const leaves = Object.entries(doc.leaves).map(([id, leave]) => ({
          id,
          employeeId: leave.employeeId,
          startDate: new Date(leave.startDate),
          endDate: new Date(leave.endDate),
          type: leave.type,
          status: leave.status,
          reason: leave.reason,
        }));

        allLeaves.push(...leaves);
      }
    });

    return allLeaves;
  } catch (error) {
    console.error(
      `Error loading all leaves for employee from Firestore:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Load leaves for a date range from Firestore
 */
export async function loadLeavesForDateRangeFirestore(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  companyName: string
): Promise<Leave[]> {
  try {
    // Get the year and month ranges we need to query
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;

    const allLeaves: Leave[] = [];

    // Query each month in the range
    for (let year = startYear; year <= endYear; year++) {
      // Determine month range for this year
      const firstMonth = year === startYear ? startMonth : 1;
      const lastMonth = year === endYear ? endMonth : 12;

      for (let month = firstMonth; month <= lastMonth; month++) {
        const monthLeaves = await loadLeavesFirestore(
          employeeId,
          year,
          month,
          companyName
        );

        // Filter leaves that fall within our date range
        const filteredLeaves = monthLeaves.filter(
          (leave) =>
            (leave.startDate >= startDate && leave.startDate <= endDate) ||
            (leave.endDate >= startDate && leave.endDate <= endDate) ||
            (leave.startDate <= startDate && leave.endDate >= endDate)
        );

        allLeaves.push(...filteredLeaves);
      }
    }

    return allLeaves;
  } catch (error) {
    console.error(`Error loading leaves for date range from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Create a Firestore instance for the leave model
 */
export function createLeaveFirestoreInstance(model: LeaveModel) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      console.log("[leave_firestore.ts] syncToFirestore: START");
      onProgress?.("Starting leave sync to Firestore...");
      try {
        const companyName = await getCompanyName(); // Moved companyName retrieval to the top
        if (!companyName) {
          console.error(
            "[leave_firestore.ts] syncToFirestore: ERROR - Company name not found."
          );
          onProgress?.("Error: Company name not found for sync.");
          throw new Error("Company name not found for leave sync.");
        }
        console.log(
          `[leave_firestore.ts] syncToFirestore: Company name: ${companyName}`
        );

        // Load all leaves from the model
        console.log(
          "[leave_firestore.ts] syncToFirestore: Attempting to load all local leaves via model.loadAllLeavesForSync()..."
        );
        const leaves = await model.loadAllLeavesForSync();
        console.log(
          `[leave_firestore.ts] syncToFirestore: Loaded ${leaves.length} local leave records for sync.`
        );
        onProgress?.(`Loaded ${leaves.length} local leave records for sync.`);

        if (leaves.length === 0) {
          console.log(
            "[leave_firestore.ts] syncToFirestore: No local leave data to sync."
          );
          onProgress?.("No local leave data to sync.");
          return;
        }

        // Group leaves by employee, year, and month
        console.log(
          "[leave_firestore.ts] syncToFirestore: Grouping leaves by employee, year, and month..."
        );
        const leavesByEmployeeMonth = leaves.reduce(
          (acc: Record<string, Leave[]>, leave: Leave) => {
            const year = leave.startDate.getFullYear();
            const month = leave.startDate.getMonth() + 1;
            const key = `${leave.employeeId}_${year}_${month}`;
            if (isNaN(year) || isNaN(month)) {
              console.warn(
                `[leave_firestore.ts] syncToFirestore: Invalid date for leave id ${leave.id}, employee ${leave.employeeId}. Key would be ${key}. Skipping this for grouping.`
              );
              return acc; // Skip entries with invalid dates
            }
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(leave);
            return acc;
          },
          {}
        );

        const employeeMonthKeys = Object.keys(leavesByEmployeeMonth);
        console.log(
          `[leave_firestore.ts] syncToFirestore: Grouped into ${
            employeeMonthKeys.length
          } employee-month documents. Keys: ${employeeMonthKeys.join(", ")}`
        );
        onProgress?.(
          `Grouped records into ${employeeMonthKeys.length} employee-month documents.`
        );

        // Process each employee's leaves by month
        for (let i = 0; i < employeeMonthKeys.length; i++) {
          const key = employeeMonthKeys[i];
          const parts = key.split("_");
          if (parts.length !== 3) {
            console.warn(
              `[leave_firestore.ts] syncToFirestore: Invalid group key format '${key}'. Skipping.`
            );
            onProgress?.(`Skipping invalid group key: ${key}`);
            continue;
          }
          const [employeeId, yearStr, monthStr] = parts;
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);

          if (isNaN(year) || isNaN(month)) {
            console.warn(
              `[leave_firestore.ts] syncToFirestore: Parsed NaN year/month from key '${key}'. employeeId: ${employeeId}, year: ${year}, month: ${month}. Skipping.`
            );
            onProgress?.(
              `Skipping group with invalid year/month from key: ${key}`
            );
            continue;
          }

          const monthLeaves = leavesByEmployeeMonth[key];
          console.log(
            `[leave_firestore.ts] syncToFirestore: Processing group ${key}: Employee ${employeeId}, ${year}-${month}. ${
              monthLeaves.length
            } leaves. (${i + 1}/${employeeMonthKeys.length})`
          );
          onProgress?.(
            `Processing leaves for employee ${employeeId} (${year}-${month}) (${
              i + 1
            }/${employeeMonthKeys.length})`
          );

          const docId = createLeaveDocId(employeeId, year, month);
          console.log(
            `[leave_firestore.ts] syncToFirestore: Generated docId: ${docId} for employee ${employeeId}, ${year}-${month}`
          );

          const leaveDocData: LeaveFirestoreData = {
            meta: {
              employeeId,
              year: year,
              month: month,
              lastModified: new Date().toISOString(),
            },
            leaves: {},
          };

          for (const leave of monthLeaves) {
            if (!leave.id) {
              console.warn(
                `[leave_firestore.ts] syncToFirestore: Skipping leave with missing ID for employee ${employeeId}, ${year}-${month}. Data:`,
                leave
              );
              continue;
            }
            leaveDocData.leaves[leave.id] = {
              employeeId: leave.employeeId,
              startDate: leave.startDate.toISOString(),
              endDate: leave.endDate.toISOString(),
              type: leave.type,
              status: leave.status,
              reason: leave.reason,
            };
          }
          console.log(
            `[leave_firestore.ts] syncToFirestore: Prepared docData for ${docId} with ${
              Object.keys(leaveDocData.leaves).length
            } leaves.`
          );

          try {
            console.log(
              `[leave_firestore.ts] syncToFirestore: Attempting to save document ${docId} for employee ${employeeId}, ${year}-${month}.`
            );
            await saveDocument("leaves", docId, leaveDocData, companyName);
            console.log(
              `[leave_firestore.ts] syncToFirestore: Successfully saved document ${docId}.`
            );
            onProgress?.(
              `Successfully synced leaves for ${employeeId} (${year}-${month})`
            );
          } catch (docSaveError) {
            console.error(
              `[leave_firestore.ts] syncToFirestore: ERROR saving document ${docId} for employee ${employeeId}, ${year}-${month}. Error:`,
              docSaveError
            );
            onProgress?.(
              `Error saving leaves for ${employeeId} (${year}-${month}): ${
                docSaveError instanceof Error
                  ? docSaveError.message
                  : String(docSaveError)
              }`
            );
            // Decide if one error should stop all: throw docSaveError; or continue with others
          }
        }

        console.log(
          "[leave_firestore.ts] syncToFirestore: END - Leave sync to Firestore completed."
        );
        onProgress?.("Leave sync to Firestore completed successfully.");
      } catch (error) {
        console.error(
          "[leave_firestore.ts] syncToFirestore: OVERALL ERROR - Error syncing leaves to Firestore:",
          error
        );
        onProgress?.(
          `Overall error in leave sync: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting leave sync from Firestore...");
        const companyName = await getCompanyName();

        // Query all documents in the leaves collection
        const conditions: [string, string, any][] = [];
        const documents = await queryCollection<LeaveFirestoreData>(
          "leaves",
          conditions,
          companyName
        );

        if (!documents || documents.length === 0) {
          onProgress?.("No leaves found in Firestore.");
          return;
        }

        onProgress?.(`Found ${documents.length} leave documents in Firestore.`);

        // Process each document
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (!doc.leaves) continue;

          const leaves = Object.entries(doc.leaves).map(([id, leave]) => ({
            id,
            employeeId: leave.employeeId,
            startDate: new Date(leave.startDate),
            endDate: new Date(leave.endDate),
            type: leave.type,
            status: leave.status,
            reason: leave.reason,
          }));

          onProgress?.(
            `Processing document ${i + 1}/${documents.length} with ${
              leaves.length
            } leaves`
          );

          // Save each leave
          for (const leave of leaves) {
            try {
              await model.saveOrUpdateLeave(leave);
            } catch (error) {
              console.error(`Error saving leave ${leave.id}:`, error);
              throw new Error("Failed to sync leaves from Firestore");
            }
          }
        }

        onProgress?.("Leave sync from Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing leaves from Firestore:", error);
        throw new Error("Failed to sync leaves from Firestore");
      }
    },
  };
}
