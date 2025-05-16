/**
 * Firestore implementation for shorts management operations
 *
 * This module provides Firestore implementations for all shorts-related
 * operations that mirror the local filesystem operations in shorts.ts.
 */

import { Short, ShortModel } from "./shorts";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  getCompanyName,
  fetchCollection,
  queryCollection,
} from "../lib/firestoreService";
import { createEmployeeModel } from "./employee";

/**
 * Firestore structure for shorts document
 */
interface ShortsFirestoreData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  shorts: Short[];
}

/**
 * Creates a shorts document ID for a specific employee, year and month
 */
const createShortsDocId = (
  employeeId: string,
  year: number,
  month: number
): string => {
  return `short_${employeeId}_${year}_${month}`;
};

/**
 * Load shorts for a specific employee, month and year from Firestore
 */
export async function loadShortsFirestore(
  employeeId: string,
  month: number,
  year: number,
  companyName: string
): Promise<Short[]> {
  console.log(
    `[DEBUG] loadShortsFirestore - Starting for employeeId: ${employeeId}, month: ${month}, year: ${year}, company: ${companyName}`
  );
  try {
    const docId = createShortsDocId(employeeId, year, month);
    console.log(
      `[DEBUG] loadShortsFirestore - Generated docId: ${docId} for collection: "shorts"`
    );

    const data = await fetchDocument<ShortsFirestoreData>(
      "shorts",
      docId,
      companyName
    );

    if (!data) {
      console.log(
        `[DEBUG] loadShortsFirestore - No data returned from fetchDocument for docId: ${docId}`
      );
      return [];
    }

    if (!data.shorts) {
      console.log(
        `[DEBUG] loadShortsFirestore - Data returned, but 'shorts' array is missing or undefined for docId: ${docId}`
      );
      return [];
    }

    console.log(
      `[DEBUG] loadShortsFirestore - Successfully fetched ${data.shorts.length} shorts for docId: ${docId}`
    );

    // Convert date strings back to Date objects
    const mappedShorts = data.shorts.map((short) => {
      let parsedDate: Date | null = null;
      if (short.date) {
        // Check if short.date is not null or undefined
        if (typeof short.date === "string") {
          parsedDate = new Date(short.date);
        } else if (
          typeof short.date === "object" &&
          typeof (short.date as any).toDate === "function"
        ) {
          // Handle Firestore Timestamp object
          parsedDate = (short.date as any).toDate();
        } else if (short.date instanceof Date) {
          parsedDate = short.date;
        } else {
          console.warn(
            `[loadShortsFirestore] Encountered an unknown date type for short ID ${short.id}:`,
            short.date
          );
          // Try to parse, but expect it might be invalid
          parsedDate = new Date(short.date as any);
        }
      }

      // If, after all attempts, parsedDate is null or an invalid Date object, log it.
      if (!parsedDate || isNaN(parsedDate.valueOf())) {
        console.warn(
          `[loadShortsFirestore] Date field is null, undefined, or invalid for short ID ${short.id}. Original value:`,
          short.date,
          ". This short will be filtered out."
        );
        return null; // Mark for filtering
      }

      return {
        ...short,
        date: parsedDate, // Now, parsedDate is guaranteed to be a valid Date if not null
        type: short.type || "Short", // Default type to "Short"
      };
    });

    // Filter out any shorts that were marked as null due to invalid dates
    const validShorts = mappedShorts.filter(
      (short) => short !== null
    ) as Short[];
    console.log(
      `[loadShortsFirestore] Processed ${data.shorts.length} shorts, ${validShorts.length} had valid dates.`
    );
    return validShorts;
  } catch (error) {
    console.error(
      `[DEBUG] Error loading shorts from Firestore for employeeId: ${employeeId}, month: ${month}, year: ${year}, company: ${companyName}:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Create a new short in Firestore
 */
export async function createShortFirestore(
  shortInput: Omit<Short, "id">,
  employeeId: string,
  month: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createShortsDocId(employeeId, year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<ShortsFirestoreData>(
      "shorts",
      docId,
      companyName
    );

    // Create the new short with ID
    const newShort: Short = {
      ...shortInput,
      id: crypto.randomUUID(),
      employeeId: employeeId, // Ensure employeeId is set correctly
      // Ensure status and remainingUnpaid are handled (default if necessary)
      status:
        shortInput.status ||
        (shortInput.remainingUnpaid === 0 ? "Paid" : "Unpaid"),
      remainingUnpaid: shortInput.remainingUnpaid ?? shortInput.amount,
      type: shortInput.type || "Short", // Default type to "Short"
    };

    if (!existingDoc) {
      // Create new document if it doesn't exist
      const newDoc: ShortsFirestoreData = {
        meta: {
          employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
        },
        shorts: [newShort],
      };

      await saveDocument("shorts", docId, newDoc, companyName);
    } else {
      // Add the new short to existing shorts
      const updatedShorts = [...existingDoc.shorts, newShort];

      // Update document
      const updateData = {
        shorts: updatedShorts,
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("shorts", docId, updateData, companyName);
    }
  } catch (error) {
    console.error(`Error creating short in Firestore:`, error);
    throw error;
  }
}

/**
 * Update a short in Firestore
 */
export async function updateShortFirestore(
  shortUpdate: Short,
  month: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createShortsDocId(shortUpdate.employeeId, year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<ShortsFirestoreData>(
      "shorts",
      docId,
      companyName
    );

    if (!existingDoc) {
      throw new Error(
        `Shorts document for ${month}/${year} not found in Firestore.`
      );
    }

    const shortIndex = existingDoc.shorts.findIndex(
      (s) => s.id === shortUpdate.id
    );

    if (shortIndex === -1) {
      throw new Error(
        `Short with id ${shortUpdate.id} not found in Firestore.`
      );
    }

    // Update the short with automatic status based on remaining amount
    const updatedShort = {
      ...existingDoc.shorts[shortIndex],
      ...shortUpdate,
      status:
        shortUpdate.remainingUnpaid <= 0
          ? "Paid"
          : ("Unpaid" as "Paid" | "Unpaid"),
      type: shortUpdate.type || "Short", // Ensure type is updated or defaulted
    };

    // Update the short in the array
    const updatedShorts = [...existingDoc.shorts];
    updatedShorts[shortIndex] = updatedShort;

    // Update document
    const updateData = {
      shorts: updatedShorts,
      "meta.lastModified": new Date().toISOString(),
    };

    await updateDocument("shorts", docId, updateData, companyName);
  } catch (error) {
    console.error(`Error updating short in Firestore:`, error);
    throw error;
  }
}

/**
 * Delete a short from Firestore
 */
export async function deleteShortFirestore(
  id: string,
  employeeId: string,
  month: number,
  year: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createShortsDocId(employeeId, year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<ShortsFirestoreData>(
      "shorts",
      docId,
      companyName
    );

    if (!existingDoc) {
      console.warn(
        `Shorts document for ${month}/${year} not found in Firestore.`
      );
      return;
    }

    // Filter out the short with the specified ID
    const updatedShorts = existingDoc.shorts.filter((s) => s.id !== id);

    // Only update if we actually removed a short
    if (updatedShorts.length < existingDoc.shorts.length) {
      const updateData = {
        shorts: updatedShorts,
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("shorts", docId, updateData, companyName);
    } else {
      console.warn(`Short with ID ${id} not found in Firestore document.`);
    }
  } catch (error) {
    console.error(`Error deleting short from Firestore:`, error);
    throw error;
  }
}

/**
 * Create a Firestore instance for the shorts model
 */
export function createShortsFirestoreInstance(
  model: ShortModel,
  employeeId: string,
  yearForSync?: number
) {
  const isPlaceholder = employeeId === "__SYNC_ALL__";
  const effectiveYear = yearForSync || new Date().getFullYear();

  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        const companyName = await getCompanyName();
        if (!companyName) {
          onProgress?.("Error: Company name not found. Cannot sync shorts.");
          throw new Error("Company name not found.");
        }
        const dbPath = model.getDbPath();
        onProgress?.(`Shorts: Starting UPLOAD for year ${effectiveYear}.`);

        const processEmployee = async (empId: string, empName?: string) => {
          onProgress?.(
            `Shorts: Processing UPLOAD for ${
              empName || empId
            } for year ${effectiveYear}.`
          );
          for (let month = 1; month <= 12; month++) {
            const monthSpecificShortModel = new ShortModel(
              dbPath,
              empId,
              month,
              effectiveYear
            );
            const jsonData = await (
              monthSpecificShortModel as any
            ).readJsonFile();

            if (jsonData && jsonData.shorts && jsonData.shorts.length > 0) {
              onProgress?.(
                `Shorts: Found ${jsonData.shorts.length} local shorts for ${
                  empName || empId
                } for ${effectiveYear}-${month}. Uploading...`
              );
              const docId = createShortsDocId(empId, effectiveYear, month);
              const dataToSave: ShortsFirestoreData = {
                meta: {
                  employeeId: empId,
                  year: effectiveYear,
                  month: month,
                  lastModified: new Date().toISOString(),
                },
                shorts: jsonData.shorts,
              };
              await saveDocument("shorts", docId, dataToSave, companyName);
              onProgress?.(
                `Shorts: Uploaded data for ${
                  empName || empId
                } for ${effectiveYear}-${month}.`
              );
            } else {
              onProgress?.(
                `Shorts: No local shorts data found for ${
                  empName || empId
                } for ${effectiveYear}-${month}. Skipping upload for this month.`
              );
            }
          }
        };

        if (isPlaceholder) {
          onProgress?.(
            `Shorts: UPLOAD - Syncing all employees for year ${effectiveYear}.`
          );
          const employeeModel = createEmployeeModel(dbPath);
          const employees = await employeeModel.loadActiveEmployees();
          onProgress?.(
            `Shorts: UPLOAD - Found ${employees.length} active employees.`
          );
          for (const emp of employees) {
            await processEmployee(emp.id, emp.name);
          }
        } else {
          await processEmployee(employeeId);
        }
        onProgress?.(`Shorts: UPLOAD for year ${effectiveYear} completed.`);
      } catch (error) {
        const errorMsg = `Shorts: Error during UPLOAD for year ${effectiveYear}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        onProgress?.(errorMsg);
        console.error(errorMsg, error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        const companyName = await getCompanyName();
        if (!companyName) {
          onProgress?.("Error: Company name not found. Cannot sync shorts.");
          throw new Error("Company name not found.");
        }
        const dbPath = model.getDbPath();
        onProgress?.(`Shorts: Starting DOWNLOAD for year ${effectiveYear}.`);

        const processEmployee = async (empId: string, empName?: string) => {
          onProgress?.(
            `Shorts: Processing DOWNLOAD for ${
              empName || empId
            } for year ${effectiveYear}.`
          );
          let totalShortsDownloadedForEmployee = 0;
          for (let month = 1; month <= 12; month++) {
            onProgress?.(
              `Shorts: Checking ${
                empName || empId
              } for ${effectiveYear}-${month}.`
            );
            const firestoreShorts = await loadShortsFirestore(
              empId,
              month,
              effectiveYear,
              companyName
            );
            if (firestoreShorts && firestoreShorts.length > 0) {
              onProgress?.(
                `Shorts: Found ${
                  firestoreShorts.length
                } shorts in Firestore for ${
                  empName || empId
                } for ${effectiveYear}-${month}.`
              );
              const monthSpecificShortModel = new ShortModel(
                dbPath,
                empId,
                month,
                effectiveYear
              );

              const localData: ShortsFirestoreData = {
                meta: {
                  employeeId: empId,
                  year: effectiveYear,
                  month: month,
                  lastModified: new Date().toISOString(),
                },
                shorts: firestoreShorts,
              };
              await (monthSpecificShortModel as any).writeJsonFile(localData);
              totalShortsDownloadedForEmployee += firestoreShorts.length;
              onProgress?.(
                `Shorts: Saved ${firestoreShorts.length} shorts locally for ${
                  empName || empId
                } for ${effectiveYear}-${month}.`
              );
            } else {
              onProgress?.(
                `Shorts: No shorts found in Firestore for ${
                  empName || empId
                } for ${effectiveYear}-${month}.`
              );
            }
          }
          onProgress?.(
            `Shorts: Downloaded a total of ${totalShortsDownloadedForEmployee} shorts for ${
              empName || empId
            } for year ${effectiveYear}.`
          );
        };

        if (isPlaceholder) {
          onProgress?.(
            `Shorts: DOWNLOAD - Syncing all employees for year ${effectiveYear}.`
          );
          const employeeModel = createEmployeeModel(dbPath);
          const employees = await employeeModel.loadActiveEmployees();
          onProgress?.(
            `Shorts: DOWNLOAD - Found ${employees.length} active employees.`
          );
          for (const emp of employees) {
            await processEmployee(emp.id, emp.name);
          }
        } else {
          await processEmployee(employeeId);
        }
        onProgress?.(`Shorts: DOWNLOAD for year ${effectiveYear} completed.`);
      } catch (error) {
        const errorMsg = `Shorts: Error during DOWNLOAD for year ${effectiveYear}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        onProgress?.(errorMsg);
        console.error(errorMsg, error);
        throw error;
      }
    },
  };
}
