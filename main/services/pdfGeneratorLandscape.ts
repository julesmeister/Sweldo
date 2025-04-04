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
        margin: 0, // Remove default margins
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

      // Calculate margins to center content
      const desiredTableWidth = 900;
      const leftMargin = (pageHeight - desiredTableWidth) / 2;
      const topMargin = 30;

      // Calculate table column widths based on centered content width
      const tableWidth = desiredTableWidth;

      // Reduce row height for more compact table
      const rowHeight = 12; // Reduced from 16
      const headerHeight = 45;

      // Draw header - centered with reduced spacing
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(options.companyName || "PAYROLL", 0, topMargin, {
          width: pageHeight,
          align: "center",
        });

      doc.fontSize(8).text(
        `${new Date(
          payrolls[0]?.startDate || ""
        ).toLocaleDateString()} - ${new Date(
          payrolls[0]?.endDate || ""
        ).toLocaleDateString()}`,
        0,
        topMargin + 15, // Reduced from +20
        {
          width: pageHeight,
          align: "center",
        }
      );

      // Add PAYROLL text
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("PAYROLL", 0, topMargin + 25, {
          // Reduced from +35
          width: pageHeight,
          align: "center",
        });

      // Draw table headers
      let currentX = leftMargin;
      let currentY = topMargin + headerHeight;

      // Define columns structure with adjusted widths
      const columns = [
        { id: "no", header: "No.", width: 0.02 },
        { id: "name", header: "NAME OF EMPLOYEE", width: 0.14 }, // Slightly reduced
        { id: "days", header: "DAYS", width: 0.03 },
        { id: "rate", header: "RATE", width: 0.05 },
        { id: "holiday", header: "HOLIDAY", width: 0.045 },
        { id: "ot", header: "OT", width: 0.045 },
        { id: "gross", header: "GROSS", width: 0.06 },
        { id: "ut", header: "UT", width: 0.045 },
        { id: "sss", header: "SSS", width: 0.045 },
        { id: "philhealth", header: "PHILHEALTH", width: 0.055 }, // Increased
        { id: "pagibig", header: "PAG-IBIG", width: 0.045 },
        { id: "loan", header: "LOAN", width: 0.045 },
        { id: "ca", header: "CA", width: 0.04 }, // Slightly reduced
        { id: "partial", header: "PARTIAL", width: 0.045 },
        { id: "others", header: "OTHERS", width: 0.045 },
        { id: "totalDeductions", header: "TOTAL DED.", width: 0.06 },
        { id: "netPay", header: "NET PAY", width: 0.06 },
        { id: "signature", header: "SIGNATURE", width: 0.12 },
      ];

      // Draw table headers with adjusted vertical positioning
      columns.forEach((column) => {
        doc
          .rect(currentX, currentY, column.width * tableWidth, rowHeight)
          .stroke()
          .font("Helvetica-Bold")
          .fontSize(column.id === "philhealth" ? 5.5 : 6)
          .text(column.header, currentX + 2, currentY + (rowHeight - 5) / 2, {
            // Adjusted vertical centering
            width: column.width * tableWidth - 4,
            align: column.header === "NAME OF EMPLOYEE" ? "left" : "center",
          });
        currentX += column.width * tableWidth;
      });

      // Move currentY down after headers
      currentY += rowHeight;

      // Reset currentX for data rows
      currentX = leftMargin;

      // Ensure payrolls array is properly sorted by employee name
      const sortedPayrolls = [...payrolls].sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName)
      );

      // Draw rows
      const rowData = sortedPayrolls.map((payroll, index) =>
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
              ? formatCurrency(0)
              : column.id === "ca"
              ? formatCurrency(payroll.deductions.cashAdvanceDeductions || 0)
              : column.id === "partial"
              ? formatCurrency(0)
              : column.id === "others"
              ? formatCurrency(payroll.deductions.others || 0)
              : column.id === "totalDeductions"
              ? formatCurrency(payroll.deductions.totalDeduction || 0)
              : column.id === "netPay"
              ? formatCurrency(payroll.netPay)
              : "",
          align:
            column.id === "name"
              ? "left"
              : column.id === "no" || column.id === "days"
              ? "center"
              : "right",
        }))
      );

      // Draw data rows with adjusted vertical positioning
      rowData.forEach((row) => {
        currentX = leftMargin;
        row.forEach((cell) => {
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .stroke()
            .font("Helvetica")
            .fontSize(6)
            .text(cell.text, currentX + 2, currentY + (rowHeight - 5) / 2, {
              // Adjusted vertical centering
              width: cell.width * tableWidth - 4,
              align: cell.align as
                | "center"
                | "justify"
                | "left"
                | "right"
                | undefined,
            });
          currentX += cell.width * tableWidth;
        });
        currentY += rowHeight;
      });

      // Add totals row
      currentX = leftMargin;

      // Calculate totals
      const totals = payrolls.reduce(
        (acc, curr) => {
          const totalDeductions =
            (curr.deductions.sss || 0) +
            (curr.deductions.philHealth || 0) +
            (curr.deductions.pagIbig || 0) +
            (curr.deductions.cashAdvanceDeductions || 0) +
            (curr.deductions.others || 0);

          // Special handling for NET PAY when there are deductions but no gross pay
          const netPay =
            curr.grossPay === 0 && totalDeductions > 0
              ? totalDeductions // If no gross pay but has deductions, NET PAY should be positive deductions
              : curr.grossPay - totalDeductions;

          return {
            days: acc.days + curr.daysWorked,
            holiday: acc.holiday + (curr.holidayBonus || 0),
            ot: acc.ot + (curr.overtime || 0),
            ut: acc.ut + (curr.undertimeDeduction || 0),
            gross: acc.gross + curr.grossPay,
            sss: acc.sss + (curr.deductions.sss || 0),
            philhealth: acc.philhealth + (curr.deductions.philHealth || 0),
            pagibig: acc.pagibig + (curr.deductions.pagIbig || 0),
            loan: acc.loan + 0,
            ca: acc.ca + (curr.deductions.cashAdvanceDeductions || 0),
            partial: acc.partial + 0,
            others: acc.others + (curr.deductions.others || 0),
            totalDeductions: acc.totalDeductions + totalDeductions,
            netPay: acc.netPay + netPay,
          };
        },
        {
          days: 0,
          holiday: 0,
          ot: 0,
          ut: 0,
          gross: 0,
          sss: 0,
          philhealth: 0,
          pagibig: 0,
          loan: 0,
          ca: 0,
          partial: 0,
          others: 0,
          totalDeductions: 0,
          netPay: 0,
        }
      );

      // Format numbers to ensure consistent decimal places
      const formattedTotals = {
        ...totals,
        holiday: Number(totals.holiday.toFixed(2)),
        ot: Number(totals.ot.toFixed(2)),
        ut: Number(totals.ut.toFixed(2)),
        gross: Number(totals.gross.toFixed(2)),
        sss: Number(totals.sss.toFixed(2)),
        philhealth: Number(totals.philhealth.toFixed(2)),
        pagibig: Number(totals.pagibig.toFixed(2)),
        loan: Number(totals.loan.toFixed(2)),
        ca: Number(totals.ca.toFixed(2)),
        partial: Number(totals.partial.toFixed(2)),
        others: Number(totals.others.toFixed(2)),
        totalDeductions: Number(totals.totalDeductions.toFixed(2)),
        netPay: Number(totals.netPay.toFixed(2)),
      };

      const totalRowData = columns.map((column) => ({
        width: column.width,
        text:
          column.id === "no"
            ? ""
            : column.id === "name"
            ? "TOTAL"
            : column.id === "days"
            ? formattedTotals.days.toString()
            : column.id === "rate"
            ? ""
            : column.id === "holiday"
            ? formatCurrency(formattedTotals.holiday)
            : column.id === "ot"
            ? formatCurrency(formattedTotals.ot)
            : column.id === "gross"
            ? formatCurrency(formattedTotals.gross)
            : column.id === "ut"
            ? formatCurrency(formattedTotals.ut)
            : column.id === "sss"
            ? formatCurrency(formattedTotals.sss)
            : column.id === "philhealth"
            ? formatCurrency(formattedTotals.philhealth)
            : column.id === "pagibig"
            ? formatCurrency(formattedTotals.pagibig)
            : column.id === "loan"
            ? formatCurrency(formattedTotals.loan)
            : column.id === "ca"
            ? formatCurrency(formattedTotals.ca)
            : column.id === "partial"
            ? formatCurrency(formattedTotals.partial)
            : column.id === "others"
            ? formatCurrency(formattedTotals.others)
            : column.id === "totalDeductions"
            ? formatCurrency(formattedTotals.totalDeductions)
            : column.id === "netPay"
            ? formatCurrency(formattedTotals.netPay)
            : column.id === "signature"
            ? ""
            : "",
        align:
          column.id === "name"
            ? "left"
            : column.id === "no" || column.id === "days"
            ? "center"
            : "right",
      }));

      // Draw total row with adjusted vertical positioning
      doc.font("Helvetica-Bold");
      totalRowData.forEach((cell) => {
        // Draw cell background for totals row
        if (cell.text !== "") {
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .fillAndStroke("#f5f5f5", "#000000");
        } else {
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .stroke();
        }

        doc
          .fillColor("#000000")
          .fontSize(6)
          .text(cell.text, currentX + 2, currentY + (rowHeight - 5) / 2, {
            // Adjusted vertical centering
            width: cell.width * tableWidth - 4,
            align: cell.align as
              | "center"
              | "justify"
              | "left"
              | "right"
              | undefined,
          });
        currentX += cell.width * tableWidth;
      });

      // Reset font to normal
      doc.font("Helvetica");

      // Update signature lines positioning
      const bottomMargin = 100;
      const signatureY = pageWidth - bottomMargin;
      const signatureWidth = Math.floor(desiredTableWidth / 3);
      const signatureStartX = leftMargin;

      // Draw signature lines with proper spacing
      ["Prepared by:", "Checked by:", "Approved by:"].forEach((text, index) => {
        const x = signatureStartX + signatureWidth * index;
        doc
          .fontSize(8)
          .text(text, x, signatureY, {
            width: signatureWidth,
            align: "left",
          })
          .text("_".repeat(35), x, signatureY + 20, {
            width: signatureWidth - 20,
            align: "left",
          });
      });

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
