/**
 * Firestore implementation for attendance-related operations
 *
 * This module provides Firestore implementations for all attendance-related
 * operations that mirror the local filesystem operations in attendance.ts.
 *
 * IMPLEMENTATION PATTERN:
 * 1. Import interfaces from the main model file (attendance.ts) rather than redefining them
 * 2. Use utility functions from firestoreService.ts for common Firestore operations
 * 3. Maintain the same function signatures as local storage but with "Firestore" suffix
 * 4. Follow the Firestore path structure from the documentation:
 *    companies/{companyName}/attendances/{employeeId}_{year}_{month}
 */

import {
  Attendance,
  AttendanceSettings,
  SharedAlternatives,
  AttendanceJsonDay,
  AttendanceJsonMonth,
  BackupEntry,
  BackupJsonMonth,
  AttendanceModel,
} from "./attendance";
import {
  Timestamp,
  DocumentReference,
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  initializeFirebase,
  getFirestoreInstance,
  isWebEnvironment,
  getCompanyName,
  fetchDocument,
  saveDocument,
  updateDocument,
  fetchTimeBasedDocument,
  saveTimeBasedDocument,
  createTimeBasedDocId,
  queryTimeBasedDocuments,
  fetchCollection,
} from "../lib/firestoreService";
import {
  processInBatches,
  transformToFirestoreFormat,
  transformFromFirestoreFormat,
} from "../utils/firestoreSyncUtils";
import { getFirestoreCollection } from "../utils/firestoreUtils";

/**
 * Load attendance data from Firestore
 * Follows the path structure: companies/{companyName}/attendances/{employeeId}_{year}_{month}
 */
export async function loadAttendanceFirestore(
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<Attendance[]> {
  try {
    // Use utility functions from firestoreService
    const docId = createTimeBasedDocId(employeeId, year, month);
    const data = await fetchDocument<AttendanceJsonMonth>(
      "attendances",
      docId,
      companyName
    );

    if (!data) {
      return []; // Document doesn't exist
    }

    const attendances: Attendance[] = [];

    // Convert Firestore document to Attendance array
    Object.entries(data.days).forEach(([dayStr, dayData]) => {
      const day = parseInt(dayStr);
      if (isNaN(day)) return;

      attendances.push({
        employeeId,
        day,
        month,
        year,
        timeIn: dayData.timeIn,
        timeOut: dayData.timeOut,
        schedule: dayData.schedule,
      });
    });

    // Sort by day
    return attendances.sort((a, b) => a.day - b.day);
  } catch (error) {
    console.error(
      `Error loading Firestore attendance for ${employeeId} ${year}-${month}:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Load a single attendance record by day from Firestore
 */
export async function loadAttendanceByDayFirestore(
  day: number,
  month: number,
  year: number,
  employeeId: string,
  companyName: string
): Promise<Attendance | null> {
  const attendances = await loadAttendanceFirestore(
    employeeId,
    year,
    month,
    companyName
  );
  return attendances.find((att) => att.day === day) || null;
}

/**
 * Save attendance data to Firestore
 */
export async function saveAttendanceFirestore(
  attendances: Attendance[],
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<void> {
  if (!attendances || attendances.length === 0) {
    console.log("[Firestore] No attendance records provided to save.");
    return;
  }

  try {
    const docId = createTimeBasedDocId(employeeId, year, month);
    console.log(`[Firestore] Saving/Updating attendance for docId: ${docId}`);

    // Fetch the existing document for the entire month
    const existingMonthDoc = await fetchDocument<AttendanceJsonMonth>(
      "attendances",
      docId,
      companyName
    );

    let currentMonthData: AttendanceJsonMonth;
    if (existingMonthDoc) {
      console.log(
        `[Firestore] Existing document found for ${docId}. Merging changes.`
      );
      currentMonthData = { ...existingMonthDoc }; // Clone to avoid direct mutation
      currentMonthData.meta = {
        // Ensure meta is preserved/updated
        ...existingMonthDoc.meta,
        employeeId, // Ensure these are correct
        year,
        month,
        lastModified: new Date().toISOString(),
      };
      // Ensure 'days' field exists
      if (!currentMonthData.days) {
        currentMonthData.days = {};
      }
    } else {
      console.log(
        `[Firestore] No existing document for ${docId}. Creating new one.`
      );
      currentMonthData = {
        meta: {
          employeeId,
          year,
          month,
          lastModified: new Date().toISOString(),
        },
        days: {},
      };
    }

    const backupEntries: {
      day: number;
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];

    // Iterate through ONLY the attendances that need to be saved/updated
    for (const attendanceRecord of attendances) {
      const dayStr = attendanceRecord.day.toString();
      const existingDayData = currentMonthData.days[dayStr];

      // Prepare new day data from the incoming record
      const newDayData: AttendanceJsonDay = {
        timeIn: attendanceRecord.timeIn,
        timeOut: attendanceRecord.timeOut,
        schedule: attendanceRecord.schedule,
      };

      // Check for changes to create backup entries
      if (existingDayData) {
        if (existingDayData.timeIn !== newDayData.timeIn) {
          backupEntries.push({
            day: attendanceRecord.day,
            field: "timeIn",
            oldValue: existingDayData.timeIn,
            newValue: newDayData.timeIn,
          });
        }
        if (existingDayData.timeOut !== newDayData.timeOut) {
          backupEntries.push({
            day: attendanceRecord.day,
            field: "timeOut",
            oldValue: existingDayData.timeOut,
            newValue: newDayData.timeOut,
          });
        }
        // Add more checks if schedule changes need to be backed up
      } else {
        // This is a new day entry, so old values are null
        if (newDayData.timeIn !== null) {
          backupEntries.push({
            day: attendanceRecord.day,
            field: "timeIn",
            oldValue: null,
            newValue: newDayData.timeIn,
          });
        }
        if (newDayData.timeOut !== null) {
          backupEntries.push({
            day: attendanceRecord.day,
            field: "timeOut",
            oldValue: null,
            newValue: newDayData.timeOut,
          });
        }
      }

      // Update the specific day in the month's data
      currentMonthData.days[dayStr] = newDayData;
      console.log(
        `[Firestore] Updated day ${dayStr} for ${docId} with TimeIn: ${newDayData.timeIn}, TimeOut: ${newDayData.timeOut}`
      );
    }

    // Update the lastModified timestamp for the whole document
    currentMonthData.meta.lastModified = new Date().toISOString();

    // Save the entire updated month document
    // The saveDocument utility handles merge:true by default, but here we are providing the full desired state.
    await saveDocument(
      "attendances",
      docId,
      currentMonthData,
      companyName,
      true
    ); // Explicitly merge:true
    console.log(`[Firestore] Successfully saved document ${docId}`);

    // If there were actual changes, save backup
    if (backupEntries.length > 0) {
      console.log(
        `[Firestore] ${backupEntries.length} changes detected. Saving backup for ${docId}.`
      );
      await saveAttendanceBackupFirestore(
        backupEntries,
        employeeId,
        year,
        month,
        companyName
      );
    } else {
      console.log(
        `[Firestore] No changes detected that require backup for ${docId}.`
      );
    }
  } catch (error) {
    console.error(
      `[Firestore] Error in saveAttendanceFirestore for ${employeeId} ${year}-${month}:`,
      error
    );
    // It's important to re-throw the error so the calling function knows the save failed
    throw error;
  }
}

/**
 * Save attendance backup to Firestore
 */
export async function saveAttendanceBackupFirestore(
  changes: {
    day: number;
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }[],
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<void> {
  if (changes.length === 0) return;

  try {
    const docId = createTimeBasedDocId(employeeId, year, month);

    // Fetch existing backup document
    const existingData = await fetchDocument<BackupJsonMonth>(
      "attendance_backups",
      docId,
      companyName
    );

    // Initialize backup document
    let backupData: BackupJsonMonth = {
      employeeId,
      year,
      month,
      backups: [],
    };

    // If document exists, use its data as base
    if (existingData) {
      backupData = existingData;
    }

    // Create new backup entry
    const timestamp = new Date().toISOString();
    backupData.backups.push({
      timestamp,
      changes,
    });

    // Save the backup document
    await saveDocument("attendance_backups", docId, backupData, companyName);
  } catch (error) {
    console.error(
      `Error saving Firestore attendance backup for ${employeeId} ${year}-${month}:`,
      error
    );
    // Don't throw error for backup failures to avoid blocking main operations
    console.warn("Backup operation failed but main save completed");
  }
}

/**
 * Load alternative times from Firestore for a specific month and year
 */
export async function loadAlternativeTimesFirestore(
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<string[]> {
  try {
    const docId = createTimeBasedDocId(employeeId, year, month);
    // console.log(`[Alternatives-Firestore] Fetching alternatives for document: ${docId}`);

    const data = await fetchDocument<{ times: string[] }>(
      "alternatives", // Collection remains 'alternatives'
      docId, // Document ID is now employeeId_year_month
      companyName
    );

    if (!data) {
      // console.log(`[Alternatives-Firestore] No alternatives document found for ${employeeId} ${year}-${month}`);
      return [];
    }

    if (!data.times || !Array.isArray(data.times)) {
      // console.log(`[Alternatives-Firestore] Alternatives document exists but has no valid times array for ${employeeId} ${year}-${month}`);
      return [];
    }

    // console.log(`[Alternatives-Firestore] Retrieved ${data.times.length} alternatives for ${employeeId} ${year}-${month}`);
    return data.times;
  } catch (error) {
    console.error(
      `Error loading Firestore alternative times for ${employeeId} ${year}-${month}:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Save alternative times to Firestore for a specific month and year
 */
export async function saveAlternativeTimesFirestore(
  employeeId: string,
  year: number,
  month: number,
  times: string[],
  companyName: string
): Promise<void> {
  try {
    // Basic validation
    if (!Array.isArray(times)) {
      console.error(
        `[Alternatives-Firestore] Invalid alternatives format for ${employeeId} ${year}-${month}. Expected array, got: ${typeof times}`
      );
      throw new Error(
        "Invalid alternatives format. Expected an array of strings."
      );
    }

    const docId = createTimeBasedDocId(employeeId, year, month);
    console.log(
      `[Alternatives-Firestore] Saving ${times.length} alternatives for ${employeeId} ${year}-${month} to document: ${docId}`
    );

    // Structure data for Firestore - simple object with a 'times' array
    const dataToSave: { times: string[] } = { times };

    // Save document using utility function
    await saveDocument("alternatives", docId, dataToSave, companyName);
    console.log(
      `[Alternatives-Firestore] Successfully saved alternatives for ${employeeId} ${year}-${month}`
    );
  } catch (error) {
    console.error(
      `Error saving Firestore alternative times for ${employeeId} ${year}-${month}:`,
      error
    );
    throw error;
  }
}

/**
 * Load attendance settings from Firestore
 */
export async function loadAttendanceSettingsFirestore(
  companyName: string
): Promise<AttendanceSettings> {
  try {
    // Use fetchDocument utility function
    const existingSettings = await fetchDocument<AttendanceSettings>(
      "settings",
      "attendance_settings",
      companyName
    );

    // Default settings
    const defaultSettings: AttendanceSettings = {
      overtimeEnabled: false,
      overtimeHourlyMultiplier: 1.25,
      overtimeThresholdHours: 8,
      autoClockOutEnabled: false,
      autoClockOutHour: 17,
      autoClockOutMinute: 0,
      hoursPerWorkDay: 8,
    };

    if (!existingSettings) {
      // If settings don't exist, create them with defaults
      await saveDocument(
        "settings",
        "attendance_settings",
        defaultSettings,
        companyName
      );
      return defaultSettings;
    }

    // Merge existing settings with defaults in case new fields were added
    return { ...defaultSettings, ...existingSettings };
  } catch (error) {
    console.error(`Error loading Firestore attendance settings:`, error);
    // Return default settings on error
    return {
      overtimeEnabled: false,
      overtimeHourlyMultiplier: 1.25,
      overtimeThresholdHours: 8,
      autoClockOutEnabled: false,
      autoClockOutHour: 17,
      autoClockOutMinute: 0,
      hoursPerWorkDay: 8,
    };
  }
}

/**
 * Save attendance settings to Firestore
 */
export async function saveAttendanceSettingsFirestore(
  settings: AttendanceSettings,
  companyName: string
): Promise<void> {
  try {
    // Save settings using utility function
    await saveDocument(
      "settings",
      "attendance_settings",
      settings,
      companyName
    );
  } catch (error) {
    console.error(`Error saving Firestore attendance settings:`, error);
    throw error;
  }
}

/**
 * Query attendance records for a date range
 */
export async function queryAttendanceByDateRangeFirestore(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  companyName: string
): Promise<Attendance[]> {
  try {
    // Extract year and month ranges
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // JavaScript months are 0-based
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;

    // Generate all year-month combinations in the range
    const yearMonthCombinations: { year: number; month: number }[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const monthStart = year === startYear ? startMonth : 1;
      const monthEnd = year === endYear ? endMonth : 12;

      for (let month = monthStart; month <= monthEnd; month++) {
        yearMonthCombinations.push({ year, month });
      }
    }

    // Fetch attendance for each month in parallel
    const results = await Promise.all(
      yearMonthCombinations.map(({ year, month }) =>
        loadAttendanceFirestore(employeeId, year, month, companyName)
      )
    );

    // Combine and filter by date range
    const allAttendances = results.flat();
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();

    return allAttendances.filter((attendance) => {
      // For same year and month, compare days
      if (
        attendance.year === startYear &&
        attendance.month === startMonth &&
        attendance.year === endYear &&
        attendance.month === endMonth
      ) {
        return attendance.day >= startDay && attendance.day <= endDay;
      }

      // For start year-month, check days >= startDay
      if (attendance.year === startYear && attendance.month === startMonth) {
        return attendance.day >= startDay;
      }

      // For end year-month, check days <= endDay
      if (attendance.year === endYear && attendance.month === endMonth) {
        return attendance.day <= endDay;
      }

      // For months in between, include all days
      return true;
    });
  } catch (error) {
    console.error(`Error querying Firestore attendance by date range:`, error);
    return [];
  }
}

export function createAttendanceFirestore(model: AttendanceModel) {
  const db = getFirestoreInstance();

  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      let companyName: string;
      try {
        companyName = await getCompanyName();
        if (!companyName) {
          throw new Error(
            "Company name could not be determined. Sync aborted."
          );
        }
        onProgress?.("Starting attendance sync to Firestore...");

        const allLocalAttendances = await model.loadAttendances();
        if (!allLocalAttendances || allLocalAttendances.length === 0) {
          onProgress?.("No local attendance data to sync.");
          // Even if no attendance, try to sync alternatives
        } else {
          onProgress?.(
            `Loaded ${allLocalAttendances.length} local attendance records.`
          );

          const groupedAttendances = allLocalAttendances.reduce(
            (acc, record) => {
              const key = `${record.employeeId}_${record.year}_${record.month}`;
              if (!acc[key]) {
                acc[key] = {
                  employeeId: record.employeeId,
                  year: record.year,
                  month: record.month,
                  records: [],
                };
              }
              acc[key].records.push(record);
              return acc;
            },
            {} as Record<
              string,
              {
                employeeId: string;
                year: number;
                month: number;
                records: Attendance[];
              }
            >
          );

          const totalGroups = Object.keys(groupedAttendances).length;
          onProgress?.(
            `Grouped records into ${totalGroups} employee-month documents.`
          );
          let processedGroups = 0;

          for (const groupKey in groupedAttendances) {
            const group = groupedAttendances[groupKey];
            const { employeeId, year, month, records } = group;

            const docId = createTimeBasedDocId(employeeId, year, month);
            const daysData: { [day: string]: AttendanceJsonDay } = {};
            records.forEach((att) => {
              daysData[att.day.toString()] = {
                timeIn: att.timeIn,
                timeOut: att.timeOut,
                schedule: att.schedule === undefined ? null : att.schedule,
              };
            });

            const docData: AttendanceJsonMonth = {
              meta: {
                employeeId,
                year,
                month,
                lastModified: new Date().toISOString(),
              },
              days: daysData,
            };
            await saveDocument("attendances", docId, docData, companyName);
            processedGroups++;
            onProgress?.(
              `Synced attendance for ${employeeId} ${year}-${month} (${processedGroups}/${totalGroups})`
            );

            // Sync alternatives for this specific employee, year, month
            try {
              // ASSUMPTION: model.loadAlternativeTimes will be updated to accept year and month
              const localAlternativesForMonth =
                await model.loadAlternativeTimes(employeeId, year, month);
              if (
                localAlternativesForMonth &&
                localAlternativesForMonth.length > 0
              ) {
                onProgress?.(
                  `Syncing ${localAlternativesForMonth.length} alternative times for ${employeeId} ${year}-${month}...`
                );
                await saveAlternativeTimesFirestore(
                  // Use NEW signature
                  employeeId,
                  year,
                  month,
                  localAlternativesForMonth,
                  companyName
                );
              } else {
                // Optional: If local alternatives for this month are empty,
                // consider deleting the corresponding Firestore document if it exists.
                // For now, we only upload if local has data.
                onProgress?.(
                  `No local alternatives to sync for ${employeeId} ${year}-${month}.`
                );
              }
            } catch (altError: any) {
              onProgress?.(
                `Error syncing alternatives for ${employeeId} ${year}-${month}: ${altError.message}`
              );
              console.warn(
                `Could not sync alternatives for ${employeeId} ${year}-${month}:`,
                altError
              );
            }
          }
        }
        onProgress?.(
          "Attendance records and their monthly alternatives sync to Firestore completed."
        );
        // The old loop for syncing alternatives for all employees has been removed
        // as it's now handled within the groupedAttendances loop.
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(
            `Failed to sync attendance to Firestore: ${error.message}`
          );
        }
        throw new Error(
          "Failed to sync attendance to Firestore due to an unknown error"
        );
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        const companyName = await getCompanyName();
        if (!companyName) {
          throw new Error(
            "Company name could not be determined. Sync aborted."
          );
        }
        onProgress?.("Starting attendance sync from Firestore...");

        const firestoreAttendanceDocs =
          await fetchCollection<AttendanceJsonMonth>(
            "attendances",
            companyName
          );

        if (!firestoreAttendanceDocs || firestoreAttendanceDocs.length === 0) {
          onProgress?.(
            "No attendance data found in Firestore for this company."
          );
          // Continue to attempt syncing alternatives
        } else {
          onProgress?.(
            `Retrieved ${firestoreAttendanceDocs.length} attendance documents from Firestore.`
          );

          let allExtractedAttendances: Attendance[] = [];
          firestoreAttendanceDocs.forEach((docData: AttendanceJsonMonth) => {
            const { employeeId, year, month } = docData.meta;
            Object.entries(docData.days).forEach(
              ([dayStr, dayData]: [string, AttendanceJsonDay]) => {
                const day = parseInt(dayStr);
                if (isNaN(day)) return;
                allExtractedAttendances.push({
                  employeeId,
                  year,
                  month,
                  day,
                  timeIn: dayData.timeIn,
                  timeOut: dayData.timeOut,
                  schedule:
                    dayData.schedule === undefined ? null : dayData.schedule,
                });
              }
            );
          });

          if (allExtractedAttendances.length > 0) {
            await model.saveAttendances(allExtractedAttendances);
            onProgress?.(
              `Successfully saved/updated ${allExtractedAttendances.length} attendance records locally.`
            );
          } else {
            onProgress?.(
              "No individual attendance entries extracted from Firestore documents."
            );
          }
        }
        onProgress?.("Attendance records sync from Firestore completed.");

        // Sync alternative times from Firestore (now month/year specific)
        onProgress?.(
          "Fetching all monthly alternative time lists from Firestore..."
        );
        const firestoreAlternativesDocs = await fetchCollection<{
          id: string;
          times: string[];
        }>( // doc.id will be "employeeId_year_month"
          "alternatives",
          companyName,
          true // includeDocId parameter
        );

        if (
          !firestoreAlternativesDocs ||
          firestoreAlternativesDocs.length === 0
        ) {
          onProgress?.("No monthly alternative time lists found in Firestore.");
        } else {
          onProgress?.(
            `Retrieved ${firestoreAlternativesDocs.length} monthly alternative time lists.`
          );
          for (const altDoc of firestoreAlternativesDocs) {
            const docIdParts = altDoc.id.split("_");
            // Expect at least 3 parts: employeeId (could have underscores), year, month
            if (docIdParts.length >= 3) {
              const monthStr = docIdParts[docIdParts.length - 1];
              const yearStr = docIdParts[docIdParts.length - 2];
              const employeeId = docIdParts
                .slice(0, docIdParts.length - 2)
                .join("_");

              const year = parseInt(yearStr);
              const month = parseInt(monthStr);
              const times = altDoc.times;

              if (
                employeeId &&
                !isNaN(year) &&
                !isNaN(month) &&
                Array.isArray(times)
              ) {
                try {
                  // ASSUMPTION: model.saveAlternativeTimes will be updated to accept year and month
                  await model.saveAlternativeTimes(
                    employeeId,
                    year,
                    month,
                    times
                  );
                  onProgress?.(
                    `Saved ${times.length} alternative times for ${employeeId} ${year}-${month} locally.`
                  );
                } catch (saveAltError: any) {
                  onProgress?.(
                    `Error saving alternatives locally for ${employeeId} ${year}-${month}: ${saveAltError.message}`
                  );
                  console.warn(
                    `Could not save alternatives locally for ${employeeId} ${year}-${month}:`,
                    saveAltError
                  );
                }
              } else {
                onProgress?.(
                  `Invalid data in alternative document: ID='${
                    altDoc.id
                  }', Times='${JSON.stringify(times)}'`
                );
                console.warn(
                  `Skipping alternative document with invalid data: ${altDoc.id}`
                );
              }
            } else {
              onProgress?.(
                `Invalid document ID format for alternative: ${altDoc.id}`
              );
              console.warn(
                `Skipping alternative document with invalid ID format: ${altDoc.id}`
              );
            }
          }
        }
        onProgress?.(
          "Monthly alternative times sync from Firestore completed."
        );
      } catch (error: any) {
        if (error instanceof Error) {
          console.error(
            `[syncFromFirestore - Attendance] Error details: ${error.message}, Stack: ${error.stack}`
          );
        }
        throw new Error(
          `Failed to sync attendance from Firestore: ${error.message || error}`
        );
      }
    },
  };
}
