import PDFDocument from "pdfkit";
import fs from "fs";
import { PayrollSummary, PDFGeneratorOptions } from "@/renderer/types/payroll";

export async function generatePayrollPDF(
  payrolls: PayrollSummary[],
  options: PDFGeneratorOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        size: [576, 936], // Long bond paper (8" x 13")
        margin: 20,
        bufferPages: true,
      });

      // Create write stream
      const writeStream = fs.createWriteStream(options.outputPath);

      // Handle stream events
      writeStream.on("finish", () => {
        resolve(options.outputPath);
      });

      writeStream.on("error", (err) => {
        reject(err);
      });

      // Pipe the PDF to the write stream
      doc.pipe(writeStream);

      // Constants for layout
      const pageWidth = 576; // Long bond paper width in points
      const pageHeight = 936; // Long bond paper height in points
      const outerMargin = 15; // Margin for page edges
      const horizontalMargin = 10; // Margin between columns
      const verticalMargin = 2; // Very small gap between rows

      // Calculate widths
      const payslipWidth =
        (pageWidth - (outerMargin * 2 + horizontalMargin)) / 2;

      // Calculate heights - divide available space into 5 equal sections
      const availableHeight = pageHeight - outerMargin * 2;
      const basePayslipHeight = availableHeight / 5;

      const logoSize = 18;
      const rowHeight = 7;
      const headerSpacing = 3;

      // Remove duplicates if any (based on employee and date range)
      const uniquePayrolls = payrolls.filter(
        (payroll, index, self) =>
          index ===
          self.findIndex(
            (p) =>
              p.employeeName === payroll.employeeName &&
              p.startDate === payroll.startDate &&
              p.endDate === payroll.endDate
          )
      );

      // Process payrolls in groups of 10 (payslips per page)
      for (let i = 0; i < uniquePayrolls.length; i += 10) {
        if (i > 0) {
          doc.addPage();
        }

        const pagePayrolls = uniquePayrolls.slice(
          i,
          Math.min(i + 10, uniquePayrolls.length)
        );

        // Draw payslips in 5x2 grid
        pagePayrolls.forEach((payroll, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = outerMargin + col * (payslipWidth + horizontalMargin);
          const y = outerMargin + row * basePayslipHeight;

          // Define table data first
          const totalDeductions =
            (payroll.lateDeduction || 0) + (payroll.undertimeDeduction || 0);

          const deductions = [
            ["SSS", formatCurrency(payroll.deductions.sss)],
            ["PhilHealth", formatCurrency(payroll.deductions.philHealth)],
            ["Pag-IBIG", formatCurrency(payroll.deductions.pagIbig)],
            ["SSS Loan", formatCurrency(payroll.deductions.sssLoan || 0)],
            [
              "Pag-IBIG Loan",
              formatCurrency(payroll.deductions.pagibigLoan || 0),
            ],
            ["Cash Advance", formatCurrency(payroll.deductions.ca || 0)],
            ["Partial", formatCurrency(payroll.deductions.partial || 0)],
            ["Others", formatCurrency(totalDeductions)], // Late + Undertime deductions
            ["Total Deductions", formatCurrency(totalDeductions)],
          ];

          const grossPay =
            payroll.basicPay +
            (payroll.overtime || 0) +
            (payroll.holidayBonus || 0) +
            (payroll.nightDifferentialPay || 0);

          const netPay = grossPay - totalDeductions;

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

          // Calculate positions for content
          const headerStartY = y + 4;
          const companyNameY = y + logoSize + 4;

          // Calculate payslip height
          const tableHeight =
            Math.max(deductions.length, earnings.length) * rowHeight;
          const contentHeight =
            logoSize + // Logo
            headerSpacing + // Space after logo
            10 + // Header text (PAYSLIP + date)
            14 + // Employee info
            8 + // Space before table
            tableHeight + // Table content
            16; // Signature section

          // Use basePayslipHeight directly without adding margins
          const payslipHeight = Math.min(
            basePayslipHeight - verticalMargin,
            contentHeight
          );

          // Draw border first
          doc
            .rect(x, y, payslipWidth, payslipHeight)
            .strokeColor("#000000")
            .lineWidth(0.5)
            .stroke();

          // Add logo if provided
          if (options.logoPath && fs.existsSync(options.logoPath)) {
            doc.image(options.logoPath, x + 5, headerStartY, {
              height: logoSize,
              width: logoSize * 2,
              fit: [payslipWidth - 10, logoSize],
              align: "center",
            });
          }

          // Add header text after logo space
          const headerTextY = headerStartY + logoSize + headerSpacing;
          doc
            .font("Helvetica-Bold")
            .fontSize(6)
            .text("PAYSLIP", x + 5, headerTextY, {
              width: payslipWidth - 10,
              align: "center",
            })
            .text(
              `${new Date(payroll.startDate).toLocaleDateString()} - ${new Date(
                payroll.endDate
              ).toLocaleDateString()}`,
              x + 5,
              headerTextY + 6,
              {
                width: payslipWidth - 10,
                align: "center",
              }
            );

          // Add employee info
          const employeeInfoY = headerTextY + 14;
          doc
            .font("Helvetica")
            .fontSize(6)
            .text(`Employee: ${payroll.employeeName}`, x + 5, employeeInfoY)
            .text(
              `No. ${payroll.payslipNumber || ""}`,
              x + payslipWidth - 45,
              employeeInfoY
            );

          // Position table after employee info
          const tableStartY = employeeInfoY + 8;

          const colWidth = (payslipWidth - 10) / 2;

          // Draw tables
          let currentY = tableStartY;
          deductions.forEach((row) => {
            drawTableRow(
              doc,
              x + 5,
              currentY,
              row[0],
              row[1],
              colWidth,
              rowHeight
            );
            currentY += rowHeight;
          });

          // Draw earnings table
          currentY = tableStartY;
          earnings.forEach((row) => {
            drawTableRow(
              doc,
              x + 5 + colWidth,
              currentY,
              row[0],
              row[1],
              colWidth,
              rowHeight
            );
            currentY += rowHeight;
          });

          // Add signature lines relative to bottom of payslip box
          const signatureSpacing = 16; // Space for signatures
          const signatureY = y + payslipHeight - signatureSpacing; // Position from bottom of box

          doc
            .fontSize(6)
            .text("Prepared by:", x + 10, signatureY, {
              width: payslipWidth / 2 - 15,
              align: "left",
            })
            .font("Helvetica")
            .text(payroll.preparedBy || "", x + 10, signatureY + 6, {
              width: payslipWidth / 2 - 15,
              align: "left",
            })
            .text("Approved by:", x + payslipWidth / 2, signatureY, {
              width: payslipWidth / 2 - 10,
              align: "right",
            })
            .text(
              payroll.approvedBy || "",
              x + payslipWidth / 2,
              signatureY + 6,
              {
                width: payslipWidth / 2 - 10,
                align: "right",
              }
            );
        });
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
  height: number
) {
  const labelWidth = width * 0.5;
  const valueWidth = width * 0.5;
  const padding = 2; // Reduced from 4
  const rightPadding = 2; // Reduced from 4
  const verticalPadding = (height - 6) / 2; // Adjusted for new font size

  // Draw cell borders
  doc.rect(x, y, labelWidth, height).stroke();
  doc.rect(x + labelWidth, y, valueWidth, height).stroke();

  // Add text with minimal padding
  doc
    .fontSize(6) // Reduced from 7
    .font("Helvetica")
    .text(label, x + padding, y + verticalPadding, {
      width: labelWidth - padding * 2,
      align: "left",
      lineGap: 0,
    });

  doc
    .fontSize(6) // Reduced from 7
    .font("Helvetica")
    .text(value, x + labelWidth + padding, y + verticalPadding, {
      width: valueWidth - padding - rightPadding,
      align: "right",
      lineGap: 0,
    });
}
function formatCurrency(amount: number): string {
  try {
    // Ensure amount is a valid number
    const numAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(numAmount)) return "Php 0.00";

    // Format with commas for thousands and two decimal places
    const formattedAmount = Math.abs(numAmount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `Php ${formattedAmount}`;
  } catch (e) {
    return "Php 0.00";
  }
}
