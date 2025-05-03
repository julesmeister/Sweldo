# Compensation Calculation and Update Logic Analysis

This document analyzes the logic flow across several components and hooks involved in updating attendance and subsequently calculating/saving compensation data. The goal is to identify shared patterns and differences to inform future refactoring efforts towards centralizing common logic.

**Files Analyzed:**

*   `renderer/components/CompensationDialog.tsx`
*   `renderer/hooks/useAttendanceOperations.tsx`
*   `renderer/hooks/useTimesheetEdit.tsx`
*   `renderer/hooks/useTimesheetCheckbox.tsx`
*   `renderer/hooks/useMissingTimeEdit.tsx`

## Core Responsibilities Summary

*   **`CompensationDialog.tsx`**: Provides a UI for viewing and **manually editing** detailed compensation fields for a single day. It can calculate compensation based on provided `timeIn`/`timeOut` props but primarily allows users to override values directly before saving the `Compensation` object.
*   **`useAttendanceOperations.tsx`**: Handles specialized attendance edits (swap times, revert to history). **It does not calculate compensation directly** but relies on calling `handleTimesheetEdit` (from `useTimesheetEdit`) which *does* trigger compensation recalculation upon saving the modified attendance.
*   **`useTimesheetEdit.tsx`**: Handles edits originating from the main timesheet grid's `EditableCell`. It saves the updated `Attendance` (`timeIn` or `timeOut`) and then **recalculates and saves the corresponding `Compensation` record automatically**.
*   **`useTimesheetCheckbox.tsx`**: Specifically handles marking attendance for non-time-tracking employees ("present"/"absent"). It saves a simplified `Attendance` record and then calculates/saves a **simplified `Compensation` record** based mainly on presence, daily rate, and holidays.
*   **`useMissingTimeEdit.tsx`**: Handles edits from the "Missing Time Logs" feature. It saves the provided `timeIn`/`timeOut`, **recalculates and saves the full `Compensation`**, and updates/deletes the corresponding `MissingTimeLog` record.

## Shared Logic & Patterns

1.  **Saving Attendance:**
    *   All hooks (`useTimesheetEdit`, `useTimesheetCheckbox`, `useMissingTimeEdit`, and indirectly `useAttendanceOperations` via `handleTimesheetEdit`) use `attendanceModel.saveOrUpdateAttendances` to persist attendance changes.
    *   `CompensationDialog` does *not* modify attendance.

2.  **Loading Supporting Data for Calculation:**
    *   `useTimesheetEdit`, `useTimesheetCheckbox`, and `useMissingTimeEdit` all load `AttendanceSettings`, `EmploymentType` settings, and `Holidays` to perform accurate compensation calculations.
    *   `CompensationDialog` also loads `EmploymentType` settings and `Holidays` to display relevant info and perform its internal calculations (when not manually overridden).

3.  **Calculating Compensation:**
    *   `useTimesheetEdit` and `useMissingTimeEdit` perform **full, detailed compensation calculations** after an attendance change.
    *   They heavily rely on shared utility functions from `renderer/hooks/utils/compensationUtils.ts` (e.g., `createTimeObjects`, `calculateTimeMetrics`, `calculatePayMetrics`, `createCompensationRecord`, `isHolidayDate`).
    *   `CompensationDialog` performs similar calculations *internally* within its `useMemo` hook (`computedValues`) using the same utility functions, primarily for display purposes or as the base before manual overrides.
    *   `useTimesheetCheckbox` performs a **simplified calculation**, mainly determining `grossPay`/`netPay` based on presence and daily rate, considering holidays but not time-based metrics like overtime or deductions.

4.  **Saving Compensation:**
    *   `CompensationDialog` (on manual save), `useTimesheetEdit`, `useTimesheetCheckbox`, and `useMissingTimeEdit` all use `compensationModel.saveOrUpdateCompensations` to persist the final `Compensation` object.

5.  **Loading Existing Compensation:**
    *   `useTimesheetEdit`, `useTimesheetCheckbox`, and `useMissingTimeEdit` load the existing `Compensation` record for the day before saving the new one, often using it as a base (e.g., preserving notes, manual override status unless explicitly changed).

6.  **Schedule Determination:**
    *   All modules (except potentially `useAttendanceOperations`) need to determine the employee's schedule for the specific date (`getScheduleForDate`) using the `EmploymentType` settings to correctly calculate expected hours, rest days, etc.

7.  **Data Update Notification:**
    *   The hooks (`useTimesheetEdit`, `useTimesheetCheckbox`, `useMissingTimeEdit`) use an `onDataUpdate` callback (or similar like `onMissingLogsUpdate`) to signal the parent component (`TimesheetPage` or `MissingTimeLogDialog`) to refresh its data display after changes are saved.
    *   `CompensationDialog` calls `onSave` which often triggers a data refresh in the parent.

8.  **Access Control:**
    *   `CompensationDialog`, `useAttendanceOperations`, `useTimesheetEdit`, and `useTimesheetCheckbox` check for user permissions (`hasAccess` or passed `accessCodes`).

9.  **Missing Time Log Interaction:**
    *   `useTimesheetEdit`, `useTimesheetCheckbox`, and `useMissingTimeEdit` interact with `MissingTimeModel` to delete logs when attendance becomes complete.

## Key Differences & Divergences

1.  **Calculation Trigger:** Compensation calculation is triggered automatically by attendance changes in the hooks, whereas in `CompensationDialog`, it's primarily for display or overridden manually.
2.  **Manual Override Handling:** `CompensationDialog` has explicit UI and logic for `manualOverride`. The hooks generally assume calculations should be driven by attendance data, although `useTimesheetCheckbox` essentially forces a manual state for non-tracking employees.
3.  **Calculation Complexity:** Full calculations in `useTimesheetEdit`/`useMissingTimeEdit` vs. simplified in `useTimesheetCheckbox`.
4.  **Source of Truth (for Dialog):** `CompensationDialog` works with `timeIn`/`timeOut` passed as props, while the hooks react to changes derived from user interaction within their specific contexts (grid cell, checkbox).
5.  **Direct Attendance Dependency:** `useAttendanceOperations` modifies attendance *but delegates the saving and subsequent compensation calculation* to `handleTimesheetEdit`.

## Potential Refactoring Opportunities

Based on the shared logic, potential areas for centralization include:

1.  **Centralized Compensation Calculation Service/Hook:** Create a single, reusable function or hook that takes all necessary inputs (attendance, employee, settings, holidays, date) and returns the fully calculated `Compensation` object. This would eliminate the redundant calculation logic in `useTimesheetEdit`, `useMissingTimeEdit`, and `CompensationDialog`.
2.  **Unified Data Saving Hook:** A hook that handles the pattern of: load existing compensation, merge changes, save compensation (using `compensationModel`), load existing attendance, merge changes, save attendance (using `attendanceModel`), and finally trigger `onDataUpdate`. Different modules could call this with specific data.
3.  **Consolidated Settings/Holiday Loading:** If performance becomes an issue, consider a context or store to load `AttendanceSettings`, `EmploymentTypes`, and `Holidays` once per relevant period (e.g., per month view) instead of loading them within multiple hooks/components.
4.  **Standardized `onDataUpdate`:** Ensure the signature and purpose of the data update callback (`onDataUpdate`, `onMissingLogsUpdate`) are consistent.
5.  **Standardize Holiday Pay Calculation/Representation:** There's an inconsistency between the intended holiday logic (where `multiplier` directly defines the total pay factor, e.g., `1` = 100% daily rate, `0.3` = 30% daily rate) and the current implementation in `compensationUtils.ts`. The utility calculates `holidayBonus` as a *premium* (`dailyRate * (multiplier - 1)`), which doesn't align correctly with multipliers less than 1 and may cause confusion.
    Refactoring should:
    *   **Adopt a Standard Calculation:** Implement the calculation logic consistently based on the intended meaning of `multiplier` determining the *total* holiday pay (`totalHolidayPay = dailyRate * multiplier`).
    *   **Re-evaluate `holidayBonus` Field:** Decide if the dedicated `holidayBonus` field in `Compensation` is still needed. If kept, clarify its purpose (e.g., only for premiums where `multiplier > 1`? or should it store the total holiday pay?). Alternatively, eliminate it and incorporate the correct holiday pay directly into `grossPay` calculations.
    *   **Ensure Uniform Handling:** Apply the chosen standard calculation uniformly across all relevant modules (`useTimesheetEdit`, `useMissingTimeEdit`, `useTimesheetCheckbox`, `CompensationDialog`), explicitly addressing scenarios like presence vs. absence on paid holidays.

## Central Utility: `compensationUtils.ts`

This file (`renderer/hooks/utils/compensationUtils.ts`) plays a crucial role by providing a collection of pure helper functions used for the core compensation calculations. Isolating this logic here promotes reusability and consistency.

**Key Functions Provided:**

*   **Date/Time Formatting & Difference:**
    *   `formatDateComponent`, `createDateString`: Basic date formatting.
    *   `calculateTimeDifference`: Calculates the difference between two `Date` objects in minutes, handling midnight crossing.
*   **Time Object Creation:**
    *   `createTimeObjects`: Takes raw time strings (`timeIn`, `timeOut`), date info, and `EmploymentType` to create `Date` objects for actual and scheduled times, correctly handling potential midnight crossings based on schedule.
*   **Metric Calculations:**
    *   `calculateDeductionMinutes`: Applies grace periods to late/undertime minutes.
    *   `calculateNightDifferential`: Computes night differential hours and pay based on actual times and settings.
    *   `calculateTimeMetrics`: Calculates `lateMinutes`, `undertimeMinutes`, `overtimeMinutes`, `hoursWorked`, and the corresponding minutes eligible for deduction/payment (applying grace periods/thresholds).
    *   `calculatePayMetrics`: Calculates monetary values like `lateDeduction`, `undertimeDeduction`, `overtimePay`, `holidayBonus`, `grossPay`, `netPay`, and `nightDifferentialPay` based on the results of `calculateTimeMetrics`, rates, and settings.
*   **Compensation Record Creation:**
    *   `createBaseCompensation`: Creates a default `Compensation` object, often used for non-tracking employees or initial states.
    *   `createCompensationRecord`: The main function to assemble a complete `Compensation` object by combining employee data, results from `calculateTimeMetrics` and `calculatePayMetrics`, date/holiday info, and potentially merging with an existing record.
*   **Holiday Check:**
    *   `isHolidayDate`: Checks if a given date falls within a defined `Holiday` period.
*   **Breakdown Generation:**
    *   `getPaymentBreakdown`: Structures the calculated metrics into a detailed object suitable for display (e.g., in the `ComputationBreakdownButton`).

**Usage Pattern:**

The hooks (`useTimesheetEdit`, `useMissingTimeEdit`) and components (`CompensationDialog`) typically follow this pattern:

1.  Gather inputs (actual times, employee data, settings, date).
2.  Call `createTimeObjects`.
3.  Call `calculateTimeMetrics`.
4.  Call `calculatePayMetrics`.
5.  Call `createCompensationRecord` to get the final `Compensation` object.

This utility file is essential for ensuring calculations are performed consistently wherever compensation needs to be determined based on attendance data.

This analysis provides a foundation for deciding how to best refactor the compensation-related logic for better maintainability and reduced redundancy.
