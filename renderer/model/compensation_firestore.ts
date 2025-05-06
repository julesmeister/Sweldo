/**
 * Firestore implementation for compensation-related operations
 *
 * This module provides Firestore implementations for all compensation-related
 * operations that mirror the local filesystem operations in compensation.ts.
 *
 * IMPLEMENTATION PATTERN:
 * 1. Import interfaces from the main model file (compensation.ts) rather than redefining them
 * 2. Use utility functions from firestoreService.ts for common Firestore operations
 * 3. Maintain the same function signatures as local storage but with "Firestore" suffix
 * 4. Follow the Firestore path structure from the documentation:
 *    companies/{companyName}/compensations/{employeeId}_{year}_{month}
 */

import {
  Compensation,
  DayType,
  CompensationJsonDay,
  CompensationJsonMonth,
  BackupEntry,
  BackupJsonMonth,
  CompensationModel,
} from "./compensation";
import { Timestamp } from "firebase/firestore";
import {
  fetchDocument,
  saveDocument,
  createTimeBasedDocId,
  queryTimeBasedDocuments,
  getFirestoreInstance,
  getCompanyName,
  fetchCollection,
} from "../lib/firestoreService";
import {
  processInBatches,
  transformToFirestoreFormat,
  transformFromFirestoreFormat,
} from "../utils/firestoreSyncUtils";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";

/**
 * Load compensation data from Firestore
 * Follows the path structure: companies/{companyName}/compensations/{employeeId}_{year}_{month}
 */
export async function loadCompensationFirestore(
  employeeId: string,
  year: number,
  month: number,
  companyName: string
): Promise<Compensation[]> {
  try {
    // Use utility functions from firestoreService
    const docId = createTimeBasedDocId(employeeId, year, month);
    const data = await fetchDocument<CompensationJsonMonth>(
      "compensations",
      docId,
      companyName
    );

    if (!data) {
      return []; // Document doesn't exist
    }

    const compensations: Compensation[] = [];

    // Convert Firestore document to Compensation array
    Object.entries(data.days).forEach(([dayStr, dayData]) => {
      const day = parseInt(dayStr);
      if (isNaN(day)) return;

      // Add type assertion since we know the document structure follows CompensationJsonMonth
      const typedDayData = dayData as CompensationJsonDay;

      compensations.push({
        employeeId,
        day,
        month,
        year,
        dayType: typedDayData.dayType,
        dailyRate: typedDayData.dailyRate,
        hoursWorked: typedDayData.hoursWorked,
        overtimeMinutes: typedDayData.overtimeMinutes,
        overtimePay: typedDayData.overtimePay,
        undertimeMinutes: typedDayData.undertimeMinutes,
        undertimeDeduction: typedDayData.undertimeDeduction,
        lateMinutes: typedDayData.lateMinutes,
        lateDeduction: typedDayData.lateDeduction,
        holidayBonus: typedDayData.holidayBonus,
        leaveType: typedDayData.leaveType,
        leavePay: typedDayData.leavePay,
        grossPay: typedDayData.grossPay,
        deductions: typedDayData.deductions,
        netPay: typedDayData.netPay,
        manualOverride: typedDayData.manualOverride,
        notes: typedDayData.notes,
        absence: typedDayData.absence,
        nightDifferentialHours: typedDayData.nightDifferentialHours || 0,
        nightDifferentialPay: typedDayData.nightDifferentialPay || 0,
      });
    });

    // Sort by day
    return compensations.sort((a, b) => a.day - b.day);
  } catch (error) {
    console.error(
      `Error loading Firestore compensation for ${employeeId} ${year}-${month}:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Load all compensation records for a specific employee
 */
export async function loadEmployeeCompensationFirestore(
  employeeId: string,
  companyName: string
): Promise<Compensation[]> {
  try {
    // Query all compensation documents for this employee
    const results = await queryTimeBasedDocuments<CompensationJsonMonth>(
      "compensations",
      employeeId,
      undefined, // All years
      undefined, // All months
      companyName
    );

    // Extract and flatten compensation records
    const compensations: Compensation[] = [];

    results.forEach((doc) => {
      const { meta, days } = doc;
      if (!meta || !days) return;

      Object.entries(days).forEach(([dayStr, dayData]) => {
        const day = parseInt(dayStr);
        if (isNaN(day)) return;

        // Add type assertion since we know the document structure follows CompensationJsonMonth
        const typedDayData = dayData as CompensationJsonDay;

        compensations.push({
          employeeId: meta.employeeId,
          day,
          month: meta.month,
          year: meta.year,
          dayType: typedDayData.dayType,
          dailyRate: typedDayData.dailyRate,
          hoursWorked: typedDayData.hoursWorked,
          overtimeMinutes: typedDayData.overtimeMinutes,
          overtimePay: typedDayData.overtimePay,
          undertimeMinutes: typedDayData.undertimeMinutes,
          undertimeDeduction: typedDayData.undertimeDeduction,
          lateMinutes: typedDayData.lateMinutes,
          lateDeduction: typedDayData.lateDeduction,
          holidayBonus: typedDayData.holidayBonus,
          leaveType: typedDayData.leaveType,
          leavePay: typedDayData.leavePay,
          grossPay: typedDayData.grossPay,
          deductions: typedDayData.deductions,
          netPay: typedDayData.netPay,
          manualOverride: typedDayData.manualOverride,
          notes: typedDayData.notes,
          absence: typedDayData.absence,
          nightDifferentialHours: typedDayData.nightDifferentialHours || 0,
          nightDifferentialPay: typedDayData.nightDifferentialPay || 0,
        });
      });
    });

    return compensations;
  } catch (error) {
    console.error(
      `Error loading all Firestore compensations for ${employeeId}:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Save or update compensation records in Firestore
 */
export async function saveCompensationFirestore(
  employeeId: string,
  year: number,
  month: number,
  records: Compensation[],
  recordsToBackup: Compensation[],
  companyName: string
): Promise<void> {
  try {
    const docId = createTimeBasedDocId(employeeId, year, month);

    // First fetch existing document if it exists
    const existingData = await fetchDocument<CompensationJsonMonth>(
      "compensations",
      docId,
      companyName
    );

    // Create backup entries for the changes
    const backupEntries: {
      day: number;
      field: string;
      oldValue: any;
      newValue: any;
    }[] = [];

    // Initialize the document data structure
    let docData: CompensationJsonMonth = {
      meta: {
        employeeId,
        year,
        month,
        lastModified: new Date().toISOString(),
      },
      days: {},
    };

    // If document exists, use its data as base
    if (existingData) {
      docData = {
        ...existingData,
        meta: {
          ...existingData.meta,
          lastModified: new Date().toISOString(),
        },
      };
    }

    // Update the document with the new records
    for (const record of records) {
      const dayStr = record.day.toString();
      const existingDay = docData.days[dayStr];

      // If this record should be backed up, record changes
      if (
        recordsToBackup &&
        recordsToBackup.some((r) => r.day === record.day)
      ) {
        if (existingDay) {
          // For each property, check if it changed
          Object.entries(record).forEach(([key, value]) => {
            if (
              key !== "employeeId" &&
              key !== "month" &&
              key !== "year" &&
              key !== "day" &&
              existingDay[key as keyof CompensationJsonDay] !== value
            ) {
              backupEntries.push({
                day: record.day,
                field: key,
                oldValue: existingDay[key as keyof CompensationJsonDay],
                newValue: value,
              });
            }
          });
        } else {
          // New day added, record all fields
          Object.entries(record).forEach(([key, value]) => {
            if (
              key !== "employeeId" &&
              key !== "month" &&
              key !== "year" &&
              key !== "day"
            ) {
              backupEntries.push({
                day: record.day,
                field: key,
                oldValue: null,
                newValue: value,
              });
            }
          });
        }
      }

      // Update the day data
      docData.days[dayStr] = {
        dayType: record.dayType,
        dailyRate: record.dailyRate,
        hoursWorked: record.hoursWorked,
        overtimeMinutes: record.overtimeMinutes,
        overtimePay: record.overtimePay,
        undertimeMinutes: record.undertimeMinutes,
        undertimeDeduction: record.undertimeDeduction,
        lateMinutes: record.lateMinutes,
        lateDeduction: record.lateDeduction,
        holidayBonus: record.holidayBonus,
        leaveType: record.leaveType,
        leavePay: record.leavePay,
        grossPay: record.grossPay,
        deductions: record.deductions,
        netPay: record.netPay,
        manualOverride: record.manualOverride,
        notes: record.notes,
        absence: record.absence,
        nightDifferentialHours: record.nightDifferentialHours,
        nightDifferentialPay: record.nightDifferentialPay,
      };
    }

    // Save the document using the utility function
    await saveDocument("compensations", docId, docData, companyName);

    // If there are changes, save backup
    if (backupEntries.length > 0) {
      await saveCompensationBackupFirestore(
        backupEntries,
        employeeId,
        year,
        month,
        companyName
      );
    }
  } catch (error) {
    console.error(
      `Error saving Firestore compensation for ${employeeId} ${year}-${month}:`,
      error
    );
    throw error;
  }
}

/**
 * Save or update specific compensation records in Firestore
 */
export async function saveOrUpdateCompensationsFirestore(
  compensationsToSave: Compensation[],
  month: number,
  year: number,
  employeeId: string,
  companyName: string
): Promise<void> {
  try {
    // Validate there are records to save
    if (!compensationsToSave || compensationsToSave.length === 0) {
      return;
    }

    // Fetch existing records
    const existingRecords = await loadCompensationFirestore(
      employeeId,
      year,
      month,
      companyName
    );

    // Create a map for faster lookups
    const existingRecordsMap = new Map<number, Compensation>();
    existingRecords.forEach((record) =>
      existingRecordsMap.set(record.day, record)
    );

    // Prepare lists for updated records and backup
    const updatedRecordsList: Compensation[] = [...existingRecords];
    const recordsToBackup: Compensation[] = [];
    let changesMade = false;

    // Process each compensation record
    for (const compensation of compensationsToSave) {
      const existingRecord = existingRecordsMap.get(compensation.day);

      if (existingRecord) {
        // Check if the record actually changed
        if (JSON.stringify(existingRecord) !== JSON.stringify(compensation)) {
          const index = updatedRecordsList.findIndex(
            (r) => r.day === compensation.day
          );
          if (index !== -1) {
            updatedRecordsList[index] = compensation; // Update in the list
            recordsToBackup.push(compensation);
            changesMade = true;
          }
        }
      } else {
        // New record, add it
        updatedRecordsList.push(compensation);
        recordsToBackup.push(compensation);
        changesMade = true;
      }
    }

    // Only save if changes were made
    if (changesMade) {
      // Sort records by day
      updatedRecordsList.sort((a, b) => a.day - b.day);

      // Save using the main save function
      await saveCompensationFirestore(
        employeeId,
        year,
        month,
        updatedRecordsList,
        recordsToBackup,
        companyName
      );
    }
  } catch (error) {
    console.error(
      `Error saving or updating Firestore compensations for ${employeeId} ${year}-${month}:`,
      error
    );
    throw error;
  }
}

/**
 * Save compensation backup to Firestore
 */
export async function saveCompensationBackupFirestore(
  changes: {
    day: number;
    field: string;
    oldValue: any;
    newValue: any;
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
      "compensation_backups",
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
    await saveDocument("compensation_backups", docId, backupData, companyName);
  } catch (error) {
    console.error(
      `Error saving Firestore compensation backup for ${employeeId} ${year}-${month}:`,
      error
    );
    // Don't throw error for backup failures to avoid blocking main operations
    console.warn("Backup operation failed but main save completed");
  }
}

export function createCompensationFirestore(model: CompensationModel) {
  const db = getFirestoreInstance();
  const collectionName = "compensations";

  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      let companyName: string;
      try {
        companyName = await getCompanyName();
        if (!companyName) {
          console.error(
            "[syncToFirestore - Compensation] Error: Company name could not be determined. Sync aborted."
          );
          throw new Error(
            "Company name could not be determined. Sync aborted."
          );
        }
        onProgress?.("Starting compensation sync to Firestore...");

        const allLocalCompensations = await model.loadAllCompensationRecords();

        if (!allLocalCompensations || allLocalCompensations.length === 0) {
          onProgress?.("No local compensation data to sync.");
          return;
        }
        onProgress?.(
          `Loaded ${allLocalCompensations.length} local compensation records.`
        );

        const groupedCompensations = allLocalCompensations.reduce(
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
              records: Compensation[];
            }
          >
        );

        const totalGroups = Object.keys(groupedCompensations).length;
        onProgress?.(
          `Grouped records into ${totalGroups} employee-month documents.`
        );
        let processedGroups = 0;

        for (const groupKey in groupedCompensations) {
          const group = groupedCompensations[groupKey];
          const { employeeId, year, month, records } = group;

          const docId = createTimeBasedDocId(employeeId, year, month);

          const daysData: { [day: string]: CompensationJsonDay } = {};
          records.forEach((comp) => {
            const dayEntry: CompensationJsonDay = {
              dayType: comp.dayType,
              dailyRate: comp.dailyRate,
              nightDifferentialHours: comp.nightDifferentialHours,
              nightDifferentialPay: comp.nightDifferentialPay,
            };

            if (comp.hoursWorked !== undefined)
              dayEntry.hoursWorked = comp.hoursWorked;
            if (comp.overtimeMinutes !== undefined)
              dayEntry.overtimeMinutes = comp.overtimeMinutes;
            if (comp.overtimePay !== undefined)
              dayEntry.overtimePay = comp.overtimePay;
            if (comp.undertimeMinutes !== undefined)
              dayEntry.undertimeMinutes = comp.undertimeMinutes;
            if (comp.undertimeDeduction !== undefined)
              dayEntry.undertimeDeduction = comp.undertimeDeduction;
            if (comp.lateMinutes !== undefined)
              dayEntry.lateMinutes = comp.lateMinutes;
            if (comp.lateDeduction !== undefined)
              dayEntry.lateDeduction = comp.lateDeduction;
            if (comp.holidayBonus !== undefined)
              dayEntry.holidayBonus = comp.holidayBonus;
            if (comp.leaveType !== undefined)
              dayEntry.leaveType = comp.leaveType;
            if (comp.leavePay !== undefined) dayEntry.leavePay = comp.leavePay;
            if (comp.grossPay !== undefined) dayEntry.grossPay = comp.grossPay;
            if (comp.deductions !== undefined)
              dayEntry.deductions = comp.deductions;
            if (comp.netPay !== undefined) dayEntry.netPay = comp.netPay;
            if (comp.manualOverride !== undefined)
              dayEntry.manualOverride = comp.manualOverride;
            if (comp.notes !== undefined) dayEntry.notes = comp.notes;
            if (comp.absence !== undefined) dayEntry.absence = comp.absence;

            daysData[comp.day.toString()] = dayEntry;
          });

          const docData: CompensationJsonMonth = {
            meta: {
              employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            days: daysData,
          };

          await saveDocument(collectionName, docId, docData, companyName);
          processedGroups++;
          onProgress?.(
            `Synced ${employeeId} ${year}-${month} (${processedGroups}/${totalGroups})`
          );
        }

        onProgress?.("Compensation sync to Firestore completed successfully.");
      } catch (error: any) {
        console.error(
          "[syncToFirestore - Compensation] Error during compensation sync to Firestore:",
          error
        );
        if (error instanceof Error) {
          console.error(
            `[syncToFirestore - Compensation] Error details: ${error.message}, Stack: ${error.stack}`
          );
        }
        throw new Error(
          `Failed to sync compensation to Firestore: ${error.message || error}`
        );
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      let companyName: string;
      try {
        companyName = await getCompanyName();
        if (!companyName) {
          console.error(
            "[syncFromFirestore - Compensation] Error: Company name could not be determined. Sync aborted."
          );
          throw new Error(
            "Company name could not be determined. Sync aborted."
          );
        }
        onProgress?.("Starting compensation sync from Firestore...");

        const firestoreDocs = await fetchCollection<CompensationJsonMonth>(
          collectionName,
          companyName
        );

        if (!firestoreDocs || firestoreDocs.length === 0) {
          onProgress?.(
            "No compensation data found in Firestore for this company."
          );
          return;
        }
        onProgress?.(
          `Retrieved ${firestoreDocs.length} compensation documents from Firestore.`
        );

        let allExtractedCompensations: Compensation[] = [];
        firestoreDocs.forEach((docData: CompensationJsonMonth) => {
          const { employeeId, year, month } = docData.meta;
          Object.entries(docData.days).forEach(
            ([dayStr, dayData]: [string, CompensationJsonDay]) => {
              const day = parseInt(dayStr);
              if (isNaN(day)) return;
              allExtractedCompensations.push({
                employeeId,
                year,
                month,
                day,
                dayType: dayData.dayType,
                dailyRate: dayData.dailyRate,
                hoursWorked: dayData.hoursWorked,
                overtimeMinutes: dayData.overtimeMinutes,
                overtimePay: dayData.overtimePay,
                undertimeMinutes: dayData.undertimeMinutes,
                undertimeDeduction: dayData.undertimeDeduction,
                lateMinutes: dayData.lateMinutes,
                lateDeduction: dayData.lateDeduction,
                holidayBonus: dayData.holidayBonus,
                leaveType: dayData.leaveType,
                leavePay: dayData.leavePay,
                grossPay: dayData.grossPay,
                deductions: dayData.deductions,
                netPay: dayData.netPay,
                manualOverride: dayData.manualOverride,
                notes: dayData.notes,
                absence: dayData.absence,
                nightDifferentialHours: dayData.nightDifferentialHours || 0,
                nightDifferentialPay: dayData.nightDifferentialPay || 0,
              });
            }
          );
        });

        if (allExtractedCompensations.length > 0) {
          const groupedByEmployeeMonthYear = allExtractedCompensations.reduce(
            (acc, record) => {
              const key = `${record.employeeId}_${record.year}_${record.month}`;
              if (!acc[key]) acc[key] = [];
              acc[key].push(record);
              return acc;
            },
            {} as Record<string, Compensation[]>
          );

          for (const key in groupedByEmployeeMonthYear) {
            const [employeeId, yearStr, monthStr] = key.split("_");
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);
            const recordsForMonth = groupedByEmployeeMonthYear[key];
            await model.saveOrUpdateCompensations(
              recordsForMonth,
              month,
              year,
              employeeId
            );
          }
          onProgress?.(
            `Successfully saved/updated ${allExtractedCompensations.length} records locally.`
          );
        } else {
          onProgress?.(
            "No individual compensation entries extracted from Firestore documents."
          );
        }

        onProgress?.(
          "Compensation sync from Firestore completed successfully."
        );
      } catch (error: any) {
        console.error(
          "[syncFromFirestore - Compensation] Error during compensation sync from Firestore:",
          error
        );
        if (error instanceof Error) {
          console.error(
            `[syncFromFirestore - Compensation] Error details: ${error.message}, Stack: ${error.stack}`
          );
        }
        throw new Error(
          `Failed to sync compensation from Firestore: ${
            error.message || error
          }`
        );
      }
    },
  };
}
