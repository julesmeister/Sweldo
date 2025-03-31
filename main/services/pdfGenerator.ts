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
        size: "A4",
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
      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points
      const margin = 10; // Reduced from 15
      const payslipWidth = (pageWidth - margin * 3) / 2; // 2 columns
      const basePayslipHeight = (pageHeight - margin * 5) / 4; // 4 rows
      const logoSize = 25; // Reduced from 30
      const rowHeight = 10; // Reduced from 12
      const headerSpacing = 5; // New constant for header spacing

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

      // Process payrolls in groups of 8 (payslips per page)
      for (let i = 0; i < uniquePayrolls.length; i += 8) {
        if (i > 0) {
          doc.addPage();
        }

        const pagePayrolls = uniquePayrolls.slice(
          i,
          Math.min(i + 8, uniquePayrolls.length)
        );

        // Draw payslips in 4x2 grid
        pagePayrolls.forEach((payroll, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = margin + col * (payslipWidth + margin);
          const y = margin + row * (basePayslipHeight + margin / 4); // Reduced vertical spacing

          // Calculate positions for content
          const headerStartY = y + 5; // Reduced from 8
          const companyNameY = y + logoSize + 8; // Reduced from 10

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
          const headerTextY = headerStartY + logoSize + 2; // Reduced spacing
          doc
            .font("Helvetica-Bold")
            .fontSize(6) // Reduced from 7
            .text("PAYSLIP", x + 5, headerTextY, {
              width: payslipWidth - 10,
              align: "center",
            })
            .text(
              `${new Date(payroll.startDate).toLocaleDateString()} - ${new Date(
                payroll.endDate
              ).toLocaleDateString()}`,
              x + 5,
              headerTextY + 8, // Reduced from 10
              {
                width: payslipWidth - 10,
                align: "center",
              }
            );

          // Add employee info
          const employeeInfoY = headerTextY + 20; // Reduced from 25
          doc
            .font("Helvetica")
            .fontSize(6) // Reduced from 7
            .text(`Employee: ${payroll.employeeName}`, x + 5, employeeInfoY)
            .text(
              `No. ${payroll.payslipNumber || ""}`,
              x + payslipWidth - 45,
              employeeInfoY
            );

          // Position table after employee info with proper spacing
          const tableStartY = employeeInfoY + 12; // Reduced from 15

          const colWidth = (payslipWidth - 10) / 2;

          // Define table data
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
            ["Others", formatCurrency(payroll.deductions.others || 0)],
            [
              "Total Deductions",
              formatCurrency(payroll.deductions.totalDeduction),
            ],
          ];

          const earnings = [
            ["Daily Rate", formatCurrency(payroll.dailyRate)],
            ["Days", payroll.daysWorked.toString()],
            ["Basic Pay", formatCurrency(payroll.basicPay)],
            ["Legal Holiday", formatCurrency(payroll.holidayBonus || 0)],
            ["OT Pay", formatCurrency(payroll.overtime || 0)],
            ["Night Diff", formatCurrency(payroll.nightDifferentialPay || 0)],
            ["Gross Pay", formatCurrency(payroll.grossPay)],
            [
              "Less: Deductions",
              formatCurrency(payroll.deductions.totalDeduction),
            ],
            ["Net Pay", formatCurrency(payroll.netPay)],
          ];

          // Calculate heights
          const tableHeight =
            Math.max(deductions.length, earnings.length) * rowHeight;
          const totalContentHeight = tableStartY + tableHeight + 5;
          const payslipHeight = Math.min(
            basePayslipHeight,
            totalContentHeight + margin
          );

          // Draw border
          doc
            .rect(x, y, payslipWidth, payslipHeight)
            .strokeColor("#000000")
            .lineWidth(0.5)
            .stroke();

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

          // Add signature lines with minimal spacing
          const signatureY = tableStartY + tableHeight + 5; // Reduced from 10
          doc
            .fontSize(6) // Reduced from 7
            .text("Prepared by:", x + 10, signatureY)
            .font("Helvetica")
            .text(payroll.preparedBy || "", x + 10, signatureY + 8, {
              width: 100,
              align: "left",
            })
            .text("Approved by:", x + payslipWidth / 2, signatureY, {
              width: 100,
              align: "right",
            })
            .text(
              payroll.approvedBy || "",
              x + payslipWidth / 2,
              signatureY + 8,
              {
                width: 100,
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
