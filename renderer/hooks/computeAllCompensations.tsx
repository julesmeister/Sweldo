'use client';

import { useMemo, useEffect } from "react";
import { Compensation, CompensationModel, DayType } from "@/renderer/model/compensation";
import { Attendance, AttendanceModel } from "@/renderer/model/attendance";
import { AttendanceSettingsModel } from "@/renderer/model/settings";
import { Employee } from "@/renderer/model/employee";
import { HolidayModel, Holiday, createHolidayModel } from "@/renderer/model/holiday";

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
  const computeCompensations = async (timesheetEntries: Attendance[], compensationEntries: Compensation[], recompute: boolean = false) => {
    if (!employee || !timesheetEntries.length) return;

    try {
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const attendanceSettings = await attendanceSettingsModel.loadAttendanceSettings();
      const updatedCompensations = [...compensationEntries];
      
      // Create holiday model for the current month
      const holidayModel = createHolidayModel(dbPath, year, month);
      const holidays = await holidayModel.loadHolidays();

      for (const entry of timesheetEntries) {
        const foundCompensation = updatedCompensations.find(
          (comp) => comp.year === year && comp.month === month && comp.day === Number(entry.day)
        );

        const shouldCompute = !foundCompensation || recompute;
        
        if (shouldCompute) {
          const employmentType = timeSettings.find(
            (type) => type.type === employee?.employmentType
          );

          // Check if this day is a holiday
          const holiday = holidays.find(h => {
            const entryDate = new Date(year, month - 1, entry.day);
            return (
              entryDate >= new Date(h.startDate.getFullYear(), h.startDate.getMonth(), h.startDate.getDate()) &&
              entryDate <= new Date(h.endDate.getFullYear(), h.endDate.getMonth(), h.endDate.getDate(), 23, 59, 59)
            );
          });

          if (!employmentType?.requiresTimeTracking || !entry.timeIn || !entry.timeOut) {
            // For non-time-tracking employees, create a basic compensation record
            const dailyRate = parseFloat((employee.dailyRate || 0).toString());
            const grossPay = dailyRate;
            const netPay = grossPay;


            const newCompensation: Compensation = {
              employeeId: employee.id,
              month,
              year,
              day: entry.day,
              dayType: holiday ? (holiday.type === 'Regular' ? 'Holiday' : 'Special') : 'Regular',
              dailyRate,
              grossPay,
              netPay,
              holidayBonus: 0, // No holiday bonus for non-time-tracking or no time entries
              manualOverride: true
            };

            if (foundCompensation && recompute) {
              // Update existing compensation
              const index = updatedCompensations.indexOf(foundCompensation);
              updatedCompensations[index] = { ...foundCompensation, ...newCompensation };
            } else {
              // Add new compensation
              updatedCompensations.push(newCompensation);
            }
            continue;
          }

          const actualTimeIn = new Date(`1970-01-01T${entry.timeIn}`);
          const actualTimeOut = new Date(`1970-01-01T${entry.timeOut}`);
          const scheduledTimeIn = new Date(`1970-01-01T${employmentType.timeIn}`);
          const scheduledTimeOut = new Date(`1970-01-01T${employmentType.timeOut}`);

          const lateMinutes = actualTimeIn > scheduledTimeIn
            ? Math.round((actualTimeIn.getTime() - scheduledTimeIn.getTime()) / (1000 * 60))
            : 0;

          const lateDeductionMinutes = lateMinutes > attendanceSettings.lateGracePeriod
            ? lateMinutes - attendanceSettings.lateGracePeriod
            : 0;

          const undertimeMinutes = actualTimeOut < scheduledTimeOut
            ? Math.round((scheduledTimeOut.getTime() - actualTimeOut.getTime()) / (1000 * 60))
            : 0;

          const undertimeDeductionMinutes = undertimeMinutes > attendanceSettings.undertimeGracePeriod
            ? undertimeMinutes - attendanceSettings.undertimeGracePeriod
            : 0;

          const overtimeMinutes = actualTimeOut > scheduledTimeOut
            ? Math.round((actualTimeOut.getTime() - scheduledTimeOut.getTime()) / (1000 * 60))
            : 0;

          const overtimeDeductionMinutes = overtimeMinutes > attendanceSettings.overtimeGracePeriod
            ? overtimeMinutes - attendanceSettings.overtimeGracePeriod
            : 0;

          const hoursWorked = Math.round(
            (actualTimeOut.getTime() - actualTimeIn.getTime()) / (1000 * 60 * 60)
          );

          const deductions =
            (lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute) +
            (undertimeDeductionMinutes * attendanceSettings.undertimeDeductionPerMinute) +
            (overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute);

          const dailyRate = parseFloat((employee.dailyRate || 0).toString());
          const baseGrossPay = dailyRate + (overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute);
          

          // Calculate holiday bonus only if there are valid time entries
          const holidayBonus = holiday ? dailyRate * (holiday.multiplier) : 0;

          // Apply holiday multiplier to base gross pay
          const grossPay = holiday ? baseGrossPay + holidayBonus : baseGrossPay;
          const netPay = grossPay - deductions;

          const newCompensation: Compensation = {
            employeeId: employee.id,
            month,
            year,
            day: entry.day,
            dayType: holiday ? (holiday.type === 'Regular' ? 'Holiday' : 'Special') : 'Regular',
            dailyRate,
            grossPay,
            netPay,
            holidayBonus,
            manualOverride: true,
            ...(employmentType?.requiresTimeTracking && entry.timeIn && entry.timeOut ? {
              lateMinutes,
              undertimeMinutes,
              overtimeMinutes,
              hoursWorked,
              deductions,
              overtimePay: overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute,
              lateDeduction: lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute,
              undertimeDeduction: undertimeDeductionMinutes * attendanceSettings.undertimeDeductionPerMinute
            } : {})
          };

          if (foundCompensation && recompute) {
            // Update existing compensation
            const index = updatedCompensations.indexOf(foundCompensation);
            updatedCompensations[index] = { ...foundCompensation, ...newCompensation };
          } else {
            // Add new compensation
            updatedCompensations.push(newCompensation);
          }
        }
      }

      // Save the updated compensations
      await compensationModel.saveOrUpdateRecords(
        employee.id,
        year,
        month,
        updatedCompensations
      );

      // Notify parent component
      onCompensationsComputed?.(updatedCompensations);
      
      return updatedCompensations;
    } catch (error) {
      console.error('Error computing compensations:', error);
    }
  };

  return computeCompensations;
};
