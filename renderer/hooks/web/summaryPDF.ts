import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FormattedPayrollPDFData } from "../usePayrollPDFGeneration";
import { formatCurrency } from "./payslipPDF";

// --- Centralized Style Configuration ---
const STYLE_CONFIG = {
  pageMargins: { top: 20, right: 40, bottom: 20, left: 40 },
  colors: {
    primary: [52, 152, 219] as [number, number, number],
    secondary: [41, 128, 185] as [number, number, number],
    accent: [26, 188, 156] as [number, number, number],
    darkGray: [52, 73, 94] as [number, number, number],
    mediumGray: [127, 140, 141] as [number, number, number],
    lightGray: [236, 240, 241] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    headerBg: [255, 255, 255] as [number, number, number],
    tableBorder: [189, 195, 199] as [number, number, number],
    totalRowBg: [232, 245, 233] as [number, number, number],
    alternateRowBg: [245, 245, 245] as [number, number, number],
  },
  header: {
    companyFontSize: 15,
    subtitleFontSize: 10,
    dateFontSize: 10,
    dateSubtitleFontSize: 8,
    topMargin: 25, // Margin from page top to start of header content
    bottomMargin: 0, // Space below the accent line
    backgroundHeight: 50, // Total height of the colored header background
    accentLineYOffset: 50, // Y position of the accent line from page top
    accentLineWidth: 1.5,
    textSpacing: 3, // Spacing between company name & subtitle, date & its subtitle
    showAccentLine: false, // Added to control visibility of the header accent line
  },
  table: {
    headerFontSize: 8,
    bodyFontSize: 8,
    totalRowFontSize: 8,
    cellPadding: 3,
    headerCellPadding: 4,
    totalRowMinHeight: 16,
    totalRowCellPadding: 4,
    totalRowTextAlign: "left" as "left" | "center" | "right",
    lineWidth: 0.3,
    columnBackgroundColors: {
      gross: [235, 245, 251] as [number, number, number],
      late: [250, 245, 245] as [number, number, number],
      ut: [250, 245, 245] as [number, number, number],
      sss: [250, 245, 245] as [number, number, number],
      philhealth: [250, 245, 245] as [number, number, number],
      pagibig: [250, 245, 245] as [number, number, number],
      ca: [250, 245, 245] as [number, number, number],
      others: [250, 245, 245] as [number, number, number],
      totalDed: [250, 240, 240] as [number, number, number],
      netPay: [240, 250, 240] as [number, number, number],
    } as Record<string, [number, number, number] | undefined>,
  },
  signatures: {
    boxWidth: 190,
    boxHeight: 65,
    labelFontSize: 8,
    nameFontSize: 9,
    spacing: 20, // Horizontal space between boxes
    yOffsetFromBottom: 35, // Distance from page bottom to top of signature boxes
    lineYOffset: 35, // Y position of signature line from top of box
    nameYOffset: 50, // Y position of name from top of box
  },
  footer: {
    fontSize: 8,
    yPosition: 15, // Distance from page bottom
    generatedOnAlign: "left" as "left" | "center" | "right",
    pageNumberAlign: "right" as "left" | "center" | "right",
  },
};
// --- End of Style Configuration ---

/**
 * Generates a summary PDF in landscape mode
 */
export const generateSummaryPDF = (
  doc: jsPDF,
  payrolls: FormattedPayrollPDFData[],
  companyName: string
) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  addPageBackground(doc, pageWidth);
  drawHeader(doc, pageWidth, companyName, payrolls);

  const tableStartY =
    STYLE_CONFIG.header.backgroundHeight + STYLE_CONFIG.header.bottomMargin;
  const tableData = formatTableData(payrolls);
  drawDataTable(doc, tableStartY, tableData);

  drawSignatures(doc, pageWidth, payrolls);
  drawFooter(doc, pageWidth);
};

/**
 * Adds a subtle background design to the PDF
 */
const addPageBackground = (doc: jsPDF, pageWidth: number) => {
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(
    STYLE_CONFIG.colors.headerBg[0],
    STYLE_CONFIG.colors.headerBg[1],
    STYLE_CONFIG.colors.headerBg[2]
  );
  doc.rect(0, 0, pageWidth, STYLE_CONFIG.header.backgroundHeight, "F");

  doc.setFillColor(
    STYLE_CONFIG.colors.headerBg[0],
    STYLE_CONFIG.colors.headerBg[1],
    STYLE_CONFIG.colors.headerBg[2]
  );
  const footerBgY =
    pageHeight -
    (STYLE_CONFIG.footer.yPosition + STYLE_CONFIG.footer.fontSize / 2 + 5); // Approx height for footer bg
  doc.rect(0, footerBgY, pageWidth, pageHeight - footerBgY, "F");

  if (STYLE_CONFIG.header.showAccentLine) {
    doc.setDrawColor(
      STYLE_CONFIG.colors.accent[0],
      STYLE_CONFIG.colors.accent[1],
      STYLE_CONFIG.colors.accent[2]
    );
    doc.setLineWidth(STYLE_CONFIG.header.accentLineWidth);
    doc.line(
      STYLE_CONFIG.pageMargins.left,
      STYLE_CONFIG.header.accentLineYOffset,
      pageWidth - STYLE_CONFIG.pageMargins.right,
      STYLE_CONFIG.header.accentLineYOffset
    );
  }
};

/**
 * Draw the header section with company name and date range
 */
const drawHeader = (
  doc: jsPDF,
  pageWidth: number,
  companyName: string,
  payrolls: FormattedPayrollPDFData[]
) => {
  const { top, left, right } = STYLE_CONFIG.pageMargins;
  const {
    companyFontSize,
    subtitleFontSize,
    dateFontSize,
    dateSubtitleFontSize,
    topMargin,
    textSpacing,
  } = STYLE_CONFIG.header;

  // Left Column: Company Name and Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(companyFontSize);
  doc.setTextColor(
    STYLE_CONFIG.colors.darkGray[0],
    STYLE_CONFIG.colors.darkGray[1],
    STYLE_CONFIG.colors.darkGray[2]
  );
  doc.text(companyName, left, topMargin);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(subtitleFontSize);
  doc.setTextColor(
    STYLE_CONFIG.colors.mediumGray[0],
    STYLE_CONFIG.colors.mediumGray[1],
    STYLE_CONFIG.colors.mediumGray[2]
  );
  doc.text(
    "Payroll Summary",
    left,
    topMargin + companyFontSize * 0.7 + textSpacing
  );

  // Right Column: Date Range and new subtitle
  if (payrolls.length > 0) {
    const startDate = new Date(payrolls[0].startDate).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
    const endDate = new Date(payrolls[0].endDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const dateText = `${startDate} - ${endDate}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(dateFontSize);
    doc.setTextColor(
      STYLE_CONFIG.colors.darkGray[0],
      STYLE_CONFIG.colors.darkGray[1],
      STYLE_CONFIG.colors.darkGray[2]
    );
    doc.text(dateText, pageWidth - right, topMargin, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(dateSubtitleFontSize);
    doc.setTextColor(
      STYLE_CONFIG.colors.mediumGray[0],
      STYLE_CONFIG.colors.mediumGray[1],
      STYLE_CONFIG.colors.mediumGray[2]
    );
    doc.text(
      "Pay Period",
      pageWidth - right,
      topMargin + dateFontSize * 0.7 + textSpacing,
      { align: "right" }
    );
  }
};

/**
 * Format payroll data for the table
 */
const formatTableData = (payrolls: FormattedPayrollPDFData[]) => {
  const tableData = payrolls.map((payroll, index) => {
    const grossPay =
      payroll.basicPay +
      (payroll.overtime || 0) +
      (payroll.holidayBonus || 0) +
      (payroll.nightDifferentialPay || 0);

    const totalDeductions =
      (payroll.lateDeduction || 0) +
      (payroll.undertimeDeduction || 0) +
      (payroll.deductions.sss || 0) +
      (payroll.deductions.philHealth || 0) +
      (payroll.deductions.pagIbig || 0) +
      (payroll.deductions.cashAdvanceDeductions || 0) +
      ((payroll.deductions as any).shortDeductions || 0);

    return {
      no: (index + 1).toString(),
      name: payroll.employeeName,
      days: payroll.daysWorked.toString(),
      rate: formatCurrency(payroll.dailyRate),
      holiday: formatCurrency(payroll.holidayBonus || 0),
      ot: formatCurrency(payroll.overtime || 0),
      nd: formatCurrency(payroll.nightDifferentialPay || 0),
      gross: formatCurrency(grossPay),
      late: formatCurrency(payroll.lateDeduction || 0),
      ut: formatCurrency(payroll.undertimeDeduction || 0),
      sss: formatCurrency(payroll.deductions.sss || 0),
      philhealth: formatCurrency(payroll.deductions.philHealth || 0),
      pagibig: formatCurrency(payroll.deductions.pagIbig || 0),
      ca: formatCurrency(payroll.deductions.cashAdvanceDeductions || 0),
      others: formatCurrency((payroll.deductions as any).shortDeductions || 0),
      totalDed: formatCurrency(totalDeductions),
      netPay: formatCurrency(grossPay - totalDeductions),
    };
  });

  const totals = calculateTotals(payrolls);
  tableData.push({
    no: "",
    name: "TOTAL",
    days: totals.days.toString(),
    rate: formatCurrency(totals.rate),
    holiday: formatCurrency(totals.holiday),
    ot: formatCurrency(totals.ot),
    nd: formatCurrency(totals.nd),
    gross: formatCurrency(totals.gross),
    late: formatCurrency(totals.late),
    ut: formatCurrency(totals.ut),
    sss: formatCurrency(totals.sss),
    philhealth: formatCurrency(totals.philhealth),
    pagibig: formatCurrency(totals.pagibig),
    ca: formatCurrency(totals.ca),
    others: formatCurrency(totals.others),
    totalDed: formatCurrency(totals.totalDed),
    netPay: formatCurrency(totals.netPay),
  });

  return tableData;
};

/**
 * Calculate totals for all payroll entries
 */
const calculateTotals = (payrolls: FormattedPayrollPDFData[]) => {
  return payrolls.reduce(
    (acc, curr) => {
      const grossPay =
        curr.basicPay +
        (curr.overtime || 0) +
        (curr.holidayBonus || 0) +
        (curr.nightDifferentialPay || 0);

      const totalDeductions =
        (curr.lateDeduction || 0) +
        (curr.undertimeDeduction || 0) +
        (curr.deductions.sss || 0) +
        (curr.deductions.philHealth || 0) +
        (curr.deductions.pagIbig || 0) +
        (curr.deductions.cashAdvanceDeductions || 0) +
        ((curr.deductions as any).shortDeductions || 0);

      return {
        days: acc.days + curr.daysWorked,
        rate: acc.rate + curr.dailyRate,
        holiday: acc.holiday + (curr.holidayBonus || 0),
        ot: acc.ot + (curr.overtime || 0),
        nd: acc.nd + (curr.nightDifferentialPay || 0),
        gross: acc.gross + grossPay,
        late: acc.late + (curr.lateDeduction || 0),
        ut: acc.ut + (curr.undertimeDeduction || 0),
        sss: acc.sss + (curr.deductions.sss || 0),
        philhealth: acc.philhealth + (curr.deductions.philHealth || 0),
        pagibig: acc.pagibig + (curr.deductions.pagIbig || 0),
        ca: acc.ca + (curr.deductions.cashAdvanceDeductions || 0),
        others: acc.others + ((curr.deductions as any).shortDeductions || 0),
        totalDed: acc.totalDed + totalDeductions,
        netPay: acc.netPay + (grossPay - totalDeductions),
      };
    },
    {
      days: 0,
      rate: 0,
      holiday: 0,
      ot: 0,
      nd: 0,
      gross: 0,
      late: 0,
      ut: 0,
      sss: 0,
      philhealth: 0,
      pagibig: 0,
      ca: 0,
      others: 0,
      totalDed: 0,
      netPay: 0,
    }
  );
};

/**
 * Draw the main data table with all payroll information
 */
const drawDataTable = (doc: jsPDF, startY: number, tableData: any[]) => {
  const columns = [
    { header: "No.", dataKey: "no" },
    { header: "NAME OF EMPLOYEE", dataKey: "name" },
    { header: "DAYS", dataKey: "days" },
    { header: "RATE", dataKey: "rate" },
    { header: "HOLIDAY", dataKey: "holiday" },
    { header: "OT", dataKey: "ot" },
    { header: "ND", dataKey: "nd" },
    { header: "GROSS", dataKey: "gross" },
    { header: "LATE", dataKey: "late" },
    { header: "UT", dataKey: "ut" },
    { header: "SSS", dataKey: "sss" },
    { header: "PHILHEALTH", dataKey: "philhealth" },
    { header: "PAG-IBIG", dataKey: "pagibig" },
    { header: "CA", dataKey: "ca" },
    { header: "OTHERS", dataKey: "others" },
    { header: "TOTAL DED.", dataKey: "totalDed" },
    { header: "NET PAY", dataKey: "netPay" },
  ];

  const baseColumnStyles: Record<string, any> = {
    name: { halign: "left", cellWidth: 80, fontStyle: "bold" },
    days: { halign: "center", cellWidth: 30 },
    no: { halign: "center", cellWidth: 25 },
    rate: { halign: "right", fontStyle: "normal" },
    holiday: { halign: "right" },
    ot: { halign: "right" },
    nd: { halign: "right" },
    gross: { halign: "right", fontStyle: "bold" },
    late: { halign: "right" },
    ut: { halign: "right" },
    sss: { halign: "right" },
    philhealth: { halign: "right" },
    pagibig: { halign: "right" },
    ca: { halign: "right" },
    others: { halign: "right" },
    totalDed: { halign: "right", fontStyle: "bold" },
    netPay: { halign: "right", fontStyle: "bold" },
  };

  const finalColumnStyles: Record<string, any> = {};
  columns.forEach((colDef) => {
    const dataKey = colDef.dataKey;
    finalColumnStyles[dataKey] = { ...(baseColumnStyles[dataKey] || {}) }; // Start with base styles
    const bgColor = STYLE_CONFIG.table.columnBackgroundColors?.[dataKey];
    if (bgColor) {
      finalColumnStyles[dataKey].fillColor = bgColor;
    }
  });

  autoTable(doc, {
    startY: startY,
    head: [columns.map((col) => col.header)],
    body: tableData.map((row) =>
      columns.map((col) => (row as any)[col.dataKey as keyof typeof row])
    ),
    theme: "grid",
    columnStyles: finalColumnStyles, // Use dynamically generated column styles
    styles: {
      lineColor: STYLE_CONFIG.colors.tableBorder,
      lineWidth: STYLE_CONFIG.table.lineWidth,
      valign: "middle",
      fontSize: STYLE_CONFIG.table.bodyFontSize,
      cellPadding: STYLE_CONFIG.table.cellPadding,
    },
    headStyles: {
      fillColor: STYLE_CONFIG.colors.primary,
      textColor: STYLE_CONFIG.colors.white,
      fontSize: STYLE_CONFIG.table.headerFontSize,
      fontStyle: "bold",
      cellPadding: STYLE_CONFIG.table.headerCellPadding,
      halign: "center",
      valign: "middle",
      minCellHeight: 14, // Keep specific if needed, or add to config
    },
    bodyStyles: {
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: STYLE_CONFIG.colors.alternateRowBg,
    },
    didParseCell: function (data) {
      const isLastRow = data.row.index === tableData.length - 1;
      if (isLastRow) {
        data.cell.styles.fillColor = STYLE_CONFIG.colors.totalRowBg;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = STYLE_CONFIG.colors.darkGray;
        data.cell.styles.halign = STYLE_CONFIG.table.totalRowTextAlign;
        data.cell.styles.valign = "middle";
        data.cell.styles.minCellHeight = STYLE_CONFIG.table.totalRowMinHeight;
        data.cell.styles.fontSize = STYLE_CONFIG.table.totalRowFontSize;
        data.cell.styles.cellPadding = STYLE_CONFIG.table.totalRowCellPadding;
      } else if (data.column.dataKey === "name") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = STYLE_CONFIG.colors.darkGray;
      }

      if (
        ["gross", "totalDed", "netPay"].includes(data.column.dataKey as string)
      ) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: {
      top:
        STYLE_CONFIG.header.backgroundHeight + STYLE_CONFIG.header.bottomMargin, // Adjusted to start below header bg + margin
      right: STYLE_CONFIG.pageMargins.right,
      bottom:
        STYLE_CONFIG.pageMargins.bottom +
        STYLE_CONFIG.signatures.boxHeight +
        STYLE_CONFIG.signatures.yOffsetFromBottom, // Reserve space for signatures and footer
      left: STYLE_CONFIG.pageMargins.left,
    },
  });
};

/**
 * Draw the signature section at the bottom of the PDF
 */
const drawSignatures = (
  doc: jsPDF,
  pageWidth: number,
  payrolls: FormattedPayrollPDFData[]
) => {
  const {
    boxWidth,
    boxHeight,
    labelFontSize,
    nameFontSize,
    spacing,
    yOffsetFromBottom,
    lineYOffset,
    nameYOffset,
  } = STYLE_CONFIG.signatures;
  const pageHeight = doc.internal.pageSize.getHeight();

  const totalSignatureWidth = boxWidth * 3 + spacing * 2;
  const startX = (pageWidth - totalSignatureWidth) / 2;
  const boxY = pageHeight - yOffsetFromBottom - boxHeight;

  const signatureLabels = ["Prepared by:", "Checked by:", "Approved by:"];
  const signatureNames = [
    payrolls.length > 0 ? payrolls[0].preparedBy || "" : "",
    "",
    payrolls.length > 0 ? payrolls[0].approvedBy || "" : "",
  ];

  signatureLabels.forEach((label, index) => {
    const currentBoxX = startX + index * (boxWidth + spacing);

    doc.setFillColor(252, 252, 252); // Very light fill for boxes
    doc.setDrawColor(
      STYLE_CONFIG.colors.tableBorder[0],
      STYLE_CONFIG.colors.tableBorder[1],
      STYLE_CONFIG.colors.tableBorder[2]
    );
    doc.setLineWidth(0.3);
    doc.roundedRect(currentBoxX, boxY, boxWidth, boxHeight, 3, 3, "FD");

    doc.setFontSize(labelFontSize);
    doc.setTextColor(
      STYLE_CONFIG.colors.darkGray[0],
      STYLE_CONFIG.colors.darkGray[1],
      STYLE_CONFIG.colors.darkGray[2]
    );
    doc.setFont("helvetica", "bold");
    doc.text(label, currentBoxX + 10, boxY + 15);

    doc.setLineWidth(0.5);
    doc.setDrawColor(220, 220, 220); // Light gray for line
    doc.line(
      currentBoxX + 10,
      boxY + lineYOffset,
      currentBoxX + boxWidth - 10,
      boxY + lineYOffset
    );

    if (signatureNames[index]) {
      doc.setFontSize(nameFontSize);
      doc.setFont("helvetica", "normal");
      doc.text(
        signatureNames[index],
        currentBoxX + boxWidth / 2,
        boxY + nameYOffset,
        { align: "center" }
      );
    }
  });
};

/**
 * Draw footer with page number and generation date
 */
const drawFooter = (doc: jsPDF, pageWidth: number) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const { fontSize, yPosition, generatedOnAlign, pageNumberAlign } =
    STYLE_CONFIG.footer;
  const { left, right } = STYLE_CONFIG.pageMargins;

  const finalFooterY = pageHeight - yPosition;

  doc.setFontSize(fontSize);
  doc.setTextColor(
    STYLE_CONFIG.colors.mediumGray[0],
    STYLE_CONFIG.colors.mediumGray[1],
    STYLE_CONFIG.colors.mediumGray[2]
  );
  doc.setFont("helvetica", "italic");

  const today = new Date().toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

  // Generated On Text
  let generatedTextX = left;
  let generatedTextAlign: "left" | "center" | "right" | undefined =
    generatedOnAlign;
  if (generatedOnAlign === "center") {
    generatedTextX = pageWidth / 2;
  } else if (generatedOnAlign === "right") {
    generatedTextX = pageWidth - right;
  }
  doc.text(`Generated on: ${today}`, generatedTextX, finalFooterY, {
    align: generatedTextAlign,
  });

  // Page Number Text
  let pageNumTextX = pageWidth - right;
  let pageNumTextAlign: "left" | "center" | "right" | undefined =
    pageNumberAlign;
  if (pageNumberAlign === "center") {
    pageNumTextX = pageWidth / 2;
  } else if (pageNumberAlign === "left") {
    pageNumTextX = left;
  }
  doc.text(`Page 1 of 1`, pageNumTextX, finalFooterY, {
    align: pageNumTextAlign,
  });
};
