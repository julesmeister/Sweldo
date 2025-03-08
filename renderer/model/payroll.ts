import { Employee, createEmployeeModel } from "./employee";
import { DateRange, Attendance, ExcelData, createAttendanceModel } from "./attendance";
import { Compensation, createCompensationModel } from "./compensation";
import { MissingTimeModel, MissingTimeLog } from './missingTime';
import * as Papa from 'papaparse';
import { toast } from 'sonner';

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
  dayType?: 'Regular' | 'Holiday' | 'Rest Day';
  leaveType?: 'Vacation' | 'Sick' | 'Unpaid' | 'None';
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

export class Payroll {
  private dateRange: DateRange;
  private generatedTime: Date;
  private days: number;
  private employees: Employee[] = [];
  private fileType: string;
  private dbPath: string;

  constructor(rows: any[][], fileTypeParam: string, dbPath: string) {
    this.dbPath = dbPath;
    this.dateRange = {
      start: new Date(),
      end: new Date(),
    };
    this.generatedTime = new Date();
    this.fileType = fileTypeParam || "xlsx";
    this.days = 0;
    // Initialize the processing asynchronously
    if (rows && rows.length > 0) {
      this.init(rows);
    }
  }

  private async init(rows: any[][]): Promise<void> {
    if (!rows || !Array.isArray(rows)) {
      throw new Error('Invalid rows data provided');
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

    // Process employee data
    for (let i = 4; i < rows.length; i += 2) {
      const timeList = rows[i + 1]?.map((value) => value?.toString());
      const attendances: Attendance[] = [];
      const missingTimeLogs: MissingTimeLog[] = [];

      timeList?.forEach((timeString, j) => {
        if (!timeString) {
          attendances.push({day: j+1, timeIn: null, timeOut: null });
          return;
        }

        let timeIn: string | null = null;
        let timeOut: string | null = null;

        // Parse time formats
        const newFormatRegex = /(\d{2}:\d{1,2})(\d{2}:\d{2})?/; // Regex to validate time format
        const newFormatMatch = timeString.match(newFormatRegex);
        if (newFormatMatch) {
          timeIn = newFormatMatch[1]; // Assign first matched time to timeIn
          if (newFormatMatch[2]) {
            timeOut = newFormatMatch[2]; // Assign second matched time to timeOut
          }
        } else {
          const timeParts = timeString.split(' ');
          const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9](\s?[APMapm]{2})?$/; // Updated regex to validate time format
          if (timeParts.length) {
            if (timeRegex.test(timeParts[0])) {
              timeIn = timeParts[0]; // Assign timeIn directly as text if valid
            }
            if (timeParts.length > 1 && timeRegex.test(timeParts[timeParts.length - 1])) {
              timeOut = timeParts[timeParts.length - 1]; // Assign timeOut directly as text if valid
            }
          }
        }

        // Check for missing time out when time in exists
        if (timeIn && !timeOut) {
          missingTimeLogs.push({
            id: crypto.randomUUID(),
            employeeId: this.processColumn(rows[i], "ID:"),
            employeeName: this.processColumn(rows[i], "Name:"),
            day: (j + 1).toString(),
            month: this.dateRange.start.getMonth() + 1,
            year: this.dateRange.start.getFullYear(),
            missingType: 'timeOut',
            employmentType: this.processColumn(rows[i], "Employment Type:"),
            createdAt: new Date().toISOString()
          });
        }

        attendances.push({ day: j + 1, timeIn, timeOut });
      });

      const id = this.processColumn(rows[i], "ID:");
      const name = this.processColumn(rows[i], "Name:");

      if (id || name) {
        this.employees.push({
          id,
          name,
          position: "", 
          dailyRate: 0, 
          sss: 0, 
          philHealth: 0, 
          pagIbig: 0, 
          status: "active", 
          employmentType: "regular", 
          lastPaymentPeriod: undefined,
        });

        // Save attendances for each employee
        const attendanceModel = createAttendanceModel(this.dbPath);
        await attendanceModel.saveOrUpdateAttendances(
          attendances, 
          this.dateRange.start.getMonth() + 1, 
          this.dateRange.start.getFullYear(), 
          id
        );

        // Save missing time logs
        const missingTimeModel = MissingTimeModel.createMissingTimeModel(this.dbPath);
        for (const log of missingTimeLogs) {
          await missingTimeModel.saveMissingTimeLog(log, this.dateRange.start.getMonth() + 1, this.dateRange.start.getFullYear());
        }
      }
    }
    let model = createEmployeeModel(this.dbPath);
    await model.saveOnlyNewEmployees(this.employees);
  }

  public async summarizeCompensations(employeeId: string, startDate: Date, endDate: Date): Promise<PayrollSummaryModel> {
    const employeeModel = createEmployeeModel(this.dbPath);
    const compensationModel = createCompensationModel(this.dbPath);
    
    const employee = await employeeModel.loadEmployeeById(employeeId);

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get all months between start and end date
    const months: { month: number; year: number }[] = [];
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    const currentDate = new Date(start);
    while (currentDate <= end) {
      months.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear()
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Fetch all compensations for the date range
    const allCompensations = await Promise.all(
      months.map(({ month, year }) => 
        compensationModel.loadRecords(month, year, employeeId)
      )
    ).then(results => results.flat());

    // Filter records within the date range
    const filteredCompensations = allCompensations.filter(comp => {
      const compDate = new Date(comp.date);
      return compDate >= start && compDate <= end;
    });

    // Count the number of days with compensation records and absences
    const daysWorked = filteredCompensations.length;
    const workingDaysInPeriod = getWorkingDaysInPeriod(start, end);
    const absences = workingDaysInPeriod - daysWorked;

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
    }

    // Calculate total gross pay for the period
    totalGrossPay = totalBasicPay + totalOvertime + totalHolidayBonus + totalLeavePay;

    // Calculate final net pay with government deductions
    const totalNetPay = totalGrossPay - totalDeductions - 
      (employee.sss || 0) - (employee.philHealth || 0) - (employee.pagIbig || 0);

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
      dayType: filteredCompensations[0]?.dayType || 'Regular',
      leaveType: filteredCompensations[0]?.leaveType || 'None',
      leavePay: totalLeavePay,
      grossPay: totalGrossPay,
      allowances: 0,
      deductions: {
        sss: employee.sss || 0,
        philHealth: employee.philHealth || 0,
        pagIbig: employee.pagIbig || 0,
        cashAdvanceDeductions: 0,
        others: totalDeductions
      },
      netPay: totalNetPay,
      paymentDate: new Date(end.getTime() + (3 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      daysWorked,
      absences
    };

    return summary;
  }

  public async generatePayrollSummary(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    deductions?: { sss: number; philHealth: number; pagIbig: number, cashAdvanceDeductions: number }
  ): Promise<PayrollSummaryModel> {
    try {
      const employeeModel = createEmployeeModel(this.dbPath);
      const employee = await employeeModel.loadEmployeeById(employeeId);
      if (!employee) throw new Error('Employee not found');

      console.log(`Generating payroll summary for employee ${employeeId} between ${startDate.toDateString()} and ${endDate.toDateString()}`);
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      const summary = await this.summarizeCompensations(employeeId, start, end);
      
      // Use provided deductions or default to employee's saved deductions or 0
      const finalDeductions = {
        sss: typeof deductions?.sss === 'string' ? parseFloat(deductions?.sss) : deductions?.sss ?? employee.sss ?? 0,
        philHealth: typeof deductions?.philHealth === 'string' ? parseFloat(deductions?.philHealth) : deductions?.philHealth ?? employee.philHealth ?? 0,
        pagIbig: typeof deductions?.pagIbig === 'string' ? parseFloat(deductions?.pagIbig) : deductions?.pagIbig ?? employee.pagIbig ?? 0,
        cashAdvanceDeductions: typeof deductions?.cashAdvanceDeductions === 'string' ? parseFloat(deductions?.cashAdvanceDeductions) : deductions?.cashAdvanceDeductions ?? 0,
        others: summary.deductions.others || 0
      };

      console.log(`Using the following deductions: ${JSON.stringify(finalDeductions)}`);

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
        netPay: summary.grossPay - (finalDeductions.sss + finalDeductions.philHealth + finalDeductions.pagIbig + finalDeductions.cashAdvanceDeductions + finalDeductions.others),
        paymentDate: new Date().toISOString(),
        daysWorked: summary.daysWorked || 0,
        absences: summary.absences || 0
      };

      // Save the payroll data as CSV
      const filePath = `${this.dbPath}/SweldoDB/payrolls/${employeeId}/${startDate.getFullYear()}_${startDate.getMonth() + 1}_payroll.csv`;
      
      // Ensure directory exists
      await window.electron.ensureDir(`${this.dbPath}/SweldoDB/payrolls/${employeeId}`);
      
      let csvContent = '';
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
      } catch (error) {
        console.error('Error writing to file:', error);
        throw error;
      }

      console.log(`Payroll data saved to ${filePath}`);
      return {
        ...summary,
        deductions: finalDeductions,
        netPay: summary.grossPay - (finalDeductions.sss + finalDeductions.philHealth + finalDeductions.pagIbig + finalDeductions.cashAdvanceDeductions + finalDeductions.others)
      };
    } catch (error) {
      console.error('Error generating payroll summary:', error);
      throw error;
    }
  }

  public static async deletePayrollSummary(dbPath: string, employeeId: string, startDate: Date, endDate: Date): Promise<void> {
    try {
      const filePath = `${dbPath}/SweldoDB/payrolls/${employeeId}/${startDate.getFullYear()}_${startDate.getMonth() + 1}_payroll.csv`;
      const content = await window.electron.readFile(filePath);
      const parsedData = Papa.parse(content, { header: true });

      // Filter out the rows that match the date range
      const filteredData = parsedData.data.filter((row: any) => {
        const rowDate = new Date(row.startDate); // Assuming the date is stored in a field named 'startDate'
        return rowDate < startDate || rowDate > endDate;
      });

      // Convert back to CSV
      const updatedContent = Papa.unparse(filteredData);
      await window.electron.saveFile(filePath, updatedContent);
      console.log(`Deleted payroll summary rows for employee ${employeeId} between ${startDate.toDateString()} and ${endDate.toDateString()}`);
    } catch (error) {
      console.error(`Error deleting payroll summary for employee ${employeeId}:`, error);
      throw new Error('Could not delete payroll summary.');
    }
  }

  public static async loadPayrolls(dbPath: string, employeeId: string, year: number, month: number): Promise<PayrollSummaryModel[]> {
    try {
      const compensationModel = createCompensationModel(dbPath);
      const employeeModel = createEmployeeModel(dbPath);
      
      // Load employee details
      const employee = await employeeModel.loadEmployeeById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Load all compensations for the month
      const compensations = await compensationModel.loadRecords(month, year, employeeId);
      
      // Group compensations by week or pay period
      const payPeriods = new Map<string, Compensation[]>();
      
      compensations.forEach(comp => {
        const date = new Date(comp.date);
        // Use the start of each week as the pay period key
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
            return sum + (hoursWorked * (dailyRate / 8));
          }, 0),
          overtime: periodCompensations.reduce((sum, comp) => sum + (comp.overtimePay || 0), 0),
          overtimeMinutes: periodCompensations.reduce((sum, comp) => sum + (comp.overtimeMinutes || 0), 0),
          undertimeDeduction: periodCompensations.reduce((sum, comp) => sum + (comp.undertimeDeduction || 0), 0),
          undertimeMinutes: periodCompensations.reduce((sum, comp) => sum + (comp.undertimeMinutes || 0), 0),
          lateDeduction: periodCompensations.reduce((sum, comp) => sum + (comp.lateDeduction || 0), 0),
          lateMinutes: periodCompensations.reduce((sum, comp) => sum + (comp.lateMinutes || 0), 0),
          holidayBonus: periodCompensations.reduce((sum, comp) => sum + (comp.holidayBonus || 0), 0),
          leavePay: periodCompensations.reduce((sum, comp) => sum + (comp.leavePay || 0), 0),
          grossPay: periodCompensations.reduce((sum, comp) => sum + (comp.grossPay || 0), 0),
          allowances: 0, // Not in compensation model, set to 0
          deductions: {
            sss: employee.sss || 0,
            philHealth: employee.philHealth || 0,
            pagIbig: employee.pagIbig || 0,
            cashAdvanceDeductions: 0,
            others: periodCompensations.reduce((sum, comp) => sum + (comp.deductions || 0), 0)
          },
          netPay: periodCompensations.reduce((sum, comp) => sum + (comp.netPay || 0), 0),
          paymentDate: new Date(endDate.getTime() + (3 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], // Payment 3 days after period end
          daysWorked: periodCompensations.length, // Add number of days worked
          absences: getWorkingDaysInPeriod(startDate, endDate) - periodCompensations.length // Calculate absences
        };

        payrolls.push(summary);
      }

      return payrolls.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    } catch (error) {
      console.error('[Payroll.loadPayrolls] Error:', error);
      throw error;
    }
  }

  public static async loadPayrollSummaries(dbPath: string, employeeId: string, year: number, month: number): Promise<PayrollSummaryModel[]> {
    try {
      const filePath = `${dbPath}/SweldoDB/payrolls/${employeeId}/${year}_${month}_payroll.csv`;
      const fileContent = await window.electron.readFile(filePath);
      if (!fileContent) {
        console.log(`Payroll summary file ${filePath} doesn't exist, returning empty array`);
        return []; // Return empty array if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      console.log(`Loaded ${results.data.length} payroll summaries`);
      return results.data.map((row: any) => ({
        id: row.id,
        employeeName: row.employeeName,
        employeeId: row.employeeId,
        startDate: new Date(row.startDate),
        endDate: new Date(row.endDate),
        dailyRate: parseFloat(row.dailyRate) || 0,
        basicPay: parseFloat(row.basicPay) || 0,
        overtime: parseFloat(row.overtimePay) || 0,
        overtimeMinutes: parseFloat(row.overtimeMinutes) || 0,
        undertimeDeduction: parseFloat(row.undertimeDeduction) || 0,
        undertimeMinutes: parseFloat(row.undertimeMinutes) || 0,
        lateDeduction: parseFloat(row.lateDeduction) || 0,
        lateMinutes: parseFloat(row.lateMinutes) || 0,
        holidayBonus: parseFloat(row.holidayBonus) || 0,
        dayType: row.dayType as 'Regular' | 'Holiday' | 'Rest Day',
        leaveType: row.leaveType as 'Vacation' | 'Sick' | 'Unpaid' | 'None',
        leavePay: parseFloat(row.leavePay) || 0,
        grossPay: parseFloat(row.grossPay) || 0,
        allowances: parseFloat(row.allowances) || 0,
        deductions: {
          sss: parseFloat(row.sssDeduction) || 0,
          philHealth: parseFloat(row.philHealthDeduction) || 0,
          pagIbig: parseFloat(row.pagIbigDeduction) || 0,
          cashAdvanceDeductions: parseFloat(row.cashAdvanceDeductions) || 0,
          others: parseFloat(row.otherDeductions) || 0,
        },
        netPay: parseFloat(row.netPay) || 0,
        paymentDate: row.paymentDate,
        daysWorked: parseFloat(row.daysWorked) || 0,
        absences: parseFloat(row.absences) || 0,
      })) as PayrollSummaryModel[];
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.log(`Payroll summary file not found: ${error.message}`);
        return []; // Return empty array if file doesn't exist
      }
      console.error('[Payroll.loadPayrollSummaries] Error:', error);
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
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
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
