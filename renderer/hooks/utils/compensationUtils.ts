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
// Returns positive value if time1 is after time2
export const calculateTimeDifference = (time1: Date, time2: Date) => {
  return Math.round((time1.getTime() - time2.getTime()) / (1000 * 60));
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

  // Only calculate night differential for hours worked within schedule
  const effectiveTimeIn =
    actual.timeIn > scheduled.timeIn ? actual.timeIn : scheduled.timeIn;
  const effectiveTimeOut =
    actual.timeOut < scheduled.timeOut ? actual.timeOut : scheduled.timeOut;

  // Convert times to hours for easier comparison
  const timeInHour = effectiveTimeIn.getHours();
  const timeOutHour = effectiveTimeOut.getHours();

  // If the work period doesn't overlap with night differential hours at all, return 0
  if (
    // Case 1: Work period is completely outside night differential hours
    // Example: If night diff is 10PM-6AM, this catches shifts like 7AM-4PM
    // timeIn >= 6AM && timeOut <= 10PM
    timeInHour >= endHour &&
    timeOutHour <= startHour
  ) {
    return {
      nightDifferentialHours: 0,
      nightDifferentialPay: 0,
    };
  }

  let nightHours = 0;
  let currentTime = new Date(effectiveTimeIn);

  // Calculate total hours between effective times
  const totalHours = Math.abs(
    Math.ceil(
      (effectiveTimeOut.getTime() - effectiveTimeIn.getTime()) /
        (1000 * 60 * 60)
    )
  );

  for (let i = 0; i < totalHours; i++) {
    const hour = currentTime.getHours();
    const isNightHour =
      // Case 1: Hours between startHour and midnight (e.g., 22-23)
      (hour >= startHour && hour < 24) ||
      // Case 2: Hours between midnight and endHour (e.g., 0-5)
      (hour >= 0 && hour < endHour);

    if (isNightHour) {
      nightHours++;
    }

    // Move to next hour
    currentTime.setHours(currentTime.getHours() + 1);
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
  // If no schedule, return zero values for all metrics
  if (!scheduled) {
    return {
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      lateDeductionMinutes: 0,
      undertimeDeductionMinutes: 0,
      overtimeDeductionMinutes: 0,
      hoursWorked: Math.abs(
        calculateTimeDifference(actual.timeOut, actual.timeIn) / 60
      ),
    };
  }

  const lateMinutes =
    actual.timeIn > scheduled.timeIn
      ? calculateTimeDifference(actual.timeIn, scheduled.timeIn)
      : 0;

  const undertimeMinutes =
    actual.timeOut < scheduled.timeOut
      ? calculateTimeDifference(scheduled.timeOut, actual.timeOut)
      : 0;

  // Calculate overtime based on hours of work
  const standardHours = employmentType?.hoursOfWork || 8; // Default to 8 hours if not specified
  const standardMinutes = standardHours * 60;

  const totalMinutesWorked = Math.abs(
    calculateTimeDifference(actual.timeOut, actual.timeIn)
  );

  // Calculate overtime minutes based on hours of work and threshold
  const overtimeMinutes = Math.max(0, totalMinutesWorked - standardMinutes);

  const lateDeductionMinutes = calculateDeductionMinutes(
    lateMinutes,
    attendanceSettings.lateGracePeriod
  );

  const undertimeDeductionMinutes = calculateDeductionMinutes(
    undertimeMinutes,
    attendanceSettings.undertimeGracePeriod
  );

  // Apply overtime threshold to overtime minutes
  const overtimeDeductionMinutes = calculateDeductionMinutes(
    overtimeMinutes,
    attendanceSettings.overtimeThreshold
  );

  const hoursWorked = Math.abs(
    calculateTimeDifference(actual.timeOut, actual.timeIn) / 60
  );

  return {
    lateMinutes,
    undertimeMinutes,
    overtimeMinutes,
    lateDeductionMinutes,
    undertimeDeductionMinutes,
    overtimeDeductionMinutes,
    hoursWorked,
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
  const standardHours = employmentType?.hoursOfWork || 8; // Default to 8 hours if not specified
  const hourlyRate = dailyRate / standardHours;
  const overtimeHourlyRate =
    hourlyRate * attendanceSettings.overtimeHourlyMultiplier;

  // If no schedule, return base pay without any adjustments
  if (!scheduled) {
    return {
      deductions: 0,
      overtimePay: 0,
      baseGrossPay: dailyRate,
      holidayBonus: holiday ? dailyRate * holiday.multiplier : 0,
      grossPay: holiday
        ? dailyRate + dailyRate * holiday.multiplier
        : dailyRate,
      netPay: holiday ? dailyRate + dailyRate * holiday.multiplier : dailyRate,
      lateDeduction: 0,
      undertimeDeduction: 0,
      nightDifferentialHours: 0,
      nightDifferentialPay: 0,
    };
  }

  const nightDifferential = calculateNightDifferential(
    { timeIn: actualTimeIn!, timeOut: actualTimeOut! },
    scheduled,
    attendanceSettings,
    hourlyRate
  );

  const { lateDeductionMinutes, undertimeDeductionMinutes, overtimeMinutes } =
    timeMetrics;

  const deductions =
    lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute +
    undertimeDeductionMinutes * attendanceSettings.undertimeDeductionPerMinute;

  // Calculate overtime pay using the new hourly rate multiplier
  const overtimePay = Math.floor(overtimeMinutes / 60) * overtimeHourlyRate;
  const baseGrossPay = dailyRate + overtimePay;
  const holidayBonus = holiday ? dailyRate * holiday.multiplier : 0;
  // Add night differential to the gross pay calculation
  const grossPayWithNightDiff = holiday
    ? baseGrossPay + holidayBonus + nightDifferential.nightDifferentialPay
    : baseGrossPay + nightDifferential.nightDifferentialPay;

  // Update net pay to include night differential
  const netPay = grossPayWithNightDiff - deductions;

  return {
    deductions,
    overtimePay,
    baseGrossPay,
    holidayBonus,
    grossPay: grossPayWithNightDiff,
    netPay,
    lateDeduction:
      lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute,
    undertimeDeduction:
      undertimeDeductionMinutes *
      attendanceSettings.undertimeDeductionPerMinute,
    nightDifferentialHours: nightDifferential.nightDifferentialHours,
    nightDifferentialPay: nightDifferential.nightDifferentialPay,
  };
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

  if (!schedule) {
    // Return null schedule to indicate no schedule was found
    return {
      actual: {
        timeIn: new Date(createDateString(year, month, day, actualTimeIn)),
        timeOut: new Date(createDateString(year, month, day, actualTimeOut)),
      },
      scheduled: null,
    };
  }

  const actual = {
    timeIn: new Date(createDateString(year, month, day, actualTimeIn)),
    timeOut: new Date(createDateString(year, month, day, actualTimeOut)),
  };

  const scheduled = {
    timeIn: new Date(createDateString(year, month, day, schedule.timeIn)),
    timeOut: new Date(createDateString(year, month, day, schedule.timeOut)),
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
