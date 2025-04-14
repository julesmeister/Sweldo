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

      // Filter timesheet entries to only include valid days for this month
      const validTimesheetEntries = timesheetEntries.filter((entry) => {
        const entryDay = Number(entry.day);
        const isValidDay = entryDay >= 1 && entryDay <= lastDayOfMonth;
        if (!isValidDay) {
          return false;
        }
        return isValidDay;
      });

      for (const entry of validTimesheetEntries) {
        const entryDay = Number(entry.day);
        const entryDate = new Date(year, month - 1, entryDay);

        // Skip if the date is invalid
        if (isNaN(entryDate.getTime())) {
          continue;
        }

        const foundCompensation = updatedCompensations.find(
          (comp) =>
            comp.year === year && comp.month === month && comp.day === entryDay
        );

        const shouldCompute = !foundCompensation || recompute;
        if (!shouldCompute) continue;

        const employmentType = timeSettings.find(
          (type) => type.type === employee?.employmentType
        );

        const holiday = holidays.find((h) => isHolidayDate(entryDate, h));
        const schedule = employmentType
          ? getScheduleForDay(employmentType, entryDate.getDay())
          : null;

        // Determine absence status
        const isWorkday = !!schedule;
        const isHoliday = !!holiday;
        const hasTimeEntries = !!(entry.timeIn && entry.timeOut);
        const isAbsent = isWorkday && !isHoliday && !hasTimeEntries;

        // For non-time-tracking employees, holidays, or missing time entries
        if (!employmentType?.requiresTimeTracking || !hasTimeEntries) {
          const newCompensation = createBaseCompensation(
            entry,
            employee,
            month,
            year,
            holiday
          );

          // Set absence and pay based on conditions
          const isPresent =
            !employmentType?.requiresTimeTracking &&
            (entry.timeIn === "present" || entry.timeOut === "present");
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
          entry.day,
          entry.timeIn || "",
          entry.timeOut || "",
          employmentType
        );

        const timeMetrics = calculateTimeMetrics(
          actual,
          scheduled,
          attendanceSettings,
          employmentType
        );
        const dailyRate = parseFloat((employee.dailyRate || 0).toString());
        const hourlyRate = dailyRate / 8;
        const overtimeHours = Math.floor(timeMetrics.overtimeMinutes / 60);
        const overtimePay =
          overtimeHours *
          hourlyRate *
          (attendanceSettings?.overtimeHourlyMultiplier || 1.25);

        const payMetrics = calculatePayMetrics(
          timeMetrics,
          attendanceSettings,
          dailyRate,
          holiday,
          actual.timeIn,
          actual.timeOut,
          scheduled,
          employmentType
        );

        // Update total pay calculations to include night differential
        const totalGrossPay = payMetrics.grossPay;
        const totalNetPay = totalGrossPay - payMetrics.deductions;

        const newCompensation = createCompensationRecord(
          entry,
          employee,
          timeMetrics,
          {
            ...payMetrics,
            grossPay: totalGrossPay,
            netPay: totalNetPay,
          },
          month,
          year,
          holiday,
          undefined,
          schedule
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
      }

      await compensationModel.saveOrUpdateRecords(
        employee.id,
        year,
        month,
        updatedCompensations
      );
      onCompensationsComputed?.(updatedCompensations);
      return updatedCompensations;
    } catch (error) {
      throw error;
    }
  };

  return computeCompensations;
};
