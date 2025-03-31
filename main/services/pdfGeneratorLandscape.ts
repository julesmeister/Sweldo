import PDFDocument from "pdfkit";
import fs from "fs";
import { PayrollSummary, PDFGeneratorOptions } from "@/renderer/types/payroll";

export async function generatePayrollPDFLandscape(
  payrolls: PayrollSummary[],
  options: PDFGeneratorOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document in landscape orientation
      const doc = new PDFDocument({
        size: [936, 576], // Long bond paper (13" x 8") in landscape
        margin: 20,
        bufferPages: true,
        layout: "landscape",
      });

      // Create write stream
      const writeStream = fs.createWriteStream(
        options.outputPath.replace(".pdf", "_landscape.pdf")
      );

      // Handle stream events
      writeStream.on("finish", () => {
        resolve(options.outputPath.replace(".pdf", "_landscape.pdf"));
      });

      writeStream.on("error", (err) => {
        reject(err);
      });

      // Pipe the PDF to the write stream
      doc.pipe(writeStream);

      // Constants for layout
      const pageWidth = 936; // Long bond paper width in landscape (13")
      const pageHeight = 576; // Long bond paper height in landscape (8")
      const outerMargin = 15;
      const horizontalMargin = 10;
      const verticalMargin = 2;

      // Calculate table column widths
      const tableWidth = pageWidth - outerMargin * 2;
      const columnWidths = {
        no: tableWidth * 0.03, // 3%
        name: tableWidth * 0.15, // 15%
        days: tableWidth * 0.04, // 4%
        rate: tableWidth * 0.07, // 7%
        holiday: tableWidth * 0.07, // 7%
        ot: tableWidth * 0.07, // 7%
        gross: tableWidth * 0.08, // 8%
        deductions: {
          sss: tableWidth * 0.06, // 6%
          philhealth: tableWidth * 0.06, // 6%
          pagibig: tableWidth * 0.06, // 6%
          loan: tableWidth * 0.06, // 6%
          ca: tableWidth * 0.06, // 6%
          partial: tableWidth * 0.06, // 6%
          others: tableWidth * 0.06, // 6%
          total: tableWidth * 0.07, // 7%
        },
      };

      const rowHeight = 20;
      const headerHeight = 60;

      // Draw header
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(options.companyName || "PAYROLL", outerMargin, outerMargin + 10, {
          align: "center",
        });

      doc
        .fontSize(10)
        .text(
          `${new Date(
            payrolls[0]?.startDate || ""
          ).toLocaleDateString()} - ${new Date(
            payrolls[0]?.endDate || ""
          ).toLocaleDateString()}`,
          outerMargin,
          outerMargin + 25,
          { align: "center" }
        );

      // Draw table headers
      let currentX = outerMargin;
      let currentY = outerMargin + headerHeight;

      const headers = [
        { width: columnWidths.no, text: "No." },
        { width: columnWidths.name, text: "NAME OF EMPLOYEE" },
        { width: columnWidths.days, text: "DAYS" },
        { width: columnWidths.rate, text: "RATE" },
        { width: columnWidths.holiday, text: "HOLIDAY" },
        { width: columnWidths.ot, text: "OT" },
        { width: columnWidths.gross, text: "GROSS" },
        { width: columnWidths.deductions.sss, text: "SSS" },
        { width: columnWidths.deductions.philhealth, text: "PHILHEALTH" },
        { width: columnWidths.deductions.pagibig, text: "PAG-IBIG" },
        { width: columnWidths.deductions.loan, text: "LOAN" },
        { width: columnWidths.deductions.ca, text: "CA" },
        { width: columnWidths.deductions.partial, text: "PARTIAL" },
        { width: columnWidths.deductions.others, text: "OTHERS" },
        { width: columnWidths.deductions.total, text: "TOTAL" },
      ];

      // Draw header cells
      headers.forEach((header) => {
        doc
          .rect(currentX, currentY, header.width, rowHeight)
          .stroke()
          .fontSize(6)
          .text(header.text, currentX + 2, currentY + (rowHeight - 6) / 2, {
            width: header.width - 4,
            align: "center",
          });
        currentX += header.width;
      });

      // Draw rows
      payrolls.forEach((payroll, index) => {
        currentX = outerMargin;
        currentY += rowHeight;

        const rowData = [
          { width: columnWidths.no, text: (index + 1).toString() },
          { width: columnWidths.name, text: payroll.employeeName },
          { width: columnWidths.days, text: payroll.daysWorked.toString() },
          { width: columnWidths.rate, text: formatCurrency(payroll.dailyRate) },
          {
            width: columnWidths.holiday,
            text: formatCurrency(payroll.holidayBonus || 0),
          },
          {
            width: columnWidths.ot,
            text: formatCurrency(payroll.overtime || 0),
          },
          { width: columnWidths.gross, text: formatCurrency(payroll.grossPay) },
          {
            width: columnWidths.deductions.sss,
            text: formatCurrency(payroll.deductions.sss),
          },
          {
            width: columnWidths.deductions.philhealth,
            text: formatCurrency(payroll.deductions.philHealth),
          },
          {
            width: columnWidths.deductions.pagibig,
            text: formatCurrency(payroll.deductions.pagIbig),
          },
          {
            width: columnWidths.deductions.loan,
            text: formatCurrency(payroll.deductions.sssLoan || 0),
          },
          {
            width: columnWidths.deductions.ca,
            text: formatCurrency(payroll.deductions.ca || 0),
          },
          {
            width: columnWidths.deductions.partial,
            text: formatCurrency(payroll.deductions.partial || 0),
          },
          {
            width: columnWidths.deductions.others,
            text: formatCurrency(payroll.deductions.others || 0),
          },
          {
            width: columnWidths.deductions.total,
            text: formatCurrency(payroll.deductions.totalDeduction),
          },
        ];

        rowData.forEach((cell) => {
          doc
            .rect(currentX, currentY, cell.width, rowHeight)
            .stroke()
            .fontSize(6)
            .text(cell.text, currentX + 2, currentY + (rowHeight - 6) / 2, {
              width: cell.width - 4,
              align: "center",
            });
          currentX += cell.width;
        });
      });

      // Add signature lines at the bottom
      const signatureY = currentY + rowHeight + 20;
      doc
        .fontSize(8)
        .text("Prepared by:", outerMargin, signatureY)
        .text("Checked by:", pageWidth / 3, signatureY)
        .text("Approved by:", (pageWidth * 2) / 3, signatureY);

      doc
        .fontSize(8)
        .text("_______________________", outerMargin, signatureY + 20)
        .text("_______________________", pageWidth / 3, signatureY + 20)
        .text("_______________________", (pageWidth * 2) / 3, signatureY + 20);

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function formatCurrency(amount: number): string {
  try {
    const numAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(numAmount)) return "Php 0.00";

    const formattedAmount = Math.abs(numAmount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formattedAmount}`;
  } catch (e) {
    return "0.00";
  }
}
