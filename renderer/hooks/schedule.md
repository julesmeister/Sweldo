# Schedule Fetching Logic (Post-Migration)

This document outlines how employee work schedules are determined after the migration from CSV-based settings (`settings_old.ts`) to JSON-based settings (`settings.ts`).

## Key Changes

The primary change is the centralization and asynchronous handling of schedule retrieval.

1.  **Centralized Logic:** Schedule fetching for a specific date is now handled exclusively by the **asynchronous instance method** `AttendanceSettingsModel.getScheduleForDate(employmentTypeInput, date)`.
2.  **Asynchronous Operation:** Because fetching might involve reading monthly schedule files from the filesystem, the `getScheduleForDate` method is `async` and returns a `Promise<DailySchedule | null>`.
3.  **No More Standalone Helpers:** The old synchronous helper functions (`getScheduleForDate`, `getScheduleForDay`) previously exported from `settings_old.ts` have been **removed**. Direct imports of these functions will fail.
4.  **Efficiency:** The new method loads monthly schedules on demand, avoiding loading all monthly data for all employment types into memory at once.

## How `getScheduleForDate` Works

When `await model.getScheduleForDate(employmentTypeInput, date)` is called:

1.  **Input:** It accepts either a full `EmploymentType` object or just the employment type name (string). If a string is provided, it first loads the necessary `EmploymentType` details internally.
2.  **Monthly Check:** It constructs the path to the relevant monthly schedule JSON file (e.g., `SweldoDB/schedules/regular/2024_07_schedule.json`) based on the employment type, year, and month.
3.  **File Read:** It attempts to read this JSON file asynchronously.
4.  **Date Check:** If the file exists and contains an entry for the specific `date` (formatted as "YYYY-MM-DD"), it returns that `DailySchedule` object (`{ timeIn, timeOut, isOff? }`).
5.  **Weekly Fallback:** If the monthly file doesn't exist, is empty, or doesn't contain an entry for the specific date, it falls back to the default weekly schedule defined in the `employmentType.schedules` array (loaded from `timeSettings.json`). It determines the correct day's schedule based on `date.getDay()`.
6.  **No Schedule:** If no schedule is found in either the monthly file or the weekly definition, it returns `null`.

## Required Usage Pattern

Any hook, component, or utility function that needs to determine the work schedule for a specific date **must**:

1.  **Get Model Instance:** Obtain an instance of `AttendanceSettingsModel` (usually created via `createAttendanceSettingsModel(dbPath)`).
2.  **Call Asynchronously:** Use `await` when calling `model.getScheduleForDate(type, date)`.
3.  **Handle Promise:** Process the returned `Promise<DailySchedule | null>`.
4.  **Use `DailySchedule`:** Utilize the properties (`timeIn`, `timeOut`, `isOff`) of the resulting `DailySchedule` object.

**Do not attempt to import or call `getScheduleForDate` or `getScheduleForDay` as standalone functions.**

