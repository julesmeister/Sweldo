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
      try {
        // Load all leaves from the model
        const leaves = await model.loadLeaves("", 0, 0); // Empty employeeId and 0 for year/month to get all leaves
        onProgress?.("Starting leave sync to Firestore...");

        // Group leaves by employee, year, and month
        const leavesByEmployeeMonth = leaves.reduce(
          (acc: Record<string, Leave[]>, leave: Leave) => {
            const year = leave.startDate.getFullYear();
            const month = leave.startDate.getMonth() + 1;
            const key = `${leave.employeeId}_${year}_${month}`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(leave);
            return acc;
          },
          {}
        );

        // Process each employee's leaves by month
        const employeeMonths = Object.keys(leavesByEmployeeMonth);
        for (let i = 0; i < employeeMonths.length; i++) {
          const [employeeId, year, month] = employeeMonths[i].split("_");
          const monthLeaves = leavesByEmployeeMonth[employeeMonths[i]];

          onProgress?.(
            `Processing leaves for employee ${employeeId} (${year}-${month}) (${
              i + 1
            }/${employeeMonths.length})`
          );

          // Create a document for this employee's leaves in this month
          const docId = createLeaveDocId(
            employeeId,
            parseInt(year),
            parseInt(month)
          );
          const companyName = await getCompanyName();

          const leaveData: LeaveFirestoreData = {
            meta: {
              employeeId,
              year: parseInt(year),
              month: parseInt(month),
              lastModified: new Date().toISOString(),
            },
            leaves: {},
          };

          // Add each leave to the document
          for (const leave of monthLeaves) {
            leaveData.leaves[leave.id] = {
              employeeId: leave.employeeId,
              startDate: leave.startDate.toISOString(),
              endDate: leave.endDate.toISOString(),
              type: leave.type,
              status: leave.status,
              reason: leave.reason,
            };
          }

          // Save the document
          await saveDocument("leaves", docId, leaveData, companyName);
        }

        onProgress?.("Leave sync to Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing leaves to Firestore:", error);
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
