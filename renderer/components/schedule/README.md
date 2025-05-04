me# Schedule Components (`renderer/components/schedule`)

This directory contains components related to viewing and editing employee work schedules.

## File Structure

Monthly schedules are now stored individually to improve scalability and prevent the main `timeSettings.json` file from becoming too large. The structure is:

```
SweldoDB/
  ├── schedules/
  │   ├── {employment-type-name}/
  │   │   ├── {YYYY}_{MM}_schedule.json  <-- Contains schedules for a specific month
  │   │   └── ...
  │   └── ...
  └── timeSettings.json                  <-- Contains base Employment Type info (name, hours, weekly pattern, etc.)
  └── settings.json                      <-- Contains general attendance settings
  └── ... (other data files)
```

*   `{employment-type-name}`: The sanitized name of the employment type (e.g., `regular`, `hk-1`).
*   `{YYYY}_{MM}_schedule.json`: Contains the schedule data for a specific year and month (e.g., `2025_04_schedule.json`). The content is a JSON object where keys are date strings (`YYYY-MM-DD`) and values are `DailySchedule` objects (`{ timeIn: string, timeOut: string, isOff?: boolean }`).

## Components

*   **`WeeklyPatternSchedule.tsx`**: Displays and allows editing of the default weekly work schedule pattern (Monday-Sunday) for an employment type. This pattern is used as a fallback if no month-specific schedule is defined for a given date.
*   **`MonthSpecificSchedule.tsx`**: Displays a calendar-like view for a specific month, allowing users to view, set, or override the schedule for individual days within that month for a specific employment type. This overrides the default weekly pattern for those specific dates.

## Data Access Algorithms (`renderer/model/settings.ts`)

### Fetching Schedule for a Specific Date (`getScheduleForDate`)

When the application needs the schedule for a specific employee type and date:

1.  **Identify Month File:** Determine the year and month from the target date. Construct the expected path to the monthly schedule file (e.g., `SweldoDB/schedules/hk-1/2025_04_schedule.json`).
2.  **Read Month File:** Attempt to read the JSON content of the identified monthly schedule file.
3.  **Check Specific Date:** If the file exists and contains valid, non-empty JSON, check if there's an entry specifically for the target date (using the `YYYY-MM-DD` key).
    *   **If Found:** Return the `DailySchedule` object for that specific date.
4.  **Fallback to Weekly Pattern:** If the monthly file doesn't exist, is empty (`{}`), or doesn't have an entry for the specific date:
    *   Load the base `EmploymentType` data from `timeSettings.json`.
    *   If the `EmploymentType` has a defined weekly `schedules` array:
        *   Determine the day of the week (1-7, Mon-Sun) for the target date.
        *   Retrieve the corresponding schedule from the weekly array.
        *   **If Found:** Return this weekly schedule as a `DailySchedule` object.
5.  **No Schedule:** If neither a specific monthly schedule nor a applicable weekly pattern schedule is found, return `null` (indicating no schedule defined).

### Saving a Monthly Schedule (`saveMonthSchedule`)

When changes are made to a month's schedule in the `MonthSpecificSchedule` component:

1.  **Identify Month File:** Determine the target employment type, year, and month.
2.  **Construct Path:** Generate the full path to the specific monthly schedule file (e.g., `SweldoDB/schedules/hk-1/2025_04_schedule.json`).
3.  **Ensure Directory:** Verify that the directory for the employment type exists within `SweldoDB/schedules/`. If not, create it.
4.  **Write File:** Write the entire updated `MonthSchedule` object (containing all dates and their `DailySchedule` for that specific month) to the JSON file, completely overwriting the previous file content for that month. 