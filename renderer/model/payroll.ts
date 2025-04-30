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
  getScheduleForDate,
} from "@/renderer/model/settings";
import { createHolidayModel } from "./holiday";
import { createCashAdvanceModel, CashAdvance } from "./cashAdvance";
import { createShortModel, Short } from "./shorts";
import * as fs from "fs";
import { createStatisticsModel } from "./statistics";
import { evaluateFormula } from "../utils/formula";
import { processTimeEntries } from "../utils/timeProcessor";

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
  cashAdvanceIDs?: string[];
  shortIDs?: string[];
  deductions: {
    sss: number;
    philHealth: number;
    pagIbig: number;
    cashAdvanceDeductions: number;
    shortDeductions?: number;
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

interface PayrollCSVData {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  dailyRate: string;
  basicPay: string;
  overtimePay: string;
  overtimeMinutes: string;
  undertimeDeduction: string;
  undertimeMinutes: string;
  lateDeduction: string;
  lateMinutes: string;
  holidayBonus: string;
  grossPay: string;
  allowances: string;
  sssDeduction: string;
  philHealthDeduction: string;
  pagIbigDeduction: string;
  cashAdvanceIDs: string;
  cashAdvanceDeductions: string;
  shortIDs: string;
  shortDeductions: string;
  otherDeductions: string;
  netPay: string;
  paymentDate: string;
  daysWorked: string;
  absences: string;
  nightDifferentialHours: string;
  nightDifferentialPay: string;
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

      // Get employee ID and load employee data
      const employeeId = this.processColumn(rows[i], "ID:");
      const employeeModel = createEmployeeModel(this.dbPath);
      const employee = await employeeModel.loadEmployeeById(employeeId);

      // Only add employee to this.employees if they don't exist in the database
      if (!employee) {
        const employeeName = this.processColumn(rows[i], "Name:");
        this.employees.push({
          id: employeeId,
          name: employeeName || "Unknown",
          position: "",
          dailyRate: 0,
          sss: 0,
          philHealth: 0,
          pagIbig: 0,
          status: "active",
          employmentType: "regular",
          lastPaymentPeriod: null,
        });
      }

      // Process time entries using the utility function
      const { attendances, missingTimeLogs } = processTimeEntries(
        timeList || [],
        employeeId,
        employee?.name || "Unknown",
        employee?.employmentType,
        this.employmentTypes,
        this.dateRange.start.getMonth() + 1,
        this.dateRange.start.getFullYear()
      );

      if (employee) {
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

    // Save employees
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
    const attendance = await createAttendanceModel(this.dbPath); // Keep attendance model if needed elsewhere, but not for daysWorked/absences

    // Get all months between start and end date to handle cross-month payroll periods
    const months: { month: number; year: number }[] = [];
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    // Create a new date object for iteration to avoid modifying the original
    const currentDateIter = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    // Keep adding months while currentDateIter is less than or equal to endMonth
    while (currentDateIter <= endMonth) {
      months.push({
        month: currentDateIter.getMonth() + 1,
        year: currentDateIter.getFullYear(),
      });
      currentDateIter.setMonth(currentDateIter.getMonth() + 1);
    }

    // Fetch all compensations for the date range from all relevant months
    const compensationResults = await Promise.all(
      months.map(({ month, year }) =>
        compensationModel.loadRecords(month, year, employeeId)
      )
    );
    const allCompensations = compensationResults.flat();

    // Filter records to only include those within the exact date range
    const filteredCompensations = allCompensations.filter((comp) => {
      // Create date at start of day to avoid timezone issues
      const compDate = new Date(comp.year, comp.month - 1, comp.day);
      compDate.setHours(0, 0, 0, 0);

      const startOfRange = new Date(start);
      startOfRange.setHours(0, 0, 0, 0);

      const endOfRange = new Date(end);
      endOfRange.setHours(23, 59, 59, 999);

      return compDate >= startOfRange && compDate <= endOfRange;
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    // --- REFINED LOGIC START ---

    // Create a map for quick lookup of compensation records by date timestamp
    const compensationMap = new Map<number, Compensation>();
    filteredCompensations.forEach(comp => {
        const compDate = new Date(comp.year, comp.month - 1, comp.day);
        compDate.setHours(0, 0, 0, 0);
        compensationMap.set(compDate.getTime(), comp);
    });

    let calculatedDaysWorked = 0;
    let calculatedAbsences = 0;
    const totalDaysInPeriod = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    for (let i = 0; i < totalDaysInPeriod; i++) {
        const currentDay = new Date(start);
        currentDay.setDate(start.getDate() + i);
        currentDay.setHours(0, 0, 0, 0);
        const currentDayTime = currentDay.getTime();
        const isRestDay = currentDay.getDay() === 0; // Assuming Sunday is rest day

        const compensationRecord = compensationMap.get(currentDayTime);

        if (compensationRecord) {
            // Compensation record exists for this day
            const netPay = compensationRecord.netPay ?? 0; // Treat null/undefined netPay as 0
            const dayType = compensationRecord.dayType;

            if (netPay > 0) {
                // If there's net pay, it's a worked day (or paid leave/holiday)
                calculatedDaysWorked++;
            } else if (dayType !== "Regular") {  
              // If there's no net pay but it's not a Regular day, it's a leave/holiday
              calculatedAbsences = calculatedAbsences; // stay the same
            } else {
                 // Record exists, netPay is 0, and it's a Regular day (or other non-paid type) -> Absence
                 // Only count as absence if it's not a designated rest day
                 if (!isRestDay) {
                    calculatedAbsences++;
                 }
            }
        } else {
            // No compensation record for this day
            // If it's not a rest day, count as absence
            if (!isRestDay) {
                calculatedAbsences++;
            }
            // Else, it's a rest day without compensation, do nothing
        }
    }

    // Use the newly calculated counts
    const daysWorked = calculatedDaysWorked;
    const totalAbsences = calculatedAbsences;

    console.log(`[Payroll Summary] Refined Calculated Days Worked: ${daysWorked}`);
    console.log(`[Payroll Summary] Refined Calculated Absences: ${totalAbsences}`);

    // --- REFINED LOGIC END ---


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
    let totalOtherDeductionsFromComp = 0; // Renamed to avoid confusion with gov't deductions
    let totalNightDifferentialHours = 0;
    let totalNightDifferentialPay = 0;

    // Calculate the daily rate once
    const dailyRate = parseFloat(`${employee.dailyRate || 0}`);

    // Calculate basic pay for the period using the NEW daysWorked count
    totalBasicPay = dailyRate * daysWorked;
    console.log(`[Payroll Summary] Calculated Basic Pay (Rate * Days Worked): ${dailyRate} * ${daysWorked} = ${totalBasicPay}`);


    // Sum up all pre-computed values from compensation records
    for (const comp of filteredCompensations) {
      // Basic pay is now calculated above based on daysWorked, so don't sum it here.
      totalOvertime += comp.overtimePay || 0;
      totalOvertimeMinutes += comp.overtimeMinutes || 0;
      totalUndertimeDeduction += comp.undertimeDeduction || 0;
      totalUndertimeMinutes += comp.undertimeMinutes || 0;
      totalLateDeduction += comp.lateDeduction || 0;
      totalLateMinutes += comp.lateMinutes || 0;
      totalHolidayBonus += comp.holidayBonus || 0;
      totalLeavePay += comp.leavePay || 0;
      totalOtherDeductionsFromComp += comp.deductions || 0; // Summing 'deductions' field from Compensation
      totalNightDifferentialHours += comp.nightDifferentialHours || 0;
      totalNightDifferentialPay += comp.nightDifferentialPay || 0;
    }

    // Calculate total gross pay for the period (using the recalculated basicPay)
    // Gross Pay = Basic Pay + Overtime + Holiday Bonus + Leave Pay + Night Diff - Undertime - Late
     totalGrossPay =
       totalBasicPay + // Use the recalculated basic pay
       totalOvertime +
       totalHolidayBonus +
       totalLeavePay +
       totalNightDifferentialPay;
     console.log(`[Payroll Summary] Calculated Gross Pay: ${totalGrossPay}`);

    // Calculate final net pay (This part seems okay, uses grossPay - deductions)
    // Note: The 'totalDeductions' summed from compensation records might need review
    // depending on what it represents. Assuming it's *not* government deductions.
    // const governmentDeductions = (employee.sss || 0) + (employee.philHealth || 0) + (employee.pagIbig || 0);
    // Let's recalculate totalNetPay based on the new gross and separate deductions
    // totalNetPay = totalGrossPay - totalOtherDeductionsFromComp - governmentDeductions; // Example if totalOtherDeductionsFromComp are non-gov't

    // Load cash advances for the period - handle cross-month periods
    let cashAdvances: CashAdvance[] = [];

    // If start and end dates are in different months, load from both months
    if (
      startDate.getMonth() !== endDate.getMonth() ||
      startDate.getFullYear() !== endDate.getFullYear()
    ) {
      // Load from start month
      const startMonthCashAdvanceModel = createCashAdvanceModel(
        this.dbPath,
        employeeId,
        startDate.getMonth() + 1,
        startDate.getFullYear()
      );
      const startMonthCashAdvances =
        await startMonthCashAdvanceModel.loadCashAdvances(employeeId);
      cashAdvances = [...cashAdvances, ...startMonthCashAdvances];
    }

    // Always load from end month
    const endMonthCashAdvanceModel = createCashAdvanceModel(
      this.dbPath,
      employeeId,
      endDate.getMonth() + 1,
      endDate.getFullYear()
    );
    const endMonthCashAdvances =
      await endMonthCashAdvanceModel.loadCashAdvances(employeeId);
    cashAdvances = [...cashAdvances, ...endMonthCashAdvances];

    // Filter cash advances to only include those within the date range
    cashAdvances = cashAdvances.filter((advance) => {
      const advanceDate = new Date(advance.date);
      return advanceDate >= startDate && advanceDate <= endDate;
    });

    // Load shorts for the period - handle cross-month periods
    let shorts: Short[] = [];

    // If start and end dates are in different months, load from both months
    if (
      startDate.getMonth() !== endDate.getMonth() ||
      startDate.getFullYear() !== endDate.getFullYear()
    ) {
      // Load from start month
      const startMonthShortModel = createShortModel(
        this.dbPath,
        employeeId,
        startDate.getMonth() + 1,
        startDate.getFullYear()
      );
      const startMonthShorts = await startMonthShortModel.loadShorts(
        employeeId
      );
      shorts = [...shorts, ...startMonthShorts];
    }

    // Always load from end month
    const endMonthShortModel = createShortModel(
      this.dbPath,
      employeeId,
      endDate.getMonth() + 1,
      endDate.getFullYear()
    );
    const endMonthShorts = await endMonthShortModel.loadShorts(employeeId);
    shorts = [...shorts, ...endMonthShorts];

    // Filter shorts to only include those within the date range
    shorts = shorts.filter((short) => {
      const shortDate = new Date(short.date);
      return shortDate >= startDate && shortDate <= endDate;
    });

    // Calculate cash advance deductions (based on what's actually paid in this period, usually handled in generatePayrollSummary)
    const cashAdvanceDeductions = 0; // Placeholder - actual deduction amount determined later

    // Calculate short deductions (based on what's actually paid in this period, usually handled in generatePayrollSummary)
    const shortDeductions = 0; // Placeholder - actual deduction amount determined later

    // Ensure the final summary object uses the recalculated values
    const summary: PayrollSummaryModel = {
      id: `${employeeId}-${start.getTime()}`,
      employeeName: employee.name,
      employeeId,
      startDate: start,
      endDate: end,
      dailyRate: employee.dailyRate || 0,
      basicPay: totalBasicPay, // Use recalculated
      overtime: totalOvertime,
      overtimeMinutes: totalOvertimeMinutes,
      undertimeDeduction: totalUndertimeDeduction,
      undertimeMinutes: totalUndertimeMinutes,
      lateDeduction: totalLateDeduction,
      lateMinutes: totalLateMinutes,
      holidayBonus: totalHolidayBonus,
      nightDifferentialHours: totalNightDifferentialHours,
      nightDifferentialPay: totalNightDifferentialPay,
      dayType: filteredCompensations[0]?.dayType || "Regular", // Keep this logic if needed
      leaveType: filteredCompensations[0]?.leaveType || "None", // Keep this logic if needed
      leavePay: totalLeavePay,
      grossPay: totalGrossPay, // Use recalculated
      allowances: 0, // Assuming allowances are handled separately or not applicable here
      cashAdvanceIDs: cashAdvances.map((advance) => advance.id), // Keep IDs for reference
      shortIDs: shorts.map((short) => short.id), // Keep IDs for reference
      deductions: {
        sss: employee.sss || 0, // Default government deductions
        philHealth: employee.philHealth || 0,
        pagIbig: employee.pagIbig || 0,
        cashAdvanceDeductions, // Placeholder, will be updated in generatePayrollSummary
        shortDeductions, // Placeholder, will be updated in generatePayrollSummary
        others: totalOtherDeductionsFromComp, // Use the sum from compensation records
      },
      netPay: 0, // Placeholder - netPay calculation happens later in generatePayrollSummary
      paymentDate: end.toISOString(),
      daysWorked, // Use recalculated
      absences: totalAbsences, // Use recalculated
    };

    // The actual netPay calculation happens in generatePayrollSummary using formulas or gross - total deductions.
    // We just need to ensure the grossPay and basicPay fed into it are correct.
    console.log("[Payroll Summary] Returning Summary Object:", summary);
    return summary;
  }

  private async loadCalculationSettings(): Promise<{
    grossPay?: { formula: string; description: string };
    others?: { formula: string; description: string };
    totalDeductions?: { formula: string; description: string };
    netPay?: { formula: string; description: string };
  }> {
    try {
      const settingsPath = `${this.dbPath}/SweldoDB/settings/calculation_settings.json`;
      const exists = await window.electron.fileExists(settingsPath);
      if (!exists) {
        return {};
      }
      const content = await window.electron.readFile(settingsPath);
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to load calculation settings: ${(error as any).message}`
      );
    }
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
      shortDeductions?: number;
    }
  ): Promise<PayrollSummaryModel> {
    try {
      console.log(`[Payroll] Generating summary for Employee ID: ${employeeId}, Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      const employeeModel = createEmployeeModel(this.dbPath);
      const employee = await employeeModel.loadEmployeeById(employeeId);
      if (!employee) throw new Error("Employee not found");

      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      const summary = await this.summarizeCompensations(employeeId, start, end);
      console.log("[Payroll] Compensation Summary:", summary);

      const calculationSettings = await this.loadCalculationSettings();
      console.log("[Payroll] Calculation Settings:", calculationSettings);

      // Calculate values using formulas if available
      const variables = {
        basicPay: summary.basicPay,
        overtime: summary.overtime,
        holidayBonus: summary.holidayBonus || 0,
        undertimeDeduction: summary.undertimeDeduction || 0,
        lateDeduction: summary.lateDeduction || 0,
        nightDifferentialPay: summary.nightDifferentialPay || 0,
        sss: deductions?.sss ?? employee.sss ?? 0,
        philHealth: deductions?.philHealth ?? employee.philHealth ?? 0,
        pagIbig: deductions?.pagIbig ?? employee.pagIbig ?? 0,
        sssLoan: 0,
        pagibigLoan: 0,
        partial: 0,
        shorts: deductions?.shortDeductions || 0,
        cashAdvanceDeductions: deductions?.cashAdvanceDeductions || 0,
      };
      console.log("[Payroll] Variables for Formula Evaluation:", variables);


      // Calculate gross pay using formula if available
      let grossPayValue = summary.grossPay;
      console.log(`[Payroll] Initial Gross Pay (from summary): ${grossPayValue}`);
      if (calculationSettings.grossPay?.formula) {
        try {
          grossPayValue = evaluateFormula(
            calculationSettings.grossPay.formula,
            variables
          );
          console.log(`[Payroll] Calculated Gross Pay (using formula): ${grossPayValue}`);
        } catch (error) {
          console.error(`[Payroll] Error evaluating gross pay formula: ${(error as any).message}`);
          throw new Error(
            `Failed to evaluate gross pay formula: ${(error as any).message}`
          );
        }
      } else {
         console.log("[Payroll] No Gross Pay formula found, using summary value.");
      }


      // Calculate others using formula if available
      let othersValue = 0;
      if (calculationSettings.others?.formula) {
        try {
          othersValue = evaluateFormula(
            calculationSettings.others.formula,
            variables
          );
           console.log(`[Payroll] Calculated Others Value (using formula): ${othersValue}`);
        } catch (error) {
          console.error(`[Payroll] Error evaluating others formula: ${(error as any).message}`);
          throw new Error(
            `Failed to evaluate others formula: ${(error as any).message}`
          );
        }
      } else {
        othersValue =
          (summary.deductions.others || 0) -
          (summary.deductions.shortDeductions || 0);
        console.log(`[Payroll] Calculated Others Value (manual): ${othersValue} (Summary Others: ${summary.deductions.others || 0}, Summary Shorts: ${summary.deductions.shortDeductions || 0})`);
      }

      // Calculate total deductions using formula if available
      const deductionVariables = {
        sss: deductions?.sss ?? employee.sss ?? 0,
        philHealth: deductions?.philHealth ?? employee.philHealth ?? 0,
        pagIbig: deductions?.pagIbig ?? employee.pagIbig ?? 0,
        cashAdvanceDeductions: deductions?.cashAdvanceDeductions ?? 0,
        others: deductions?.shortDeductions ?? 0, // shorts go into others
        lateDeduction: summary.lateDeduction ?? 0,
        undertimeDeduction: summary.undertimeDeduction ?? 0,
      };
      console.log("[Payroll] Variables for Total Deductions:", deductionVariables);


      let totalDeductions = 0;
      if (calculationSettings?.totalDeductions?.formula) {
        console.log(`[Payroll] Using Total Deductions Formula: ${calculationSettings.totalDeductions.formula}`);
        try {
          totalDeductions = evaluateFormula(
            calculationSettings.totalDeductions.formula,
            deductionVariables
          );
          console.log(`[Payroll] Calculated Total Deductions (using formula): ${totalDeductions}`);
        } catch (error) {
          console.error(`[Payroll] Error evaluating total deductions formula: ${(error as any).message}`);
          throw new Error(
            `Formula evaluation failed: ${(error as any).message}`
          );
        }
      } else {
        // No formula available, sum all deductions
        totalDeductions = Object.values(deductionVariables).reduce(
          (sum, val) => sum + (typeof val === "number" ? val : 0),
          0
        );
        console.log(`[Payroll] Calculated Total Deductions (summing variables): ${totalDeductions}`);
      }

      // Calculate net pay using formula if available
      let netPayValue = grossPayValue - totalDeductions;
      console.log(`[Payroll] Initial Net Pay (Gross - Total Deductions): ${grossPayValue} - ${totalDeductions} = ${netPayValue}`);
      if (calculationSettings.netPay?.formula) {
        console.log(`[Payroll] Using Net Pay Formula: ${calculationSettings.netPay.formula}`);
        const netPayVariables = {
            ...variables,
            grossPay: grossPayValue,
            totalDeductions,
            others: othersValue, // Ensure 'others' used here matches the calculated 'othersValue'
          };
        console.log("[Payroll] Variables for Net Pay Formula:", netPayVariables);
        try {
          netPayValue = evaluateFormula(calculationSettings.netPay.formula, netPayVariables);
          console.log(`[Payroll] Calculated Net Pay (using formula): ${netPayValue}`);
        } catch (error) {
          console.error(`[Payroll] Error evaluating net pay formula: ${(error as any).message}`);
          throw new Error(
            `Failed to evaluate net pay formula: ${(error as any).message}`
          );
        }
      } else {
        console.log("[Payroll] No Net Pay formula found, using Gross - Total Deductions.");
      }


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
        shortDeductions:
          typeof deductions?.shortDeductions === "string"
            ? parseFloat(deductions?.shortDeductions)
            : deductions?.shortDeductions ?? 0,
        others: othersValue,
      };
      console.log("[Payroll] Final Deductions Object:", finalDeductions);

      const payrollData: PayrollCSVData = {
        id: `${employeeId}_${startDate.getTime()}_${endDate.getTime()}`,
        employeeId,
        employeeName: employee.name,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        dailyRate: summary.dailyRate.toString(),
        basicPay: summary.basicPay.toString(),
        overtimePay: summary.overtime.toString(),
        overtimeMinutes: (summary.overtimeMinutes || 0).toString(),
        undertimeDeduction: (summary.undertimeDeduction || 0).toString(),
        undertimeMinutes: (summary.undertimeMinutes || 0).toString(),
        lateDeduction: (summary.lateDeduction || 0).toString(),
        lateMinutes: (summary.lateMinutes || 0).toString(),
        holidayBonus: (summary.holidayBonus || 0).toString(),
        grossPay: grossPayValue.toString(),
        allowances: (summary.allowances || 0).toString(),
        sssDeduction: finalDeductions.sss.toString(),
        philHealthDeduction: finalDeductions.philHealth.toString(),
        pagIbigDeduction: finalDeductions.pagIbig.toString(),
        cashAdvanceIDs: (summary.cashAdvanceIDs || []).join("|"),
        cashAdvanceDeductions: finalDeductions.cashAdvanceDeductions.toString(),
        shortIDs: (summary.shortIDs || []).join("|"),
        shortDeductions: finalDeductions.shortDeductions.toString(),
        otherDeductions: finalDeductions.others.toString(),
        netPay: netPayValue.toString(),
        paymentDate: new Date(
          end.getTime() + 2 * 24 * 60 * 60 * 1000
        ).toISOString(),
        daysWorked: (summary.daysWorked || 0).toString(),
        absences: (summary.absences || 0).toString(),
        nightDifferentialHours: (
          summary.nightDifferentialHours || 0
        ).toString(),
        nightDifferentialPay: (summary.nightDifferentialPay || 0).toString(),
      };
      console.log("[Payroll] Payroll Data for CSV:", payrollData);

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

      // Update cash advances if there are any deductions
      const cashAdvanceDeductionAmount = deductions?.cashAdvanceDeductions || 0;
      const cashAdvanceIDsToUpdate = summary.cashAdvanceIDs || [];
      if (cashAdvanceDeductionAmount > 0 && cashAdvanceIDsToUpdate.length > 0) {
        console.log(
          `[Payroll] Processing cash advance deductions. Total amount to deduct: ${cashAdvanceDeductionAmount}`
        );
        console.log(
          `[Payroll] Processing cash advance deductions. Total amount to deduct: ${cashAdvanceDeductionAmount}`
        );

        // Load all cash advances from relevant months
        const allAdvances: CashAdvance[] = [];

        // Get the current month and year from the payroll end date
        const currentMonth = end.getMonth() + 1;
        const currentYear = end.getFullYear();

        // Check current month and previous month to catch recent advances
        for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
          let targetMonth = currentMonth - monthOffset;
          let targetYear = currentYear;

          // Handle year boundary
          if (targetMonth < 1) {
            targetMonth = 12 + targetMonth;
            targetYear--;
          }

          console.log(
            `[Payroll] Loading cash advances for ${targetYear}-${targetMonth}`
          );
          const cashAdvanceModel = createCashAdvanceModel(
            this.dbPath,
            employeeId,
            targetMonth,
            targetYear
          );
          const advances = await cashAdvanceModel.loadCashAdvances(employeeId);
          allAdvances.push(...advances);
        }

        // Filter advances by the IDs in the summary and sort by date (oldest first)
        const advancesToUpdate = allAdvances
          .filter((advance) => {
            const isMatch = cashAdvanceIDsToUpdate.includes(advance.id);
            console.log(
              `[Payroll] Checking advance ${advance.id}: ${
                isMatch ? "matches" : "no match"
              }`
            );
            return isMatch;
          })
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        console.log(
          `[Payroll] Found ${advancesToUpdate.length} cash advances to update`
        );

        // Calculate how much to deduct from each advance
        let remainingDeduction = cashAdvanceDeductionAmount;

        // Update each cash advance
        for (const advance of advancesToUpdate) {
          if (advance.status !== "Paid" && remainingDeduction > 0) {
            console.log(
              `[Payroll] Processing advance ID: ${advance.id}, Current remaining: ${advance.remainingUnpaid}`
            );

            // Calculate how much we can deduct from this advance
            const deductionForThisAdvance = Math.min(
              advance.remainingUnpaid,
              remainingDeduction
            );

            const newRemainingUnpaid = Math.max(
              0,
              advance.remainingUnpaid - deductionForThisAdvance
            );

            console.log(
              `[Payroll] Deducting ${deductionForThisAdvance} from advance. New remaining: ${newRemainingUnpaid}`
            );

            const updatedAdvance = {
              ...advance,
              status:
                newRemainingUnpaid <= 0
                  ? ("Paid" as const)
                  : ("Unpaid" as const),
              remainingUnpaid: newRemainingUnpaid,
            } as CashAdvance;

            // Update installment details if applicable
            if (
              updatedAdvance.paymentSchedule === "Installment" &&
              updatedAdvance.installmentDetails
            ) {
              const paymentsLeft = Math.ceil(
                updatedAdvance.amount /
                  updatedAdvance.installmentDetails.amountPerPayment
              );
              updatedAdvance.installmentDetails.remainingPayments =
                paymentsLeft;
              console.log(
                `[Payroll] Updated installment payments left: ${paymentsLeft}`
              );
            }

            // Save the update
            const cashAdvanceModel = createCashAdvanceModel(
              this.dbPath,
              employeeId,
              advance.date.getMonth() + 1,
              advance.date.getFullYear()
            );
            await cashAdvanceModel.updateCashAdvance(updatedAdvance);
            console.log(
              `[Payroll] Saved updated cash advance status: ${updatedAdvance.status}`
            );

            // Update remaining deduction amount
            remainingDeduction -= deductionForThisAdvance;
            console.log(
              `[Payroll] Remaining deduction amount: ${remainingDeduction}`
            );
          }
        }

        if (remainingDeduction > 0) {
          console.warn(
            `[Payroll] Warning: Not all deductions were applied. Remaining: ${remainingDeduction}`
          );
        }
      }

      // Update shorts if there are any deductions
      const shortDeductionAmount = deductions?.shortDeductions || 0;
      const shortIDsToUpdate = summary.shortIDs || [];
      if (shortDeductionAmount > 0 && shortIDsToUpdate.length > 0) {
        console.log(
          `[Payroll] Processing short deductions. Total amount to deduct: ${shortDeductionAmount}`
        );
        // Load all shorts from relevant months
        const allShorts: Short[] = [];
        for (const { month, year } of months) {
          const shortModel = createShortModel(
            this.dbPath,
            employeeId,
            month,
            year
          );
          const shorts = await shortModel.loadShorts(employeeId);
          allShorts.push(...shorts);
        }

        // Filter shorts by the IDs in the summary
        const shortsToUpdate = allShorts.filter((short) =>
          shortIDsToUpdate.includes(short.id)
        );

        // Update each short
        for (const short of shortsToUpdate) {
          if (short.status !== "Paid") {
            const updatedShort = {
              ...short,
              status: "Paid" as const,
              remainingUnpaid: 0,
            } as Short;

            // Save the update
            const shortModel = createShortModel(
              this.dbPath,
              employeeId,
              short.date.getMonth() + 1,
              short.date.getFullYear()
            );
            await shortModel.updateShort(updatedShort);
          }
        }
      }

      // Save payroll data only to the file corresponding to the end date's month
      const endMonth = end.getMonth() + 1;
      const endYear = end.getFullYear();
      const filePath = `${this.dbPath}/SweldoDB/payrolls/${employeeId}/${endYear}_${endMonth}_payroll.csv`;

      try {
        // Ensure directory exists
        const dirPath = `${this.dbPath}/SweldoDB/payrolls/${employeeId}`;
        try {
          await window.electron.ensureDir(dirPath);
        } catch (error) {
          throw error;
        }

        let csvContent = "";
        const fileExists = await window.electron.fileExists(filePath);

        if (fileExists) {
          const existingContent = await window.electron.readFile(filePath);
          const parsedData = Papa.parse<PayrollCSVData>(existingContent, {
            header: true,
          });
          parsedData.data.push(payrollData);
          csvContent = Papa.unparse(parsedData.data);
        } else {
          csvContent = Papa.unparse([payrollData]);
        }

        await window.electron.writeFile(filePath, csvContent);
      } catch (error: unknown) {
        toast.error(
          `Failed to save payroll CSV: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Update employee's last payment period
      try {
        await employeeModel.updateEmployeeDetails({
          ...employee,
          lastPaymentPeriod: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            start: start.toISOString(),
            end: end.toISOString(),
          },
        });
      } catch (error: unknown) {
        toast.error(
          `Failed to update employee details: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Create the payroll summary object
      const payrollSummary: PayrollSummaryModel = {
        ...summary,
        grossPay: grossPayValue, // Use the final calculated grossPayValue
        deductions: finalDeductions,
        netPay: netPayValue, // Use the final calculated netPayValue
        paymentDate: new Date(
          end.getTime() + 2 * 24 * 60 * 60 * 1000
        ).toISOString(),
        employeeId,
        employeeName: employee.name,
        dailyRate: summary.dailyRate,
        daysWorked: summary.daysWorked || 0,
        absences: summary.absences || 0,
        shortIDs: summary.shortIDs || [],
        cashAdvanceIDs: summary.cashAdvanceIDs || [],
      };
      console.log("[Payroll] Final Payroll Summary Object:", payrollSummary);

      // Update statistics
      try {
        const statisticsModel = createStatisticsModel(this.dbPath, endYear);
        await statisticsModel.updatePayrollStatistics([payrollSummary]);
      } catch (error: unknown) {
        toast.error(
          `Failed to update statistics: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      return payrollSummary;
    } catch (error) {
      console.error("[Payroll] Error in generatePayrollSummary:", error); // Added top-level error log
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

      // Check if file exists
      const fileExists = await window.electron.fileExists(filePath);

      if (!fileExists) {
        throw new Error(`Payroll file not found: ${filePath}`);
      }

      // Read the file content
      const content = await window.electron.readFile(filePath);

      const parsedData = Papa.parse<PayrollCSVData>(content, { header: true });

      // Find the exact record to delete using the ID
      const payrollId = `${employeeId}_${startDate.getTime()}_${endDate.getTime()}`;

      // Find the payroll record before filtering it out
      const payrollToDelete = parsedData.data.find(
        (row: any) => row.id === payrollId
      );

      // If not found with exact ID, try a more flexible approach
      if (!payrollToDelete) {
        // Try to find by employee ID and date range
        const alternativeMatch = parsedData.data.find((row: any) => {
          const rowStartDate = new Date(row.startDate);
          const rowEndDate = new Date(row.endDate);

          // Check if dates match (within a day to account for timezone differences)
          const startDateMatch =
            Math.abs(rowStartDate.getTime() - startDate.getTime()) < 86400000; // 24 hours in ms
          const endDateMatch =
            Math.abs(rowEndDate.getTime() - endDate.getTime()) < 86400000; // 24 hours in ms

          return (
            row.employeeId === employeeId && startDateMatch && endDateMatch
          );
        });

        if (alternativeMatch) {
          // Use this ID instead
          const alternativeId = alternativeMatch.id;

          // Filter out the matching record
          const filteredData = parsedData.data.filter((row: any) => {
            const rowId = row.id?.toString();
            return rowId !== alternativeId;
          });

          // Convert back to CSV
          const updatedContent = Papa.unparse(filteredData);

          // Write the updated content back to the file
          await window.electron.writeFile(filePath, updatedContent);

          return;
        }

        throw new Error("Payroll record not found");
      }

      // If there are cash advance deductions, reverse them
      const cashAdvanceDeductions = parseFloat(
        payrollToDelete.cashAdvanceDeductions || "0"
      );

      if (cashAdvanceDeductions > 0) {
        await Payroll.reverseCashAdvanceDeduction(
          dbPath,
          employeeId,
          cashAdvanceDeductions,
          endDate
        );
      }

      // If there are short deductions, reverse them
      const shortIDs = payrollToDelete.shortIDs
        ? payrollToDelete.shortIDs.split("|")
        : [];

      if (shortIDs.length > 0) {
        await Payroll.reverseShortDeduction(
          dbPath,
          employeeId,
          shortIDs,
          endDate
        );
      }

      // Filter out the matching record
      const filteredData = parsedData.data.filter((row: any) => {
        const rowId = row.id?.toString();
        return rowId !== payrollId;
      });

      // Convert back to CSV
      const updatedContent = Papa.unparse(filteredData);

      // Write the updated content back to the file
      await window.electron.writeFile(filePath, updatedContent);
    } catch (error) {
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
      const filePath = `${dbPath}/SweldoDB/payrolls/${employeeId}/${year}_${month}_payroll.csv`;

      // Check if file exists using electron
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) {
        return [];
      }

      const fileContent = await window.electron.readFile(filePath);

      // Parse the entire CSV file at once with headers
      const parsedData = Papa.parse<PayrollCSVData>(fileContent, {
        header: true,
        skipEmptyLines: true, // Keep this
        delimiter: ",", // Explicitly set the delimiter
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
      });

      if (parsedData.errors.length > 0) {
        // Filter out the 'UndetectableDelimiter' warning if it's the only one,
        // as it often defaults correctly but can be noisy.
        const criticalErrors = parsedData.errors.filter(e => e.code !== 'UndetectableDelimiter');
        if (criticalErrors.length > 0) {
            console.error("Critical CSV Parsing Errors:", criticalErrors);
            toast.error(`Error parsing payroll CSV for ${employeeId} (${year}-${month}). Check console for details.`);
            return []; // Return empty on critical error
        } else {
            console.warn("CSV Parsing Warnings (non-critical):", parsedData.errors);
        }
      }

      // Add a try-catch within the map for more granular error checking
      const payrolls: PayrollSummaryModel[] = parsedData.data.map((row, index) => {
        try {
          // **Add check for essential data before processing the row**
          // If employeeId is missing or empty, assume it's a bad/empty row and skip it.
          if (!row.employeeId || row.employeeId.trim() === "") {
            console.warn(`Skipping row ${index + 1} due to missing employeeId:`, row);
            return null;
          }

          // Ensure dates are properly parsed
          const startDate = new Date(row.startDate);
          const endDate = new Date(row.endDate);
          const paymentDate = new Date(row.paymentDate);

          // Validate date parsing
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(paymentDate.getTime())) {
            console.warn(`Invalid date format in row ${index + 1}:`, row);
            // Skip this row by returning null and filtering later
            return null;
          }

          return {
            id: row.id,
            employeeId: row.employeeId,
            employeeName: row.employeeName,
            startDate,
            endDate,
            dailyRate: parseFloat(row.dailyRate || "0"),
            basicPay: parseFloat(row.basicPay || "0"),
            overtime: parseFloat(row.overtimePay || "0"),
            overtimeMinutes: parseInt(row.overtimeMinutes || "0"),
            undertimeDeduction: parseFloat(row.undertimeDeduction || "0"),
            undertimeMinutes: parseInt(row.undertimeMinutes || "0"),
            lateDeduction: parseFloat(row.lateDeduction || "0"),
            lateMinutes: parseInt(row.lateMinutes || "0"),
            holidayBonus: parseFloat(row.holidayBonus || "0"),
            grossPay: parseFloat(row.grossPay || "0"),
            allowances: parseFloat(row.allowances || "0"),
            deductions: {
              sss: parseFloat(row.sssDeduction || "0"),
              philHealth: parseFloat(row.philHealthDeduction || "0"),
              pagIbig: parseFloat(row.pagIbigDeduction || "0"),
              cashAdvanceDeductions: parseFloat(row.cashAdvanceDeductions || "0"),
              shortDeductions: parseFloat(row.shortDeductions || "0"),
              others: parseFloat(row.otherDeductions || "0"),
            },
            netPay: parseFloat(row.netPay || "0"),
            paymentDate: paymentDate.toISOString(),
            daysWorked: parseInt(row.daysWorked || "0"),
            absences: parseInt(row.absences || "0"),
            nightDifferentialHours: parseFloat(row.nightDifferentialHours || "0"),
            nightDifferentialPay: parseFloat(row.nightDifferentialPay || "0"),
            cashAdvanceIDs: row.cashAdvanceIDs
              ? row.cashAdvanceIDs.split("|").filter(id => id) // Filter out empty strings if split results in them
              : [],
            shortIDs: row.shortIDs ? row.shortIDs.split("|").filter(id => id) : [], // Filter out empty strings
          };
        } catch (mapError) {
           console.error(`Error processing payroll row ${index + 1}:`, mapError, row);
           toast.error(`Error processing payroll data for row ${index + 1}. Check console.`);
           return null; // Return null for rows that cause errors
        }
      }).filter(payroll => payroll !== null) as PayrollSummaryModel[]; // Filter out nulls

      return payrolls;
    } catch (error) {
      console.error("Error loading payroll summaries:", error);
      toast.error("An unexpected error occurred while loading payroll summaries.");
      // Re-throw or handle as appropriate for your application
      throw error;
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
    const timeSettings = await this.attendanceSettingsModel.loadTimeSettings();
    const employeeSchedule = timeSettings.find(
      (type) => type.type === employmentType
    );

    if (!employeeSchedule) {
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
      const schedule = getScheduleForDate(employeeSchedule, currentDate);

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
      if (schedule && !schedule.isOff && !isHoliday) {
        // Find attendance record for this day
        const attendance = attendanceRecords.find(
          (record) =>
            record.day === currentDate.getDate() &&
            record.timeIn &&
            record.timeOut // Must have both timeIn and timeOut
        );

        // If no attendance record found for a scheduled day, count as absence
        if (!attendance) {
          absences++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return absences;
  }

  private static async reverseCashAdvanceDeduction(
    dbPath: string,
    employeeId: string,
    deductionAmount: number,
    payrollDate: Date
  ): Promise<void> {
    try {
      // Get all months between the payroll date and 3 months before (to catch recent cash advances)
      const months = [];
      let currentDate = new Date(payrollDate);
      for (let i = 0; i < 3; i++) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() - 1);
      }

      // Load cash advances from all relevant months
      const allAdvances: CashAdvance[] = [];
      for (const { month, year } of months) {
        const cashAdvanceModel = createCashAdvanceModel(
          dbPath,
          employeeId,
          month,
          year
        );
        const advances = await cashAdvanceModel.loadCashAdvances(employeeId);
        allAdvances.push(...advances);
      }

      // Sort by date (most recent first)
      allAdvances.sort((a, b) => b.date.getTime() - a.date.getTime());

      // Find cash advances that were partially or fully paid
      const paidAdvances = allAdvances.filter(
        (advance) => advance.remainingUnpaid < advance.amount
      );

      if (paidAdvances.length === 0) {
        // If no paid advances found, just return without throwing an error
        // This handles cases where advances were already reversed
        return;
      }

      // Calculate how much was deducted from each advance
      let totalReversed = 0;
      for (const advance of paidAdvances) {
        const amountDeducted = advance.amount - advance.remainingUnpaid;
        if (amountDeducted > 0) {
          // Update the cash advance
          const updatedCashAdvance = {
            ...advance,
            status: "Unpaid" as const,
            remainingUnpaid: advance.amount, // Reset to full amount
          } as CashAdvance;

          // Update installment details if applicable
          if (
            updatedCashAdvance.paymentSchedule === "Installment" &&
            updatedCashAdvance.installmentDetails
          ) {
            updatedCashAdvance.installmentDetails.remainingPayments = Math.ceil(
              updatedCashAdvance.amount /
                updatedCashAdvance.installmentDetails.amountPerPayment
            );
          }

          // Save the update
          const cashAdvanceModel = createCashAdvanceModel(
            dbPath,
            employeeId,
            advance.date.getMonth() + 1,
            advance.date.getFullYear()
          );
          await cashAdvanceModel.updateCashAdvance(updatedCashAdvance);

          totalReversed += amountDeducted;
        }
      }

      if (Math.abs(totalReversed - deductionAmount) > 0.01) {
        // Log warning instead of throwing error
        toast.warning(
          `Reversed amount (${totalReversed}) differs from deduction amount (${deductionAmount})`
        );
      }
    } catch (error) {
      throw error;
    }
  }

  private static async reverseShortDeduction(
    dbPath: string,
    employeeId: string,
    shortIDs: string[],
    payrollDate: Date
  ): Promise<void> {
    try {
      // Get all months between the payroll date and 3 months before (to catch recent shorts)
      const months = [];
      let currentDate = new Date(payrollDate);
      for (let i = 0; i < 3; i++) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() - 1);
      }

      // Load shorts from all relevant months
      const allShorts: Short[] = [];
      for (const { month, year } of months) {
        const shortModel = createShortModel(dbPath, employeeId, month, year);
        const shorts = await shortModel.loadShorts(employeeId);
        allShorts.push(...shorts);
      }

      // Filter shorts by the provided IDs
      const shortsToReverse = allShorts.filter((short) =>
        shortIDs.includes(short.id)
      );

      // Update each short
      for (const short of shortsToReverse) {
        if (short.status === "Paid") {
          // Update the short
          const updatedShort = {
            ...short,
            status: "Unpaid" as const,
            remainingUnpaid: short.amount,
          } as Short;

          // Save the update
          const shortModel = createShortModel(
            dbPath,
            employeeId,
            short.date.getMonth() + 1,
            short.date.getFullYear()
          );
          await shortModel.updateShort(updatedShort);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to reverse short deduction: ${(error as any).message}`
      );
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
