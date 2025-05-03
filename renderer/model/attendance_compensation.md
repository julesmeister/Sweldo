# Attendance and Compensation Data Management

This document outlines the structure and logic for saving and loading attendance and compensation data using CSV and JSON files within the Sweldo application.

## File Structure

Attendance and compensation data are stored in separate files organized by employee ID, year, and month. Shared alternative times are stored in a JSON file per employee. The base directory is determined by the `dbPath` provided during model creation.

- **Base Path:** `<dbPath>/SweldoDB/attendances/`
- **Daily Attendance Files (CSV):** `<basePath>/<employeeId>/<year>_<month>_attendance.csv`
- **Shared Alternative Times (JSON):** `<basePath>/<employeeId>/alternatives.json`
- **Compensation Files (CSV):** `<basePath>/<employeeId>/<year>_<month>_compensation.csv`

*Note: The `CompensationModel` currently uses the `attendances` subdirectory path in its factory function (`createCompensationModel`). This might need correction to a dedicated `compensations` directory if desired, although both models currently read/write within the structure defined above.*

## Attendance Data (`renderer/model/attendance.ts`)

This model handles reading and writing daily attendance records (time in/out) and shared alternative time options.

### Loading Data

1.  **`loadAttendancesById(month, year, employeeId)`**:
    *   Constructs the file path: `<basePath>/<employeeId>/<year>_<month>_attendance.csv`.
    *   Reads and parses the CSV file.
    *   Maps each row to an `Attendance` object (containing `employeeId`, `day`, `month`, `year`, `timeIn`, `timeOut`).
    *   **Does not** load alternative times from this file.
    *   Returns the resulting array of `Attendance` objects or an empty array on error/file not found.

2.  **`loadAttendanceByDay(day, month, year, employeeId)`**:
    *   Loads the specific CSV file for the month/year.
    *   Finds the row matching the given `day`.
    *   Returns the single mapped `Attendance` object if found, otherwise `null`.
    *   **Does not** load alternative times from this file.

3.  **`loadAlternativeTimes(employeeId)`**:
    *   Constructs the file path: `<basePath>/<employeeId>/alternatives.json`.
    *   Reads the JSON file content.
    *   If the file exists and contains valid JSON in the format `{ "times": ["...", "..."] }`, it parses the file and returns the `times` array (`string[]`).
    *   If the file doesn't exist, is empty, or contains invalid JSON, it logs a warning and returns an empty array `[]`.

### Saving Data

1.  **`saveAttendances(attendances, month, year, employeeId)`**:
    *   **(Deprecated)** This method likely doesn't reflect the current data structure and backup strategy. Use `saveOrUpdateAttendances`.
    *   Writes only the basic `Attendance` fields (no alternatives) to the CSV. Does not handle backups.

2.  **`saveOrUpdateAttendances(attendancesToSave, month, year, employeeId)`**:
    *   This is the primary method for saving daily attendance changes.
    *   Ensures the target directory exists.
    *   Loads existing daily records for the month.
    *   Compares input records (`attendancesToSave`) with existing ones based on `day`.
    *   Updates existing records or adds new ones based only on `timeIn` and `timeOut` changes.
    *   Collects only the records that were actually added or modified.
    *   If changes were made:
        *   Sorts the full list of records for the month by day.
        *   Prepares the data for CSV (only `employeeId`, `day`, `month`, `year`, `timeIn`, `timeOut` columns).
        *   Writes the complete, updated list to the primary `..._attendance.csv` file using `Papa.unparse` (with headers).
        *   Calls the internal `appendToBackup` helper to append *only the changed/added* records (with a timestamp) to the `..._attendance_backup.csv` file.
    *   **Updates Alternatives:** After successfully saving the attendance CSV and backup, it loads the existing `alternatives.json` for the employee, checks if the `timeIn` or `timeOut` values from the just-saved records are new, adds any new unique times to the list, and saves the updated list back to `alternatives.json`. This ensures the suggestions list grows automatically. (Errors during this step are logged but do not prevent the main attendance save).

3.  **`saveAlternativeTimes(employeeId, times)`**:
    *   Constructs the file path: `<basePath>/<employeeId>/alternatives.json`.
    *   Ensures the target directory exists.
    *   Validates that the input `times` is an array.
    *   Creates a JSON object `{ "times": [...] }` from the input array.
    *   Writes the JSON string (pretty-printed) to the `alternatives.json` file, overwriting any previous content.
    *   Throws an error if the input format is invalid or if writing fails.

## Compensation Data (`renderer/model/compensation.ts`)

This model handles reading and writing daily compensation details, including rates, hours, deductions, and pay calculations.

### Loading Data

1.  **`loadRecords(month, year, employeeId)`**:
    *   Constructs the file path: `<basePath>/<employeeId>/<year>_<month>_compensation.csv`.
    *   Reads the file content using `window.electron.readFile`.
    *   If the file is empty or not found, returns an empty array `[]`.
    *   Parses the CSV content using `Papa.parse` (with headers and skipping empty lines).
    *   Maps each row to a `Compensation` object:
        *   Parses numeric fields (`month`, `year`, `day`, `dailyRate`, `hoursWorked`, `overtimeMinutes`, `overtimePay`, `undertimeMinutes`, `undertimeDeduction`, `lateMinutes`, `lateDeduction`, `holidayBonus`, `leavePay`, `grossPay`, `deductions`, `netPay`, `nightDifferentialHours`, `nightDifferentialPay`) using `parseInt` or `parseFloat`. If the corresponding CSV value is missing or empty, the field is set to `undefined`.
        *   Parses boolean fields (`manualOverride`, `absence`) by checking if the string value is exactly `"true"`.
        *   Assigns string fields directly (`employeeId`, `notes`).
        *   Assigns `dayType` (casting to `DayType`), defaulting to `"Regular"` if the CSV value is missing.
        *   Assigns `leaveType`.
    *   Returns the array of `Compensation` objects.
    *   Catches potential errors during file reading or parsing and returns an empty array.

### Saving Data

1.  **`saveOrUpdateRecords(employeeId, year, month, records)`**:
    *   Constructs the target file path: `<basePath>/<employeeId>/<year>_<month>_compensation.csv`.
    *   Converts the entire provided `records` array (assumed to be complete for the month) into a CSV string using `Papa.unparse`.
    *   Writes the CSV string to the file using `window.electron.writeFile`, completely overwriting any existing content for that specific month/year/employee.
    *   Propagates any file writing errors upwards.

2.  **`saveOrUpdateCompensations(compensations, month, year, employeeId)`**:
    *   This method handles merging updates into the monthly compensation file.
    *   Performs basic validation on the `month`, `year`, and `day` fields of each object in the input `compensations` array. It throws an `Error` if values are outside expected ranges (e.g., month not 1-12).
    *   Loads the *entire* set of existing compensation records for the specified month, year, and employee using `loadRecords`.
    *   Creates a mutable copy (`updatedRecords`) of the existing records.
    *   Iterates through the `compensations` provided as input (these are the records to be added or updated).
    *   For each input compensation object:
        *   It searches (`findIndex`) within the `updatedRecords` list for a record matching the same `month`, `year`, and `day`.
        *   **If found (index >= 0):** It replaces the entire record at that index in `updatedRecords` with the input compensation object.
        *   **If not found:** It appends the input compensation object to the end of the `updatedRecords` list.
    *   After processing all input compensations, it calls `saveOrUpdateRecords`, passing the complete `updatedRecords` list. This overwrites the existing CSV file with the merged data.
    *   **Backup:** The `saveOrUpdateRecords` method (called internally) handles appending the changed records to the corresponding backup file (`..._compensation_backup.csv`) with timestamps.
    *   Propagates any errors encountered during the process.

## Backup Strategy: Append-Only Log Files

*(This section can be filled in once a backup strategy is implemented. Potential approaches include:*
*   *Creating timestamped copies of CSV files before overwriting.*
*   *Copying the entire `<dbPath>/SweldoDB/attendances/` directory to a backup location.*
*   *Using version control (like Git) if appropriate for the deployment environment.)*

A backup strategy is implemented to track changes made to attendance and compensation data over time. This provides a historical log of modifications.

1.  **Backup File Location:** For each primary data file (`<year>_<month>_attendance.csv` or `<year>_<month>_compensation.csv`), a corresponding backup file is created in the *same directory*.
2.  **Backup File Naming:** The backup file name is derived from the original file name by appending `_backup`.
    *   Attendance Backup: `<basePath>/<employeeId>/<year>_<month>_attendance_backup.csv`
    *   Compensation Backup: `<basePath>/<employeeId>/<year>_<month>_compensation_backup.csv`
3.  **Mechanism:** The backup files function as append-only logs. Every time a save operation is successfully completed on the primary data file (using methods like `saveOrUpdateAttendances` or `saveOrUpdateCompensations`), the specific records that were saved (whether updated or newly added) are *appended* as new rows to the corresponding backup file. The backup file is *never overwritten* by these operations (though new rows are added). If the backup file doesn't exist, it's created with headers.
4.  **Backup File Format:**
    *   The structure of the backup file mirrors the primary data file, with one crucial addition:
    *   **Timestamp Column:** The very first column in every backup CSV file is `timestamp`. This column stores an ISO 8601 formatted timestamp string (e.g., `2023-10-27T10:30:00.123Z`) indicating precisely when the record was saved to the primary file.
    *   **Data Columns:** All the original columns from the primary data file follow the `timestamp` column. (Note: For attendance backups, this no longer includes alternative times).
    *   **Headers:** The backup file includes a header row reflecting this structure (e.g., `timestamp,employeeId,day,month,year,timeIn,timeOut`). When appending, headers are only added if the file is being newly created.

**Example Backup Row (Attendance):**

```csv
timestamp,employeeId,day,month,year,timeIn,timeOut
2024-01-15T09:05:12.345Z,EMP001,15,1,2024,08:00,17:00
```

## Data Migration

### Migrating Alternative Times from CSV to JSON

If you are upgrading from a version where alternative times were stored within each daily attendance CSV file (in `alternativeTimeIns` and `alternativeTimeOuts` columns), a migration function is provided to transition to the centralized `alternatives.json` format.

**Function:** `migrateAttendanceAlternatives(dbPath: string, onProgress?: (message: string) => void)`

Located in `renderer/model/attendance.ts` (exported, defined outside the `AttendanceModel` class).

**Process:**

1.  **Requires `dbPath`:** You need to provide the path to the root `SweldoDB` directory.
2.  **Iterates Employees:** It scans the `<dbPath>/SweldoDB/attendances/` directory for employee subdirectories.
3.  **Scans CSVs:** For each employee, it reads all `*_attendance.csv` files.
4.  **Detects Old Format:** It checks if the CSV headers contain `alternativeTimeIns` or `alternativeTimeOuts`.
5.  **Extracts & Collects:** If old columns are found, it parses the JSON arrays within them for each row and collects all unique, valid time strings (`HH:MM` format) into a temporary set.
6.  **Saves `alternatives.json`:** If any old-format files were found for an employee, it saves the sorted list of unique times to `<basePath>/<employeeId>/alternatives.json` using the `saveAlternativeTimes` model method. If saving fails, it skips rewriting CSVs for that employee.
7.  **Rewrites CSVs:** After successfully saving `alternatives.json`, it rereads the old-format CSVs for that employee and rewrites them, explicitly including only the standard columns (`employeeId`, `day`, `month`, `year`, `timeIn`, `timeOut`) and removing the old alternative columns.
8.  **Progress Reporting:** An optional `onProgress` callback can be provided to receive status messages during the migration (e.g., which employee is being processed, files found, errors encountered).

**How to Run:**

You will need to call this function once from your application logic, perhaps triggered by a button in a settings page or run automatically on first launch after an update. Make sure to handle potential errors thrown by the function.

**Example Usage (Conceptual):**

```typescript
import { migrateAttendanceAlternatives } from '@/renderer/model/attendance';

async function runMigration() {
  const dbPath = "path/to/your/SweldoDB/parent"; // Get the base path
  try {
    await migrateAttendanceAlternatives(dbPath, (message) => {
      console.log("Migration Progress:", message);
      // Update UI with progress message if desired
    });
    alert("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    alert("Migration failed. Check console for details.");
  }
}
```
