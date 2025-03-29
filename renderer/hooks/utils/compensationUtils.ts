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

  console.log("Night Differential Calculation:");
  console.log("Settings:", {
    startHour,
    endHour,
    multiplier,
    hourlyRate,
  });
  console.log("Actual times:", {
    timeIn: actual.timeIn.toLocaleTimeString(),
    timeOut: actual.timeOut.toLocaleTimeString(),
  });
  console.log("Scheduled times:", {
    timeIn: scheduled.timeIn.toLocaleTimeString(),
    timeOut: scheduled.timeOut.toLocaleTimeString(),
  });

  // Only calculate night differential for hours worked within schedule
  const effectiveTimeIn =
    actual.timeIn > scheduled.timeIn ? actual.timeIn : scheduled.timeIn;
  const effectiveTimeOut =
    actual.timeOut < scheduled.timeOut ? actual.timeOut : scheduled.timeOut;

  console.log("Effective times:", {
    timeIn: effectiveTimeIn.toLocaleTimeString(),
    timeOut: effectiveTimeOut.toLocaleTimeString(),
  });

  let nightHours = 0;
  let currentTime = new Date(effectiveTimeIn);

  // Calculate total hours between effective times
  const totalHours = Math.abs(
    Math.ceil(
      (effectiveTimeOut.getTime() - effectiveTimeIn.getTime()) /
        (1000 * 60 * 60)
    )
  );

  console.log("Total hours to check:", totalHours);

  for (let i = 0; i < totalHours; i++) {
    const hour = currentTime.getHours();
    const isNightHour =
      // Case 1: Hours between startHour and midnight (e.g., 22-23)
      (hour >= startHour && hour < 24) ||
      // Case 2: Hours between midnight and endHour (e.g., 0-5)
      (hour >= 0 && hour < endHour);

    console.log(`Checking hour ${hour}:`, {
      isNightHour,
      startHour,
      endHour,
      currentTime: currentTime.toLocaleTimeString(),
      iteration: i + 1,
      totalHours,
    });

    if (isNightHour) {
      nightHours++;
    }

    // Move to next hour
    currentTime.setHours(currentTime.getHours() + 1);
  }

  const nightDifferentialPay = nightHours * hourlyRate * multiplier;
  console.log("Final night differential:", {
    nightHours,
    nightDifferentialPay,
    hourlyRate,
    multiplier,
    calculation: `${nightHours} * ${hourlyRate} * ${multiplier}`,
  });

  return {
    nightDifferentialHours: nightHours,
    nightDifferentialPay,
  };
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

  // Calculate overtime for both early-in and late-out
  const earlyInMinutes =
    actual.timeIn < scheduled.timeIn
      ? calculateTimeDifference(scheduled.timeIn, actual.timeIn)
      : 0;

  const lateOutMinutes =
    actual.timeOut > scheduled.timeOut
      ? calculateTimeDifference(actual.timeOut, scheduled.timeOut)
      : 0;

  // Combine early-in and late-out minutes for total overtime
  const overtimeMinutes = earlyInMinutes + lateOutMinutes;

  const lateDeductionMinutes = calculateDeductionMinutes(
    lateMinutes,
    attendanceSettings.lateGracePeriod
  );

  const undertimeDeductionMinutes = calculateDeductionMinutes(
    undertimeMinutes,
    attendanceSettings.undertimeGracePeriod
  );

  // Apply overtime grace period to combined overtime minutes
  const overtimeDeductionMinutes = calculateDeductionMinutes(
    overtimeMinutes,
    attendanceSettings.overtimeGracePeriod
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
  scheduled?: { timeIn: Date; timeOut: Date }
) => {
  const hourlyRate = dailyRate / 8;
  console.log("Calculate Pay Metrics:", {
    dailyRate,
    hourlyRate,
    hasActualTimes: !!(actualTimeIn && actualTimeOut),
    hasScheduled: !!scheduled,
  });

  const nightDifferential =
    actualTimeIn && actualTimeOut && scheduled
      ? calculateNightDifferential(
          { timeIn: actualTimeIn, timeOut: actualTimeOut },
          scheduled,
          attendanceSettings,
          hourlyRate
        )
      : { nightDifferentialHours: 0, nightDifferentialPay: 0 };

  console.log(
    "Night Differential from calculatePayMetrics:",
    nightDifferential
  );

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

  const result = {
    deductions,
    overtimePay,
    baseGrossPay,
    holidayBonus,
    grossPay: grossPay + nightDifferential.nightDifferentialPay,
    netPay,
    lateDeduction:
      lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute,
    undertimeDeduction:
      undertimeDeductionMinutes *
      attendanceSettings.undertimeDeductionPerMinute,
    nightDifferentialHours: nightDifferential.nightDifferentialHours,
    nightDifferentialPay: nightDifferential.nightDifferentialPay,
  };

  console.log("Final pay metrics result:", result);
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
