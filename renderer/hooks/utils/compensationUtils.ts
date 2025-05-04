import { Attendance } from "@/renderer/model/attendance_old";
import { Compensation, DayType } from "@/renderer/model/compensation";
import { Holiday, HolidayModel } from "@/renderer/model/holiday";
import { Employee } from "@/renderer/model/employee";
import {
  AttendanceSettings,
  EmploymentType,
  DailySchedule,
} from "@/renderer/model/settings";
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
  settings: AttendanceSettings,
  hourlyRate: number
): NightDifferentialMetrics => {
  const startHour = settings.nightDifferentialStartHour ?? 22; // Default to 10 PM
  const endHour = settings.nightDifferentialEndHour ?? 6; // Default to 6 AM
  const multiplier = settings.nightDifferentialMultiplier ?? 0.1; // Default to 10%
  const NIGHT_DIFF_MIN_MINUTES = 60; // 1 hour minimum threshold in minutes

  const actualTimeInMs = actual.timeIn.getTime();
  const actualTimeOutMs = actual.timeOut.getTime();

  if (actualTimeOutMs <= actualTimeInMs) {
    return { nightDifferentialHours: 0, nightDifferentialPay: 0 }; // No duration worked
  }

  let totalNdMinutes = 0;

  // --- Calculate ND interval for the day work started ---
  const dayStart = new Date(actual.timeIn);
  dayStart.setHours(0, 0, 0, 0);

  const ndStart1 = new Date(dayStart);
  ndStart1.setHours(startHour, 0, 0, 0);

  const ndEnd1 = new Date(dayStart);
  ndEnd1.setHours(endHour, 0, 0, 0);

  // Adjust ndEnd1 to the next day if the ND period crosses midnight
  if (endHour <= startHour) {
    ndEnd1.setDate(ndEnd1.getDate() + 1);
  }

  // Calculate overlap with the first potential ND interval
  const ndStart1Ms = ndStart1.getTime();
  const ndEnd1Ms = ndEnd1.getTime();

  const overlap1Start = Math.max(actualTimeInMs, ndStart1Ms);
  const overlap1End = Math.min(actualTimeOutMs, ndEnd1Ms);

  if (overlap1End > overlap1Start) {
    totalNdMinutes += (overlap1End - overlap1Start) / (1000 * 60);
  }

  // --- Calculate ND interval for the *next* day if work crosses midnight significantly OR if ND window started on the next day ---
  // This is necessary if the work period itself spans past the start of the *next* day's ND period.
  const dayAfterStart = new Date(dayStart);
  dayAfterStart.setDate(dayAfterStart.getDate() + 1);

  const ndStart2 = new Date(dayAfterStart);
  ndStart2.setHours(startHour, 0, 0, 0);

  const ndEnd2 = new Date(dayAfterStart);
  ndEnd2.setHours(endHour, 0, 0, 0);

  if (endHour <= startHour) {
    // Handles the standard overnight case
    ndEnd2.setDate(ndEnd2.getDate() + 1);
  }

  // Calculate overlap with the second potential ND interval
  const ndStart2Ms = ndStart2.getTime();
  const ndEnd2Ms = ndEnd2.getTime();

  const overlap2Start = Math.max(actualTimeInMs, ndStart2Ms);
  const overlap2End = Math.min(actualTimeOutMs, ndEnd2Ms);

  if (overlap2End > overlap2Start) {
    totalNdMinutes += (overlap2End - overlap2Start) / (1000 * 60);
  }

  // Round the total minutes
  totalNdMinutes = Math.round(totalNdMinutes);

  // Check if night hours meet the minimum threshold
  if (totalNdMinutes < NIGHT_DIFF_MIN_MINUTES) {
    return {
      nightDifferentialHours: 0,
      nightDifferentialPay: 0,
    };
  }

  // Calculate hours (can be fractional)
  const nightDifferentialHours = totalNdMinutes / 60;
  const nightDifferentialPay = nightDifferentialHours * hourlyRate * multiplier;

  return {
    // Return hours rounded to 2 decimal places for display, but use precise value for pay calculation
    nightDifferentialHours: parseFloat(nightDifferentialHours.toFixed(2)),
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
  schedule?: DailySchedule | null
): Compensation => {
  const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
  const isOffDay = schedule?.isOff === true;
  const isWorkday = !!schedule && !isOffDay;
  const isAbsent = isWorkday && !(entry.timeIn && entry.timeOut);

  // Start with base compensation or existing data
  let compensation: Compensation = {
    ...(existingCompensation || {}),
    employeeId: employee?.id || "",
    month,
    year,
    day: entry.day,
    dayType: holiday?.type || "Regular",
    dailyRate,
    hoursWorked: timeMetrics.hoursWorked,
    grossPay: payMetrics.grossPay,
    netPay: payMetrics.netPay,
    lateMinutes: timeMetrics.lateMinutes,
    lateDeduction: payMetrics.lateDeduction,
    undertimeMinutes: timeMetrics.undertimeMinutes,
    undertimeDeduction: payMetrics.undertimeDeduction,
    overtimeMinutes: timeMetrics.overtimeMinutes,
    overtimePay: payMetrics.overtimePay,
    holidayBonus: payMetrics.holidayBonus,
    nightDifferentialHours: payMetrics.nightDifferentialHours,
    nightDifferentialPay: payMetrics.nightDifferentialPay || 0,
    deductions: payMetrics.deductions,
    manualOverride: existingCompensation?.manualOverride || false,
    absence: isAbsent,
    leaveType: existingCompensation?.leaveType || "None",
    leavePay: existingCompensation?.leavePay || 0,
    notes: existingCompensation?.notes || "",
  };

  // If it's an official off day according to the schedule, adjust pay logic
  // (This might need refinement based on exact business rules for paid/unpaid off days)
  if (isOffDay) {
    compensation.grossPay = 0; // Example: Unpaid off day
    compensation.netPay = 0;
    compensation.hoursWorked = 0;
    // Reset time-based metrics if it's an off day
    compensation.lateMinutes = 0;
    compensation.lateDeduction = 0;
    compensation.undertimeMinutes = 0;
    compensation.undertimeDeduction = 0;
    compensation.overtimeMinutes = 0;
    compensation.overtimePay = 0;
    compensation.nightDifferentialHours = 0;
    compensation.nightDifferentialPay = 0;
    compensation.absence = false; // Not technically absent if it's a scheduled off day
    compensation.leavePay = 0; // Explicitly set to 0
  }

  // Ensure grossPay and netPay are non-negative
  compensation.grossPay = Math.max(0, compensation.grossPay || 0);
  compensation.netPay = Math.max(0, compensation.netPay || 0);

  return compensation;
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

export const createTimeObjects = (
  year: number,
  month: number,
  day: number,
  actualTimeIn: string,
  actualTimeOut: string,
  schedule: DailySchedule | null
) => {
  // Use the passed schedule object directly
  const scheduledTimeIn = schedule?.timeIn;
  const scheduledTimeOut = schedule?.timeOut;

  const actualTimeInStr = createDateString(
    year,
    month,
    day,
    actualTimeIn || "00:00" // Default if empty
  );
  const actualTimeOutStr = createDateString(
    year,
    month,
    day,
    actualTimeOut || "00:00" // Default if empty
  );

  const actualTimeInObj = new Date(actualTimeInStr);
  let actualTimeOutObj = new Date(actualTimeOutStr);

  // Handle potential midnight crossing for actual times
  if (actualTimeOutObj <= actualTimeInObj) {
    actualTimeOutObj.setDate(actualTimeOutObj.getDate() + 1);
  }

  // Create scheduled Date objects only if schedule times exist
  let scheduledTimeInObj: Date | null = null;
  let scheduledTimeOutObj: Date | null = null;

  if (scheduledTimeIn && scheduledTimeOut) {
    const scheduledTimeInStr = createDateString(
      year,
      month,
      day,
      scheduledTimeIn
    );
    const scheduledTimeOutStr = createDateString(
      year,
      month,
      day,
      scheduledTimeOut
    );
    scheduledTimeInObj = new Date(scheduledTimeInStr);
    scheduledTimeOutObj = new Date(scheduledTimeOutStr);

    // Handle potential midnight crossing for scheduled times
    if (scheduledTimeOutObj <= scheduledTimeInObj) {
      scheduledTimeOutObj.setDate(scheduledTimeOutObj.getDate() + 1);
    }
  }

  return {
    actual: {
      timeIn: actualTimeInObj,
      timeOut: actualTimeOutObj,
    },
    // Return null if either scheduled object is null
    scheduled:
      scheduledTimeInObj && scheduledTimeOutObj
        ? {
            timeIn: scheduledTimeInObj,
            timeOut: scheduledTimeOutObj,
          }
        : null,
  };
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
