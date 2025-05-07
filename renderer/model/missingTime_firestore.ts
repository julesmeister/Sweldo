/**
 * Firestore implementation for missing time operations
 *
 * This module provides Firestore implementations for all missing time related
 * operations that mirror the local filesystem operations in missingTime.ts.
 */

import { MissingTimeLog, MissingTimeModel } from "./missingTime";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  createTimeBasedDocId,
  getCompanyName,
  queryCollection,
  getFirestoreInstance,
} from "../lib/firestoreService";
import { db } from "../lib/db";
import { collection, getDocs } from "firebase/firestore";

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
    // Attempt to load from cache
    const cacheKey = [companyName, year, month] as const;
    const cachedRecords = await db.missingTimeLogs
      .where("[companyName+year+month]")
      .equals(cacheKey)
      .toArray();

    if (cachedRecords.length > 0) {
      return cachedRecords.map((rec) => rec.data);
    }

    // Cache miss, query Firestore
    const docId = createMissingTimeDocId(year, month);
    let data = await fetchDocument<MissingTimeFirestoreData>(
      "missing_time_logs",
      docId,
      companyName
    );

    // If no data found with the primary ID, try alternative patterns
    if (!data || !data.logs) {
      data = await tryAlternativeDocIds(
        "missing_time_logs",
        year,
        month,
        companyName
      );

      if (!data || !data.logs) {
        return [];
      }
    }

    // Store fetched logs in cache
    const logs = data.logs;
    const timestamp = Date.now();
    const records = logs.map((log) => ({
      companyName,
      year,
      month,
      id: log.id,
      timestamp,
      data: log,
    }));
    await db.missingTimeLogs.bulkPut(records);

    return logs;
  } catch (error) {
    console.error(`Error loading missing time logs from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Debugging: Try to find document by alternative naming patterns
 */
async function tryAlternativeDocIds(
  subcollection: string,
  year: number,
  month: number,
  companyName: string
): Promise<MissingTimeFirestoreData | null> {
  // Check document IDs with the format we see in Firestore
  const patterns = [
    `missing_time_${year}_${month}`,
    `missing_time_${year}_${month.toString().padStart(2, "0")}`,
    `missing_time_logs_${year}_${month}`,
    `missingtime${year}${month}`,
  ];

  // Also check if the collection path itself might be different
  const alternativeCollections = [
    subcollection,
    "missing_time",
    "missing_times",
  ];

  // First try to list documents in collections to find matches
  for (const collectionName of alternativeCollections) {
    try {
      const db = getFirestoreInstance();
      const collectionRef = collection(
        db,
        `companies/${companyName}/${collectionName}`
      );
      const querySnapshot = await getDocs(collectionRef);

      if (querySnapshot.empty) continue;

      const docIds: string[] = [];
      querySnapshot.forEach((doc) => {
        docIds.push(doc.id);
      });

      // Check for any ID that contains the year and month
      const yearMonthPattern = `${year}_${month}`;
      const matchingIds = docIds.filter((id) => id.includes(yearMonthPattern));

      if (matchingIds.length > 0) {
        // Try to fetch the first matching document
        const firstMatchId = matchingIds[0];
        const data = await fetchDocument<MissingTimeFirestoreData>(
          collectionName,
          firstMatchId,
          companyName
        );

        if (data && data.logs) {
          return data;
        }
      }
    } catch (error) {
      // Continue to next collection on error
    }
  }

  // If we didn't find any matching documents by listing,
  // try direct access with the patterns we defined
  for (const pattern of patterns) {
    try {
      const data = await fetchDocument<MissingTimeFirestoreData>(
        subcollection,
        pattern,
        companyName
      );

      if (data && data.logs) {
        return data;
      }
    } catch (error) {
      // Continue to next pattern on error
    }
  }

  return null;
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
  const docId = createMissingTimeDocId(year, month);
  try {
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
          `[Firestore] Missing time log already exists in Firestore document ${docId}, skipping:`,
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
  const docId = createMissingTimeDocId(year, month);
  try {
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
      console.warn(
        `[Firestore] deleteMissingTimeLogFirestore: Log with ID ${id} not found in document ${docId}. No deletion performed.`
      );
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

/**
 * Create a Firestore instance for the missing time model
 */
export function createMissingTimeFirestoreInstance(model: MissingTimeModel) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        // Load all missing time logs from the model
        const logs = await model.loadAllMissingTimeLogsForSync();
        onProgress?.("Starting missing time sync to Firestore...");

        if (!logs || logs.length === 0) {
          onProgress?.(
            "No missing time logs found locally to sync to Firestore."
          );
          return;
        }

        // Group logs by year and month
        const logsByMonth = logs.reduce(
          (acc: Record<string, MissingTimeLog[]>, log: MissingTimeLog) => {
            const key = `${log.year}_${log.month}`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(log);
            return acc;
          },
          {}
        );

        // Process each month's logs
        const months = Object.keys(logsByMonth);
        for (let i = 0; i < months.length; i++) {
          const [year, month] = months[i].split("_");
          const monthLogs = logsByMonth[months[i]];

          onProgress?.(
            `Processing missing time logs for ${year}-${month} (${i + 1}/${
              months.length
            })`
          );

          // Save each log individually
          for (const log of monthLogs) {
            await saveMissingTimeLogFirestore(
              log,
              parseInt(month),
              parseInt(year),
              await getCompanyName()
            );
          }
        }

        onProgress?.("Missing time sync to Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing missing time to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        onProgress?.("Starting missing time sync from Firestore...");
        const companyName = await getCompanyName();

        // Query all missing time documents
        const docs = await queryCollection<MissingTimeFirestoreData>(
          "missing_time_logs",
          [], // No conditions to get all documents
          companyName
        );
        if (!docs || docs.length === 0) {
          onProgress?.("No missing time logs found in Firestore.");
          return;
        }

        onProgress?.(
          `Found ${docs.length} missing time documents in Firestore.`
        );

        // Process each document
        let totalLogs = 0;
        for (const doc of docs) {
          if (!doc.logs || !Array.isArray(doc.logs)) {
            console.warn(
              `Invalid document structure in ${doc.meta?.year}-${doc.meta?.month}`
            );
            continue;
          }

          onProgress?.(
            `Processing ${doc.logs.length} logs for ${doc.meta?.year}-${doc.meta?.month}`
          );

          // Save each log individually
          for (const log of doc.logs) {
            await model.saveMissingTimeLog(log, log.month, log.year);
            totalLogs++;
          }
        }

        onProgress?.(
          `Missing time sync from Firestore completed successfully. Processed ${totalLogs} logs.`
        );
      } catch (error) {
        console.error("Error syncing missing time from Firestore:", error);
        throw new Error("Failed to sync missing time from Firestore");
      }
    },
  };
}
