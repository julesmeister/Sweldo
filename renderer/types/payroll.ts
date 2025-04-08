export interface PayrollDeductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  sssLoan?: number;
  pagibigLoan?: number;
  ca?: number;
  partial?: number;
  shortDeductions?: number;
  others?: number;
  totalDeduction: number;
}

export interface PayrollSummary {
  employeeName: string;
  startDate: string;
  endDate: string;
  daysWorked: number;
  basicPay: number;
  dailyRate: number;
  undertimeDeduction?: number;
  lateDeduction?: number;
  holidayBonus?: number;
  overtime: number;
  grossPay: number;
  netPay: number;
  deductions: PayrollDeductions;
  preparedBy?: string;
  approvedBy?: string;
  payslipNumber?: number;
  nightDifferentialPay?: number;
}

export interface PDFGeneratorOptions {
  outputPath: string;
  logoPath?: string;
  companyName: string;
  dbPath: string; // Path to the database directory
  columnColors?: {
    [key: string]: string; // Key is column id, value is hex color code
  };
  calculationSettings?: {
    grossPay?: {
      formula: string; // e.g., "basicPay + overtime + holidayBonus - undertimeDeduction"
      description: string; // e.g., "Basic pay plus overtime and holiday bonus, minus undertime deductions"
    };
    others?: {
      formula: string; // e.g., "sssLoan + pagibigLoan + partial"
      description: string; // e.g., "Sum of SSS loan, Pag-IBIG loan, and partial payments"
    };
    totalDeductions?: {
      formula: string; // e.g., "sss + philHealth + pagIbig + cashAdvanceDeductions + others"
      description: string; // e.g., "Sum of all statutory and voluntary deductions"
    };
    netPay?: {
      formula: string; // e.g., "grossPay - totalDeductions"
      description: string; // e.g., "Gross pay minus total deductions"
    };
  };
}

export interface PayrollSummaryModel {
  employeeName: string;
  startDate: string;
  endDate: string;
  daysWorked: number;
  basicPay: number;
  dailyRate: number;
  overtime: number;
  grossPay: number;
  netPay: number;
  sssDeduction: number;
  philhealthDeduction: number;
  pagibigDeduction: number;
  cashAdvanceDeductions: number;
  shortsDeductions: number;
  otherDeductions: number;
  lateDeduction: number;
  undertimeDeduction: number;
  holidayBonus?: number;
  nightDifferentialPay?: number;
  preparedBy?: string;
  approvedBy?: string;
  payslipNumber?: number;
}
