import type {
  PayrollSummary,
  PayrollDeductions,
  PDFGeneratorOptions,
} from "@/renderer/types/payroll";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CashAdvance } from "@/renderer/model/cashAdvance";
import { Employee } from "@/renderer/model/employee";

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

/**
 * Generate a PDF report for cash advances in web mode
 * @param advances List of cash advances to include in the report
 * @param employees List of employees for name lookup
 * @param month Current month (1-12)
 * @param year Current year
 * @returns The generated PDF document
 */
export function generateCashAdvancesWebPDF(
  advances: CashAdvance[],
  employees: Employee[],
  month: number,
  year: number
): jsPDF {
  // Create a new PDF document
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Get month name
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  // Set up document title
  doc.setFontSize(16);
  doc.text(`Cash Advances Report - ${monthName} ${year}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

  // Format the table data
  const tableData = advances.map((advance) => {
    // Format currency without any special characters
    const formatCurrency = (amount: number) => {
      // Ensure positive value and format with 2 decimal places and commas
      const amountStr = Math.abs(amount).toFixed(2);
      const parts = amountStr.split(".");
      const wholeNumber = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      // Restore the currency symbol
      return `Php ${wholeNumber}.${parts[1]}`;
    };

    return [
      advance.employeeId
        ? employees.find((e) => e.id === advance.employeeId)?.name ||
          advance.employeeId
        : "Unknown",
      new Date(advance.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      formatCurrency(advance.amount),
      advance.reason || "",
      advance.paymentSchedule,
      advance.approvalStatus,
      formatCurrency(advance.remainingUnpaid),
    ];
  });

  // Use the autoTable plugin
  autoTable(doc, {
    head: [
      [
        "Employee",
        "Date",
        "Amount",
        "Reason",
        "Payment Type",
        "Status",
        "Remaining",
      ],
    ],
    body: tableData,
    startY: 30,
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 244, 249] },
    columnStyles: {
      2: { halign: "right" }, // Amount column (index 2)
      6: { halign: "right" }, // Remaining column (index 6)
    },
  });

  return doc;
}
