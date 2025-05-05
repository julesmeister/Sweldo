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
} from "./attendance";
import { Timestamp, DocumentReference } from "firebase/firestore";
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
} from "../lib/firestoreService";

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
  if (!attendances.length) return;

  try {
    const docId = createTimeBasedDocId(employeeId, year, month);

    // First fetch existing document if it exists
    const existingData = await fetchDocument<AttendanceJsonMonth>(
      "attendances",
      docId,
      companyName
    );

    // Prepare backup entries for changes if document exists
    const backupEntries: {
      day: number;
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];

    // Initialize the document data structure
    let docData: AttendanceJsonMonth = {
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

    // Process each attendance record
    for (const attendance of attendances) {
      const dayStr = attendance.day.toString();
      const existingDay = docData.days[dayStr];

      // Check for changes and create backup entries
      if (existingDay) {
        if (existingDay.timeIn !== attendance.timeIn) {
          backupEntries.push({
            day: attendance.day,
            field: "timeIn",
            oldValue: existingDay.timeIn,
            newValue: attendance.timeIn,
          });
        }

        if (existingDay.timeOut !== attendance.timeOut) {
          backupEntries.push({
            day: attendance.day,
            field: "timeOut",
            oldValue: existingDay.timeOut,
            newValue: attendance.timeOut,
          });
        }
      }

      // Update the day data
      docData.days[dayStr] = {
        timeIn: attendance.timeIn,
        timeOut: attendance.timeOut,
        schedule: attendance.schedule,
      };
    }

    // Save the document using the utility function
    await saveDocument("attendances", docId, docData, companyName);

    // If there are changes, save backup
    if (backupEntries.length > 0) {
      await saveAttendanceBackupFirestore(
        backupEntries,
        employeeId,
        year,
        month,
        companyName
      );
    }
  } catch (error) {
    console.error(
      `Error saving Firestore attendance for ${employeeId} ${year}-${month}:`,
      error
    );
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
 * Load alternative times from Firestore
 */
export async function loadAlternativeTimesFirestore(
  employeeId: string,
  companyName: string
): Promise<string[]> {
  try {
    // Use fetchDocument utility function
    const data = await fetchDocument<SharedAlternatives>(
      "alternatives",
      employeeId,
      companyName
    );

    return data?.times || [];
  } catch (error) {
    console.error(
      `Error loading Firestore alternative times for ${employeeId}:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Save alternative times to Firestore
 */
export async function saveAlternativeTimesFirestore(
  employeeId: string,
  times: string[],
  companyName: string
): Promise<void> {
  try {
    // Basic validation
    if (!Array.isArray(times)) {
      throw new Error(
        "Invalid alternatives format. Expected an array of strings."
      );
    }

    // Structure data for Firestore
    const dataToSave: SharedAlternatives = { times };

    // Save document using utility function
    await saveDocument("alternatives", employeeId, dataToSave, companyName);
  } catch (error) {
    console.error(
      `Error saving Firestore alternative times for ${employeeId}:`,
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
