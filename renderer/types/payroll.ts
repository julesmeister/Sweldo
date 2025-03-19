export interface PayrollDeductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  others: number;
}

export interface PayrollSummary {
  employeeName: string;
  startDate: string;
  endDate: string;
  daysWorked: number;
  basicPay: number;
  undertimeDeduction?: number;
  holidayBonus?: number;
  overtime: number;
  grossPay: number;
  netPay: number;
  deductions: PayrollDeductions;
}
