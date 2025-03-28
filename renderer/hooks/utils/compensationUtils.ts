import { Attendance } from "@/renderer/model/attendance";
import { Compensation, DayType } from "@/renderer/model/compensation";
import { Holiday, HolidayModel } from "@/renderer/model/holiday";
import { Employee } from "@/renderer/model/employee";
import { AttendanceSettings, EmploymentType } from "@/renderer/model/settings";
import { Schedule } from "@/renderer/model/schedule";

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

// Helper function to calculate deduction minutes after applying grace period
// Returns 0 if minutes are less than or equal to grace period
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

// Helper function to create time objects for a day
// Converts string times to Date objects for both actual and scheduled times
export const createTimeObjects = (
  year: number,
  month: number,
  day: number,
  actualTimeIn: string,
  actualTimeOut: string,
  schedule: { timeIn: string; timeOut: string }
) => {
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

// Helper function to calculate all time-based metrics
// Computes late, undertime, overtime, and hours worked based on actual vs scheduled times
export const calculateTimeMetrics = (
  actual: { timeIn: Date; timeOut: Date },
  scheduled: { timeIn: Date; timeOut: Date },
  attendanceSettings: AttendanceSettings
) => {
  const lateMinutes =
    actual.timeIn > scheduled.timeIn
      ? calculateTimeDifference(actual.timeIn, scheduled.timeIn)
      : 0;

  const undertimeMinutes =
    actual.timeOut < scheduled.timeOut
      ? calculateTimeDifference(scheduled.timeOut, actual.timeOut)
      : 0;

  const overtimeMinutes =
    actual.timeOut > scheduled.timeOut
      ? calculateTimeDifference(actual.timeOut, scheduled.timeOut)
      : 0;

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

  const hoursWorked =
    calculateTimeDifference(actual.timeOut, actual.timeIn) / 60;

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
  holiday?: Holiday
) => {
  const {
    lateDeductionMinutes,
    undertimeDeductionMinutes,
    overtimeDeductionMinutes,
  } = timeMetrics;

  const deductions =
    lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute +
    undertimeDeductionMinutes * attendanceSettings.undertimeDeductionPerMinute;

  const overtimePay =
    overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute;
  const baseGrossPay = dailyRate + overtimePay;
  const holidayBonus = holiday ? dailyRate * holiday.multiplier : 0;
  const grossPay = holiday ? baseGrossPay + holidayBonus : baseGrossPay;
  const netPay = grossPay - deductions;

  return {
    deductions,
    overtimePay,
    baseGrossPay,
    holidayBonus,
    grossPay,
    netPay,
    lateDeduction:
      lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute,
    undertimeDeduction:
      undertimeDeductionMinutes *
      attendanceSettings.undertimeDeductionPerMinute,
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
  } as Compensation;
};
