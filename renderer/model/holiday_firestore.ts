/**
 * Firestore implementation for holiday-related operations
 *
 * This module provides Firestore implementations for all holiday-related
 * operations that mirror the local filesystem operations in holiday.ts.
 */

import { Holiday } from "./holiday";
import {
  fetchDocument,
  saveDocument,
  updateDocument,
  deleteField,
  queryCollection,
  createTimeBasedDocId,
} from "../lib/firestoreService";

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
