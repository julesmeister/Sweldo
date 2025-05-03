import { Attendance } from "../model/attendance_old";
import { MissingTimeLog } from "../model/missingTime";
import { EmploymentType } from "../model/settings";

/**
 * Processes time entries from Excel data and converts them to attendance records
 * @param timeString The time string from Excel cell
 * @param dayIndex The day index (0-based)
 * @param month The month (1-12)
 * @param year The year
 * @param employeeId The employee ID
 * @param employeeName The employee name
 * @param employeeType The employee employment type
 * @param employmentTypes Available employment types with schedules
 * @param timeList List of time strings from Excel row
 * @param nextDayTimeString Optional next day's time string for night shift processing
 * @returns Object containing attendance record and missing time log (if any)
 */
export function processTimeEntry(
  timeString: string | null,
  dayIndex: number,
  month: number,
  year: number,
  employeeId: string,
  employeeName: string,
  employeeType: string | undefined,
  employmentTypes: EmploymentType[],
  timeList: (string | null)[],
  nextDayTimeString?: string | null
): {
  attendance: Attendance;
  missingTimeLog?: MissingTimeLog;
} {
  // Debug logging for employee ID 2 only
  const isTargetEmployee = employeeId === (window as any).targetEmployeeId;

  if (isTargetEmployee) {
    console.log(`\n--- Processing Day ${dayIndex + 1} ---`);
    console.log("Raw time string:", timeString);
    console.log("Next day time string:", nextDayTimeString);
  }

  if (!timeString) {
    if (isTargetEmployee) {
      console.log("No time string provided for this day");
    }
    return {
      attendance: {
        employeeId,
        day: dayIndex + 1,
        month,
        year,
        timeIn: null,
        timeOut: null,
        alternativeTimeIns: [],
      },
    };
  }

  // Get employee type and schedule from employee data
  const employmentType = employmentTypes.find(
    (type) => type.type === employeeType
  );

  if (isTargetEmployee) {
    console.log("\nEmployment Type Matching:");
    console.log("Employee's type:", employeeType);
    console.log(
      "Available employment types:",
      employmentTypes.map((t) => t.type)
    );
    console.log("Found employment type:", employmentType?.type);
  }

  let schedule = null;
  if (employmentType) {
    const date = new Date(year, month - 1, dayIndex + 1);
    const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
    const dateStr = `${yearMonth}-${String(dayIndex + 1).padStart(2, "0")}`;

    if (isTargetEmployee) {
      console.log("\nSchedule Lookup:");
      console.log("Looking for date:", dateStr);
      console.log("In year-month:", yearMonth);
      console.log("Employment type:", employmentType.type);
      console.log("Has monthSchedules:", !!employmentType.monthSchedules);
      if (employmentType.monthSchedules) {
        console.log(
          "Available months:",
          Object.keys(employmentType.monthSchedules)
        );
        if (employmentType.monthSchedules[yearMonth]) {
          console.log(
            "Available dates for",
            yearMonth + ":",
            Object.keys(employmentType.monthSchedules[yearMonth])
          );
        }
      }
    }

    // First check month-specific schedule
    if (
      employmentType.monthSchedules &&
      employmentType.monthSchedules[yearMonth] &&
      employmentType.monthSchedules[yearMonth][dateStr]
    ) {
      const monthSchedule = employmentType.monthSchedules[yearMonth][dateStr];
      if (isTargetEmployee) {
        console.log(
          "Found month-specific schedule for",
          dateStr + ":",
          monthSchedule
        );
      }
      schedule = {
        timeIn: monthSchedule.timeIn,
        timeOut: monthSchedule.timeOut,
        dayOfWeek: date.getDay() || 7,
      };
    } else {
      // Fall back to weekly schedule
      const dayOfWeek = date.getDay();
      const scheduleDay = dayOfWeek === 0 ? 7 : dayOfWeek;

      if (isTargetEmployee) {
        console.log("No month-specific schedule found for", dateStr);
        console.log("Falling back to weekly schedule");
        console.log("Day of week:", dayOfWeek);
        console.log("Schedule day:", scheduleDay);
        console.log("Weekly schedules:", employmentType.schedules);
      }

      const weeklySchedule = employmentType.schedules?.find(
        (s) => s.dayOfWeek === scheduleDay
      );
      if (weeklySchedule) {
        schedule = weeklySchedule;
      }

      if (isTargetEmployee) {
        console.log("Using weekly schedule:", schedule);
      }
    }
  }

  // Parse times from current cell and adjacent days
  const timeRegex = /(\d{2}:\d{2})/g;
  const times: string[] = [];
  const currentDayTimes: string[] = [];

  // Get times from yesterday, today, and tomorrow for alternatives
  timeList.forEach((time) => {
    if (time) {
      const matches = time.match(timeRegex);
      if (matches) {
        times.push(...matches);
      }
    }
  });

  // Get times only from current day for actual timeIn/timeOut
  if (timeString) {
    const currentMatches = timeString.match(timeRegex);
    if (currentMatches) {
      currentDayTimes.push(...currentMatches);
    }
  }

  // Create a unique list of alternative times (keep this for other features)
  const alternativeTimes = Array.from(new Set(times));

  let timeIn: string | null = null;
  let timeOut: string | null = null;

  // Use only current day times for timeIn/timeOut
  if (currentDayTimes.length > 0) {
    timeIn = currentDayTimes[0];
    if (currentDayTimes.length > 1) {
      timeOut = currentDayTimes[currentDayTimes.length - 1];
    }
  }

  if (isTargetEmployee) {
    console.log("\nFinal times for this day:");
    console.log("Time In:", timeIn);
    console.log("Time Out:", timeOut);
    console.log("------------------------");
  }

  // Create attendance record
  const attendance: Attendance = {
    employeeId,
    day: dayIndex + 1,
    month,
    year,
    timeIn: timeIn || null,
    timeOut: timeOut || null,
    schedule: schedule
      ? {
          timeIn: schedule.timeIn,
          timeOut: schedule.timeOut,
          dayOfWeek: schedule.dayOfWeek,
        }
      : null,
    alternativeTimeIns: alternativeTimes,
  };

  // Create missing time log if needed
  let missingTimeLog: MissingTimeLog | undefined;
  if (timeIn && !timeOut) {
    if (isTargetEmployee) {
      console.log("Creating missing time log for missing time out");
    }
    missingTimeLog = {
      id: crypto.randomUUID(),
      employeeId,
      employeeName: employeeName || "",
      day: (dayIndex + 1).toString(),
      month,
      year,
      missingType: "timeOut",
      employmentType: employeeType || "Unknown",
      createdAt: new Date().toISOString(),
    };
  }

  return {
    attendance,
    missingTimeLog,
  };
}

/**
 * Processes a row of time entries from Excel data
 * @param timeList List of time strings from Excel row
 * @param employeeId Employee ID
 * @param employeeName Employee name
 * @param employeeType Employee employment type
 * @param employmentTypes Available employment types with schedules
 * @param month Month (1-12)
 * @param year Year
 * @returns Object containing attendance records and missing time logs
 */
export function processTimeEntries(
  timeList: (string | null)[],
  employeeId: string,
  employeeName: string,
  employeeType: string | undefined,
  employmentTypes: EmploymentType[],
  month: number,
  year: number
): {
  attendances: Attendance[];
  missingTimeLogs: MissingTimeLog[];
} {
  const isTargetEmployee = employeeId === (window as any).targetEmployeeId;

  if (isTargetEmployee) {
    console.log(
      "\n========== PROCESSING TIME ENTRIES FOR EMPLOYEE ID 2 =========="
    );
    console.log("Employee:", employeeName);
    console.log("Employment Type:", employeeType);
    console.log("Month/Year:", month, "/", year);
    console.log("Number of days to process:", timeList.length);
  }

  const attendances: Attendance[] = [];
  const missingTimeLogs: MissingTimeLog[] = [];

  timeList.forEach((timeString, j) => {
    if (isTargetEmployee) {
      console.log(`\nProcessing Day ${j + 1}`);
      console.log("Time string:", timeString);
    }

    const nextDayString = j < timeList.length - 1 ? timeList[j + 1] : null;
    const result = processTimeEntry(
      timeString,
      j,
      month,
      year,
      employeeId,
      employeeName,
      employeeType,
      employmentTypes,
      timeList,
      nextDayString
    );

    attendances.push(result.attendance);
    if (result.missingTimeLog) {
      missingTimeLogs.push(result.missingTimeLog);
    }
  });

  if (isTargetEmployee) {
    console.log("\n========== PROCESSING COMPLETE ==========");
    console.log("Total days processed:", attendances.length);
    console.log("Missing time logs:", missingTimeLogs.length);
    console.log("=========================================\n");
  }

  return { attendances, missingTimeLogs };
}
