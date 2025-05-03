import { Attendance } from "@/renderer/model/attendance_old";
import { Compensation, DayType } from "@/renderer/model/compensation";
import { Holiday, HolidayModel } from "@/renderer/model/holiday";
import { Employee } from "@/renderer/model/employee";
import {
  AttendanceSettings,
  EmploymentType,
  getScheduleForDate,
} from "@/renderer/model/settings";
import { Schedule } from "@/renderer/model/schedule";
import { IoCalculator } from "react-icons/io5";
import React from "react";

// Helper function to format date components (e.g., "01" for January)
export const formatDateComponent = (value: number) =>
  value.toString().padStart(2, "0");

// Helper function to create a complete date string in YYYY-MM-DD format
export const createDateString = (
  year: number,
  month: number,
  day: number,
  time: string
) => {
  const formattedMonth = formatDateComponent(month);
  const formattedDay = formatDateComponent(day);
  return `${year}-${formattedMonth}-${formattedDay}T${time}`;
};

// Helper function to calculate time difference in minutes
// Returns positive value if time1 is after time2, handles midnight crossing
export const calculateTimeDifference = (time1: Date, time2: Date) => {
  let diffInMinutes = Math.round(
    (time1.getTime() - time2.getTime()) / (1000 * 60)
  );

  // If timeOut is earlier than timeIn, it means we crossed midnight
  // In this case, add 24 hours worth of minutes (1440)
  if (diffInMinutes < 0) {
    diffInMinutes += 24 * 60; // Add 24 hours in minutes
  }

  return diffInMinutes;
};

// Helper function to calculate deduction minutes
export const calculateDeductionMinutes = (
  minutes: number,
  gracePeriod: number
) => {
  return minutes > gracePeriod ? minutes - gracePeriod : 0;
};

interface NightDifferentialMetrics {
  nightDifferentialHours: number;
  nightDifferentialPay: number;
}

const calculateNightDifferential = (
  actual: { timeIn: Date; timeOut: Date },
  scheduled: { timeIn: Date; timeOut: Date },
  settings: AttendanceSettings,
  hourlyRate: number
): NightDifferentialMetrics => {
  const startHour = settings.nightDifferentialStartHour || 22; // Default to 10 PM
  const endHour = settings.nightDifferentialEndHour || 6; // Default to 6 AM
  const multiplier = settings.nightDifferentialMultiplier || 0.1; // Default to 10%
  const NIGHT_DIFF_MIN_HOURS = 1; // Minimum hours required for night differential

  // Calculate total hours between effective times
  let totalHours = Math.ceil(
    (actual.timeOut.getTime() - actual.timeIn.getTime()) / (1000 * 60 * 60)
  );

  // Handle midnight crossing
  if (totalHours < 0) {
    totalHours += 24;
  }

  let nightHours = 0;
  let currentTime = new Date(actual.timeIn);

  // Calculate night hours
  for (let i = 0; i < totalHours; i++) {
    const hour = currentTime.getHours();
    const isNightHour =
      (hour >= startHour && hour < 24) || (hour >= 0 && hour < endHour);

    if (isNightHour) {
      nightHours++;
    }

    currentTime.setHours(currentTime.getHours() + 1);
  }

  // Check if night hours meet the minimum threshold
  if (nightHours < NIGHT_DIFF_MIN_HOURS) {
    return {
      nightDifferentialHours: 0,
      nightDifferentialPay: 0,
    };
  }

  const nightDifferentialPay = nightHours * hourlyRate * multiplier;

  return {
    nightDifferentialHours: nightHours,
    nightDifferentialPay,
  };
};

// Helper function to calculate all time-based metrics
// Computes late, undertime, overtime, and hours worked based on actual vs scheduled times
export const calculateTimeMetrics = (
  actual: { timeIn: Date; timeOut: Date },
  scheduled: { timeIn: Date; timeOut: Date } | null,
  attendanceSettings: AttendanceSettings,
  employmentType: EmploymentType | null
) => {
  const totalMinutesWorked = Math.abs(
    calculateTimeDifference(actual.timeOut, actual.timeIn)
  );
  const standardHours = employmentType?.hoursOfWork || 8;
  const standardMinutes = standardHours * 60;

  // If no schedule, only calculate total hours and overtime
  if (!scheduled) {
    const rawOvertimeMinutes = Math.max(
      0,
      totalMinutesWorked - standardMinutes
    );
    // Enforce 1-hour threshold for overtime
    const overtimeMinutes = Math.floor(rawOvertimeMinutes / 60) * 60;
    return {
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes,
      lateDeductionMinutes: 0,
      undertimeDeductionMinutes: 0,
      overtimeDeductionMinutes: overtimeMinutes,
      hoursWorked: totalMinutesWorked / 60,
    };
  }

  // Calculate late minutes
  const lateMinutes =
    actual.timeIn > scheduled.timeIn
      ? calculateTimeDifference(actual.timeIn, scheduled.timeIn)
      : 0;

  // Calculate undertime minutes
  const undertimeMinutes =
    actual.timeOut < scheduled.timeOut
      ? calculateTimeDifference(scheduled.timeOut, actual.timeOut)
      : 0;

  // Calculate overtime minutes - consider both total hours worked and extended hours
  const earlyMinutes =
    scheduled.timeIn > actual.timeIn
      ? calculateTimeDifference(scheduled.timeIn, actual.timeIn)
      : 0;
  const lateOutMinutes =
    actual.timeOut > scheduled.timeOut
      ? calculateTimeDifference(actual.timeOut, scheduled.timeOut)
      : 0;

  // Calculate overtime based on both total hours worked and schedule extension
  const overtimeFromTotal = Math.max(0, totalMinutesWorked - standardMinutes);
  const overtimeFromSchedule = attendanceSettings.countEarlyTimeInAsOvertime
    ? earlyMinutes + lateOutMinutes
    : lateOutMinutes;
  const rawOvertimeMinutes = Math.max(overtimeFromTotal, overtimeFromSchedule);
  // Enforce 1-hour threshold for overtime
  const overtimeMinutes = Math.floor(rawOvertimeMinutes / 60) * 60;

  const lateDeductionMinutes = calculateDeductionMinutes(
    lateMinutes,
    attendanceSettings.lateGracePeriod
  );

  const undertimeDeductionMinutes = calculateDeductionMinutes(
    undertimeMinutes,
    attendanceSettings.undertimeGracePeriod
  );

  const overtimeDeductionMinutes = overtimeMinutes;

  return {
    lateMinutes,
    undertimeMinutes,
    overtimeMinutes,
    lateDeductionMinutes,
    undertimeDeductionMinutes,
    overtimeDeductionMinutes,
    hoursWorked: totalMinutesWorked / 60,
  };
};

// Helper function to calculate all pay-related values
// Computes deductions, overtime pay, and final pay amounts based on time metrics
export const calculatePayMetrics = (
  timeMetrics: ReturnType<typeof calculateTimeMetrics>,
  attendanceSettings: AttendanceSettings,
  dailyRate: number,
  holiday?: Holiday,
  actualTimeIn?: Date,
  actualTimeOut?: Date,
  scheduled?: { timeIn: Date; timeOut: Date } | null,
  employmentType?: EmploymentType | null
) => {
  const standardHours = employmentType?.hoursOfWork || 8;
  const hourlyRate =
    dailyRate > 0 && standardHours > 0 ? dailyRate / standardHours : 0; // Avoid division by zero
  const overtimeHourlyRate =
    hourlyRate * (attendanceSettings.overtimeHourlyMultiplier || 1.25);

  // Calculate night differential if we have actual time data
  let nightDifferential = {
    nightDifferentialHours: 0,
    nightDifferentialPay: 0,
  };

  if (actualTimeIn && actualTimeOut && hourlyRate > 0) {
    // Check hourlyRate > 0
    nightDifferential = calculateNightDifferential(
      { timeIn: actualTimeIn, timeOut: actualTimeOut },
      { timeIn: actualTimeIn, timeOut: actualTimeOut }, // Use actual times as schedule to avoid time restriction
      attendanceSettings,
      hourlyRate
    );
  }

  // Calculate deductions
  const lateDeduction =
    timeMetrics.lateDeductionMinutes *
    (attendanceSettings.lateDeductionPerMinute || 0);
  const undertimeDeduction =
    timeMetrics.undertimeDeductionMinutes *
    (attendanceSettings.undertimeDeductionPerMinute || 0);
  const overtimePay =
    (timeMetrics.overtimeDeductionMinutes / 60) * overtimeHourlyRate;
  const totalDeductions = lateDeduction + undertimeDeduction;

  // Calculate TOTAL holiday pay based on multiplier
  const totalHolidayPay = holiday ? dailyRate * holiday.multiplier : 0;

  // Calculate gross pay:
  // If it's a holiday, the gross includes the totalHolidayPay + OT + NightDiff.
  // If it's not a holiday, it's the dailyRate + OT + NightDiff.
  // The base daily rate is implicitly included *within* totalHolidayPay when holiday is present.
  const grossPay =
    (holiday ? totalHolidayPay : dailyRate) +
    overtimePay +
    nightDifferential.nightDifferentialPay;

  const netPay = grossPay - totalDeductions;

  const result = {
    deductions: totalDeductions,
    overtimePay,
    holidayBonus: totalHolidayPay, // Store the TOTAL holiday pay here
    grossPay,
    netPay,
    lateDeduction,
    undertimeDeduction,
    ...nightDifferential,
  };

  return result;
};

// Helper function to create a complete compensation record
// Combines all calculated metrics into a final Compensation object
export const createCompensationRecord = (
  entry: Attendance,
  employee: Employee | null,
  timeMetrics: ReturnType<typeof calculateTimeMetrics>,
  payMetrics: ReturnType<typeof calculatePayMetrics>,
  month: number,
  year: number,
  holiday?: Holiday,
  existingCompensation?: Partial<Compensation>,
  schedule?: Schedule | null
): Compensation => {
  const {
    lateMinutes: initialLateMinutes, // Rename initial values
    undertimeMinutes: initialUndertimeMinutes,
    overtimeMinutes: initialOvertimeMinutes,
    hoursWorked: initialHoursWorked,
  } = timeMetrics;

  let {
    deductions: initialDeductions, // Rename initial values
    overtimePay: initialOvertimePay,
    grossPay: initialGrossPay,
    netPay: initialNetPay,
    holidayBonus: initialHolidayBonus, // This now holds total potential holiday pay from payMetrics
    lateDeduction: initialLateDeduction,
    undertimeDeduction: initialUndertimeDeduction,
    nightDifferentialHours: initialNightDifferentialHours,
    nightDifferentialPay: initialNightDifferentialPay,
  } = payMetrics;

  const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
  const hasTimeEntries = !!(entry.timeIn && entry.timeOut);

  // Determine absence specifically for paid holidays vs normal days
  const isPaidHoliday = holiday && holiday.multiplier > 0; // Assumes multiplier > 0 means paid
  const isAbsent = !hasTimeEntries;

  // Use let for final values that might change based on absence
  let finalGrossPay = initialGrossPay;
  let finalNetPay = initialNetPay;
  let finalHolidayBonus = initialHolidayBonus; // Start with the calculated total holiday pay
  let finalAbsence = false;
  let finalLateMinutes = initialLateMinutes;
  let finalUndertimeMinutes = initialUndertimeMinutes;
  let finalOvertimeMinutes = initialOvertimeMinutes;
  let finalHoursWorked = initialHoursWorked;
  let finalDeductions = initialDeductions;
  let finalOvertimePay = initialOvertimePay;
  let finalLateDeduction = initialLateDeduction;
  let finalUndertimeDeduction = initialUndertimeDeduction;
  let finalNightDifferentialHours = initialNightDifferentialHours;
  let finalNightDifferentialPay = initialNightDifferentialPay;

  if (isAbsent) {
    if (isPaidHoliday) {
      // Absent on a PAID holiday - should receive base pay (or based on specific rule)
      // Assuming base pay (100%) for regular holidays if absent
      const holidayBasePay = dailyRate * 1.0; // Adjust multiplier if rule is different
      finalGrossPay = holidayBasePay;
      finalNetPay = holidayBasePay; // Assuming no deductions apply on paid absence
      finalHolidayBonus = 0; // No work premium/bonus earned
      finalAbsence = false; // Not typically marked absent if paid for holiday
      // Keep time metrics (late/under/overtime minutes) as 0 for paid absence
      finalLateMinutes = 0;
      finalUndertimeMinutes = 0;
      finalOvertimeMinutes = 0;
      finalHoursWorked = 0;
      finalDeductions = 0;
      finalOvertimePay = 0;
      finalLateDeduction = 0;
      finalUndertimeDeduction = 0;
      finalNightDifferentialHours = 0;
      finalNightDifferentialPay = 0;
    } else {
      // Absent on a regular workday (or unpaid holiday)
      finalGrossPay = 0;
      finalNetPay = 0;
      finalHolidayBonus = 0;
      finalAbsence = true;
      // Zero out metrics if truly absent and unpaid
      finalLateMinutes = 0;
      finalUndertimeMinutes = 0;
      finalOvertimeMinutes = 0;
      finalHoursWorked = 0;
      finalDeductions = 0;
      finalOvertimePay = 0;
      finalLateDeduction = 0;
      finalUndertimeDeduction = 0;
      finalNightDifferentialHours = 0;
      finalNightDifferentialPay = 0;
    }
  } else if (!isPaidHoliday) {
    // Present on a non-holiday, ensure holidayBonus is zero
    // Note: payMetrics already calculates holidayBonus as 0 if no holiday
    // but we explicitly set finalHolidayBonus to 0 ensure it reflects *earned* bonus for the day
    finalHolidayBonus = 0;
  }
  // If present on a paid holiday, the initially calculated values from payMetrics are correct for final values

  return {
    ...(existingCompensation || {}),
    employeeId: employee?.id || "",
    month,
    year,
    day: entry.day,
    dayType: holiday
      ? holiday.type === "Regular"
        ? "Holiday"
        : "Special"
      : "Regular",
    dailyRate,
    grossPay: finalGrossPay,
    netPay: finalNetPay,
    holidayBonus: finalHolidayBonus, // Store the determined bonus (0 if absent, total if present)
    manualOverride: false,
    lateMinutes: finalLateMinutes,
    undertimeMinutes: finalUndertimeMinutes,
    overtimeMinutes: finalOvertimeMinutes,
    hoursWorked: finalHoursWorked,
    deductions: finalDeductions,
    overtimePay: finalOvertimePay,
    lateDeduction: finalLateDeduction,
    undertimeDeduction: finalUndertimeDeduction,
    leaveType: existingCompensation?.leaveType || "None",
    leavePay: existingCompensation?.leavePay || 0,
    notes: existingCompensation?.notes || "",
    absence: finalAbsence,
    nightDifferentialHours: finalNightDifferentialHours,
    nightDifferentialPay: finalNightDifferentialPay,
  } as Compensation;
};

// Helper function to create a base compensation record
// **This might need adjustment depending on how it's used, especially if holidays apply**
export const createBaseCompensation = (
  entry: Attendance,
  employee: Employee | null,
  month: number,
  year: number,
  holiday: Holiday | undefined
): Compensation => {
  const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
  // Apply basic holiday logic even for base compensation
  const totalHolidayPay = holiday ? dailyRate * holiday.multiplier : 0;
  const isPaidHoliday = holiday && holiday.multiplier > 0;
  const basePay = isPaidHoliday ? dailyRate * 1.0 : 0; // Pay for absent holiday?

  return {
    employeeId: employee?.id || "",
    month,
    year,
    day: entry.day,
    dayType: holiday
      ? holiday.type === "Regular"
        ? "Holiday"
        : "Special"
      : ("Regular" as DayType),
    dailyRate: dailyRate, // Store the actual daily rate
    grossPay: basePay, // Start with base pay if applicable for absent holiday
    netPay: basePay,
    holidayBonus: 0, // Default to 0 for base/absent case
    manualOverride: true, // Usually base is for manual cases
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
    absence: !isPaidHoliday, // Mark absent if not a paid holiday (needs refinement)
    nightDifferentialHours: 0,
    nightDifferentialPay: 0,
  };
};

// Helper function to check if a date falls within a holiday period
// Returns true if the date is within the holiday's start and end dates
export const isHolidayDate = (date: Date, holiday: Holiday): boolean => {
  return (
    date >=
      new Date(
        holiday.startDate.getFullYear(),
        holiday.startDate.getMonth(),
        holiday.startDate.getDate()
      ) &&
    date <=
      new Date(
        holiday.endDate.getFullYear(),
        holiday.endDate.getMonth(),
        holiday.endDate.getDate(),
        23,
        59,
        59
      )
  );
};

// Helper function to get schedule for a specific date
const getEffectiveSchedule = (
  employmentType: EmploymentType | null,
  date: Date
): { timeIn: string; timeOut: string } | null => {
  if (!employmentType?.requiresTimeTracking) return null;

  const schedule = getScheduleForDate(employmentType, date);
  if (!schedule || schedule.isOff) return null;

  return {
    timeIn: schedule.timeIn,
    timeOut: schedule.timeOut,
  };
};

// Update createTimeObjects to use the new schedule format
export const createTimeObjects = (
  year: number,
  month: number,
  day: number,
  actualTimeIn: string,
  actualTimeOut: string,
  employmentType: EmploymentType | null
) => {
  const date = new Date(year, month - 1, day);
  const schedule = getEffectiveSchedule(employmentType, date);

  // Create timeIn date
  const timeInDate = new Date(createDateString(year, month, day, actualTimeIn));

  // Create timeOut date - if timeOut is earlier than timeIn, it means we crossed midnight
  let timeOutDate = new Date(createDateString(year, month, day, actualTimeOut));
  const timeInHour = parseInt(actualTimeIn.split(":")[0]);
  const timeOutHour = parseInt(actualTimeOut.split(":")[0]);

  // If timeOut hour is less than timeIn hour, it means we crossed midnight
  if (timeOutHour < timeInHour) {
    timeOutDate.setDate(timeOutDate.getDate() + 1);
  }

  const actual = {
    timeIn: timeInDate,
    timeOut: timeOutDate,
  };

  if (!schedule) {
    return { actual, scheduled: null };
  }

  // Apply the same midnight crossing logic to scheduled times
  const scheduledTimeIn = new Date(
    createDateString(year, month, day, schedule.timeIn)
  );
  let scheduledTimeOut = new Date(
    createDateString(year, month, day, schedule.timeOut)
  );

  const schedTimeInHour = parseInt(schedule.timeIn.split(":")[0]);
  const schedTimeOutHour = parseInt(schedule.timeOut.split(":")[0]);

  if (schedTimeOutHour < schedTimeInHour) {
    scheduledTimeOut.setDate(scheduledTimeOut.getDate() + 1);
  }

  const scheduled = {
    timeIn: scheduledTimeIn,
    timeOut: scheduledTimeOut,
  };

  return { actual, scheduled };
};

export interface PaymentBreakdown {
  basePay: number;
  overtimePay: number;
  nightDifferentialPay: number;
  holidayBonus: number;
  deductions: {
    late: number;
    undertime: number;
    total: number;
  };
  netPay: number;
  details: {
    hourlyRate: number;
    overtimeHourlyRate: number;
    overtimeMinutes: number;
    nightDifferentialHours: number;
    lateMinutes: number;
    undertimeMinutes: number;
    lateGracePeriod: number;
    undertimeGracePeriod: number;
    lateDeductionPerMinute: number;
    undertimeDeductionPerMinute: number;
  };
}

export const getPaymentBreakdown = (
  timeMetrics: ReturnType<typeof calculateTimeMetrics>,
  payMetrics: ReturnType<typeof calculatePayMetrics>,
  attendanceSettings: AttendanceSettings,
  dailyRate: number,
  employmentType: EmploymentType | null
): PaymentBreakdown => {
  const standardHours = employmentType?.hoursOfWork || 8;
  const hourlyRate = dailyRate / standardHours;
  const overtimeHourlyRate =
    hourlyRate * attendanceSettings.overtimeHourlyMultiplier;

  return {
    basePay: dailyRate,
    overtimePay: payMetrics.overtimePay,
    nightDifferentialPay: payMetrics.nightDifferentialPay,
    holidayBonus: payMetrics.holidayBonus,
    deductions: {
      late: payMetrics.lateDeduction,
      undertime: payMetrics.undertimeDeduction,
      total: payMetrics.deductions,
    },
    netPay: payMetrics.netPay,
    details: {
      hourlyRate,
      overtimeHourlyRate,
      overtimeMinutes: timeMetrics.overtimeMinutes,
      nightDifferentialHours: payMetrics.nightDifferentialHours,
      lateMinutes: timeMetrics.lateMinutes,
      undertimeMinutes: timeMetrics.undertimeMinutes,
      lateGracePeriod: attendanceSettings.lateGracePeriod,
      undertimeGracePeriod: attendanceSettings.undertimeGracePeriod,
      lateDeductionPerMinute: attendanceSettings.lateDeductionPerMinute,
      undertimeDeductionPerMinute:
        attendanceSettings.undertimeDeductionPerMinute,
    },
  };
};
