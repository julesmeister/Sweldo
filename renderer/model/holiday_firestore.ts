/**
 * Firestore implementation for holiday-related operations
 *
 * This module provides Firestore implementations for all holiday-related
 * operations that mirror the local filesystem operations in holiday.ts.
 */

import { Holiday, HolidayModel } from "./holiday";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  queryCollection,
  createTimeBasedDocId,
  getCompanyName,
} from "../lib/firestoreService";
import { db } from "../lib/db";

/**
 * Firestore structure for holidays document
 */
interface HolidayFirestoreData {
  meta: {
    year: number;
    month: number;
    lastModified: string;
  };
  holidays: {
    [id: string]: {
      startDate: string;
      endDate: string;
      name: string;
      type: "Regular" | "Special";
      multiplier: number;
    };
  };
}

/**
 * Creates a new holiday document ID for a specific year and month
 */
const createHolidayDocId = (year: number, month: number): string => {
  return `holidays_${year}_${month}`;
};

/**
 * Load holidays for a specific year and month from Firestore
 */
export async function loadHolidaysFirestore(
  year: number,
  month: number,
  companyName: string
): Promise<Holiday[]> {
  try {
    // Attempt to load from Dexie cache
    const cacheKey = [companyName, year, month] as const;
    const cachedRecords = await db.holidays
      .where("[companyName+year+month]")
      .equals(cacheKey)
      .toArray();

    if (cachedRecords.length > 0) {
      return cachedRecords.map((rec) => rec.data);
    }

    const docId = createHolidayDocId(year, month);
    const data = await fetchDocument<HolidayFirestoreData>(
      "holidays",
      docId,
      companyName
    );

    if (!data || !data.holidays) {
      return [];
    }

    // Convert to Holiday array
    const holidays: Holiday[] = Object.entries(data.holidays).map(
      ([id, holiday]) => ({
        id,
        startDate: new Date(holiday.startDate),
        endDate: new Date(holiday.endDate),
        name: holiday.name,
        type: holiday.type,
        multiplier: holiday.multiplier,
      })
    );

    // Store fetched holidays in cache
    const timestamp = Date.now();
    const records = holidays.map((h) => ({
      companyName,
      year,
      month,
      id: h.id,
      timestamp,
      data: h,
    }));
    await db.holidays.bulkPut(records);

    return holidays;
  } catch (error) {
    console.error(`Error loading holidays from Firestore:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Save a single holiday to Firestore
 */
export async function createHolidayFirestore(
  holiday: Holiday,
  year: number,
  month: number,
  companyName: string
): Promise<void> {
  try {
    await saveOrUpdateHolidayFirestore(holiday, year, month, companyName);
  } catch (error) {
    console.error(`Error creating holiday in Firestore:`, error);
    throw error;
  }
}

/**
 * Save or update a holiday in Firestore
 */
export async function saveOrUpdateHolidayFirestore(
  holiday: Holiday,
  year: number,
  month: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createHolidayDocId(year, month);

    // First check if document exists
    const existingDoc = await fetchDocument<HolidayFirestoreData>(
      "holidays",
      docId,
      companyName
    );

    if (!existingDoc) {
      // Create new document if it doesn't exist
      const newDoc: HolidayFirestoreData = {
        meta: {
          year,
          month,
          lastModified: new Date().toISOString(),
        },
        holidays: {
          [holiday.id]: {
            startDate: holiday.startDate.toISOString(),
            endDate: holiday.endDate.toISOString(),
            name: holiday.name,
            type: holiday.type,
            multiplier: holiday.multiplier,
          },
        },
      };

      await saveDocument("holidays", docId, newDoc, companyName);
    } else {
      // Update existing document
      const holidayData = {
        [`holidays.${holiday.id}`]: {
          startDate: holiday.startDate.toISOString(),
          endDate: holiday.endDate.toISOString(),
          name: holiday.name,
          type: holiday.type,
          multiplier: holiday.multiplier,
        },
        "meta.lastModified": new Date().toISOString(),
      };

      await updateDocument("holidays", docId, holidayData, companyName);
    }
  } catch (error) {
    console.error(`Error saving/updating holiday in Firestore:`, error);
    throw error;
  }
}

/**
 * Delete a holiday from Firestore
 */
export async function deleteHolidayFirestore(
  id: string,
  year: number,
  month: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createHolidayDocId(year, month);

    // Check if document exists
    const existingDoc = await fetchDocument<HolidayFirestoreData>(
      "holidays",
      docId,
      companyName
    );

    if (!existingDoc) {
      return; // Nothing to delete
    }

    // Update the document to remove the specific holiday
    const updateData = {
      [`holidays.${id}`]: deleteField(),
      "meta.lastModified": new Date().toISOString(),
    };

    await updateDocument("holidays", docId, updateData, companyName);
  } catch (error) {
    console.error(`Error deleting holiday from Firestore:`, error);
    throw error;
  }
}

/**
 * Save multiple holidays to Firestore (replaces all holidays for the month)
 */
export async function saveHolidaysFirestore(
  holidays: Holiday[],
  year: number,
  month: number,
  companyName: string
): Promise<void> {
  try {
    const docId = createHolidayDocId(year, month);

    // Create the holidays map
    const holidaysMap: HolidayFirestoreData["holidays"] = {};

    holidays.forEach((holiday) => {
      holidaysMap[holiday.id] = {
        startDate: holiday.startDate.toISOString(),
        endDate: holiday.endDate.toISOString(),
        name: holiday.name,
        type: holiday.type,
        multiplier: holiday.multiplier,
      };
    });

    // Create or replace the document
    const docData: HolidayFirestoreData = {
      meta: {
        year,
        month,
        lastModified: new Date().toISOString(),
      },
      holidays: holidaysMap,
    };

    await saveDocument("holidays", docId, docData, companyName, false); // false = don't merge
  } catch (error) {
    console.error(`Error saving holidays to Firestore:`, error);
    throw error;
  }
}

/**
 * Load holidays for a date range from Firestore
 * This is an example of a more complex query that's easier in Firestore than in local storage
 */
export async function loadHolidaysForDateRangeFirestore(
  startDate: Date,
  endDate: Date,
  companyName: string
): Promise<Holiday[]> {
  try {
    // Get the year and month ranges we need to query
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;

    const allHolidays: Holiday[] = [];

    // Query each month in the range
    for (let year = startYear; year <= endYear; year++) {
      // Determine month range for this year
      const firstMonth = year === startYear ? startMonth : 1;
      const lastMonth = year === endYear ? endMonth : 12;

      for (let month = firstMonth; month <= lastMonth; month++) {
        const monthHolidays = await loadHolidaysFirestore(
          year,
          month,
          companyName
        );

        // Filter holidays that fall within our date range
        const filteredHolidays = monthHolidays.filter(
          (holiday) =>
            (holiday.startDate >= startDate && holiday.startDate <= endDate) ||
            (holiday.endDate >= startDate && holiday.endDate <= endDate) ||
            (holiday.startDate <= startDate && holiday.endDate >= endDate)
        );

        allHolidays.push(...filteredHolidays);
      }
    }

    return allHolidays;
  } catch (error) {
    console.error(
      `Error loading holidays for date range from Firestore:`,
      error
    );
    return []; // Return empty array on error
  }
}

/**
 * Create a Firestore instance for the holiday model
 */
export function createHolidayFirestoreInstance(model: HolidayModel) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      onProgress?.("Starting holiday sync to Firestore...");
      try {
        // Load all holidays from the model
        const holidays = await model.loadAllHolidaysForSync();
        onProgress?.(`Loaded ${holidays.length} local holidays for sync.`);

        if (holidays.length === 0) {
          onProgress?.("No local holidays to sync.");
          return;
        }

        // Group holidays by year and month
        const holidaysByMonth = holidays.reduce(
          (acc: Record<string, Holiday[]>, holiday: Holiday) => {
            const year = holiday.startDate.getFullYear();
            const month = holiday.startDate.getMonth() + 1; // getMonth() is 0-indexed

            const key = `${year}_${month}`;
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(holiday);
            return acc;
          },
          {}
        );

        // Process each month's holidays
        const months = Object.keys(holidaysByMonth);
        for (let i = 0; i < months.length; i++) {
          const [yearStr, monthStr] = months[i].split("_");
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);
          const monthHolidays = holidaysByMonth[months[i]];

          onProgress?.(
            `Processing holidays for ${year}-${month} (${i + 1}/${
              months.length
            })`
          );
          await saveHolidaysFirestore(
            monthHolidays,
            year,
            month,
            await getCompanyName()
          );
        }

        onProgress?.("Holiday sync to Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing holidays to Firestore:", error);
        onProgress?.(
          `Error syncing holidays: ${
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
        onProgress?.("Starting holiday sync from Firestore...");
        const companyName = await getCompanyName();

        // Get current year and month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Load holidays for current month
        const holidays = await loadHolidaysFirestore(
          currentYear,
          currentMonth,
          companyName
        );

        onProgress?.(`Retrieved ${holidays.length} holidays from Firestore.`);

        // Save holidays to the model
        await model.saveHolidays(holidays);

        onProgress?.("Holiday sync from Firestore completed successfully.");
      } catch (error) {
        console.error("Error syncing holidays from Firestore:", error);
        throw error;
      }
    },
  };
}
