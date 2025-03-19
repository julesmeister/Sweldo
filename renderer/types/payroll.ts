export interface PayrollDeductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  others: number;
  sssLoan?: number;
  pagibigLoan?: number;
  ca?: number;
  partial?: number;
  totalDeduction: number;
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
  preparedBy?: string;
  approvedBy?: string;
  payslipNumber?: number;
}

export interface PDFGeneratorOptions {
  outputPath: string;
  logoPath?: string;
  companyName: string;
}
