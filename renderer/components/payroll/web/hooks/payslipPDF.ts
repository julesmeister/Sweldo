import jsPDF from "jspdf";
import { FormattedPayrollPDFData } from "@/renderer/hooks/usePayrollPDFGeneration";

// --- Centralized Style Configuration for Payslips ---
const STYLE_CONFIG_PAYSLIP = {
  page: {
    width: 576, // Standard portrait width, adjust if needed
    height: 936, // Standard portrait height, adjust if needed
    outerMargin: 15,
    payslipHorizontalMargin: 10, // Margin between payslips horizontally
    payslipVerticalMargin: 10, // Margin between payslips vertically (increased for better spacing)
    payslipsPerRow: 2,
    payslipsPerColumn: 5,
  },
  payslip: {
    maxHeight: 175, // Max individual payslip height (increased slightly)
    outerBorderColor: [0, 0, 0] as [number, number, number], // Renamed from borderColor
    outerBorderWidth: 0.5, // Renamed from borderWidth
    fontFamily: "helvetica", // Global font family for payslip
    colors: {
      primaryText: [0, 0, 0] as [number, number, number],
      // Add other specific colors like secondaryText if needed
    },
    header: {
      fontSize: 8,
      fontStyle: "bold",
      yOffset: 10, // From top of payslip box to company name baseline
      companyToPayslipLabelSpacing: 5, // Vertical space
      payslipLabelToDateSpacing: 5, // Vertical space
      companyNameColor: undefined as [number, number, number] | undefined, // Defaults to primaryText
    },
    subHeader: {
      // For "PAYSLIP" text
      fontSize: 7, // Slightly larger
      fontStyle: "bold",
      payslipLabelColor: undefined as [number, number, number] | undefined, // Defaults to primaryText
    },
    periodText: {
      // For date range
      fontSize: 6,
      fontStyle: "normal",
      dateRangeColor: undefined as [number, number, number] | undefined, // Defaults to primaryText
    },
    employeeInfo: {
      fontSize: 7, // Slightly larger
      fontStyle: "normal",
      yOffsetFromHeaderBottom: 8, // Vertical space from bottom of full header (date)
      paddingX: 5,
    },
    table: {
      yOffsetFromEmployeeInfoBottom: 6, // Vertical space from employee info
      paddingX: 5, // Horizontal padding for the two-column table content within payslip
      labelWidthRatio: 0.55, // Label part of the table row
      rowHeight: 9, // Increased row height
      fontSize: 6,
      fontStyle: "normal",
      cellInternalPaddingX: 2,
      cellInternalPaddingY: 3, // Adjusted for new rowHeight
      cellBorderColor: [0, 0, 0] as [number, number, number], // Added for cell borders
      cellBorderWidth: 0.1, // Added for cell border width
      labelTextColor: undefined as [number, number, number] | undefined, // For text color of row labels
      labelBackgroundColor: undefined as [number, number, number] | undefined, // For background color of row labels
    },
    signature: {
      fontSize: 6,
      fontStyle: "normal",
      yOffsetFromBottom: 15, // From bottom of payslip box
      labelToNameSpacing: 5,
      paddingX: 5, // General padding for signature lines
    },
  },
};
// --- End of Style Configuration ---

// Helper function to format currency
export const formatCurrency = (amount: number): string => {
  try {
    const numAmount =
      typeof amount === "number" ? amount : parseFloat(amount as any);
    if (isNaN(numAmount)) return "Php 0.00";
    const formattedAmount = Math.abs(numAmount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `Php ${formattedAmount}`;
  } catch (e) {
    return "Php 0.00";
  }
};

// Helper function to draw table row for payslips
const drawTableRow = (
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
  config: typeof STYLE_CONFIG_PAYSLIP.payslip.table // Pass relevant config
) => {
  const labelWidth = width * config.labelWidthRatio;
  const valueWidth = width * (1 - config.labelWidthRatio);

  // Draw background for label cell if specified
  if (config.labelBackgroundColor) {
    doc.setFillColor(...config.labelBackgroundColor);
    doc.rect(x, y, labelWidth, config.rowHeight, "F");
  }

  doc.setDrawColor(...config.cellBorderColor); // Use configured cell border color
  doc.setLineWidth(config.cellBorderWidth); // Use configured cell border width
  doc.rect(x, y, labelWidth, config.rowHeight);
  doc.rect(x + labelWidth, y, valueWidth, config.rowHeight);

  doc.setFont(STYLE_CONFIG_PAYSLIP.payslip.fontFamily, config.fontStyle);
  doc.setFontSize(config.fontSize);

  // Set color for the label
  doc.setTextColor(
    ...(config.labelTextColor ||
      STYLE_CONFIG_PAYSLIP.payslip.colors.primaryText)
  );
  doc.text(
    label,
    x + config.cellInternalPaddingX,
    y + config.rowHeight - config.cellInternalPaddingY
  );

  // Set color for the value (can be made separate if needed)
  doc.setTextColor(...STYLE_CONFIG_PAYSLIP.payslip.colors.primaryText);
  doc.text(
    value,
    x + labelWidth + valueWidth - config.cellInternalPaddingX,
    y + config.rowHeight - config.cellInternalPaddingY,
    {
      align: "right",
    }
  );
};

// Function to generate payslips PDF - portrait mode
export const generatePayslipsPDF = (
  doc: jsPDF,
  payrolls: FormattedPayrollPDFData[],
  companyName: string
) => {
  const pageConfig = STYLE_CONFIG_PAYSLIP.page;
  const payslipConfig = STYLE_CONFIG_PAYSLIP.payslip;

  const calculatedPayslipWidth =
    (pageConfig.width -
      (pageConfig.outerMargin * 2 +
        pageConfig.payslipHorizontalMargin * (pageConfig.payslipsPerRow - 1))) /
    pageConfig.payslipsPerRow;
  const availableHeight = pageConfig.height - pageConfig.outerMargin * 2;
  const calculatedBasePayslipHeight =
    (availableHeight -
      pageConfig.payslipVerticalMargin * (pageConfig.payslipsPerColumn - 1)) /
    pageConfig.payslipsPerColumn;

  const numPayslipsPerPage =
    pageConfig.payslipsPerRow * pageConfig.payslipsPerColumn;

  for (let i = 0; i < payrolls.length; i += numPayslipsPerPage) {
    if (i > 0) {
      doc.addPage();
    }
    const pagePayrolls = payrolls.slice(
      i,
      Math.min(i + numPayslipsPerPage, payrolls.length)
    );

    pagePayrolls.forEach((payroll, index) => {
      const col = index % pageConfig.payslipsPerRow;
      const row = Math.floor(index / pageConfig.payslipsPerRow);
      const x =
        pageConfig.outerMargin +
        col * (calculatedPayslipWidth + pageConfig.payslipHorizontalMargin);
      const y =
        pageConfig.outerMargin +
        row * (calculatedBasePayslipHeight + pageConfig.payslipVerticalMargin);

      const totalDeductions =
        (payroll.lateDeduction || 0) +
        (payroll.undertimeDeduction || 0) +
        (payroll.deductions.sss || 0) +
        (payroll.deductions.philHealth || 0) +
        (payroll.deductions.pagIbig || 0) +
        (payroll.deductions.loanDeductions || 0) +
        (payroll.deductions.cashAdvanceDeductions || 0) +
        ((payroll.deductions as any).shortDeductions || 0);
      const grossPay =
        payroll.basicPay +
        (payroll.overtime || 0) +
        (payroll.holidayBonus || 0) +
        (payroll.nightDifferentialPay || 0);
      const netPay = grossPay - totalDeductions;

      const actualPayslipHeight = Math.min(
        calculatedBasePayslipHeight,
        payslipConfig.maxHeight
      );
      doc.setDrawColor(...payslipConfig.outerBorderColor); // Use outerBorderColor
      doc.setLineWidth(payslipConfig.outerBorderWidth); // Use outerBorderWidth
      doc.rect(x, y, calculatedPayslipWidth, actualPayslipHeight);

      // --- Header Section ---
      let currentY = y + payslipConfig.header.yOffset;
      doc.setFont(payslipConfig.fontFamily, payslipConfig.header.fontStyle);
      doc.setFontSize(payslipConfig.header.fontSize);
      doc.setTextColor(
        ...(payslipConfig.header.companyNameColor ||
          payslipConfig.colors.primaryText)
      );
      doc.text(companyName, x + calculatedPayslipWidth / 2, currentY, {
        align: "center",
      });

      currentY +=
        payslipConfig.header.fontSize * 0.5 +
        payslipConfig.header.companyToPayslipLabelSpacing;
      doc.setFont(payslipConfig.fontFamily, payslipConfig.subHeader.fontStyle);
      doc.setFontSize(payslipConfig.subHeader.fontSize);
      doc.setTextColor(
        ...(payslipConfig.subHeader.payslipLabelColor ||
          payslipConfig.colors.primaryText)
      );
      doc.text("PAYSLIP", x + calculatedPayslipWidth / 2, currentY, {
        align: "center",
      });

      currentY +=
        payslipConfig.subHeader.fontSize * 0.5 +
        payslipConfig.header.payslipLabelToDateSpacing;
      doc.setFont(payslipConfig.fontFamily, payslipConfig.periodText.fontStyle);
      doc.setFontSize(payslipConfig.periodText.fontSize);
      doc.setTextColor(
        ...(payslipConfig.periodText.dateRangeColor ||
          payslipConfig.colors.primaryText)
      );
      const startDate = new Date(payroll.startDate).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      );
      const endDate = new Date(payroll.endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      doc.text(
        `${startDate} - ${endDate}`,
        x + calculatedPayslipWidth / 2,
        currentY,
        { align: "center" }
      );

      // --- Employee Info Section ---
      currentY +=
        payslipConfig.periodText.fontSize * 0.5 +
        payslipConfig.employeeInfo.yOffsetFromHeaderBottom;
      doc.setFont(
        payslipConfig.fontFamily,
        payslipConfig.employeeInfo.fontStyle
      );
      doc.setFontSize(payslipConfig.employeeInfo.fontSize);
      doc.setTextColor(...payslipConfig.colors.primaryText); // Assuming employee info uses primary text color
      doc.text(
        `Employee: ${payroll.employeeName}`,
        x + payslipConfig.employeeInfo.paddingX,
        currentY
      );
      doc.text(
        `No. ${payroll.payslipNumber || ""}`,
        x + calculatedPayslipWidth - payslipConfig.employeeInfo.paddingX,
        currentY,
        { align: "right" }
      );

      // --- Table Section (Deductions and Earnings) ---
      currentY +=
        payslipConfig.employeeInfo.fontSize * 0.5 +
        payslipConfig.table.yOffsetFromEmployeeInfoBottom;
      const tableContentWidth =
        calculatedPayslipWidth - 2 * payslipConfig.table.paddingX;
      const columnWidth = tableContentWidth / 2;

      let deductionsY = currentY;
      const deductions = [
        ["SSS", formatCurrency(payroll.deductions.sss)],
        ["PhilHealth", formatCurrency(payroll.deductions.philHealth)],
        ["Pag-IBIG", formatCurrency(payroll.deductions.pagIbig)],
        ["Loan", formatCurrency(payroll.deductions.loanDeductions || 0)],
        [
          "Cash Advance",
          formatCurrency(payroll.deductions.cashAdvanceDeductions || 0),
        ],
        [
          "Late/UT",
          formatCurrency(
            (payroll.lateDeduction || 0) + (payroll.undertimeDeduction || 0)
          ),
        ],
        [
          "Others",
          formatCurrency((payroll.deductions as any).shortDeductions || 0),
        ],
        ["Total Deductions", formatCurrency(totalDeductions)],
      ];
      deductions.forEach((item) => {
        drawTableRow(
          doc,
          x + payslipConfig.table.paddingX,
          deductionsY,
          item[0],
          item[1],
          columnWidth,
          payslipConfig.table
        );
        deductionsY += payslipConfig.table.rowHeight;
      });

      let earningsY = currentY;
      const earnings = [
        ["Daily Rate", formatCurrency(payroll.dailyRate)],
        ["Days", payroll.daysWorked.toString()],
        ["Basic Pay", formatCurrency(payroll.basicPay)],
        ["Legal Holiday", formatCurrency(payroll.holidayBonus || 0)],
        ["OT Pay", formatCurrency(payroll.overtime || 0)],
        ["Night Diff", formatCurrency(payroll.nightDifferentialPay || 0)],
        ["Gross Pay", formatCurrency(grossPay)],
        ["Less: Deductions", formatCurrency(totalDeductions)],
        ["Net Pay", formatCurrency(netPay)],
      ];
      earnings.forEach((item) => {
        drawTableRow(
          doc,
          x + payslipConfig.table.paddingX + columnWidth,
          earningsY,
          item[0],
          item[1],
          columnWidth,
          payslipConfig.table
        );
        earningsY += payslipConfig.table.rowHeight;
      });

      // --- Signature Section ---
      const signatureTextY =
        y +
        actualPayslipHeight -
        payslipConfig.signature.yOffsetFromBottom -
        payslipConfig.signature.labelToNameSpacing -
        payslipConfig.signature.fontSize * 0.5;
      const signatureNameY =
        signatureTextY + payslipConfig.signature.labelToNameSpacing;

      doc.setFont(payslipConfig.fontFamily, payslipConfig.signature.fontStyle);
      doc.setFontSize(payslipConfig.signature.fontSize);
      doc.setTextColor(...payslipConfig.colors.primaryText); // Assuming signature uses primary text color

      doc.text(
        "Prepared by:",
        x + payslipConfig.signature.paddingX,
        signatureTextY
      );
      doc.text(
        payroll.preparedBy || "",
        x + payslipConfig.signature.paddingX,
        signatureNameY
      );

      doc.text(
        "Approved by:",
        x + calculatedPayslipWidth - payslipConfig.signature.paddingX,
        signatureTextY,
        { align: "right" }
      );
      doc.text(
        payroll.approvedBy || "",
        x + calculatedPayslipWidth - payslipConfig.signature.paddingX,
        signatureNameY,
        { align: "right" }
      );
    });
  }
};
