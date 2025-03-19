import type {
  PayrollSummary,
  PayrollDeductions,
} from "@/renderer/types/payroll";

export interface PDFGeneratorOptions {
  outputPath: string;
  logoPath?: string;
}

export async function generatePayrollPDF(
  payrollSummaries: PayrollSummary[],
  options: PDFGeneratorOptions
): Promise<string> {
  try {
    const result = await window.electron.generatePDF(payrollSummaries, options);
    return result;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF");
  }
}
