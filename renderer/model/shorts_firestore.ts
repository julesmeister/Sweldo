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
  try {
    const docId = createShortsDocId(employeeId, year, month);
    const data = await fetchDocument<ShortsFirestoreData>(
      "shorts",
      docId,
      companyName
    );

    if (!data || !data.shorts) {
      return [];
    }

    // Convert date strings back to Date objects
    return data.shorts.map((short) => ({
      ...short,
      date: short.date instanceof Date ? short.date : new Date(short.date),
    }));
  } catch (error) {
    console.error(`Error loading shorts from Firestore:`, error);
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
  employeeId: string
) {
  // Check if this is the placeholder employeeId for bulk sync
  const isPlaceholder = employeeId === "__SYNC_ALL__";

  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        const companyName = await getCompanyName();

        if (isPlaceholder) {
          // Handle bulk sync for all employees
          onProgress?.(
            "Starting bulk shorts sync to Firestore for ALL employees..."
          );

          // Get employee model to load all employees
          const dbPath = model.getDbPath();
          const employeeModel = createEmployeeModel(dbPath);
          const employees = await employeeModel.loadActiveEmployees();

          onProgress?.(
            `Found ${employees.length} active employees for shorts sync`
          );

          // Process each employee in sequence
          for (let i = 0; i < employees.length; i++) {
            const employee = employees[i];
            onProgress?.(
              `Processing employee ${i + 1}/${employees.length}: ${
                employee.name
              } (${employee.id})`
            );

            try {
              // Create a model for this specific employee
              const employeeModel = new ShortModel(dbPath, employee.id);
              // Load all shorts for this employee
              const shorts = await employeeModel.loadShorts(employee.id);
              onProgress?.(
                `Retrieved ${shorts.length} shorts for employee ${employee.id}`
              );

              // Group shorts by year and month
              const shortsByMonth = shorts.reduce((acc, short) => {
                const date = new Date(short.date);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const key = `${year}_${month}`;
                if (!acc[key]) {
                  acc[key] = [];
                }
                acc[key].push(short);
                return acc;
              }, {} as Record<string, Short[]>);

              // Process each month's shorts
              const months = Object.keys(shortsByMonth);
              for (let j = 0; j < months.length; j++) {
                const [year, month] = months[j].split("_").map(Number);
                const monthShorts = shortsByMonth[months[j]];

                onProgress?.(
                  `Processing shorts for ${employee.id}: ${month}/${year} (${
                    j + 1
                  }/${months.length})`
                );

                // Create or update the shorts document in Firestore
                const docId = createShortsDocId(employee.id, year, month);
                const data: ShortsFirestoreData = {
                  meta: {
                    employeeId: employee.id,
                    year,
                    month,
                    lastModified: new Date().toISOString(),
                  },
                  shorts: monthShorts,
                };

                await saveDocument("shorts", docId, data, companyName);
              }
            } catch (error) {
              // Log error but continue with next employee
              const errorMsg = `Error syncing shorts for employee ${employee.id}: ${error}`;
              console.error(errorMsg);
              onProgress?.(errorMsg);
            }
          }

          onProgress?.("Bulk shorts sync completed");
        } else {
          // Regular single-employee sync
          onProgress?.(
            `Starting shorts sync to Firestore for employee: ${employeeId}...`
          );

          // Load all shorts for the employee
          const shorts = await model.loadShorts(employeeId);
          onProgress?.(
            `Retrieved ${shorts.length} shorts for employee ${employeeId}`
          );

          // Group shorts by year and month
          const shortsByMonth = shorts.reduce((acc, short) => {
            const date = new Date(short.date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const key = `${year}_${month}`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(short);
            return acc;
          }, {} as Record<string, Short[]>);

          // Process each month's shorts
          const months = Object.keys(shortsByMonth);
          for (let i = 0; i < months.length; i++) {
            const [year, month] = months[i].split("_").map(Number);
            const monthShorts = shortsByMonth[months[i]];

            onProgress?.(
              `Processing shorts for ${month}/${year} (${i + 1}/${
                months.length
              })`
            );

            // Create or update the shorts document in Firestore
            const docId = createShortsDocId(employeeId, year, month);
            const data: ShortsFirestoreData = {
              meta: {
                employeeId,
                year,
                month,
                lastModified: new Date().toISOString(),
              },
              shorts: monthShorts,
            };

            await saveDocument("shorts", docId, data, companyName);
          }

          onProgress?.("Shorts sync to Firestore completed successfully.");
        }
      } catch (error) {
        console.error("Error syncing shorts to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        const companyName = await getCompanyName();

        if (isPlaceholder) {
          // Handle bulk sync from Firestore for all employees
          onProgress?.(
            "Starting bulk shorts download from Firestore for ALL employees..."
          );

          // Get employee model to load all employees
          const dbPath = model.getDbPath();
          const employeeModel = createEmployeeModel(dbPath);
          const employees = await employeeModel.loadActiveEmployees();

          onProgress?.(
            `Found ${employees.length} active employees for shorts download`
          );

          // Process each employee in sequence
          for (let i = 0; i < employees.length; i++) {
            const employee = employees[i];
            onProgress?.(
              `Processing employee ${i + 1}/${employees.length}: ${
                employee.name
              } (${employee.id})`
            );

            try {
              // Create a model for this specific employee
              const employeeModel = new ShortModel(dbPath, employee.id);

              // Load shorts for current and previous months (more useful than all history)
              const currentDate = new Date();
              const currentYear = currentDate.getFullYear();
              const currentMonth = currentDate.getMonth() + 1;

              // Try to get previous 3 months of shorts
              const monthsToGet = [
                { year: currentYear, month: currentMonth },
                {
                  year: currentMonth > 1 ? currentYear : currentYear - 1,
                  month: currentMonth > 1 ? currentMonth - 1 : 12,
                },
                {
                  year: currentMonth > 2 ? currentYear : currentYear - 1,
                  month:
                    currentMonth > 2 ? currentMonth - 2 : currentMonth + 10,
                },
              ];

              let shortsCount = 0;

              for (const period of monthsToGet) {
                const shorts = await loadShortsFirestore(
                  employee.id,
                  period.month,
                  period.year,
                  companyName
                );

                if (shorts.length > 0) {
                  onProgress?.(
                    `Found ${shorts.length} shorts for ${employee.id} in ${period.month}/${period.year}`
                  );

                  // Save each short to the model
                  for (const short of shorts) {
                    await employeeModel.createShort(short);
                    shortsCount++;
                  }
                }
              }

              onProgress?.(
                `Downloaded ${shortsCount} shorts for employee ${employee.id}`
              );
            } catch (error) {
              // Log error but continue with next employee
              const errorMsg = `Error downloading shorts for employee ${employee.id}: ${error}`;
              console.error(errorMsg);
              onProgress?.(errorMsg);
            }
          }

          onProgress?.("Bulk shorts download completed");
        } else {
          // Regular single-employee download
          onProgress?.(
            `Starting shorts download from Firestore for employee: ${employeeId}...`
          );

          // Load shorts for the current month
          const currentDate = new Date();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth() + 1;

          const shorts = await loadShortsFirestore(
            employeeId,
            currentMonth,
            currentYear,
            companyName
          );

          onProgress?.(`Retrieved ${shorts.length} shorts from Firestore.`);

          // Save each short to the model
          for (const short of shorts) {
            await model.createShort(short);
          }

          onProgress?.("Shorts sync from Firestore completed successfully.");
        }
      } catch (error) {
        console.error("Error syncing shorts from Firestore:", error);
        throw error;
      }
    },
  };
}
