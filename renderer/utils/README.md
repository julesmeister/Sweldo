# Utility Functions

This directory contains utility functions used throughout the application.

## timeProcessor.ts

The `timeProcessor.ts` file contains functions for processing time entries from Excel data and converting them to attendance records. This utility was extracted from the `payroll.ts` model to improve code organization and maintainability.

### Functions

#### `processTimeEntry`

Processes a single time entry from Excel data and converts it to an attendance record.

```typescript
function processTimeEntry(
  timeString: string | null,
  dayIndex: number,
  month: number,
  year: number,
  employeeId: string,
  employeeName: string,
  employeeType: string | undefined,
  employmentTypes: EmploymentType[],
  nextDayTimeString?: string | null
): {
  attendance: Attendance;
  missingTimeLog?: MissingTimeLog;
}
```

#### `processTimeEntries`

Processes a row of time entries from Excel data.

```typescript
function processTimeEntries(
  timeList: (string | null)[],
  employeeId: string,
  employeeName: string,
  employeeType: string | undefined,
  employmentTypes: EmploymentType[],
  month: number,
  year: number
): {
  attendances: Attendance[];
  missingTimeLogs: MissingTimeLog[];
}
```

### Usage

These functions are used in the `payroll.ts` model to process time entries from Excel data. The functions handle:

1. Parsing time strings from Excel cells
2. Determining time in and time out based on employee schedules
3. Handling night shifts by looking at the next day's time entries
4. Creating attendance records and missing time logs 