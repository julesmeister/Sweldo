/**
 * Firestore implementation for missing time operations
 *
 * This module provides Firestore implementations for all missing time related
 * operations that mirror the local filesystem operations in missingTime.ts.
 */

import { MissingTimeLog } from "./missingTime";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  createTimeBasedDocId,
} from "../lib/firestoreService";

/**
 * Firestore structure for missing time logs document
 */
interface MissingTimeFirestoreData {
  meta: {
    month: number;
    year: number;
    lastModified: string;
  };
  logs: MissingTimeLog[];
}

/**
 * Creates a missing time document ID for a specific year and month
 */
const createMissingTimeDocId = (year: number, month: number): string => {
  return `missing_time_${year}_${month}`;
};

/**
 * Load missing time logs for a specific month and year from Firestore
 */
export async function getMissingTimeLogsFirestore(
  month: number,
  year: number,
  companyName: string
): Promise<MissingTimeLog[]> {
  try {
    const docId = createMissingTimeDocId(year, month);
    const data = await fetchDocument<MissingTimeFirestoreData>(
      "missing_time_logs",
      docId,
      companyName
    );

    if (!data || !data.logs) {
      return [];
    }

    return data.logs;
  } catch (error) {
    console.error(`Error loading missing time logs from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Save a missing time log to Firestore
 */
export async function saveMissingTimeLogFirestore(
  log: MissingTimeLog,
  month: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createMissingTimeDocId(year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<MissingTimeFirestoreData>(
      "missing_time_logs",
      docId,
      companyName
    );

    if (!existingDoc) {
      // Create new document if it doesn't exist
      const newDoc: MissingTimeFirestoreData = {
        meta: {
          month,
          year,
          lastModified: new Date().toISOString(),
        },
        logs: [log],
      };

      await saveDocument("missing_time_logs", docId, newDoc, companyName);
    } else {
      // Check for duplicate before updating
      const exists = existingDoc.logs.some(
        (existingLog) =>
          existingLog.day === log.day &&
          existingLog.employeeId === log.employeeId &&
          existingLog.missingType === log.missingType
      );

      if (exists) {
        console.log(
          "Missing time log already exists in Firestore, skipping:",
          log
        );
        return;
      }

      // Add the new log to existing logs array
      const updatedLogs = [...existingDoc.logs, log];

      // Update document
      const updateData = {
        logs: updatedLogs,
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("missing_time_logs", docId, updateData, companyName);
    }
  } catch (error) {
    console.error(`Error saving missing time log to Firestore:`, error);
    throw error;
  }
}

/**
 * Delete a missing time log from Firestore
 */
export async function deleteMissingTimeLogFirestore(
  id: string,
  month: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createMissingTimeDocId(year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<MissingTimeFirestoreData>(
      "missing_time_logs",
      docId,
      companyName
    );

    if (!existingDoc) {
      console.warn(`Document for ${month}/${year} not found in Firestore.`);
      return;
    }

    // Filter out the log with the specified ID
    const updatedLogs = existingDoc.logs.filter((log) => log.id !== id);

    // Only update if we actually removed a log
    if (updatedLogs.length < existingDoc.logs.length) {
      const updateData = {
        logs: updatedLogs,
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("missing_time_logs", docId, updateData, companyName);
    } else {
      console.warn(`Log with ID ${id} not found in Firestore document.`);
    }
  } catch (error) {
    console.error(`Error deleting missing time log from Firestore:`, error);
    throw error;
  }
}

/**
 * Get all missing time logs across all months for an employee
 */
export async function getAllMissingTimeLogsForEmployeeFirestore(
  employeeId: string,
  companyName: string
): Promise<MissingTimeLog[]> {
  try {
    // We would need to list and query all documents in the missing_time_logs collection
    // This is a simplified implementation that assumes we know the current year
    // In a real implementation, we would use a query to find all relevant documents

    const allLogs: MissingTimeLog[] = [];
    const currentYear = new Date().getFullYear();

    // Query documents for the current year and previous year
    for (let year = currentYear - 1; year <= currentYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const logs = await getMissingTimeLogsFirestore(
          month,
          year,
          companyName
        );
        const employeeLogs = logs.filter(
          (log) => log.employeeId === employeeId
        );
        allLogs.push(...employeeLogs);
      }
    }

    return allLogs;
  } catch (error) {
    console.error(`Error loading all missing time logs from Firestore:`, error);
    return []; // Return empty array on error
  }
}
