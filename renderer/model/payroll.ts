import { Employee, createEmployeeModel } from "./employee";
import {
  DateRange,
  Attendance,
  ExcelData,
  createAttendanceModel,
} from "./attendance";
import { Compensation, createCompensationModel } from "./compensation";
import { MissingTimeModel, MissingTimeLog } from "./missingTime";
import * as Papa from "papaparse";
import { toast } from "sonner";
import {
  AttendanceSettingsModel,
  createAttendanceSettingsModel,
  EmploymentType,
  getScheduleForDay,
} from "@/renderer/model/settings";
import { createHolidayModel } from "./holiday";
import { createCashAdvanceModel, CashAdvance } from "./cashAdvance";
import * as fs from "fs";

export interface PayrollSummaryModel {
  id: string;
  employeeName: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  dailyRate: number;
  basicPay: number;
  overtime: number;
  overtimeMinutes?: number;
  undertimeDeduction?: number;
  undertimeMinutes?: number;
  lateDeduction?: number;
  lateMinutes?: number;
  holidayBonus?: number;
  nightDifferentialHours?: number;
  nightDifferentialPay?: number;
  dayType?: "Regular" | "Holiday" | "Rest Day" | "Special";
  leaveType?: "Vacation" | "Sick" | "Unpaid" | "None";
  leavePay?: number;
  grossPay: number;
  allowances: number;
  deductions: {
    sss: number;
    philHealth: number;
    pagIbig: number;
    cashAdvanceDeductions: number;
    others: number;
  };
  netPay: number;
  paymentDate: string;
  daysWorked: number;
  absences: number;
}

export interface PayrollData {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  netPay: number;
  paymentDate: string;
  // ... other fields
}

interface TimeEntry {
  time: string;
  hour: number;
}

export class Payroll {
  private dateRange: DateRange;
  private generatedTime: Date;
  private days: number;
  private employees: Employee[] = [];
  private fileType: string;
  private dbPath: string;
  private attendanceSettingsModel: AttendanceSettingsModel;
  private employmentTypes: EmploymentType[] = [];

  constructor(rows: any[][], fileTypeParam: string, dbPath: string) {
    this.dbPath = dbPath;
    this.dateRange = {
      start: new Date(),
      end: new Date(),
    };
    this.generatedTime = new Date();
    this.fileType = fileTypeParam || "xlsx";
    this.days = 0;
    this.attendanceSettingsModel = createAttendanceSettingsModel(dbPath);
    // Initialize the processing asynchronously
    if (rows && rows.length > 0) {
      this.init(rows);
    }
  }

  private async init(rows: any[][]): Promise<void> {
    if (!rows || !Array.isArray(rows)) {
      throw new Error("Invalid rows data provided");
    }
    await this.replaceValues(rows);
  }

  private findIndexInRow(row: any[], searchTerm: string): number {
    if (!row || !Array.isArray(row)) {
      return -1;
    }
    return row.findIndex((cell) => cell?.toString().includes(searchTerm));
  }

  private processColumn(row: any[], target: string): string {
    const targetIndex = this.findIndexInRow(row, target);
    if (targetIndex !== -1) {
      for (let j = targetIndex + 1; j < row.length; j++) {
        if (row[j] != null) {
          return row[j].toString();
        }
      }
    }
    return "";
  }

  private async replaceValues(rows: any[][]): Promise<void> {
    const targetRow = rows[2];
    const attTimeIndex = this.findIndexInRow(targetRow, "Att. Time");
    const tabulationIndex = this.findIndexInRow(targetRow, "Tabulation");

    // Parse days
    const lastNonNullValue = rows[3].filter((value) => value != null).pop();
    this.days = parseInt(lastNonNullValue?.toString() || "0");

    // Parse date range
    for (let i = attTimeIndex + 1; i < targetRow.length; i++) {
      if (attTimeIndex !== -1 && i < targetRow.length) {
        const dateString = targetRow[i]?.toString() || "";
        const dateRangeParts = dateString.split("~");

        if (dateRangeParts.length === 2) {
          const startDate = new Date(dateRangeParts[0]);
          const endDate = new Date(dateRangeParts[1]);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            this.dateRange = { start: startDate, end: endDate };
            break;
          }
        }
      }
    }

    // Load time settings before processing
    await this.loadTimeSettings();

    // Process employee data
    for (let i = 4; i < rows.length; i += 2) {
      const timeList = rows[i + 1]?.map((value) => value?.toString());
      const attendances: Attendance[] = [];
      const missingTimeLogs: MissingTimeLog[] = [];

      // Get employee ID and load employee data
      const employeeId = this.processColumn(rows[i], "ID:");
      const employeeModel = createEmployeeModel(this.dbPath);
      const employee = await employeeModel.loadEmployeeById(employeeId);
      console.log(`Loaded employee data:`, employee);

      timeList?.forEach((timeString, j) => {
        if (!timeString) {
          attendances.push({
            employeeId,
            day: j + 1,
            month: this.dateRange.start.getMonth() + 1,
            year: this.dateRange.start.getFullYear(),
            timeIn: null,
            timeOut: null,
          });
          return;
        }

        // Get employee type and schedule from employee data
        const employeeType = employee?.employmentType;
        console.log(`Employee type from database:`, employeeType);
        console.log(`Available employment types:`, this.employmentTypes);

        const employmentType = this.employmentTypes.find(
          (type) => type.type === employeeType
        );
        console.log(`Found employment type:`, employmentType);

        let schedule = null;
        if (employmentType) {
          const dayOfWeek = new Date(
            this.dateRange.start.getFullYear(),
            this.dateRange.start.getMonth(),
            j + 1
          ).getDay();
          const scheduleDay = dayOfWeek === 0 ? 7 : dayOfWeek;
          console.log(`Calculated schedule day:`, {
            dayOfWeek,
            scheduleDay,
            date: new Date(
              this.dateRange.start.getFullYear(),
              this.dateRange.start.getMonth(),
              j + 1
            ),
          });

          schedule = employmentType.schedules
            ? employmentType.schedules.find(
                (s: any) => s.dayOfWeek === scheduleDay
              )
            : null;
          console.log(`Found schedule for day:`, schedule);
        }

        // Parse times from current cell
        const timeRegex = /(\d{2}:\d{2})/g;
        const times = timeString.match(timeRegex) || [];
        const uniqueTimes = [...new Set(times)] as string[];
        console.log(`\nProcessing times for day ${j + 1}:`, {
          rawTimeString: timeString,
          parsedTimes: times,
          uniqueTimes: uniqueTimes,
        });

        let timeIn: string | null = null;
        let timeOut: string | null = null;

        if (schedule && schedule.timeIn && schedule.timeOut) {
          const [schedInHour] = schedule.timeIn.split(":").map(Number);
          const isNightShift = schedInHour >= 18;
          console.log(`Schedule info:`, {
            schedule,
            schedInHour,
            isNightShift,
          });

          if (isNightShift) {
            // For night shifts, find the latest PM time from current cell
            const currentCellTimes = (uniqueTimes as string[]).map(
              (time: string) => {
                const [hour] = time.split(":").map(Number);
                return { time, hour };
              }
            );
            console.log(`Current cell times processed:`, currentCellTimes);

            // Get PM times (17:00 onwards) from current cell for time in
            const pmTimes = currentCellTimes
              .filter((t: { time: string; hour: number }) => t.hour >= 17)
              .sort(
                (a: { hour: number }, b: { hour: number }) => b.hour - a.hour
              );
            console.log(`PM times found for time in:`, pmTimes);

            // Get next day's cell for time out
            const nextDayString = timeList[j + 1];
            console.log(`Next day's time string:`, nextDayString);

            if (nextDayString) {
              const nextDayTimes = (
                (nextDayString.match(timeRegex) || []) as string[]
              )
                .map((time: string) => {
                  const [hour] = time.split(":").map(Number);
                  return { time, hour };
                })
                .filter((t: { time: string; hour: number }) => t.hour <= 11)
                .sort(
                  (a: { hour: number }, b: { hour: number }) => a.hour - b.hour
                );
              console.log(
                `Next day's AM times found for time out:`,
                nextDayTimes
              );

              // Set time in from current day's PM time
              if (pmTimes.length > 0) {
                timeIn = pmTimes[0].time as string;
                console.log(`Setting time in from PM times:`, timeIn);
              }

              // Set time out from next day's AM time, but only if it's not too close to time in
              if (nextDayTimes.length > 0) {
                const [timeInHour, timeInMinute] = timeIn
                  ?.split(":")
                  .map(Number) || [0, 0];
                const [timeOutHour, timeOutMinute] = nextDayTimes[0].time
                  .split(":")
                  .map(Number);

                // Calculate time difference in minutes
                const timeInMinutes = timeInHour * 60 + timeInMinute;
                const timeOutMinutes = timeOutHour * 60 + timeOutMinute;
                const timeDiff = Math.abs(timeOutMinutes - timeInMinutes);

                // Only set time out if it's more than 5 minutes away from time in
                if (timeDiff > 5) {
                  timeOut = nextDayTimes[0].time as string;
                  console.log(
                    `Setting time out from next day's AM times:`,
                    timeOut
                  );
                } else {
                  console.log(
                    `Time out too close to time in (${timeDiff} minutes), leaving blank`
                  );
                }
              }
            } else {
              // If it's the last day, only set time in if we have a PM time
              if (pmTimes.length > 0) {
                timeIn = pmTimes[0].time as string;
                console.log(
                  `Last day - setting time in from PM times:`,
                  timeIn
                );
              }
            }
          } else {
            // Regular shift logic
            if (uniqueTimes.length > 0) {
              timeIn = uniqueTimes[0] as string;
              // Only set time out if it's more than 5 minutes away from time in
              if (uniqueTimes.length > 1) {
                const [timeInHour, timeInMinute] = timeIn
                  .split(":")
                  .map(Number);
                const [timeOutHour, timeOutMinute] = uniqueTimes[
                  uniqueTimes.length - 1
                ]
                  .split(":")
                  .map(Number);

                // Calculate time difference in minutes
                const timeInMinutes = timeInHour * 60 + timeInMinute;
                const timeOutMinutes = timeOutHour * 60 + timeOutMinute;
                const timeDiff = Math.abs(timeOutMinutes - timeInMinutes);

                // Only set time out if it's more than 5 minutes away from time in
                if (timeDiff > 5) {
                  timeOut = uniqueTimes[uniqueTimes.length - 1] as string;
                  console.log(`Regular shift - setting times:`, {
                    timeIn,
                    timeOut,
                  });
                } else {
                  console.log(
                    `Time out too close to time in (${timeDiff} minutes), leaving blank`
                  );
                }
              }
            }
          }
        } else {
          // No schedule - use first and last times, but check time difference
          if (uniqueTimes.length > 0) {
            timeIn = uniqueTimes[0] as string;
            if (uniqueTimes.length > 1) {
              const [timeInHour, timeInMinute] = timeIn.split(":").map(Number);
              const [timeOutHour, timeOutMinute] = uniqueTimes[
                uniqueTimes.length - 1
              ]
                .split(":")
                .map(Number);

              // Calculate time difference in minutes
              const timeInMinutes = timeInHour * 60 + timeInMinute;
              const timeOutMinutes = timeOutHour * 60 + timeOutMinute;
              const timeDiff = Math.abs(timeOutMinutes - timeInMinutes);

              // Only set time out if it's more than 5 minutes away from time in
              if (timeDiff > 5) {
                timeOut = uniqueTimes[uniqueTimes.length - 1] as string;
                console.log(`No schedule - using first and last times:`, {
                  timeIn,
                  timeOut,
                });
              } else {
                console.log(
                  `Time out too close to time in (${timeDiff} minutes), leaving blank`
                );
              }
            }
          }
        }

        // Push to attendances in the correct format
        const attendance = {
          employeeId,
          day: j + 1,
          month: this.dateRange.start.getMonth() + 1,
          year: this.dateRange.start.getFullYear(),
          timeIn: timeIn || null,
          timeOut: timeOut || null,
        };
        console.log(`Final attendance record:`, attendance);
        attendances.push(attendance);

        // Check for missing time out with processed times
        if (timeIn && !timeOut) {
          missingTimeLogs.push({
            id: crypto.randomUUID(),
            employeeId,
            employeeName: employee?.name || "",
            day: (j + 1).toString(),
            month: this.dateRange.start.getMonth() + 1,
            year: this.dateRange.start.getFullYear(),
            missingType: "timeOut",
            employmentType: employeeType || "Unknown",
            createdAt: new Date().toISOString(),
          });
        }
      });

      if (employee) {
        this.employees.push({
          id: employee.id,
          name: employee.name,
          position: "",
          dailyRate: employee.dailyRate || 0,
          sss: employee.sss || 0,
          philHealth: employee.philHealth || 0,
          pagIbig: employee.pagIbig || 0,
          status: "active",
          employmentType: employee.employmentType || "regular",
          lastPaymentPeriod: undefined,
        });

        // Save attendances for each employee
        const attendanceModel = createAttendanceModel(this.dbPath);
        await attendanceModel.saveOrUpdateAttendances(
          attendances,
          this.dateRange.start.getMonth() + 1,
          this.dateRange.start.getFullYear(),
          employee.id
        );

        // Save missing time logs
        const missingTimeModel = MissingTimeModel.createMissingTimeModel(
          this.dbPath
        );
        for (const log of missingTimeLogs) {
          await missingTimeModel.saveMissingTimeLog(
            log,
            this.dateRange.start.getMonth() + 1,
            this.dateRange.start.getFullYear()
          );
        }
      }
    }
    let model = createEmployeeModel(this.dbPath);
    await model.saveOnlyNewEmployees(this.employees);
  }

  private async loadTimeSettings() {
    const timeSettings = await this.attendanceSettingsModel.loadTimeSettings();
    this.employmentTypes = timeSettings;
  }

  public async summarizeCompensations(
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PayrollSummaryModel> {
    const employeeModel = createEmployeeModel(this.dbPath);
    const compensationModel = createCompensationModel(this.dbPath);

    const employee = await employeeModel.loadEmployeeById(employeeId);
    const attendance = await createAttendanceModel(this.dbPath);

    // Get all months between start and end date to handle cross-month payroll periods
    // Example: Jan 15 to Feb 15 will include both January and February
    // Example: Feb 1 to Feb 15 will only include February
    const months: { month: number; year: number }[] = [];
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    const currentDate = new Date(start);
    while (currentDate <= end) {
      months.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    console.log(`Processing payroll for months:`, months);

    // Fetch all compensations for the date range from all relevant months
    // This ensures we get data from both months when period spans across months
    const allCompensations = await Promise.all(
      months.map(({ month, year }) =>
        compensationModel.loadRecords(month, year, employeeId)
      )
    ).then((results) => results.flat());
    console.log(
      `Loaded ${allCompensations.length} total compensation records from ${months.length} months`
    );

    // Filter records to only include those within the exact date range
    const filteredCompensations = allCompensations.filter((comp) => {
      // Create date at start of day to avoid timezone issues
      const compDate = new Date(comp.year, comp.month - 1, comp.day);
      compDate.setHours(0, 0, 0, 0);

      const startOfRange = new Date(start);
      startOfRange.setHours(0, 0, 0, 0);

      const endOfRange = new Date(end);
      endOfRange.setHours(23, 59, 59, 999);

      const isInRange = compDate >= startOfRange && compDate <= endOfRange;

      console.log(
        `Compensation for ${compDate.toISOString()}: ${
          isInRange ? "included" : "excluded"
        } (absence: ${comp.absence ? "yes" : "no"}, date comparison:`,
        {
          compDate,
          startOfRange,
          endOfRange,
          isAfterStart: compDate >= startOfRange,
          isBeforeEnd: compDate <= endOfRange,
        }
      );

      return isInRange;
    });

    // Load attendance records from all months in the period
    // This is important for cross-month periods to get complete attendance data
    const allAttendanceRecords = await Promise.all(
      months.map(({ month, year }) =>
        attendance.loadAttendancesById(month, year, employeeId)
      )
    ).then((results) => results.flat());
    console.log(
      `Loaded ${allAttendanceRecords.length} total attendance records from ${months.length} months`
    );

    // Filter attendance records to only include those within the exact date range
    // This ensures we only count attendance from the specified period, even if it spans months
    const filteredAttendanceRecords = allAttendanceRecords.filter((record) => {
      const recordDate = new Date(record.year, record.month - 1, record.day);
      const isInRange = recordDate >= start && recordDate <= end;
      console.log(
        `Attendance for ${recordDate.toISOString()}: ${
          isInRange ? "included" : "excluded"
        }`
      );
      return isInRange;
    });
    console.log(
      `Filtered to ${filteredAttendanceRecords.length} attendance records within date range`
    );

    if (!employee) {
      throw new Error("Employee not found");
    }

    // Count absences by checking empty time entries in attendance records
    const absences = filteredAttendanceRecords.filter((record) => {
      // Skip Sundays
      const recordDate = new Date(record.year, record.month - 1, record.day);
      if (recordDate.getDay() === 0) return false;

      // Count as absence if both timeIn and timeOut are empty
      return !record.timeIn || !record.timeOut;
    });

    console.log(
      "Found absences:",
      absences.map((record) => ({
        date: `${record.year}-${record.month}-${record.day}`,
        timeIn: record.timeIn,
        timeOut: record.timeOut,
      }))
    );

    const totalAbsences = absences.length;
    console.log(`Total absences in period: ${totalAbsences}`);

    // Count the number of days worked (days with both timeIn and timeOut)
    const daysWorked = filteredAttendanceRecords.filter((record) => {
      const recordDate = new Date(record.year, record.month - 1, record.day);
      // Don't count Sundays
      if (recordDate.getDay() === 0) return false;
      return record.timeIn && record.timeOut;
    }).length;

    console.log(`Total days worked: ${daysWorked}`);

    // Calculate totals from pre-computed compensation records
    let totalBasicPay = 0;
    let totalOvertime = 0;
    let totalOvertimeMinutes = 0;
    let totalUndertimeDeduction = 0;
    let totalUndertimeMinutes = 0;
    let totalLateDeduction = 0;
    let totalLateMinutes = 0;
    let totalHolidayBonus = 0;
    let totalLeavePay = 0;
    let totalGrossPay = 0;
    let totalDeductions = 0;
    let totalNightDifferentialHours = 0;
    let totalNightDifferentialPay = 0;

    // Calculate the daily rate once
    const dailyRate = parseFloat(`${employee.dailyRate || 0}`);

    // Calculate basic pay for the period
    totalBasicPay = dailyRate * daysWorked;

    // Sum up all pre-computed values from compensation records
    for (const comp of filteredCompensations) {
      totalOvertime += comp.overtimePay || 0;
      totalOvertimeMinutes += comp.overtimeMinutes || 0;
      totalUndertimeDeduction += comp.undertimeDeduction || 0;
      totalUndertimeMinutes += comp.undertimeMinutes || 0;
      totalLateDeduction += comp.lateDeduction || 0;
      totalLateMinutes += comp.lateMinutes || 0;
      totalHolidayBonus += comp.holidayBonus || 0;
      totalLeavePay += comp.leavePay || 0;
      totalDeductions += comp.deductions || 0;
      totalNightDifferentialHours += comp.nightDifferentialHours || 0;
      totalNightDifferentialPay += comp.nightDifferentialPay || 0;
    }

    // Calculate total gross pay for the period
    totalGrossPay =
      totalBasicPay +
      totalOvertime +
      totalHolidayBonus +
      totalLeavePay +
      totalNightDifferentialPay;

    // Calculate final net pay with government deductions
    const totalNetPay =
      totalGrossPay -
      totalDeductions -
      (employee.sss || 0) -
      (employee.philHealth || 0) -
      (employee.pagIbig || 0);

    const summary: PayrollSummaryModel = {
      id: `${employeeId}-${start.getTime()}`,
      employeeName: employee.name,
      employeeId,
      startDate: start,
      endDate: end,
      dailyRate: employee.dailyRate || 0,
      basicPay: totalBasicPay,
      overtime: totalOvertime,
      overtimeMinutes: totalOvertimeMinutes,
      undertimeDeduction: totalUndertimeDeduction,
      undertimeMinutes: totalUndertimeMinutes,
      lateDeduction: totalLateDeduction,
      lateMinutes: totalLateMinutes,
      holidayBonus: totalHolidayBonus,
      nightDifferentialHours: totalNightDifferentialHours,
      nightDifferentialPay: totalNightDifferentialPay,
      dayType: filteredCompensations[0]?.dayType || "Regular",
      leaveType: filteredCompensations[0]?.leaveType || "None",
      leavePay: totalLeavePay,
      grossPay: totalGrossPay,
      allowances: 0,
      deductions: {
        sss: employee.sss || 0,
        philHealth: employee.philHealth || 0,
        pagIbig: employee.pagIbig || 0,
        cashAdvanceDeductions: 0,
        others: totalDeductions,
      },
      netPay: totalNetPay,
      paymentDate: new Date(end.getTime() + 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      daysWorked,
      absences: totalAbsences,
    };

    return summary;
  }

  public async generatePayrollSummary(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    deductions?: {
      sss: number;
      philHealth: number;
      pagIbig: number;
      cashAdvanceDeductions: number;
    }
  ): Promise<PayrollSummaryModel> {
    try {
      const employeeModel = createEmployeeModel(this.dbPath);
      const employee = await employeeModel.loadEmployeeById(employeeId);
      if (!employee) throw new Error("Employee not found");

      console.log(
        `Generating payroll summary for employee ${employeeId} between ${startDate.toDateString()} and ${endDate.toDateString()}`
      );
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      const summary = await this.summarizeCompensations(employeeId, start, end);

      // Use provided deductions or default to employee's saved deductions or 0
      const finalDeductions = {
        sss:
          typeof deductions?.sss === "string"
            ? parseFloat(deductions?.sss)
            : deductions?.sss ?? employee.sss ?? 0,
        philHealth:
          typeof deductions?.philHealth === "string"
            ? parseFloat(deductions?.philHealth)
            : deductions?.philHealth ?? employee.philHealth ?? 0,
        pagIbig:
          typeof deductions?.pagIbig === "string"
            ? parseFloat(deductions?.pagIbig)
            : deductions?.pagIbig ?? employee.pagIbig ?? 0,
        cashAdvanceDeductions:
          typeof deductions?.cashAdvanceDeductions === "string"
            ? parseFloat(deductions?.cashAdvanceDeductions)
            : deductions?.cashAdvanceDeductions ?? 0,
        others: summary.deductions.others || 0,
      };

      console.log(
        `Using the following deductions: ${JSON.stringify(finalDeductions)}`
      );

      const payrollData = {
        id: `${employeeId}_${startDate.getTime()}_${endDate.getTime()}`,
        employeeId,
        employeeName: employee.name,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        dailyRate: summary.dailyRate,
        basicPay: summary.basicPay,
        overtimePay: summary.overtime,
        overtimeMinutes: summary.overtimeMinutes || 0,
        undertimeDeduction: summary.undertimeDeduction || 0,
        undertimeMinutes: summary.undertimeMinutes || 0,
        lateDeduction: summary.lateDeduction || 0,
        lateMinutes: summary.lateMinutes || 0,
        holidayBonus: summary.holidayBonus || 0,
        grossPay: summary.grossPay,
        allowances: summary.allowances || 0,
        sssDeduction: finalDeductions.sss,
        philHealthDeduction: finalDeductions.philHealth,
        pagIbigDeduction: finalDeductions.pagIbig,
        cashAdvanceDeductions: finalDeductions.cashAdvanceDeductions,
        otherDeductions: finalDeductions.others,
        netPay:
          summary.grossPay -
          (finalDeductions.sss +
            finalDeductions.philHealth +
            finalDeductions.pagIbig +
            finalDeductions.cashAdvanceDeductions +
            finalDeductions.others),
        paymentDate: new Date().toISOString(),
        daysWorked: summary.daysWorked || 0,
        absences: summary.absences || 0,
      };

      // Get all months between start and end date
      const months = [];
      let currentDate = new Date(start);
      while (currentDate <= end) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Save payroll data only to the file corresponding to the end date's month
      const endMonth = end.getMonth() + 1;
      const endYear = end.getFullYear();
      const filePath = `${this.dbPath}/SweldoDB/payrolls/${employeeId}/${endYear}_${endMonth}_payroll.csv`;

      // Ensure directory exists
      await window.electron.ensureDir(
        `${this.dbPath}/SweldoDB/payrolls/${employeeId}`
      );

      let csvContent = "";
      const fileExists = await window.electron.fileExists(filePath);

      if (fileExists) {
        // Read existing content and append new row
        const existingContent = await window.electron.readFile(filePath);
        const parsedData = Papa.parse(existingContent, { header: true });
        parsedData.data.push(payrollData);
        csvContent = Papa.unparse(parsedData.data);
      } else {
        // Create new file with header and first row
        csvContent = Papa.unparse([payrollData]);
      }

      try {
        await window.electron.writeFile(filePath, csvContent);
        console.log(`Payroll data saved to ${filePath}`);
      } catch (error) {
        console.error(`Error writing to file ${filePath}:`, error);
        throw error;
      }

      return {
        ...summary,
        deductions: finalDeductions,
        netPay:
          summary.grossPay -
          (finalDeductions.sss +
            finalDeductions.philHealth +
            finalDeductions.pagIbig +
            finalDeductions.cashAdvanceDeductions +
            finalDeductions.others),
      };
    } catch (error) {
      console.error("Error generating payroll summary:", error);
      throw error;
    }
  }

  public static async deletePayrollSummary(
    dbPath: string,
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Get the file path based on the end date's month and year
      const endMonth = endDate.getMonth() + 1;
      const endYear = endDate.getFullYear();
      const filePath = `${dbPath}/SweldoDB/payrolls/${employeeId}/${endYear}_${endMonth}_payroll.csv`;

      console.log(`Attempting to delete payroll from file: ${filePath}`);
      console.log(
        `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Check if file exists
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) {
        throw new Error(`Payroll file not found: ${filePath}`);
      }

      // Read the file content
      const content = await window.electron.readFile(filePath);
      const parsedData = Papa.parse(content, { header: true });

      console.log(`Found ${parsedData.data.length} records in file`);

      // Find the exact record to delete using the ID
      const payrollId = `${employeeId}_${startDate.getTime()}_${endDate.getTime()}`;
      console.log(`Looking for payroll with ID: ${payrollId}`);

      // Find the payroll record before filtering it out
      const payrollToDelete = parsedData.data.find(
        (row: any) => row.id === payrollId
      ) as PayrollSummaryModel;
      if (!payrollToDelete) {
        throw new Error("Payroll record not found");
      }

      // If there are cash advance deductions, reverse them
      if (payrollToDelete.deductions.cashAdvanceDeductions > 0) {
        console.log(
          `Reversing cash advance deduction of ${payrollToDelete.deductions.cashAdvanceDeductions}`
        );
        await Payroll.reverseCashAdvanceDeduction(
          dbPath,
          employeeId,
          payrollToDelete.deductions.cashAdvanceDeductions,
          endDate
        );
      }

      // Filter out the matching record
      const filteredData = parsedData.data.filter((row: any) => {
        const rowId = row.id?.toString();
        const shouldKeep = rowId !== payrollId;
        console.log(`Row ID: ${rowId}, Keep: ${shouldKeep}`);
        return shouldKeep;
      });

      console.log(`Remaining records after filter: ${filteredData.length}`);

      // Convert back to CSV
      const updatedContent = Papa.unparse(filteredData);

      // Write the updated content back to the file
      await window.electron.writeFile(filePath, updatedContent);

      console.log(`Successfully deleted payroll record with ID: ${payrollId}`);
    } catch (error) {
      console.error(`Error deleting payroll summary:`, error);
      throw error;
    }
  }

  public static async loadPayrolls(
    dbPath: string,
    employeeId: string,
    year: number,
    month: number
  ): Promise<PayrollSummaryModel[]> {
    try {
      const compensationModel = createCompensationModel(dbPath);
      const employeeModel = createEmployeeModel(dbPath);

      // Load employee details
      const employee = await employeeModel.loadEmployeeById(employeeId);
      if (!employee) {
        throw new Error("Employee not found");
      }

      // Load all compensations for the month
      const compensations = await compensationModel.loadRecords(
        month,
        year,
        employeeId
      );

      // Group compensations by week or pay period
      const payPeriods = new Map<string, Compensation[]>();

      compensations.forEach((comp) => {
        const date = new Date(comp.year, comp.month - 1, comp.day); // Use the start of each week as the pay period key
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const key = weekStart.toISOString();

        if (!payPeriods.has(key)) {
          payPeriods.set(key, []);
        }
        payPeriods.get(key)?.push(comp);
      });

      // Convert each pay period into a PayrollSummary
      const payrolls: PayrollSummaryModel[] = [];

      for (const [key, periodCompensations] of payPeriods) {
        const startDate = new Date(key);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 14); // Two weeks per period

        const summary = {
          id: `${employeeId}-${startDate.getTime()}`,
          employeeName: employee.name,
          employeeId: employeeId,
          startDate,
          endDate,
          dailyRate: employee.dailyRate || 0,
          basicPay: periodCompensations.reduce((sum, comp) => {
            const hoursWorked = comp.hoursWorked || 0;
            const dailyRate = employee.dailyRate || 0;
            return sum + hoursWorked * (dailyRate / 8);
          }, 0),
          overtime: periodCompensations.reduce(
            (sum, comp) => sum + (comp.overtimePay || 0),
            0
          ),
          overtimeMinutes: periodCompensations.reduce(
            (sum, comp) => sum + (comp.overtimeMinutes || 0),
            0
          ),
          undertimeDeduction: periodCompensations.reduce(
            (sum, comp) => sum + (comp.undertimeDeduction || 0),
            0
          ),
          undertimeMinutes: periodCompensations.reduce(
            (sum, comp) => sum + (comp.undertimeMinutes || 0),
            0
          ),
          lateDeduction: periodCompensations.reduce(
            (sum, comp) => sum + (comp.lateDeduction || 0),
            0
          ),
          lateMinutes: periodCompensations.reduce(
            (sum, comp) => sum + (comp.lateMinutes || 0),
            0
          ),
          holidayBonus: periodCompensations.reduce(
            (sum, comp) => sum + (comp.holidayBonus || 0),
            0
          ),
          leavePay: periodCompensations.reduce(
            (sum, comp) => sum + (comp.leavePay || 0),
            0
          ),
          grossPay: periodCompensations.reduce(
            (sum, comp) => sum + (comp.grossPay || 0),
            0
          ),
          allowances: 0, // Not in compensation model, set to 0
          deductions: {
            sss: employee.sss || 0,
            philHealth: employee.philHealth || 0,
            pagIbig: employee.pagIbig || 0,
            cashAdvanceDeductions: 0,
            others: periodCompensations.reduce(
              (sum, comp) => sum + (comp.deductions || 0),
              0
            ),
          },
          netPay: periodCompensations.reduce(
            (sum, comp) => sum + (comp.netPay || 0),
            0
          ),
          paymentDate: new Date(endDate.getTime() + 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0], // Payment 3 days after period end
          daysWorked: periodCompensations.length, // Add number of days worked
          absences:
            getWorkingDaysInPeriod(startDate, endDate) -
            periodCompensations.length, // Calculate absences
          nightDifferentialHours: periodCompensations.reduce(
            (sum, comp) => sum + (comp.nightDifferentialHours || 0),
            0
          ),
          nightDifferentialPay: periodCompensations.reduce(
            (sum, comp) => sum + (comp.nightDifferentialPay || 0),
            0
          ),
        };

        payrolls.push(summary);
      }

      return payrolls.sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
    } catch (error) {
      console.error("[Payroll.loadPayrolls] Error:", error);
      throw error;
    }
  }

  public static async loadPayrollSummaries(
    dbPath: string,
    employeeId: string,
    year: number,
    month: number
  ): Promise<PayrollSummaryModel[]> {
    try {
      console.log(
        `Loading payroll summaries for ${year}-${month}, employee: ${employeeId}`
      );
      const filePath = `${dbPath}/SweldoDB/payrolls/${employeeId}/${year}_${month}_payroll.csv`;

      // Check if file exists using electron
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) {
        console.log(`No payroll file found for ${year}-${month}`);
        return [];
      }

      const fileContent = await window.electron.readFile(filePath);
      const rows = fileContent.split("\n").filter((row) => row.trim());

      // Skip header row
      const payrolls: PayrollSummaryModel[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row.trim()) continue;

        const columns = row.split(",");
        console.log(`Processing row: ${row}`);

        const payroll: PayrollSummaryModel = {
          id: columns[0],
          employeeId: columns[1],
          employeeName: columns[2],
          startDate: new Date(columns[3]),
          endDate: new Date(columns[4]),
          dailyRate: parseFloat(columns[5]),
          basicPay: parseFloat(columns[6]),
          overtime: parseFloat(columns[7]),
          overtimeMinutes: parseInt(columns[8]),
          undertimeDeduction: parseFloat(columns[9]),
          undertimeMinutes: parseInt(columns[10]),
          lateDeduction: parseFloat(columns[11]),
          lateMinutes: parseInt(columns[12]),
          holidayBonus: parseFloat(columns[13]),
          grossPay: parseFloat(columns[14]),
          allowances: parseFloat(columns[15]),
          deductions: {
            sss: parseFloat(columns[16]),
            philHealth: parseFloat(columns[17]),
            pagIbig: parseFloat(columns[18]),
            cashAdvanceDeductions: parseFloat(columns[19]),
            others: parseFloat(columns[20]),
          },
          netPay: parseFloat(columns[21]),
          paymentDate: columns[22], // Fix the type issue by using the string directly
          daysWorked: parseInt(columns[23]),
          absences: parseInt(columns[24]),
        };

        payrolls.push(payroll);
      }

      console.log(`Loaded ${payrolls.length} payroll records from ${filePath}`);
      return payrolls;
    } catch (error) {
      console.error(
        `[Payroll.loadPayrollSummaries] Error loading payrolls for ${year}-${month}:`,
        error
      );
      return [];
    }
  }

  public getData(): ExcelData {
    return {
      startDate: this.dateRange.start,
      endDate: this.dateRange.end,
      days: this.days,
      employees: this.employees,
      fileType: this.fileType,
      generatedTime: this.generatedTime,
    };
  }

  // Helper function to count actual working days based on employment type schedule
  private async getActualWorkingDays(
    start: Date,
    end: Date,
    employmentType: string,
    attendanceRecords: Attendance[],
    compensations: Compensation[]
  ): Promise<number> {
    console.log(
      `Calculating actual working days from ${start} to ${end} for employment type: ${employmentType}`
    );
    console.log("Attendance records:", attendanceRecords);

    const timeSettings = await this.attendanceSettingsModel.loadTimeSettings();
    console.log("Time settings:", timeSettings);

    const employeeSchedule = timeSettings.find(
      (type) => type.type === employmentType
    );
    console.log("Found employee schedule:", employeeSchedule);

    if (!employeeSchedule) {
      console.log("No schedule found for employment type:", employmentType);
      return 0;
    }

    // Load holidays for this period
    const holidayModel = createHolidayModel(
      this.dbPath,
      start.getFullYear(),
      start.getMonth() + 1
    );
    const holidays = await holidayModel.loadHolidays();

    let absences = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay() || 7; // Convert 0 (Sunday) to 7
      console.log(`Processing date: ${currentDate}, day of week: ${dayOfWeek}`);

      const schedule = getScheduleForDay(employeeSchedule, dayOfWeek);
      console.log("Schedule for day:", schedule);

      // Check if this date is a holiday
      const isHoliday = holidays.some((holiday) => {
        const holidayDate = new Date(holiday.startDate);
        return (
          holidayDate.getDate() === currentDate.getDate() &&
          holidayDate.getMonth() === currentDate.getMonth() &&
          holidayDate.getFullYear() === currentDate.getFullYear()
        );
      });

      // Only check for absence if it's a scheduled working day and not a holiday
      if (schedule && schedule.timeIn && schedule.timeOut && !isHoliday) {
        // Find attendance record for this day
        const attendance = attendanceRecords.find(
          (record) =>
            record.day === currentDate.getDate() &&
            record.timeIn &&
            record.timeOut // Must have both timeIn and timeOut
        );
        console.log("Found attendance record:", attendance);

        // If no attendance record found for a scheduled day, count as absence
        if (!attendance) {
          console.log(`Absence found for date: ${currentDate}`);
          absences++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Total absences found: ${absences}`);
    return absences;
  }

  private static async reverseCashAdvanceDeduction(
    dbPath: string,
    employeeId: string,
    deductionAmount: number,
    payrollDate: Date
  ): Promise<void> {
    try {
      console.log(`Attempting to reverse cash advance deduction:`, {
        employeeId,
        deductionAmount,
        payrollDate: payrollDate.toISOString(),
      });

      // Create a CashAdvanceModel instance for the specific month
      const cashAdvanceModel = createCashAdvanceModel(
        dbPath,
        employeeId,
        payrollDate.getMonth() + 1,
        payrollDate.getFullYear()
      );

      // Load all cash advances for the employee
      const cashAdvances = await cashAdvanceModel.loadCashAdvances(employeeId);
      console.log(`Found ${cashAdvances.length} cash advances for employee`);

      // Find cash advances that have been paid (fully or partially)
      const relevantCashAdvances = cashAdvances
        .filter((ca) => {
          const isRelevant = ca.remainingUnpaid < ca.amount; // Has been paid at least partially

          console.log(`Checking cash advance:`, {
            id: ca.id,
            date: ca.date,
            amount: ca.amount,
            remainingUnpaid: ca.remainingUnpaid,
            isRelevant,
          });

          return isRelevant;
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      console.log(
        `Found ${relevantCashAdvances.length} relevant cash advances`
      );

      const relevantCashAdvance = relevantCashAdvances[0];

      if (relevantCashAdvance) {
        console.log(`Found relevant cash advance to reverse:`, {
          id: relevantCashAdvance.id,
          originalAmount: relevantCashAdvance.amount,
          currentRemainingUnpaid: relevantCashAdvance.remainingUnpaid,
          deductionToReverse: deductionAmount,
          newRemainingUnpaid: Math.min(
            relevantCashAdvance.remainingUnpaid + deductionAmount,
            relevantCashAdvance.amount
          ),
        });

        // Update the cash advance to reflect the reversed deduction
        const updatedCashAdvance = {
          ...relevantCashAdvance,
          status: "Unpaid" as const, // Always mark as unpaid when reversing a deduction
          remainingUnpaid: Math.min(
            relevantCashAdvance.remainingUnpaid + deductionAmount,
            relevantCashAdvance.amount // Don't exceed original amount
          ),
        } as CashAdvance;

        // If this was an installment payment, update the remaining payments
        if (
          updatedCashAdvance.paymentSchedule === "Installment" &&
          updatedCashAdvance.installmentDetails
        ) {
          const amountPerPayment =
            updatedCashAdvance.installmentDetails.amountPerPayment;
          updatedCashAdvance.installmentDetails.remainingPayments = Math.ceil(
            updatedCashAdvance.remainingUnpaid / amountPerPayment
          );
        }

        // Save the updated cash advance
        await cashAdvanceModel.updateCashAdvance(updatedCashAdvance);
        console.log(`Successfully reversed cash advance deduction:`, {
          employeeId,
          cashAdvanceId: updatedCashAdvance.id,
          deductionAmount,
          newRemainingUnpaid: updatedCashAdvance.remainingUnpaid,
          newStatus: updatedCashAdvance.status,
        });
      } else {
        console.warn(`No relevant cash advance found to reverse deduction:`, {
          employeeId,
          payrollDate: payrollDate.toISOString(),
          deductionAmount,
          availableCashAdvances: cashAdvances.map((ca) => ({
            id: ca.id,
            date: ca.date,
            amount: ca.amount,
            remainingUnpaid: ca.remainingUnpaid,
          })),
        });
      }
    } catch (error) {
      console.error(`Error reversing cash advance deduction:`, error);
      throw error;
    }
  }

  // Helper function to determine if a time should be AM or PM based on schedule
  private determineTimeAMPM(
    time: string,
    isTimeIn: boolean,
    schedule: { timeIn: string; timeOut: string }
  ): string {
    if (!time || !schedule) return time;

    const [hours] = time.split(":").map(Number);
    const [schedInHour] = schedule.timeIn.split(":").map(Number);
    const [schedOutHour] = schedule.timeOut.split(":").map(Number);

    // Determine if it's a night shift (starts in PM, ends in AM)
    const isNightShift = schedInHour >= 18;

    if (isNightShift) {
      if (isTimeIn) {
        // For time in during night shift:
        // If hour is between 18-23 or 0-2, it should be PM
        return hours >= 18 || hours <= 2 ? `${time} PM` : `${time} AM`;
      } else {
        // For time out during night shift:
        // If hour is between 3-11, it should be AM
        return hours >= 3 && hours <= 11 ? `${time} AM` : `${time} PM`;
      }
    }

    // For regular shifts
    return hours < 12 ? `${time} AM` : `${time} PM`;
  }

  // Helper to calculate time difference in hours, handling day boundaries
  private getHoursDifference(time1: string, time2: string): number {
    const [h1] = time1.split(":").map(Number);
    const [h2] = time2.split(":").map(Number);

    // Handle cross-day scenarios (e.g. 23:00 vs 01:00)
    if (Math.abs(h1 - h2) > 12) {
      return 24 - Math.abs(h1 - h2);
    }
    return Math.abs(h1 - h2);
  }

  // Process time entries based on schedule proximity
  private processTimeEntries(
    rawTime1: string,
    rawTime2: string,
    schedule: { timeIn: string; timeOut: string } | null
  ): { timeIn: string | null; timeOut: string | null } {
    if (!schedule || !rawTime1 || !rawTime2) {
      return { timeIn: rawTime1 || null, timeOut: rawTime2 || null };
    }

    const [schedInHour] = schedule.timeIn.split(":").map(Number);
    const [schedOutHour] = schedule.timeOut.split(":").map(Number);
    const [time1Hour] = rawTime1.split(":").map(Number);
    const [time2Hour] = rawTime2.split(":").map(Number);

    // Calculate proximity to scheduled times
    const time1ToSchedIn = this.getHoursDifference(rawTime1, schedule.timeIn);
    const time1ToSchedOut = this.getHoursDifference(rawTime1, schedule.timeOut);
    const time2ToSchedIn = this.getHoursDifference(rawTime2, schedule.timeIn);
    const time2ToSchedOut = this.getHoursDifference(rawTime2, schedule.timeOut);

    // If either time is within 3 hours of its expected schedule, assign accordingly
    if (time1ToSchedIn <= 3 && time2ToSchedOut <= 3) {
      return {
        timeIn: rawTime1,
        timeOut: rawTime2,
      };
    } else if (time1ToSchedOut <= 3 && time2ToSchedIn <= 3) {
      return {
        timeIn: rawTime2,
        timeOut: rawTime1,
      };
    }

    // If no clear match within 3 hours, use default order
    return {
      timeIn: rawTime1,
      timeOut: rawTime2,
    };
  }
}

/**
 * Calculates the number of working days between two dates.
 * A working day is a day that is not Sunday.
 * @param startDate The start date of the period.
 * @param endDate The end date of the period.
 * @returns The number of working days in the period.
 */
function getWorkingDaysInPeriod(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 3600 * 24)
  );
  let workingDays = 0;
  // Iterate through each day in the period
  for (let i = 0; i <= days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    // Check if the day is not Sunday
    if (date.getDay() !== 0) {
      workingDays++;
    }
  }
  return workingDays;
}
