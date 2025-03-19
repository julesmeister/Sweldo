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
      const margin = 15; // Reduced margin
      const payslipWidth = (pageWidth - margin * 3) / 2; // 2 columns
      const basePayslipHeight = (pageHeight - margin * 5) / 4; // 4 rows
      const logoSize = 30; // Smaller logo
      const rowHeight = 12; // Smaller row height
      const signatureHeight = 0; // Reduced signature section height

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
          const y = margin + row * (basePayslipHeight + margin / 2);

          // Calculate positions for content
          const headerStartY = y + 8;
          const companyNameY = y + logoSize + 10;
          const tableStartY = y + logoSize + 60;

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
            ["Basic Rate", formatCurrency(payroll.basicPay / 15)],
            ["Days", payroll.daysWorked.toString()],
            ["Basic Pay", formatCurrency(payroll.basicPay)],
            ["Legal Holiday", formatCurrency(payroll.holidayBonus || 0)],
            ["OT Pay", formatCurrency(payroll.overtime || 0)],
            ["Gross Pay", formatCurrency(payroll.grossPay)],
            [
              "Less: Deductions",
              formatCurrency(payroll.deductions.totalDeduction),
            ],
            ["Net Pay", formatCurrency(payroll.netPay)],
          ];

          // Calculate heights
          const tableHeight =
            (Math.max(deductions.length, earnings.length) + 1) * rowHeight; // +1 for header
          const totalContentHeight =
            tableStartY + tableHeight + 20 + signatureHeight; // 20 is padding after tables
          const payslipHeight = Math.max(
            basePayslipHeight,
            totalContentHeight + margin
          );

          // Draw border
          doc
            .rect(x, y, payslipWidth, payslipHeight)
            .strokeColor("#000000")
            .lineWidth(0.5)
            .stroke();

          // Add logo if provided
          if (options.logoPath && fs.existsSync(options.logoPath)) {
            doc.image(options.logoPath, x, headerStartY, {
              height: logoSize,
              width: payslipWidth, // Set container width to full payslip width
              fit: [payslipWidth - 20, logoSize], // Ensure it doesn't exceed payslip width with some padding
              align: "center",
            });
          }

          // Add header text after logo space
          const headerTextY = headerStartY + logoSize + 5; // 5px padding after logo
          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .text("PAYSLIP", x + 5, headerTextY, {
              width: payslipWidth - 10,
              align: "center",
            })
            .text(
              `${new Date(payroll.startDate).toLocaleDateString()} - ${new Date(
                payroll.endDate
              ).toLocaleDateString()}`,
              x + 5,
              headerTextY + 10, // 10px spacing between payslip and date
              {
                width: payslipWidth - 10,
                align: "center",
              }
            );

          // Add employee info (adjust other Y positions accordingly)
          const employeeInfoY = headerTextY + 25; // Adjusted to be after the header text
          doc
            .font("Helvetica")
            .fontSize(7) // Reduced from 8
            .text(`Employee: ${payroll.employeeName}`, x + 5, employeeInfoY)
            .text(
              `No. ${payroll.payslipNumber || ""}`,
              x + payslipWidth - 45,
              employeeInfoY
            );

          const colWidth = (payslipWidth - 10) / 2;

          // Draw table headers with borders
          drawTableHeader(doc, x + 5, tableStartY, "Deductions", colWidth);
          drawTableHeader(
            doc,
            x + 5 + colWidth,
            tableStartY,
            "Earnings",
            colWidth
          );

          // Draw deductions table
          let currentY = tableStartY + rowHeight;
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
          currentY = tableStartY + rowHeight;
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

          // Add signature lines with increased spacing
          const signatureY = tableStartY + tableHeight + 15; // Reduced padding from 20 to 15
          doc
            .fontSize(7) // Reduced from 8
            .text("Prepared by:", x + 10, signatureY)
            .font("Helvetica")
            .text(payroll.preparedBy || "", x + 10, signatureY + 10, {
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
              signatureY + 10,
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

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  title: string,
  width: number
) {
  const headerHeight = 12; // Same as rowHeight constant

  doc
    .rect(x, y, width, headerHeight)
    .fillColor("#f3f4f6")
    .fill()
    .strokeColor("#000000")
    .lineWidth(0.5)
    .stroke();

  doc
    .fillColor("#000000")
    .fontSize(7)
    .font("Helvetica-Bold")
    .text(title, x, y + 3, { width: width, align: "center" });
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
  // Give more space to the value column for amounts
  const labelWidth = width * 0.5; // More space for labels
  const valueWidth = width * 0.5; // Less space but enough for amounts
  const padding = 4; // Consistent padding
  const rightPadding = 4; // Extra padding on the right for amounts
  const verticalPadding = (height - 7) / 2; // Center text vertically (7 is font size)

  // Draw cell borders
  doc.rect(x, y, labelWidth, height).stroke(); // Label cell
  doc.rect(x + labelWidth, y, valueWidth, height).stroke(); // Value cell

  // Add text with proper padding
  doc
    .fontSize(7)
    .font("Helvetica")
    .text(label, x + padding, y + verticalPadding, {
      width: labelWidth - padding * 2,
      align: "left",
      lineGap: 0,
    });

  // Handle value cell separately to ensure proper alignment
  doc
    .fontSize(7)
    .font("Helvetica")
    .text(value, x + labelWidth + padding, y + verticalPadding, {
      width: valueWidth - padding - rightPadding, // Apply extra right padding
      align: "right",
      lineGap: 0,
    });
}

function formatCurrency(amount: number): string {
  try {
    // Ensure amount is a valid number
    const numAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(numAmount)) return "0.00";

    // Format with just the number and two decimal places
    const formattedAmount = Math.abs(numAmount).toFixed(2);
    return formattedAmount;
  } catch (e) {
    return "0.00";
  }
}
