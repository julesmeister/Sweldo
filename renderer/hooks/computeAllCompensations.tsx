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

      for (const entry of timesheetEntries) {
        const foundCompensation = updatedCompensations.find(
          (comp) =>
            comp.year === year &&
            comp.month === month &&
            comp.day === Number(entry.day)
        );

        const shouldCompute = !foundCompensation || recompute;
        if (!shouldCompute) continue;

        const employmentType = timeSettings.find(
          (type) => type.type === employee?.employmentType
        );

        // Check if this day is a holiday
        const holiday = holidays.find((h) => {
          const entryDate = new Date(year, month - 1, entry.day);
          return isHolidayDate(entryDate, h);
        });

        // For non-time-tracking employees or missing time entries
        if (
          !employmentType?.requiresTimeTracking ||
          !entry.timeIn ||
          !entry.timeOut
        ) {
          const newCompensation = createBaseCompensation(
            entry,
            employee,
            month,
            year,
            holiday
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
          continue;
        }

        // Get schedule and create time objects
        const schedule = getScheduleForDay(employmentType, day);
        if (!schedule) continue;

        const { actual, scheduled } = createTimeObjects(
          year,
          month,
          entry.day,
          entry.timeIn,
          entry.timeOut,
          schedule
        );

        // Calculate all metrics
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

        // Create compensation record
        const newCompensation = createCompensationRecord(
          entry,
          employee,
          timeMetrics,
          payMetrics,
          month,
          year,
          holiday
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
      console.error("Error computing compensations:", error);
    }
  };

  return computeCompensations;
};
