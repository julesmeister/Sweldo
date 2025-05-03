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

// Import the old Payroll model for fallback logic
import { Payroll as OldPayroll } from "./payroll_old";

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

interface PayrollJsonStructure {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  payrolls: PayrollSummaryModel[];
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
  private oldPayrollModelInstance: OldPayroll;

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
    this.oldPayrollModelInstance = new OldPayroll(rows, fileTypeParam, dbPath);

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

    const lastNonNullValue = rows[3].filter((value) => value != null).pop();
    this.days = parseInt(lastNonNullValue?.toString() || "0");

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

    await this.loadTimeSettings();

    for (let i = 4; i < rows.length; i += 2) {
      const timeList = rows[i + 1]?.map((value) => value?.toString());

      const employeeId = this.processColumn(rows[i], "ID:");
      const employeeModel = createEmployeeModel(this.dbPath);
      const employee = await employeeModel.loadEmployeeById(employeeId);

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
        const attendanceModel = createAttendanceModel(this.dbPath);
        const existingAttendances = await attendanceModel.loadAttendancesById(
          this.dateRange.start.getMonth() + 1,
          this.dateRange.start.getFullYear(),
          employee.id
        );
        const existingDays = new Set(existingAttendances.map((att) => att.day));
        const newAttendancesToSave = attendances.filter(
          (att) => !existingDays.has(att.day)
        );
        if (newAttendancesToSave.length > 0) {
          await attendanceModel.saveOrUpdateAttendances(
            newAttendancesToSave,
            this.dateRange.start.getMonth() + 1,
            this.dateRange.start.getFullYear(),
            employee.id
          );
        }

        const missingTimeModel = MissingTimeModel.createMissingTimeModel(
          this.dbPath
        );
        for (const log of missingTimeLogs) {
          const logWithId: MissingTimeLog = {
            ...log,
            id: `log-${Date.now()}-${Math.random()}`,
            createdAt: new Date().toISOString(),
          };
          await missingTimeModel.saveMissingTimeLog(
            logWithId,
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

    const months: { month: number; year: number }[] = [];
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const currentDateIter = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (currentDateIter <= endMonth) {
      months.push({
        month: currentDateIter.getMonth() + 1,
        year: currentDateIter.getFullYear(),
      });
      currentDateIter.setMonth(currentDateIter.getMonth() + 1);
    }

    const compensationResults = await Promise.all(
      months.map(({ month, year }) =>
        compensationModel.loadRecords(month, year, employeeId)
      )
    );
    const allCompensations = compensationResults.flat();

    const filteredCompensations = allCompensations.filter((comp) => {
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

    const compensationMap = new Map<number, Compensation>();
    filteredCompensations.forEach((comp) => {
      const compDate = new Date(comp.year, comp.month - 1, comp.day);
      compDate.setHours(0, 0, 0, 0);
      compensationMap.set(compDate.getTime(), comp);
    });

    let calculatedDaysWorked = 0;
    let calculatedAbsences = 0;
    const totalDaysInPeriod =
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    for (let i = 0; i < totalDaysInPeriod; i++) {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + i);
      currentDay.setHours(0, 0, 0, 0);
      const currentDayTime = currentDay.getTime();
      const isRestDay = currentDay.getDay() === 0;

      const compensationRecord = compensationMap.get(currentDayTime);

      if (compensationRecord) {
        const netPay = compensationRecord.netPay ?? 0;
        const dayType = compensationRecord.dayType;

        if (netPay > 0) {
          calculatedDaysWorked++;
        } else if (dayType !== "Regular") {
          calculatedAbsences = calculatedAbsences;
        } else {
          if (!isRestDay) {
            calculatedAbsences++;
          }
        }
      } else {
        if (!isRestDay) {
          calculatedAbsences++;
        }
      }
    }

    const daysWorked = calculatedDaysWorked;
    const totalAbsences = calculatedAbsences;

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
    let totalOtherDeductionsFromComp = 0;
    let totalNightDifferentialHours = 0;
    let totalNightDifferentialPay = 0;
    const dailyRate = parseFloat(`${employee.dailyRate || 0}`);
    totalBasicPay = dailyRate * daysWorked;

    for (const comp of filteredCompensations) {
      totalOvertime += comp.overtimePay || 0;
      totalOvertimeMinutes += comp.overtimeMinutes || 0;
      totalUndertimeDeduction += comp.undertimeDeduction || 0;
      totalUndertimeMinutes += comp.undertimeMinutes || 0;
      totalLateDeduction += comp.lateDeduction || 0;
      totalLateMinutes += comp.lateMinutes || 0;
      totalHolidayBonus += comp.holidayBonus || 0;
      totalLeavePay += comp.leavePay || 0;
      totalOtherDeductionsFromComp += comp.deductions || 0;
      totalNightDifferentialHours += comp.nightDifferentialHours || 0;
      totalNightDifferentialPay += comp.nightDifferentialPay || 0;
    }

    totalGrossPay =
      totalBasicPay +
      totalOvertime +
      totalHolidayBonus +
      totalLeavePay +
      totalNightDifferentialPay;

    let cashAdvances: CashAdvance[] = [];
    if (
      startDate.getMonth() !== endDate.getMonth() ||
      startDate.getFullYear() !== endDate.getFullYear()
    ) {
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
    const endMonthCashAdvanceModel = createCashAdvanceModel(
      this.dbPath,
      employeeId,
      endDate.getMonth() + 1,
      endDate.getFullYear()
    );
    const endMonthCashAdvances =
      await endMonthCashAdvanceModel.loadCashAdvances(employeeId);
    cashAdvances = [...cashAdvances, ...endMonthCashAdvances];
    cashAdvances = cashAdvances.filter((advance) => {
      const advanceDate = new Date(advance.date);
      return advanceDate >= startDate && advanceDate <= endDate;
    });

    let shorts: Short[] = [];
    if (
      startDate.getMonth() !== endDate.getMonth() ||
      startDate.getFullYear() !== endDate.getFullYear()
    ) {
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
    const endMonthShortModel = createShortModel(
      this.dbPath,
      employeeId,
      endDate.getMonth() + 1,
      endDate.getFullYear()
    );
    const endMonthShorts = await endMonthShortModel.loadShorts(employeeId);
    shorts = [...shorts, ...endMonthShorts];
    shorts = shorts.filter((short) => {
      const shortDate = new Date(short.date);
      return shortDate >= startDate && shortDate <= endDate;
    });

    const cashAdvanceDeductions = 0;
    const shortDeductions = 0;

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
      cashAdvanceIDs: cashAdvances.map((advance) => advance.id),
      shortIDs: shorts.map((short) => short.id),
      deductions: {
        sss: employee.sss || 0,
        philHealth: employee.philHealth || 0,
        pagIbig: employee.pagIbig || 0,
        cashAdvanceDeductions,
        shortDeductions,
        others: totalOtherDeductionsFromComp,
      },
      netPay: 0,
      paymentDate: end.toISOString(),
      daysWorked,
      absences: totalAbsences,
    };

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

  private static getPayrollJsonFilePath(
    dbPath: string,
    employeeId: string,
    year: number,
    month: number
  ): string {
    return `${dbPath}/SweldoDB/payrolls/${employeeId}/${year}_${month}_payroll.json`;
  }

  private static async readPayrollJsonFile(
    dbPath: string,
    employeeId: string,
    year: number,
    month: number
  ): Promise<PayrollJsonStructure | null> {
    const filePath = Payroll.getPayrollJsonFilePath(
      dbPath,
      employeeId,
      year,
      month
    );
    try {
      const fileExists = await window.electron.fileExists(filePath);
      if (!fileExists) return null;
      const content = await window.electron.readFile(filePath);
      const data = JSON.parse(content) as PayrollJsonStructure;
      data.payrolls.forEach((p) => {
        p.startDate = new Date(p.startDate);
        p.endDate = new Date(p.endDate);
      });
      return data;
    } catch (error) {
      console.error(`Error reading payroll JSON file ${filePath}:`, error);
      return null;
    }
  }

  private static async writePayrollJsonFile(
    dbPath: string,
    employeeId: string,
    year: number,
    month: number,
    data: PayrollJsonStructure
  ): Promise<void> {
    const filePath = Payroll.getPayrollJsonFilePath(
      dbPath,
      employeeId,
      year,
      month
    );
    const dirPath = `${dbPath}/SweldoDB/payrolls/${employeeId}`;
    try {
      await window.electron.ensureDir(dirPath);
      const dataToSave = JSON.parse(JSON.stringify(data));
      dataToSave.payrolls.forEach((p: any) => {
        p.startDate =
          p.startDate instanceof Date ? p.startDate.toISOString() : p.startDate;
        p.endDate =
          p.endDate instanceof Date ? p.endDate.toISOString() : p.endDate;
      });
      await window.electron.writeFile(
        filePath,
        JSON.stringify(dataToSave, null, 2)
      );
    } catch (error) {
      console.error(`Error writing payroll JSON file ${filePath}:`, error);
      throw error;
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
      console.log(
        `[Payroll] Generating summary for Employee ID: ${employeeId}, Period: ${
          startDate.toISOString().split("T")[0]
        } to ${endDate.toISOString().split("T")[0]}`
      );
      const employeeModel = createEmployeeModel(this.dbPath);
      const employee = await employeeModel.loadEmployeeById(employeeId);
      if (!employee) throw new Error("Employee not found");

      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      const summary = await this.summarizeCompensations(employeeId, start, end);
      console.log("[Payroll] Compensation Summary:", summary);

      const calculationSettings = await this.loadCalculationSettings();
      console.log("[Payroll] Calculation Settings:", calculationSettings);

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

      let grossPayValue = summary.grossPay;
      console.log(
        `[Payroll] Initial Gross Pay (from summary): ${grossPayValue}`
      );
      if (calculationSettings.grossPay?.formula) {
        try {
          grossPayValue = evaluateFormula(
            calculationSettings.grossPay.formula,
            variables
          );
          console.log(
            `[Payroll] Calculated Gross Pay (using formula): ${grossPayValue}`
          );
        } catch (error) {
          console.error(
            `[Payroll] Error evaluating gross pay formula: ${
              (error as any).message
            }`
          );
          throw new Error(
            `Failed to evaluate gross pay formula: ${(error as any).message}`
          );
        }
      } else {
        console.log(
          "[Payroll] No Gross Pay formula found, using summary value."
        );
      }

      let othersValue = 0;
      if (calculationSettings.others?.formula) {
        try {
          othersValue = evaluateFormula(
            calculationSettings.others.formula,
            variables
          );
          console.log(
            `[Payroll] Calculated Others Value (using formula): ${othersValue}`
          );
        } catch (error) {
          console.error(
            `[Payroll] Error evaluating others formula: ${
              (error as any).message
            }`
          );
          throw new Error(
            `Failed to evaluate others formula: ${(error as any).message}`
          );
        }
      } else {
        othersValue =
          (summary.deductions.others || 0) -
          (summary.deductions.shortDeductions || 0);
        console.log(
          `[Payroll] Calculated Others Value (manual): ${othersValue} (Summary Others: ${
            summary.deductions.others || 0
          }, Summary Shorts: ${summary.deductions.shortDeductions || 0})`
        );
      }

      const deductionVariables = {
        sss: deductions?.sss ?? employee.sss ?? 0,
        philHealth: deductions?.philHealth ?? employee.philHealth ?? 0,
        pagIbig: deductions?.pagIbig ?? employee.pagIbig ?? 0,
        cashAdvanceDeductions: deductions?.cashAdvanceDeductions ?? 0,
        others: deductions?.shortDeductions ?? 0,
        lateDeduction: summary.lateDeduction ?? 0,
        undertimeDeduction: summary.undertimeDeduction ?? 0,
      };
      console.log(
        "[Payroll] Variables for Total Deductions:",
        deductionVariables
      );

      let totalDeductions = 0;
      if (calculationSettings?.totalDeductions?.formula) {
        console.log(
          `[Payroll] Using Total Deductions Formula: ${calculationSettings.totalDeductions.formula}`
        );
        try {
          totalDeductions = evaluateFormula(
            calculationSettings.totalDeductions.formula,
            deductionVariables
          );
          console.log(
            `[Payroll] Calculated Total Deductions (using formula): ${totalDeductions}`
          );
        } catch (error) {
          console.error(
            `[Payroll] Error evaluating total deductions formula: ${
              (error as any).message
            }`
          );
          throw new Error(
            `Formula evaluation failed: ${(error as any).message}`
          );
        }
      } else {
        totalDeductions = Object.values(deductionVariables).reduce(
          (sum, val) => sum + (typeof val === "number" ? val : 0),
          0
        );
        console.log(
          `[Payroll] Calculated Total Deductions (summing variables): ${totalDeductions}`
        );
      }

      let netPayValue = grossPayValue - totalDeductions;
      console.log(
        `[Payroll] Initial Net Pay (Gross - Total Deductions): ${grossPayValue} - ${totalDeductions} = ${netPayValue}`
      );
      if (calculationSettings.netPay?.formula) {
        console.log(
          `[Payroll] Using Net Pay Formula: ${calculationSettings.netPay.formula}`
        );
        const netPayVariables = {
          ...variables,
          grossPay: grossPayValue,
          totalDeductions,
          others: othersValue,
        };
        console.log(
          "[Payroll] Variables for Net Pay Formula:",
          netPayVariables
        );
        try {
          netPayValue = evaluateFormula(
            calculationSettings.netPay.formula,
            netPayVariables
          );
          console.log(
            `[Payroll] Calculated Net Pay (using formula): ${netPayValue}`
          );
        } catch (error) {
          console.error(
            `[Payroll] Error evaluating net pay formula: ${
              (error as any).message
            }`
          );
          throw new Error(
            `Failed to evaluate net pay formula: ${(error as any).message}`
          );
        }
      } else {
        console.log(
          "[Payroll] No Net Pay formula found, using Gross - Total Deductions."
        );
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

      const payrollSummary: PayrollSummaryModel = {
        ...summary,
        id: `${employeeId}_${start.getTime()}_${end.getTime()}`,
        grossPay: grossPayValue,
        deductions: finalDeductions,
        netPay: netPayValue,
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

      const endMonth = end.getMonth() + 1;
      const endYear = end.getFullYear();
      const payrollJsonData = await Payroll.readPayrollJsonFile(
        this.dbPath,
        employeeId,
        endYear,
        endMonth
      );

      let updatedPayrolls: PayrollSummaryModel[] = [];
      if (payrollJsonData) {
        updatedPayrolls = payrollJsonData.payrolls.filter(
          (p) => p.id !== payrollSummary.id
        );
      }
      updatedPayrolls.push(payrollSummary);
      updatedPayrolls.sort(
        (a, b) => b.startDate.getTime() - a.startDate.getTime()
      );

      const updatedJsonStructure: PayrollJsonStructure = {
        meta: {
          employeeId,
          year: endYear,
          month: endMonth,
          lastModified: new Date().toISOString(),
        },
        payrolls: updatedPayrolls,
      };

      await Payroll.writePayrollJsonFile(
        this.dbPath,
        employeeId,
        endYear,
        endMonth,
        updatedJsonStructure
      );

      await employeeModel.updateEmployeeDetails({
        ...employee,
        lastPaymentPeriod: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });

      const statisticsModel = createStatisticsModel(this.dbPath, endYear);
      await statisticsModel.updatePayrollStatistics([payrollSummary]);

      return payrollSummary;
    } catch (error) {
      console.error("[Payroll] Error in generatePayrollSummary:", error);
      throw error;
    }
  }

  public static async deletePayrollSummary(
    dbPath: string,
    employeeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const endMonth = endDate.getMonth() + 1;
    const endYear = endDate.getFullYear();
    const payrollId = `${employeeId}_${startDate.getTime()}_${endDate.getTime()}`;

    try {
      const jsonData = await Payroll.readPayrollJsonFile(
        dbPath,
        employeeId,
        endYear,
        endMonth
      );
      let deletedFromJson = false;
      let payrollToDelete: PayrollSummaryModel | undefined = undefined;

      if (jsonData) {
        const initialLength = jsonData.payrolls.length;
        payrollToDelete = jsonData.payrolls.find((p) => p.id === payrollId);
        jsonData.payrolls = jsonData.payrolls.filter((p) => p.id !== payrollId);
        if (jsonData.payrolls.length < initialLength) {
          jsonData.meta.lastModified = new Date().toISOString();
          await Payroll.writePayrollJsonFile(
            dbPath,
            employeeId,
            endYear,
            endMonth,
            jsonData
          );
          deletedFromJson = true;
          console.log(`Deleted payroll ${payrollId} from JSON.`);
        }
      }

      if (!deletedFromJson) {
        console.log(
          `Payroll ${payrollId} not found in JSON, attempting fallback CSV deletion.`
        );
        try {
          const oldPayrollStatic = OldPayroll;
          await oldPayrollStatic.deletePayrollSummary(
            dbPath,
            employeeId,
            startDate,
            endDate
          );
          const csvSummaries = await OldPayroll.loadPayrollSummaries(
            dbPath,
            employeeId,
            endYear,
            endMonth
          );
          payrollToDelete = csvSummaries.find((p) => p.id === payrollId);
          console.log(`Deleted payroll ${payrollId} from CSV (fallback).`);
        } catch (csvError) {
          console.error(
            `Error during fallback CSV delete for ${payrollId}:`,
            csvError
          );
          if (!jsonData) {
            throw new Error(
              `Payroll record ${payrollId} not found in JSON or CSV.`
            );
          }
          throw new Error(
            `Payroll record ${payrollId} not found in JSON and failed to delete from CSV: ${
              (csvError as Error).message
            }`
          );
        }
      }

      if (payrollToDelete) {
        const cashAdvanceDeductions =
          payrollToDelete.deductions?.cashAdvanceDeductions || 0;
        if (cashAdvanceDeductions > 0) {
          await Payroll.reverseCashAdvanceDeduction(
            dbPath,
            employeeId,
            cashAdvanceDeductions,
            endDate
          );
        }
        const shortIDs = payrollToDelete.shortIDs || [];
        if (shortIDs.length > 0) {
          await Payroll.reverseShortDeduction(
            dbPath,
            employeeId,
            shortIDs,
            endDate
          );
        }
      } else if (deletedFromJson || !jsonData) {
        console.warn(
          `Could not retrieve details for payroll ${payrollId} to reverse deductions.`
        );
      }
    } catch (error) {
      console.error(`Error deleting payroll summary ${payrollId}:`, error);
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
      const jsonData = await Payroll.readPayrollJsonFile(
        dbPath,
        employeeId,
        year,
        month
      );
      if (jsonData) {
        console.log(
          `Loaded ${jsonData.payrolls.length} payrolls from JSON for ${employeeId} ${year}-${month}`
        );
        return jsonData.payrolls;
      } else {
        console.warn(
          `JSON payroll file not found for ${employeeId} ${year}-${month}. Falling back to CSV.`
        );
        try {
          const oldPayrollStatic = OldPayroll;
          const csvPayrolls = await oldPayrollStatic.loadPayrollSummaries(
            dbPath,
            employeeId,
            year,
            month
          );
          console.log(
            `Loaded ${csvPayrolls.length} payrolls from CSV (fallback) for ${employeeId} ${year}-${month}`
          );
          return csvPayrolls;
        } catch (csvError) {
          console.error(
            `Error loading from CSV fallback for ${employeeId} ${year}-${month}:`,
            csvError
          );
          return [];
        }
      }
    } catch (error) {
      console.error(
        `Error loading payroll summaries for ${employeeId} ${year}-${month}:`,
        error
      );
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

  private async getActualWorkingDays(
    start: Date,
    end: Date,
    employmentType: string,
    compensations: Compensation[]
  ): Promise<number> {
    const attendanceModel = createAttendanceModel(this.dbPath);
    const startMonth = start.getMonth() + 1;
    const startYear = start.getFullYear();
    const endMonth = end.getMonth() + 1;
    const endYear = end.getFullYear();

    let attendanceRecords: Attendance[] = [];
    if (startMonth === endMonth && startYear === endYear) {
      attendanceRecords = await attendanceModel.loadAttendancesById(
        startMonth,
        startYear,
        ""
      );
    } else {
      const startData = await attendanceModel.loadAttendancesById(
        startMonth,
        startYear,
        ""
      );
      const endData = await attendanceModel.loadAttendancesById(
        endMonth,
        endYear,
        ""
      );
      attendanceRecords = [...startData, ...endData];
    }

    const timeSettings = await this.attendanceSettingsModel.loadTimeSettings();
    const employeeSchedule = timeSettings.find(
      (type) => type.type === employmentType
    );
    if (!employeeSchedule) return 0;

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
      const isHoliday = holidays.some((holiday) => {
        const holidayDate = new Date(holiday.startDate);
        return (
          holidayDate.getDate() === currentDate.getDate() &&
          holidayDate.getMonth() === currentDate.getMonth() &&
          holidayDate.getFullYear() === currentDate.getFullYear()
        );
      });

      if (schedule && !schedule.isOff && !isHoliday) {
        const attendance = attendanceRecords.find(
          (record) =>
            record.day === currentDate.getDate() &&
            record.timeIn &&
            record.timeOut
        );
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
    payrollDate: Date,
    isApplyingDeduction: boolean = false
  ): Promise<void> {
    try {
      const months = [];
      let currentDate = new Date(payrollDate);
      for (let i = 0; i < 3; i++) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() - 1);
      }

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

      allAdvances.sort((a, b) =>
        isApplyingDeduction
          ? a.date.getTime() - b.date.getTime()
          : b.date.getTime() - a.date.getTime()
      );

      let amountToProcess = deductionAmount;

      for (const advance of allAdvances) {
        if (amountToProcess <= 0) break;

        const cashAdvanceModel = createCashAdvanceModel(
          dbPath,
          employeeId,
          advance.date.getMonth() + 1,
          advance.date.getFullYear()
        );

        if (isApplyingDeduction) {
          if (advance.status !== "Paid") {
            const deductable = Math.min(
              advance.remainingUnpaid,
              amountToProcess
            );
            const newRemaining = advance.remainingUnpaid - deductable;
            const newStatus = newRemaining <= 0 ? "Paid" : "Unpaid";

            await cashAdvanceModel.updateCashAdvance({
              ...advance,
              remainingUnpaid: newRemaining,
              status: newStatus,
            });
            amountToProcess -= deductable;
          }
        } else {
          const refundable = Math.min(
            advance.amount - advance.remainingUnpaid,
            amountToProcess
          );
          if (refundable > 0) {
            const newRemaining = advance.remainingUnpaid + refundable;
            const newStatus = newRemaining > 0 ? "Unpaid" : "Paid";

            await cashAdvanceModel.updateCashAdvance({
              ...advance,
              remainingUnpaid: newRemaining,
              status: newStatus,
            });
            amountToProcess -= refundable;
          }
        }
      }

      if (amountToProcess > 0.01) {
        console.warn(
          `Could not fully ${
            isApplyingDeduction ? "apply" : "reverse"
          } cash advance amount. Remaining: ${amountToProcess}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to ${
          isApplyingDeduction ? "apply" : "reverse"
        } cash advance deduction:`,
        error
      );
      throw error;
    }
  }

  private static async reverseShortDeduction(
    dbPath: string,
    employeeId: string,
    shortIDs: string[],
    payrollDate: Date,
    isApplyingDeduction: boolean = false
  ): Promise<void> {
    try {
      const months = [];
      let currentDate = new Date(payrollDate);
      for (let i = 0; i < 3; i++) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() - 1);
      }

      const allShorts: Short[] = [];
      for (const { month, year } of months) {
        const shortModel = createShortModel(dbPath, employeeId, month, year);
        const shorts = await shortModel.loadShorts(employeeId);
        allShorts.push(...shorts);
      }

      const shortsToProcess = allShorts.filter((short) =>
        shortIDs.includes(short.id)
      );

      for (const short of shortsToProcess) {
        const shortModel = createShortModel(
          dbPath,
          employeeId,
          short.date.getMonth() + 1,
          short.date.getFullYear()
        );
        if (isApplyingDeduction) {
          if (short.status !== "Paid") {
            await shortModel.updateShort({
              ...short,
              status: "Paid",
              remainingUnpaid: 0,
            });
          }
        } else {
          if (short.status === "Paid") {
            await shortModel.updateShort({
              ...short,
              status: "Unpaid",
              remainingUnpaid: short.amount,
            });
          }
        }
      }
    } catch (error) {
      console.error(
        `Failed to ${
          isApplyingDeduction ? "apply" : "reverse"
        } short deduction:`,
        error
      );
      throw error;
    }
  }

  private determineTimeAMPM(
    time: string,
    isTimeIn: boolean,
    schedule: { timeIn: string; timeOut: string }
  ): string {
    if (!time || !schedule) return time;

    const [hours] = time.split(":").map(Number);
    const [schedInHour] = schedule.timeIn.split(":").map(Number);
    const [schedOutHour] = schedule.timeOut.split(":").map(Number);

    const isNightShift = schedInHour >= 18;

    if (isNightShift) {
      if (isTimeIn) {
        return hours >= 18 || hours <= 2 ? `${time} PM` : `${time} AM`;
      } else {
        return hours >= 3 && hours <= 11 ? `${time} AM` : `${time} PM`;
      }
    }

    return hours < 12 ? `${time} AM` : `${time} PM`;
  }

  private getHoursDifference(time1: string, time2: string): number {
    const [h1] = time1.split(":").map(Number);
    const [h2] = time2.split(":").map(Number);

    if (Math.abs(h1 - h2) > 12) {
      return 24 - Math.abs(h1 - h2);
    }
    return Math.abs(h1 - h2);
  }

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

    const time1ToSchedIn = this.getHoursDifference(rawTime1, schedule.timeIn);
    const time1ToSchedOut = this.getHoursDifference(rawTime1, schedule.timeOut);
    const time2ToSchedIn = this.getHoursDifference(rawTime2, schedule.timeIn);
    const time2ToSchedOut = this.getHoursDifference(rawTime2, schedule.timeOut);

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

    return {
      timeIn: rawTime1,
      timeOut: rawTime2,
    };
  }

  public static async migrateCsvToJson(
    dbPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
    const payrollBasePath = `${dbPath}/SweldoDB/payrolls`;
    onProgress?.("Starting Payroll Summary CSV to JSON migration...");

    try {
      const employeeDirs = await window.electron.readDir(payrollBasePath);

      for (const dirEntry of employeeDirs) {
        if (dirEntry.isDirectory) {
          const employeeId = dirEntry.name;
          const employeePath = `${payrollBasePath}/${employeeId}`;
          onProgress?.(`Processing employee: ${employeeId}`);

          try {
            const filesInEmployeeDir = await window.electron.readDir(
              employeePath
            );

            // Group files by year_month
            const filesByMonth = new Map<
              string,
              { name: string; year: number; month: number }[]
            >();
            const payrollFileRegex = /(\d+)_(\d+)_payroll(?:-\d+)?\.csv$/;

            for (const fileEntry of filesInEmployeeDir) {
              if (fileEntry.isFile) {
                const match = fileEntry.name.match(payrollFileRegex);
                if (match) {
                  const year = parseInt(match[1]);
                  const month = parseInt(match[2]);
                  const key = `${year}_${month}`;
                  if (!filesByMonth.has(key)) {
                    filesByMonth.set(key, []);
                  }
                  filesByMonth
                    .get(key)
                    ?.push({ name: fileEntry.name, year, month });
                }
              }
            }

            if (filesByMonth.size === 0) {
              onProgress?.(
                `  No payroll CSV files found for employee ${employeeId}.`
              );
              continue;
            }

            onProgress?.(
              `  Found ${filesByMonth.size} year-month groups to process.`
            );

            // Process each year-month group
            for (const [key, fileGroup] of filesByMonth.entries()) {
              const { year, month } = fileGroup[0]; // Get year/month from the first file in group
              const jsonFilePath = Payroll.getPayrollJsonFilePath(
                dbPath,
                employeeId,
                year,
                month
              );
              onProgress?.(`  Processing group ${key}...`);

              // Check if JSON already exists for this group
              if (await window.electron.fileExists(jsonFilePath)) {
                onProgress?.(
                  `    JSON file ${jsonFilePath} already exists, skipping group.`
                );
                continue;
              }

              let payrollSummaries: PayrollSummaryModel[] | null = null;
              let sourceCsvFileName = "";

              // Try loading from files in the group until data is found
              for (const fileInfo of fileGroup) {
                const csvFilePath = `${employeePath}/${fileInfo.name}`;
                onProgress?.(`    Trying file: ${fileInfo.name}...`);
                try {
                  const oldPayrollStatic = OldPayroll;
                  const loadedSummaries =
                    await oldPayrollStatic.loadPayrollSummaries(
                      dbPath,
                      employeeId,
                      fileInfo.year,
                      fileInfo.month
                    );

                  // Check if loaded data is valid and non-empty
                  if (loadedSummaries && loadedSummaries.length > 0) {
                    payrollSummaries = loadedSummaries;
                    sourceCsvFileName = fileInfo.name;
                    onProgress?.(
                      `      Found valid data in ${sourceCsvFileName}.`
                    );
                    break; // Found data, stop checking this group
                  } else {
                    onProgress?.(
                      `      File ${fileInfo.name} is empty or contains no valid summaries.`
                    );
                  }
                } catch (loadError) {
                  onProgress?.(
                    `      Error loading from ${fileInfo.name}: ${
                      (loadError as Error).message
                    }`
                  );
                  // Continue to the next file in the group
                }
              }

              // If data was found in any file of the group, create JSON
              if (payrollSummaries && sourceCsvFileName) {
                try {
                  const jsonData: PayrollJsonStructure = {
                    meta: {
                      employeeId,
                      year,
                      month,
                      lastModified: new Date().toISOString(),
                    },
                    payrolls: payrollSummaries,
                  };

                  await Payroll.writePayrollJsonFile(
                    dbPath,
                    employeeId,
                    year,
                    month,
                    jsonData
                  );
                  onProgress?.(
                    `    Successfully converted data from ${sourceCsvFileName} to ${jsonFilePath}.`
                  );
                } catch (writeError) {
                  const message =
                    writeError instanceof Error
                      ? writeError.message
                      : String(writeError);
                  onProgress?.(
                    `    Error writing JSON for ${key} using data from ${sourceCsvFileName}: ${message}`
                  );
                  console.error(`Error writing JSON for ${key}:`, writeError);
                }
              } else {
                onProgress?.(
                  `    Skipping group ${key}: No non-empty CSV file found.`
                );
              }
            }
          } catch (dirError) {
            const message =
              dirError instanceof Error ? dirError.message : String(dirError);
            onProgress?.(
              `  Error reading directory ${employeePath}: ${message}`
            );
          }
        }
      }
      onProgress?.("Payroll Summary migration finished.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.(`Payroll Summary migration failed: ${message}`);
      console.error("Payroll Summary Migration Error:", error);
      throw new Error(`Payroll Summary migration failed: ${message}`);
    }
  }
}

function getWorkingDaysInPeriod(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 3600 * 24)
  );
  let workingDays = 0;
  for (let i = 0; i <= days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    if (date.getDay() !== 0) {
      workingDays++;
    }
  }
  return workingDays;
}
