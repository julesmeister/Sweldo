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
        size: [576, 936], // Long bond paper (8" x 13") in landscape
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
      const pageWidth = 576; // Long bond paper height in landscape (8")
      const pageHeight = 936; // Long bond paper width in landscape (13")
      const outerMargin = 20;
      const horizontalMargin = 5;
      const verticalMargin = 1;

      // Calculate table column widths
      const tableWidth = pageHeight - outerMargin * 2;
      const columnWidths = {
        no: tableWidth * 0.02,
        name: tableWidth * 0.12,
        days: tableWidth * 0.03,
        rate: tableWidth * 0.055,
        holiday: tableWidth * 0.045,
        ot: tableWidth * 0.045,
        gross: tableWidth * 0.055,
        ut: tableWidth * 0.045,
        deductions: {
          sss: tableWidth * 0.045,
          philhealth: tableWidth * 0.045,
          pagibig: tableWidth * 0.045,
          loan: tableWidth * 0.045,
          ca: tableWidth * 0.045,
          partial: tableWidth * 0.045,
          others: tableWidth * 0.045,
          total: tableWidth * 0.055,
        },
        totalDeductions: tableWidth * 0.055,
        netPay: tableWidth * 0.055,
        signature: tableWidth * 0.12,
      };

      const rowHeight = 12;
      const headerHeight = 50;

      // Draw header
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(options.companyName || "PAYROLL", outerMargin, outerMargin + 15, {
          align: "center",
        });

      doc
        .fontSize(8)
        .text(
          `${new Date(
            payrolls[0]?.startDate || ""
          ).toLocaleDateString()} - ${new Date(
            payrolls[0]?.endDate || ""
          ).toLocaleDateString()}`,
          outerMargin,
          outerMargin + 30,
          { align: "center" }
        );

      // Add PAYROLL text
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("PAYROLL", outerMargin, outerMargin + 42, {
          align: "center",
        });

      // Draw table headers
      let currentX = outerMargin;
      let currentY = outerMargin + headerHeight + 10;

      const columns = [
        { id: "no", header: "No.", width: 0.02 },
        { id: "name", header: "NAME OF EMPLOYEE", width: 0.12 },
        { id: "days", header: "DAYS", width: 0.03 },
        { id: "rate", header: "RATE", width: 0.055 },
        { id: "holiday", header: "HOLIDAY", width: 0.045 },
        { id: "ot", header: "OT", width: 0.045 },
        { id: "gross", header: "GROSS", width: 0.055 },
        { id: "ut", header: "UT", width: 0.045 },
        { id: "sss", header: "SSS", width: 0.045 },
        { id: "philhealth", header: "PHILHEALTH", width: 0.045 },
        { id: "pagibig", header: "PAG-IBIG", width: 0.045 },
        { id: "loan", header: "LOAN", width: 0.045 },
        { id: "ca", header: "CA", width: 0.045 },
        { id: "partial", header: "PARTIAL", width: 0.045 },
        { id: "others", header: "OTHERS", width: 0.045 },
        { id: "totalDeductions", header: "TOTAL DED.", width: 0.055 },
        { id: "netPay", header: "NET PAY", width: 0.055 },
        { id: "signature", header: "SIGNATURE", width: 0.12 },
      ];

      // Draw header cells
      columns.forEach((column) => {
        doc
          .rect(currentX, currentY, column.width * tableWidth, rowHeight)
          .stroke()
          .fontSize(5)
          .text(column.header, currentX + 2, currentY + (rowHeight - 5) / 2, {
            width: column.width * tableWidth - 4,
            align: column.header === "NAME OF EMPLOYEE" ? "left" : "center",
          });
        currentX += column.width * tableWidth;
      });

      // Move currentY down after headers
      currentY += rowHeight;

      // Draw rows
      const rowData = payrolls.map((payroll, index) =>
        columns.map((column) => ({
          width: column.width,
          text:
            column.id === "no"
              ? (index + 1).toString()
              : column.id === "name"
              ? payroll.employeeName
              : column.id === "days"
              ? payroll.daysWorked.toString()
              : column.id === "rate"
              ? formatCurrency(payroll.dailyRate)
              : column.id === "holiday"
              ? formatCurrency(payroll.holidayBonus || 0)
              : column.id === "ot"
              ? formatCurrency(payroll.overtime || 0)
              : column.id === "ut"
              ? formatCurrency(payroll.undertimeDeduction || 0)
              : column.id === "gross"
              ? formatCurrency(payroll.grossPay)
              : column.id === "sss"
              ? formatCurrency(payroll.deductions.sss || 0)
              : column.id === "philhealth"
              ? formatCurrency(payroll.deductions.philHealth || 0)
              : column.id === "pagibig"
              ? formatCurrency(payroll.deductions.pagIbig || 0)
              : column.id === "loan"
              ? "0.00"
              : column.id === "ca"
              ? formatCurrency(payroll.deductions.cashAdvanceDeductions || 0)
              : column.id === "partial"
              ? "0.00"
              : column.id === "others"
              ? formatCurrency(payroll.deductions.others || 0)
              : column.id === "totalDeductions"
              ? formatCurrency(
                  (payroll.deductions.sss || 0) +
                    (payroll.deductions.philHealth || 0) +
                    (payroll.deductions.pagIbig || 0) +
                    (payroll.deductions.cashAdvanceDeductions || 0) +
                    (payroll.deductions.others || 0)
                )
              : column.id === "netPay"
              ? formatCurrency(payroll.netPay)
              : "",
          align: (column.id === "name"
            ? "left"
            : column.id === "no" || column.id === "days"
            ? "center"
            : "right") as "left" | "center" | "right",
        }))
      );

      rowData.forEach((row) => {
        currentX = outerMargin;
        row.forEach((cell) => {
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .stroke()
            .fontSize(5)
            .text(cell.text, currentX + 2, currentY + (rowHeight - 5) / 2, {
              width: cell.width * tableWidth - 4,
              align: cell.align,
            });
          currentX += cell.width * tableWidth;
        });
        currentY += rowHeight;
      });

      // Add totals row
      currentX = outerMargin;

      // Calculate totals
      const totals = payrolls.reduce(
        (acc, curr) => ({
          days: acc.days + curr.daysWorked,
          rate: acc.rate + curr.dailyRate,
          holiday: acc.holiday + (curr.holidayBonus || 0),
          ot: acc.ot + (curr.overtime || 0),
          ut: acc.ut + (curr.undertimeDeduction || 0),
          gross: acc.gross + curr.grossPay,
          sss: acc.sss + (curr.deductions.sss || 0),
          philhealth: acc.philhealth + (curr.deductions.philHealth || 0),
          pagibig: acc.pagibig + (curr.deductions.pagIbig || 0),
          ca: acc.ca + (curr.deductions.cashAdvanceDeductions || 0),
          partial: 0,
          others: acc.others + (curr.deductions.others || 0),
          totalDeductions:
            acc.totalDeductions +
            (curr.deductions.sss || 0) +
            (curr.deductions.philHealth || 0) +
            (curr.deductions.pagIbig || 0) +
            (curr.deductions.cashAdvanceDeductions || 0) +
            (curr.deductions.others || 0),
          netPay: acc.netPay + curr.netPay,
        }),
        {
          days: 0,
          rate: 0,
          holiday: 0,
          ot: 0,
          ut: 0,
          gross: 0,
          sss: 0,
          philhealth: 0,
          pagibig: 0,
          ca: 0,
          partial: 0,
          others: 0,
          totalDeductions: 0,
          netPay: 0,
        }
      );

      const totalRowData = columns.map((column) => {
        const width =
          column.id === "name"
            ? columnWidths.name
            : column.id === "no"
            ? columnWidths.no
            : column.id === "days"
            ? columnWidths.days
            : column.id === "rate"
            ? columnWidths.rate
            : column.id === "holiday"
            ? columnWidths.holiday
            : column.id === "ot"
            ? columnWidths.ot
            : column.id === "gross"
            ? columnWidths.gross
            : column.id === "ut"
            ? columnWidths.ut
            : column.id === "sss"
            ? columnWidths.deductions.sss
            : column.id === "philhealth"
            ? columnWidths.deductions.philhealth
            : column.id === "pagibig"
            ? columnWidths.deductions.pagibig
            : column.id === "loan"
            ? columnWidths.deductions.loan
            : column.id === "ca"
            ? columnWidths.deductions.ca
            : column.id === "partial"
            ? columnWidths.deductions.partial
            : column.id === "others"
            ? columnWidths.deductions.others
            : column.id === "totalDeductions"
            ? columnWidths.totalDeductions
            : column.id === "netPay"
            ? columnWidths.netPay
            : columnWidths.signature;

        return {
          width,
          text:
            column.id === "no" ||
            column.id === "name" ||
            column.id === "signature"
              ? ""
              : column.id === "days"
              ? totals.days.toString()
              : column.id === "rate"
              ? formatCurrency(totals.rate)
              : column.id === "holiday"
              ? formatCurrency(totals.holiday)
              : column.id === "ot"
              ? formatCurrency(totals.ot)
              : column.id === "gross"
              ? formatCurrency(totals.gross)
              : column.id === "ut"
              ? formatCurrency(totals.ut)
              : column.id === "sss"
              ? formatCurrency(totals.sss)
              : column.id === "philhealth"
              ? formatCurrency(totals.philhealth)
              : column.id === "pagibig"
              ? formatCurrency(totals.pagibig)
              : column.id === "loan"
              ? "0.00"
              : column.id === "ca"
              ? formatCurrency(totals.ca)
              : column.id === "partial"
              ? formatCurrency(totals.partial)
              : column.id === "others"
              ? formatCurrency(totals.others)
              : column.id === "totalDeductions"
              ? formatCurrency(totals.totalDeductions)
              : column.id === "netPay"
              ? formatCurrency(totals.netPay)
              : "",
          align:
            column.id === "name"
              ? "left"
              : column.id === "no" || column.id === "days"
              ? "center"
              : "right",
        };
      });

      // Draw total row with bold font
      doc.font("Helvetica-Bold");
      totalRowData.forEach((cell) => {
        doc
          .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
          .stroke()
          .fontSize(5)
          .text(cell.text, currentX + 2, currentY + (rowHeight - 5) / 2, {
            width: cell.width * tableWidth - 4,
            align: cell.align as "left" | "center" | "right",
          });
        currentX += cell.width * tableWidth;
      });

      // Reset font to normal
      doc.font("Helvetica");

      // Add signature lines at the bottom
      const bottomMargin = 60; // Increased from 40 to move signatures higher
      const signatureY = pageWidth - bottomMargin;

      doc
        .fontSize(7)
        .text("Prepared by:", outerMargin, signatureY)
        .text("Checked by:", pageHeight / 3, signatureY)
        .text("Approved by:", (pageHeight * 2) / 3, signatureY);

      doc
        .fontSize(7)
        .text("_______________________", outerMargin, signatureY + 15)
        .text("_______________________", pageHeight / 3, signatureY + 15)
        .text("_______________________", (pageHeight * 2) / 3, signatureY + 15);

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
