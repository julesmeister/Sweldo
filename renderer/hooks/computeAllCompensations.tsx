"use client";

import { useMemo, useEffect } from "react";
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
  // Helper function to format date components
  const formatDateComponent = (value: number) =>
    value.toString().padStart(2, "0");

  // Helper function to create date string
  const createDateString = (time: string) => {
    const formattedMonth = formatDateComponent(month);
    const formattedDay = formatDateComponent(day);
    return `${year}-${formattedMonth}-${formattedDay}T${time}`;
  };

  // Helper function to calculate time difference in minutes
  const calculateTimeDifference = (time1: Date, time2: Date) => {
    return Math.round((time1.getTime() - time2.getTime()) / (1000 * 60));
  };

  // Helper function to calculate deduction minutes
  const calculateDeductionMinutes = (minutes: number, gracePeriod: number) => {
    return minutes > gracePeriod ? minutes - gracePeriod : 0;
  };

  // Helper function to create base compensation record
  const createBaseCompensation = (
    entry: Attendance,
    holiday: Holiday | undefined
  ): Compensation => {
    const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
    return {
      employeeId: employee!.id,
      month,
      year,
      day: entry.day,
      dayType: holiday
        ? holiday.type === "Regular"
          ? "Holiday"
          : "Special"
        : "Regular",
      dailyRate,
      grossPay: 0,
      netPay: 0,
      holidayBonus: 0,
      manualOverride: true,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      hoursWorked: 0,
      deductions: 0,
      overtimePay: 0,
      lateDeduction: 0,
      undertimeDeduction: 0,
      leaveType: "None",
      leavePay: 0,
      notes: "",
    };
  };

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
          return (
            entryDate >=
              new Date(
                h.startDate.getFullYear(),
                h.startDate.getMonth(),
                h.startDate.getDate()
              ) &&
            entryDate <=
              new Date(
                h.endDate.getFullYear(),
                h.endDate.getMonth(),
                h.endDate.getDate(),
                23,
                59,
                59
              )
          );
        });

        // For non-time-tracking employees or missing time entries
        if (
          !employmentType?.requiresTimeTracking ||
          !entry.timeIn ||
          !entry.timeOut
        ) {
          const newCompensation = createBaseCompensation(entry, holiday);
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

        // Create time objects
        const actualTimeIn = new Date(createDateString(entry.timeIn));
        const actualTimeOut = new Date(createDateString(entry.timeOut));

        const schedule = getScheduleForDay(employmentType, day);
        if (!schedule) continue;

        const scheduledTimeIn = new Date(createDateString(schedule.timeIn));
        const scheduledTimeOut = new Date(createDateString(schedule.timeOut));

        // Calculate time differences
        const lateMinutes =
          actualTimeIn > scheduledTimeIn
            ? calculateTimeDifference(actualTimeIn, scheduledTimeIn)
            : 0;

        const undertimeMinutes =
          actualTimeOut < scheduledTimeOut
            ? calculateTimeDifference(scheduledTimeOut, actualTimeOut)
            : 0;

        const overtimeMinutes =
          actualTimeOut > scheduledTimeOut
            ? calculateTimeDifference(actualTimeOut, scheduledTimeOut)
            : 0;

        // Calculate deduction minutes
        const lateDeductionMinutes = calculateDeductionMinutes(
          lateMinutes,
          attendanceSettings.lateGracePeriod
        );
        const undertimeDeductionMinutes = calculateDeductionMinutes(
          undertimeMinutes,
          attendanceSettings.undertimeGracePeriod
        );
        const overtimeDeductionMinutes = calculateDeductionMinutes(
          overtimeMinutes,
          attendanceSettings.overtimeGracePeriod
        );

        // Calculate hours worked
        const hoursWorked =
          calculateTimeDifference(actualTimeOut, actualTimeIn) / 60;

        // Calculate deductions and pay
        const deductions =
          lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute +
          undertimeDeductionMinutes *
            attendanceSettings.undertimeDeductionPerMinute +
          overtimeDeductionMinutes *
            attendanceSettings.overtimeAdditionPerMinute;

        const dailyRate = parseFloat((employee.dailyRate || 0).toString());
        const baseGrossPay =
          dailyRate +
          overtimeDeductionMinutes *
            attendanceSettings.overtimeAdditionPerMinute;
        const holidayBonus = holiday ? dailyRate * holiday.multiplier : 0;
        const grossPay = holiday ? baseGrossPay + holidayBonus : baseGrossPay;
        const netPay = grossPay - deductions;

        const newCompensation: Compensation = {
          employeeId: employee.id,
          month,
          year,
          day: entry.day,
          dayType: holiday
            ? holiday.type === "Regular"
              ? "Holiday"
              : "Special"
            : "Regular",
          dailyRate,
          grossPay,
          netPay,
          holidayBonus,
          manualOverride: false,
          lateMinutes,
          undertimeMinutes,
          overtimeMinutes,
          hoursWorked,
          deductions,
          overtimePay:
            overtimeDeductionMinutes *
            attendanceSettings.overtimeAdditionPerMinute,
          lateDeduction:
            lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute,
          undertimeDeduction:
            undertimeDeductionMinutes *
            attendanceSettings.undertimeDeductionPerMinute,
          leaveType: "None",
          leavePay: 0,
          notes: "",
        };

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
