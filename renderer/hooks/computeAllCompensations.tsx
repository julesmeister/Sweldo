'use client';

import { useMemo, useEffect } from "react";
import { Compensation, CompensationModel } from "@/renderer/model/compensation";
import { Attendance, AttendanceModel } from "@/renderer/model/attendance";
import { AttendanceSettingsModel } from "@/renderer/model/settings";
import { Employee } from "@/renderer/model/employee";

export const useComputeAllCompensations = (
  employee: Employee | null,
  year: number,
  month: number,
  day: number,
  compensationModel: CompensationModel,
  attendanceModel: AttendanceModel,
  attendanceSettingsModel: AttendanceSettingsModel,
  onCompensationsComputed?: (newCompensations: Compensation[]) => void
) => {
  const computeCompensations = async (timesheetEntries: Attendance[], compensationEntries: Compensation[], recompute: boolean = false) => {
    if (!employee || !timesheetEntries.length) return;

    try {
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      const attendanceSettings = await attendanceSettingsModel.loadAttendanceSettings();
      const updatedCompensations = [...compensationEntries];

      for (const entry of timesheetEntries) {
        const foundCompensation = updatedCompensations.find(
          ({ date }) => new Date(date).getDate() === Number(entry.day)
        );

        const shouldCompute = !foundCompensation || recompute;
        
        if (shouldCompute) {
          const employmentType = timeSettings.find(
            (type) => type.type === employee?.employmentType
          );

          if (!employmentType?.requiresTimeTracking || !entry.timeIn || !entry.timeOut) {
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
          const grossPay = dailyRate + (overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute);
          const netPay = grossPay - deductions;

          const newCompensation: Compensation = {
            employeeId: employee.id,
            date: new Date(year, month - 1, entry.day),
            dayType: "Regular",
            lateMinutes,
            undertimeMinutes,
            overtimeMinutes,
            hoursWorked,
            grossPay,
            deductions,
            netPay,
            overtimePay: overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute,
            lateDeduction: lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute,
            undertimeDeduction: undertimeDeductionMinutes * attendanceSettings.undertimeDeductionPerMinute
          };

          if (foundCompensation && recompute) {
            // Update existing compensation
            const index = updatedCompensations.indexOf(foundCompensation);
            updatedCompensations[index] = newCompensation;
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
