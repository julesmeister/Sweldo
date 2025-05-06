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
    console.error(
      `[LeaveFirestore] Error loading leaves from Firestore for emp ${employeeId}, ${year}-${month}:`,
      error
    );
    return [];
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
    console.error(
      `[LeaveFirestore] Error creating leave in Firestore (ID: ${leave.id}):`,
      error
    );
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
    console.error(
      `[LeaveFirestore] Error saving/updating leave in Firestore (ID: ${leave.id}):`,
      error
    );
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
    console.error(
      `[LeaveFirestore] Error deleting leave from Firestore (ID: ${id}):`,
      error
    );
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
      `[LeaveFirestore] Error loading all leaves for employee ${employeeId} from Firestore:`,
      error
    );
    return [];
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
    console.error(
      `[LeaveFirestore] Error loading leaves for date range for emp ${employeeId} from Firestore:`,
      error
    );
    return [];
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
      onProgress?.("Starting leave sync to Firestore...");
      try {
        const companyName = await getCompanyName();
        if (!companyName) {
          console.error(
            "[LeaveFirestore] syncToFirestore: Critical - Company name not found."
          );
          onProgress?.("Error: Company name not found for sync.");
          throw new Error("Company name not found for leave sync.");
        }

        const leaves = await model.loadAllLeavesForSync();
        onProgress?.(`Loaded ${leaves.length} local leave records.`);

        if (leaves.length === 0) {
          onProgress?.("No local leave data to sync.");
          return;
        }

        const leavesByEmployeeMonth = leaves.reduce(
          (acc: Record<string, Leave[]>, leave: Leave) => {
            const year = leave.startDate.getFullYear();
            const month = leave.startDate.getMonth() + 1;
            const key = `${leave.employeeId}_${year}_${month}`;
            if (isNaN(year) || isNaN(month)) {
              console.warn(
                `[LeaveFirestore] syncToFirestore: Invalid date for leave id ${leave.id}, employee ${leave.employeeId}. Key would be ${key}. Skipping for grouping.`
              );
              return acc;
            }
            if (!acc[key]) acc[key] = [];
            acc[key].push(leave);
            return acc;
          },
          {}
        );

        const employeeMonthKeys = Object.keys(leavesByEmployeeMonth);
        onProgress?.(
          `Grouped records into ${employeeMonthKeys.length} employee-month documents.`
        );

        for (let i = 0; i < employeeMonthKeys.length; i++) {
          const key = employeeMonthKeys[i];
          const parts = key.split("_");
          if (parts.length !== 3) {
            console.warn(
              `[LeaveFirestore] syncToFirestore: Invalid group key format '${key}'. Skipping.`
            );
            onProgress?.(`Skipping invalid group key: ${key}`);
            continue;
          }
          const [employeeId, yearStr, monthStr] = parts;
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);

          if (isNaN(year) || isNaN(month)) {
            console.warn(
              `[LeaveFirestore] syncToFirestore: Parsed NaN year/month from key '${key}'. Skipping.`
            );
            onProgress?.(
              `Skipping group with invalid year/month from key: ${key}`
            );
            continue;
          }

          const monthLeaves = leavesByEmployeeMonth[key];
          onProgress?.(
            `Processing ${
              monthLeaves.length
            } leaves for ${employeeId} (${year}-${month}) (${i + 1}/${
              employeeMonthKeys.length
            })`
          );

          const docId = createLeaveDocId(employeeId, year, month);

          const leaveDocData: LeaveFirestoreData = {
            meta: {
              employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            leaves: {},
          };

          for (const leave of monthLeaves) {
            if (!leave.id) {
              console.warn(
                `[LeaveFirestore] syncToFirestore: Skipping leave with missing ID for employee ${employeeId}, ${year}-${month}.`
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

          try {
            await saveDocument("leaves", docId, leaveDocData, companyName);
            onProgress?.(`Synced ${employeeId} (${year}-${month})`);
          } catch (docSaveError) {
            const errorMsg =
              docSaveError instanceof Error
                ? docSaveError.message
                : String(docSaveError);
            console.error(
              `[LeaveFirestore] syncToFirestore: ERROR saving doc ${docId} for emp ${employeeId}, ${year}-${month}:`,
              docSaveError
            );
            onProgress?.(
              `Error for ${employeeId} (${year}-${month}): ${errorMsg}`
            );
          }
        }
        onProgress?.("Leave sync to Firestore completed.");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          "[LeaveFirestore] syncToFirestore: Overall ERROR:",
          error
        );
        onProgress?.(`Overall error in leave sync: ${errorMsg}`);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      onProgress?.("Starting leave sync from Firestore...");
      try {
        const companyName = await getCompanyName();
        if (!companyName) {
          console.error(
            "[LeaveFirestore] syncFromFirestore: Critical - Company name not found."
          );
          onProgress?.("Error: Company name not found.");
          throw new Error(
            "Company name not found for leave sync from Firestore."
          );
        }
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
        onProgress?.(
          `Retrieved ${documents.length} leave documents from Firestore.`
        );
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          if (!doc.leaves) continue;
          const leaves = Object.entries(doc.leaves).map(([id, leaveData]) => ({
            id,
            employeeId: leaveData.employeeId,
            startDate: new Date(leaveData.startDate),
            endDate: new Date(leaveData.endDate),
            type: leaveData.type,
            status: leaveData.status,
            reason: leaveData.reason,
          }));
          onProgress?.(
            `Processing doc ${i + 1}/${documents.length} with ${
              leaves.length
            } leaves`
          );
          for (const leave of leaves) {
            try {
              await model.saveOrUpdateLeave(leave);
            } catch (error) {
              console.error(
                `[LeaveFirestore] Error saving leave ID ${leave.id} locally from Firestore sync:`,
                error
              );
              onProgress?.(
                `Error saving leave ID ${leave.id} locally: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }
        }
        onProgress?.("Leave sync from Firestore completed.");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          "[LeaveFirestore] syncFromFirestore: Overall ERROR:",
          error
        );
        onProgress?.(
          `Overall error syncing leaves from Firestore: ${errorMsg}`
        );
        throw error;
      }
    },
  };
}
