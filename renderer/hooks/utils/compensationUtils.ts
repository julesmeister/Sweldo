import { Attendance } from "@/renderer/model/attendance";
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
  const hourlyRate = dailyRate / standardHours;
  const overtimeHourlyRate =
    hourlyRate * (attendanceSettings.overtimeHourlyMultiplier || 1.25);

  // Calculate night differential if we have actual time data
  let nightDifferential = {
    nightDifferentialHours: 0,
    nightDifferentialPay: 0,
  };

  if (actualTimeIn && actualTimeOut) {
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

  // Calculate holiday bonus if applicable
  const holidayBonus = holiday ? dailyRate * (holiday.multiplier - 1) : 0;

  // Calculate gross and net pay
  const baseGrossPay = dailyRate;
  const grossPay =
    baseGrossPay +
    overtimePay +
    nightDifferential.nightDifferentialPay +
    holidayBonus;
  const netPay = grossPay - totalDeductions;

  const result = {
    deductions: totalDeductions,
    overtimePay,
    baseGrossPay,
    holidayBonus,
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
  const { lateMinutes, undertimeMinutes, overtimeMinutes, hoursWorked } =
    timeMetrics;

  const {
    deductions,
    overtimePay,
    grossPay,
    netPay,
    holidayBonus,
    lateDeduction,
    undertimeDeduction,
    nightDifferentialHours,
    nightDifferentialPay,
  } = payMetrics;

  // Determine absence based on schedule and time entries
  const isWorkday = !!schedule;
  const isHoliday = !!holiday;
  const hasTimeEntries = !!(entry.timeIn && entry.timeOut);
  const isAbsent = isWorkday && !isHoliday && !hasTimeEntries;

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
    dailyRate: parseFloat((employee?.dailyRate || 0).toString()),
    grossPay: isAbsent ? 0 : grossPay,
    netPay: isAbsent ? 0 : netPay,
    holidayBonus,
    manualOverride: false,
    lateMinutes,
    undertimeMinutes,
    overtimeMinutes,
    hoursWorked: isAbsent ? 0 : hoursWorked,
    deductions,
    overtimePay,
    lateDeduction,
    undertimeDeduction,
    leaveType: "None",
    leavePay: 0,
    notes: "",
    absence: isAbsent,
    nightDifferentialHours,
    nightDifferentialPay,
  } as Compensation;
};

// Helper function to create a base compensation record
export const createBaseCompensation = (
  entry: Attendance,
  employee: Employee | null,
  month: number,
  year: number,
  holiday: Holiday | undefined
): Compensation => {
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
    dailyRate: 0,
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
    absence: false,
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
