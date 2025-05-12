import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FormattedPayrollPDFData } from "@/renderer/hooks/usePayrollPDFGeneration";
import { generatePayslipsPDF } from "./payslipPDF";
import { generateSummaryPDF } from "./summaryPDF";

// Define a consistent color scheme
const COLORS = {
  primary: [41, 98, 255] as [number, number, number], // #2962FF - Primary blue
  secondary: [33, 150, 243] as [number, number, number], // #2196F3 - Secondary blue
  accent: [0, 150, 136] as [number, number, number], // #009688 - Teal accent
  darkGray: [66, 66, 66] as [number, number, number], // #424242 - Dark text
  lightBg: [245, 245, 245] as [number, number, number], // #F5F5F5 - Light background
  headerBg: [236, 239, 241] as [number, number, number], // #ECEFF1 - Header background
};

/**
 * Formats a number as Philippine Peso currency
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "Php 1,234.56")
 */
export const formatCurrency = (amount: number): string => {
  try {
    const numAmount =
      typeof amount === "number" ? amount : parseFloat(amount as any);

    if (isNaN(numAmount)) {
      return "Php 0.00";
    }

    const formattedAmount = Math.abs(numAmount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `Php ${formattedAmount}`;
  } catch (e) {
    return "Php 0.00";
  }
};

/**
 * Draws a table row with label and value cells for payslips
 * @param doc - The jsPDF document instance
 * @param x - X coordinate for the row
 * @param y - Y coordinate for the row
 * @param label - Label text (left cell)
 * @param value - Value text (right cell)
 * @param width - Total width of the row
 * @param height - Height of the row
 */
export const drawTableRow = (
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
  height: number
) => {
  // Calculate cell dimensions
  const labelWidth = width * 0.5;
  const valueWidth = width * 0.5;

  // Draw cell borders with a more subtle color
  doc.setDrawColor(207, 216, 220);
  doc.setLineWidth(0.5);

  // Draw rectangles with subtle fill color for the label side
  doc.setFillColor(245, 247, 250);
  doc.rect(x, y, labelWidth, height, "FD");

  // White background for the value side
  doc.setFillColor(255, 255, 255);
  doc.rect(x + labelWidth, y, valueWidth, height, "FD");

  // Add text content
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(66, 66, 66);
  doc.text(label, x + 3, y + height - 3);

  doc.setFont("helvetica", "normal");
  doc.text(value, x + labelWidth + valueWidth - 3, y + height - 3, {
    align: "right",
  });
};

/**
 * Generates PDF for payroll data, either as a summary or individual payslips
 * @param formattedPayrolls - Array of formatted payroll data
 * @param isLandscape - Whether to generate in landscape mode (summary) or portrait (payslips)
 * @param companyName - Company name to display in the PDF header
 * @returns Object with success status and file path or error message
 */
export const generateWebPDF = async (
  formattedPayrolls: FormattedPayrollPDFData[],
  isLandscape: boolean,
  companyName: string
) => {
  try {
    // Create PDF document with appropriate orientation
    const doc = new jsPDF({
      orientation: isLandscape ? "landscape" : "portrait",
      unit: "pt",
      format: [576, 936], // Standard long bond, auto-swapped for landscape
    });

    // Set filename based on PDF type
    const fileName = isLandscape
      ? "payroll_summary.pdf"
      : "payroll_payslips.pdf";

    // Generate the appropriate PDF type
    if (isLandscape) {
      generateSummaryPDF(doc, formattedPayrolls, companyName);
    } else {
      generatePayslipsPDF(doc, formattedPayrolls, companyName);
    }

    // Save the PDF file
    doc.save(fileName);

    return { success: true, filePath: fileName };
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
