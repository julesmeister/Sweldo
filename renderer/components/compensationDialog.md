# CompensationDialog Calculation Logic

This document outlines the core logic used within the `CompensationDialog.tsx` component, specifically within the `computedValues` memoized calculation, to determine the various pay and time metrics for a given day.

## Recent Changes & Refinements (July 2024)

Several updates were made to improve usability and fix issues:

1.  **Asynchronous Schedule Loading:** The dialog now correctly uses the `useSchedule` hook, passing the required `AttendanceSettingsModel` instance. It properly handles the initial `null` state while schedule information is loaded asynchronously, displaying "Loading Schedule..." in the header.
2.  **`handleClearAndOverride` Functionality:** Clicking the '×' (clear) button next to an editable field now:
    *   Sets the field's value to `0`.
    *   **Automatically enables** the `Manual Override` toggle.
    *   **Immediately recalculates** dependent fields (`grossPay`, `netPay`, `deductions`) based on the cleared value, mirroring the logic in `handleInputChange`.
3.  **`FormField` Component Updates:**
    *   The internal logic for the `disabled` state of input fields was corrected. Fields are now disabled only if the user lacks edit access OR if the field is marked as `isComputedField` and `manualOverride` is false.
    *   The clear button ('×') now triggers the `handleClearAndOverride` function.
4.  **"Leave Pay" Field Behavior:**
    *   The "Leave Pay" field is now treated like other computed fields regarding editability: it is **disabled by default** and only becomes editable when `Manual Override` is turned **on**.
    *   The input for "Leave Pay" is now treated as an **integer** (whole number), and the displayed value is rounded accordingly for easier editing.

## Overview

The calculation aims to determine compensation based on attendance (`timeIn`, `timeOut`), the employee's schedule (`scheduleInfo` from `useSchedule`), holiday status, and configured attendance settings.

It handles different scenarios like absence, presence on workdays, presence on rest days, and presence on holidays. It also respects the `manualOverride` flag.

## Calculation Steps (within `computedValues` `useMemo`)

1.  **Prerequisites Check:**
    *   The hook first verifies that `employmentType`, `attendanceSettings`, and `scheduleInfo` have been successfully loaded. `scheduleInfo` comes from the `useSchedule` hook and contains the specific daily schedule (`scheduleInfo.schedule`), rest day status (`scheduleInfo.isRestDay`), and general schedule existence (`scheduleInfo.hasSchedule`).
    *   If any of these prerequisites are missing (e.g., `null` during initial load), the calculation returns default values (mostly zeros, base `dailyRate` for pay) to prevent errors.

2.  **Input Gathering:**
    *   Uses the current `formData` state (which might contain manually edited values).
    *   Uses the `employee` prop (primarily for `employee.dailyRate`).
    *   Uses the loaded `holidays` array.
    *   Uses the `timeIn` and `timeOut` props passed to the dialog.
    *   Uses the resolved `scheduleInfo` object.

3.  **Status Determination:**
    *   **Holiday:** Checks if the `date` (derived from `year`, `month`, `day` props) falls on any date within the `holidays` array using `isHolidayDate`.
    *   **Presence:** Checks if both `timeIn` and `timeOut` props have values.
    *   **Workday:** Checks if a schedule exists and it's not an off day (`scheduleInfo.hasSchedule && !scheduleInfo.isRestDay`).
    *   **Paid Holiday:** Checks if it's a holiday and if that holiday has a `multiplier > 0`.

4.  **Scenario Handling:**
    *   **A) If Absent (`!isPresent`):**
        *   If it's a *Paid Holiday*: Calculates base pay (e.g., `dailyRate * 1.0`) and sets most other metrics (like `hoursWorked`, `overtimePay`, `holidayBonus`) to zero. Sets `absence` flag to `false` (as the employee is paid). Returns these base values.
        *   If it's a *Regular Workday* or *Unpaid Holiday*: Returns zero for all pay/time metrics and sets the `absence` flag to `true`.
    *   **B) If Present (`isPresent`):**
        *   If it's a *Rest Day* (`scheduleInfo.isRestDay`) or `attendanceSettings` are missing: Calculates basic `hoursWorked` from `timeIn`/`timeOut`. Calculates basic `overtimeMinutes` and `overtimePay` based on `hoursWorked` vs `standardHours`. Calculates `presentPay` (base `dailyRate` or `dailyRate * holiday.multiplier`). Returns these limited metrics.
        *   If it's a *Scheduled Workday* (and `timeIn`/`timeOut` are present):
            *   Calls `createTimeObjects(..., scheduleInfo.schedule)` to get `actual` and `scheduled` Date objects.
            *   *Fallback:* If `createTimeObjects` fails to return `scheduled` (e.g., `scheduleInfo.schedule` was missing `timeIn`/`timeOut`), it logs a warning and returns base pay as a fallback.
            *   Calls `calculateTimeMetrics(actual, scheduled, ...)` to get detailed time metrics (late, undertime, OT minutes, hours worked).
            *   Calls `calculatePayMetrics(timeMetrics, ...)` to get detailed pay metrics (gross/net pay, deductions, OT pay, holiday bonus, night diff pay).
            *   Returns the combined, detailed time and pay metrics.

5.  **Applying Computed Values:**
    *   A separate `useEffect` hook watches `computedValues` and `formData.manualOverride`.
    *   If `manualOverride` is `false`, this effect updates the `formData` state with the latest `computedValues`.
    *   This ensures that automatic calculations only apply when manual override is off.

6.  **Manual Override Interaction:**
    *   If the user edits a computed field (like `overtimePay`, `lateMinutes`, etc.) directly in the dialog, the `handleInputChange` function prevents the change unless `manualOverride` is `true`.
    *   If the user clicks the '×' (clear) button next to a computed field, the `handleClearAndOverride` function sets that field to `0` in `formData` **and** sets `formData.manualOverride` to `true`.

7.  **Computation Breakdown:**
    *   The `ComputationBreakdownButton` component is rendered.
    *   If `formData.manualOverride` is true, it receives a breakdown constructed directly from the current `formData` values.
    *   If `formData.manualOverride` is false, it receives a breakdown generated by calling `getPaymentBreakdown` using the *recalculated* metrics based on the latest `timeIn`, `timeOut`, `scheduleInfo`, etc. (similar to the main `computedValues` logic).

This separation ensures that the dialog displays values consistent with its state (manual or computed) while allowing the breakdown to always show the theoretical calculation based on current inputs when not in manual override mode.

## Compensation Fields Explained

This section describes the fields present in the `Compensation` interface and displayed/editable in the dialog:

*   **`employeeId` (string):** Identifier for the employee.
*   **`month` (number):** The month (1-12).
*   **`year` (number):** The year.
*   **`day` (number):** The day of the month.
*   **`dayType` (DayType):** Type of day (`Regular`, `Holiday`, `Rest Day`, `Special`). Automatically determined based on schedule and holidays, but can be manually overridden.
*   **`dailyRate` (number):** Employee's base daily rate. Used as the basis for most pay calculations.
*   **`hoursWorked` (number, optional):** Total hours worked for the day. Computed based on `timeIn` and `timeOut`.
*   **`overtimeMinutes` (number, optional):** Minutes worked beyond the standard hours or scheduled time, based on `attendanceSettings`.
*   **`overtimePay` (number, optional):** Calculated pay for overtime minutes.
*   **`undertimeMinutes` (number, optional):** Minutes short of the required work hours based on schedule and `timeOut`.
*   **`undertimeDeduction` (number, optional):** Calculated deduction for undertime minutes (considering grace period).
*   **`lateMinutes` (number, optional):** Minutes late based on schedule and `timeIn`.
*   **`lateDeduction` (number, optional):** Calculated deduction for late minutes (considering grace period).
*   **`holidayBonus` (number, optional):** Additional pay earned specifically for working on a holiday (often the base daily rate multiplied by a factor, stored here for clarity).
*   **`leaveType` ("Vacation" | "Sick" | "Unpaid" | "None", optional):** Type of leave taken, if any.
*   **`leavePay` (number, optional):** Pay associated with the leave.
*   **`grossPay` (number, optional):** Total earnings before deductions. Typically calculated as: (Base Daily Rate or Holiday Pay) + Overtime Pay + Night Differential Pay + Holiday Bonus.
*   **`deductions` (number, optional):** Total deductions for the day (Late Deduction + Undertime Deduction).
*   **`netPay` (number, optional):** Final take-home pay after deductions are subtracted from gross earnings and leave pay is added (`grossPay - deductions + leavePay`).
*   **`manualOverride` (boolean, optional):** Flag indicating if computed values should be ignored in favor of manually entered data.
*   **`notes` (string, optional):** User-entered notes for the specific day.
*   **`absence` (boolean, optional):** Flag indicating if the employee was marked absent for the day.
*   **`nightDifferentialHours` (number):** Total hours worked within the night differential period (defined in `attendanceSettings`).
*   **`nightDifferentialPay` (number):** Calculated additional pay for night differential hours.

## Manual Edit Recalculation (`handleInputChange` and `handleClearAndOverride`)

When `manualOverride` is **true**, editing certain fields (`handleInputChange`) or clearing them using the '×' button (`handleClearAndOverride`) triggers automatic recalculations of related pay fields to maintain consistency:

*   Clearing a field via '×' sets its value to 0 and automatically enables `Manual Override` before performing the recalculations below.

1.  **Editing/Clearing `overtimeMinutes` or `overtimePay`:**
    *   Recalculates `overtimePay` (sets to 0 if cleared).
    *   Recalculates `grossPay` (`dailyRate` + new `overtimePay` + `nightDifferentialPay` + `holidayBonus`).
    *   Recalculates `netPay` (new `grossPay` - `deductions`).

2.  **Editing/Clearing `undertimeMinutes` or `undertimeDeduction`:**
    *   Recalculates `undertimeDeduction` (sets to 0 if cleared).
    *   Recalculates total `deductions` (new `undertimeDeduction` + `lateDeduction`).
    *   Recalculates `netPay` (`grossPay` - new `deductions`).

3.  **Editing/Clearing `lateMinutes` or `lateDeduction`:**
    *   Recalculates `lateDeduction` (sets to 0 if cleared).
    *   Recalculates total `deductions` (`undertimeDeduction` + new `lateDeduction`).
    *   Recalculates `netPay` (`grossPay` - new `deductions`).

4.  **Editing/Clearing `nightDifferentialHours` or `nightDifferentialPay`:**
    *   Recalculates `nightDifferentialPay` (sets to 0 if cleared).
    *   Recalculates `grossPay` (`dailyRate` + `overtimePay` + new `nightDifferentialPay` + `holidayBonus`).
    *   Recalculates `netPay` (new `grossPay` - `deductions`).

5.  **Editing/Clearing Pay Components (`overtimePay`, `holidayBonus`, `nightDifferentialPay`):**
    *   Recalculates `grossPay` by subtracting the *old* value of the edited field and adding the *new* value (or 0 if cleared).
    *   Recalculates `netPay` (new `grossPay` - `deductions`).

6.  **Editing/Clearing Deduction Components (`undertimeDeduction`, `lateDeduction`):**
    *   Recalculates total `deductions` (uses 0 for the cleared component).
    *   Recalculates `netPay` (`grossPay` - new `deductions`).

7.  **Editing/Clearing `leavePay`:**
    *   Recalculates `netPay` (`grossPay` - `deductions` + new `leavePay` (or 0 if cleared)).

8.  **Editing/Clearing `grossPay` directly:**
    *   Recalculates `netPay` (new `grossPay` (or 0 if cleared) - `deductions`).

9.  **Editing/Clearing `netPay` directly:**
    *   Recalculates `grossPay` (new `netPay` (or 0 if cleared) + `deductions`).

*Note:* Editing fields like `hoursWorked` directly when `manualOverride` is true does *not* automatically trigger recalculations of pay components in the current implementation; only the direct input is stored.
