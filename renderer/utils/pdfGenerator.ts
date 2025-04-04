import type {
  PayrollSummary,
  PayrollDeductions,
} from "@/renderer/types/payroll";

export interface PDFGeneratorOptions {
  outputPath: string;
  logoPath?: string;
  companyName: string;
  dbPath: string; // Path to the database directory
}

// Re-export the type to ensure it's recognized
export type { PDFGeneratorOptions as PDFOptions };

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
