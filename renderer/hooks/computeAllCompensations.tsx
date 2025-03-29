"use client";

import { useMemo } from "react";
import {
  Compensation,
  CompensationModel,
  DayType,
} from "@/renderer/model/compensation";
import { Attendance, AttendanceModel } from "@/renderer/model/attendance";
import {
  AttendanceSettingsModel,
  EmploymentType,
  getScheduleForDay,
} from "@/renderer/model/settings";
import { Employee } from "@/renderer/model/employee";
import {
  HolidayModel,
  Holiday,
  createHolidayModel,
} from "@/renderer/model/holiday";
import {
  createDateString,
  calculateTimeDifference,
  calculateDeductionMinutes,
  createBaseCompensation,
  isHolidayDate,
  createTimeObjects,
  calculateTimeMetrics,
  calculatePayMetrics,
  createCompensationRecord,
} from "./utils/compensationUtils";

export const useComputeAllCompensations = (
  employee: Employee | null,
  year: number,
  month: number,
  day: number,
  compensationModel: CompensationModel,
  attendanceModel: AttendanceModel,
  attendanceSettingsModel: AttendanceSettingsModel,
  dbPath: string,
  onCompensationsComputed?: (newCompensations: Compensation[]) => void
) => {
  const computeCompensations = async (
    timesheetEntries: Attendance[],
    compensationEntries: Compensation[],
    recompute: boolean = false
  ) => {
    if (!employee || !timesheetEntries.length) return;

    try {
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const attendanceSettings =
        await attendanceSettingsModel.loadAttendanceSettings();
      const updatedCompensations = [...compensationEntries];

      const holidayModel = createHolidayModel(dbPath, year, month);
      const holidays = await holidayModel.loadHolidays();

      // Get the last day of the month
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      console.log(
        `Computing compensations for ${year}-${month}, days: 1-${lastDayOfMonth}`
      );

      // Filter timesheet entries to only include valid days for this month
      const validTimesheetEntries = timesheetEntries.filter((entry) => {
        const entryDay = Number(entry.day);
        const isValidDay = entryDay >= 1 && entryDay <= lastDayOfMonth;
        if (!isValidDay) {
          console.log(`Skipping invalid day ${entryDay} for month ${month}`);
        }
        return isValidDay;
      });

      // Create a map of existing attendance entries for quick lookup
      const attendanceMap = new Map(
        validTimesheetEntries.map((entry) => [entry.day, entry])
      );

      // Process all days of the month
      for (let day = 1; day <= lastDayOfMonth; day++) {
        const entryDate = new Date(year, month - 1, day);
        const entry = attendanceMap.get(day);

        // Skip if the date is invalid
        if (isNaN(entryDate.getTime())) {
          console.log(`Skipping invalid date: ${year}-${month}-${day}`);
          continue;
        }

        const foundCompensation = updatedCompensations.find(
          (comp) =>
            comp.year === year && comp.month === month && comp.day === day
        );

        const shouldCompute = !foundCompensation || recompute;
        if (!shouldCompute) continue;

        const employmentType = timeSettings.find(
          (type) => type.type === employee?.employmentType
        );

        const holiday = holidays.find((h) => isHolidayDate(entryDate, h));
        // Convert JavaScript's getDay() (0-6, where 0 is Sunday) to our schedule format (1-7, where 7 is Sunday)
        const dayOfWeek = entryDate.getDay() === 0 ? 7 : entryDate.getDay();
        const schedule = employmentType
          ? getScheduleForDay(employmentType, dayOfWeek)
          : null;

        // Determine absence status
        const isWorkday = !!schedule && !!schedule.timeIn && !!schedule.timeOut;
        const isHoliday = !!holiday;
        const hasTimeEntries = !!(entry?.timeIn && entry?.timeOut);
        const isAbsent = isWorkday && !isHoliday && !hasTimeEntries;

        // Create a base attendance entry if none exists
        const baseEntry = entry || {
          employeeId: employee.id,
          day: day,
          timeIn: "",
          timeOut: "",
        };

        // For non-time-tracking employees, holidays, or missing time entries
        if (!employmentType?.requiresTimeTracking || !hasTimeEntries) {
          const newCompensation = createBaseCompensation(
            baseEntry,
            employee,
            month,
            year,
            holiday
          );

          // Set absence and pay based on conditions
          const isPresent =
            !employmentType?.requiresTimeTracking &&
            (baseEntry.timeIn === "present" || baseEntry.timeOut === "present");
          const dailyRate = parseFloat((employee.dailyRate || 0).toString());

          newCompensation.absence = !isPresent && isAbsent;
          newCompensation.grossPay = isHoliday
            ? dailyRate * (holiday?.multiplier || 1)
            : isPresent
            ? dailyRate
            : 0;
          newCompensation.netPay = newCompensation.grossPay;

          if (foundCompensation && recompute) {
            const index = updatedCompensations.indexOf(foundCompensation);
            updatedCompensations[index] = {
              ...foundCompensation,
              ...newCompensation,
            };
          } else {
            updatedCompensations.push(newCompensation);
          }
          continue;
        }

        // Regular time-tracking computation
        if (!schedule) continue;

        const { actual, scheduled } = createTimeObjects(
          year,
          month,
          day,
          baseEntry.timeIn || "",
          baseEntry.timeOut || "",
          schedule
        );

        const timeMetrics = calculateTimeMetrics(
          actual,
          scheduled,
          attendanceSettings
        );
        const dailyRate = parseFloat((employee.dailyRate || 0).toString());
        const payMetrics = calculatePayMetrics(
          timeMetrics,
          attendanceSettings,
          dailyRate,
          holiday
        );

        const newCompensation = createCompensationRecord(
          baseEntry,
          employee,
          timeMetrics,
          payMetrics,
          month,
          year,
          holiday,
          undefined,
          { ...schedule, dayOfWeek: day }
        );

        if (foundCompensation && recompute) {
          const index = updatedCompensations.indexOf(foundCompensation);
          updatedCompensations[index] = {
            ...foundCompensation,
            ...newCompensation,
          };
        } else {
          updatedCompensations.push(newCompensation);
        }

        console.log(`Computed compensation for ${year}-${month}-${day}:`, {
          isWorkday: !!schedule,
          isHoliday: !!holiday,
          hasTimeEntries: !!(baseEntry.timeIn && baseEntry.timeOut),
          isAbsent: isWorkday && !isHoliday && !hasTimeEntries,
        });
      }

      // Log summary before saving
      console.log(`Compensation summary for ${year}-${month}:`, {
        totalDays: lastDayOfMonth,
        processedEntries: validTimesheetEntries.length,
        computedCompensations: updatedCompensations.length,
      });

      await compensationModel.saveOrUpdateRecords(
        employee.id,
        year,
        month,
        updatedCompensations
      );
      onCompensationsComputed?.(updatedCompensations);
      return updatedCompensations;
    } catch (error) {
      console.error("Error computing compensations:", error);
    }
  };

  return computeCompensations;
};
