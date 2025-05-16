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
        size: [612, 936], // Long bond paper (8.5" x 13") in portrait first
        margin: 20,
        bufferPages: true,
        layout: "landscape", // This will automatically swap the dimensions to 936x612
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
      const pageHeight = 612; // Long bond paper height in landscape (8.5")

      // Calculate margins to center content
      const leftMargin = 15; // Reduced left margin
      const rightMargin = 15; // Added right margin
      const topMargin = 40; // Top margin for header
      const desiredTableWidth = pageWidth - (leftMargin + rightMargin); // Adjust table width based on margins

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
          width: pageWidth, // Changed from pageHeight to pageWidth
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
          0,
          topMargin + 15,
          {
            width: pageWidth, // Changed from pageHeight to pageWidth
            align: "center",
          }
        );

      // Add PAYROLL text
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("PAYROLL", 0, topMargin + 25, {
          width: pageWidth, // Changed from pageHeight to pageWidth
          align: "center",
        });

      // Draw table headers
      let currentX = leftMargin;
      let currentY = topMargin + headerHeight;

      // Define columns structure with adjusted widths
      const columns = [
        { id: "no", header: "No.", width: 0.02 },
        { id: "name", header: "NAME OF EMPLOYEE", width: 0.12 },
        { id: "days", header: "DAYS", width: 0.025 },
        { id: "rate", header: "RATE", width: 0.04 },
        { id: "holiday", header: "HOLIDAY", width: 0.04 },
        { id: "ot", header: "OT", width: 0.04 },
        { id: "nd", header: "ND", width: 0.04 },
        { id: "gross", header: "GROSS", width: 0.055 },
        { id: "late", header: "LATE", width: 0.04 },
        { id: "ut", header: "UT", width: 0.04 },
        { id: "sss", header: "SSS", width: 0.04 },
        { id: "philhealth", header: "PHILHEALTH", width: 0.045 },
        { id: "pagibig", header: "PAG-IBIG", width: 0.04 },
        { id: "loan", header: "LOAN", width: 0.04 },
        { id: "ca", header: "CA", width: 0.035 },
        { id: "partial", header: "PARTIAL", width: 0.04 },
        { id: "others", header: "OTHERS", width: 0.04 },
        { id: "totalDeductions", header: "TOTAL DED.", width: 0.055 },
        { id: "netPay", header: "NET PAY", width: 0.055 },
        { id: "signature", header: "SIGNATURE", width: 0.15 }, // Increased signature width
      ];

      // Draw table headers with adjusted vertical positioning
      columns.forEach((column) => {
        // Apply column color if specified
        const columnColor = options.columnColors?.[column.id];

        // Draw the cell background with the column color or white as default
        if (columnColor) {
          doc.fillColor(columnColor);
        } else {
          doc.fillColor("#FFFFFF"); // Default to white background
        }
        doc
          .rect(currentX, currentY, column.width * tableWidth, rowHeight)
          .fill();

        // Draw the cell border
        doc.strokeColor("#000000");
        doc
          .rect(currentX, currentY, column.width * tableWidth, rowHeight)
          .stroke();

        // Set text color to black for better contrast
        doc.fillColor("#000000");

        doc
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
      const rowData = sortedPayrolls.map((payroll, index) => {
        console.log("Processing row data for:", {
          employeeName: payroll.employeeName,
          deductions: payroll.deductions,
          totalDeduction: payroll.deductions.totalDeduction,
        });

        // Calculate values based on settings
        const grossPay =
          payroll.basicPay +
          (payroll.overtime || 0) +
          (payroll.holidayBonus || 0) +
          (payroll.nightDifferentialPay || 0);

        const others = options.calculationSettings?.others?.formula
          ? evaluateFormula(options.calculationSettings.others.formula, {
              sssLoan: payroll.deductions.sssLoan || 0,
              pagibigLoan: payroll.deductions.pagibigLoan || 0,
              partial: payroll.deductions.partial || 0,
              shorts: payroll.deductions.shortDeductions || 0,
              lateDeduction: payroll.lateDeduction || 0,
            })
          : payroll.deductions.others;

        // Calculate total deductions including late and undertime
        const totalDeductions =
          (payroll.lateDeduction || 0) +
          (payroll.undertimeDeduction || 0) +
          (payroll.deductions.sss || 0) +
          (payroll.deductions.philHealth || 0) +
          (payroll.deductions.pagIbig || 0) +
          (payroll.deductions.loanDeductions || 0) +
          (payroll.deductions.cashAdvanceDeductions || 0) +
          (payroll.deductions.partial || 0) +
          (payroll.deductions.shortDeductions || 0);

        console.log("Row calculations:", {
          grossPay,
          others,
          totalDeductions,
          originalTotalDeduction: payroll.deductions.totalDeduction,
        });

        return columns.map((column) => ({
          id: column.id,
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
              : column.id === "nd"
              ? formatCurrency(payroll.nightDifferentialPay || 0)
              : column.id === "ut"
              ? formatCurrency(payroll.undertimeDeduction || 0)
              : column.id === "late"
              ? formatCurrency(payroll.lateDeduction || 0)
              : column.id === "gross"
              ? formatCurrency(grossPay)
              : column.id === "sss"
              ? formatCurrency(payroll.deductions.sss || 0)
              : column.id === "philhealth"
              ? formatCurrency(payroll.deductions.philHealth || 0)
              : column.id === "pagibig"
              ? formatCurrency(payroll.deductions.pagIbig || 0)
              : column.id === "loan"
              ? formatCurrency(payroll.deductions.loanDeductions || 0)
              : column.id === "ca"
              ? formatCurrency(payroll.deductions.cashAdvanceDeductions || 0)
              : column.id === "partial"
              ? formatCurrency(0)
              : column.id === "others"
              ? formatCurrency(others || 0)
              : column.id === "totalDeductions"
              ? formatCurrency(totalDeductions)
              : column.id === "netPay"
              ? formatCurrency(grossPay - totalDeductions)
              : "",
          align:
            column.id === "name"
              ? "left"
              : column.id === "no" || column.id === "days"
              ? "center"
              : "right",
          color: options.columnColors?.[column.id] || "#000000",
        }));
      });

      // Draw data rows with adjusted vertical positioning
      rowData.forEach((row) => {
        currentX = leftMargin;
        row.forEach((cell) => {
          // Apply column color if specified
          const columnColor = options.columnColors?.[cell.id];

          // Draw the cell background with the column color or white as default
          if (columnColor) {
            doc.fillColor(columnColor);
          } else {
            doc.fillColor("#FFFFFF"); // Default to white background
          }
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .fill();

          // Draw the cell border
          doc.strokeColor("#000000");
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .stroke();

          // Set text color to black for better contrast
          doc.fillColor("#000000");

          doc
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
          // Calculate gross pay for the current employee (needed for net pay)
          const grossPay =
            curr.basicPay +
            (curr.overtime || 0) +
            (curr.holidayBonus || 0) +
            (curr.nightDifferentialPay || 0);

          // Calculate 'others' based on formula if applicable, otherwise use the value from deductions
          // Note: Ensure this logic matches the row calculation if 'others' affects total deductions
          const othersValue = options.calculationSettings?.others?.formula
            ? evaluateFormula(options.calculationSettings.others.formula, {
                sssLoan: curr.deductions.sssLoan || 0,
                pagibigLoan: curr.deductions.pagibigLoan || 0,
                partial: curr.deductions.partial || 0,
                shorts: curr.deductions.shortDeductions || 0,
                lateDeduction: curr.lateDeduction || 0,
              })
            : curr.deductions.others || 0;

          // Directly use the pre-calculated total deductions for the current employee
          const currentTotalDeductions =
            (curr.lateDeduction || 0) +
            (curr.undertimeDeduction || 0) +
            (curr.deductions.sss || 0) +
            (curr.deductions.philHealth || 0) +
            (curr.deductions.pagIbig || 0) +
            (curr.deductions.loanDeductions || 0) +
            (curr.deductions.cashAdvanceDeductions || 0) +
            (curr.deductions.partial || 0) +
            (curr.deductions.shortDeductions || 0);

          return {
            days: acc.days + curr.daysWorked,
            rate: acc.rate + (curr.dailyRate || 0), // Summing daily rates might not be meaningful, consider removing or clarifying purpose
            holiday: acc.holiday + (curr.holidayBonus || 0),
            ot: acc.ot + (curr.overtime || 0),
            nightDifferential:
              acc.nightDifferential + (curr.nightDifferentialPay || 0),
            ut: acc.ut + (curr.undertimeDeduction || 0),
            late: acc.late + (curr.lateDeduction || 0),
            gross: acc.gross + grossPay,
            sss: acc.sss + (curr.deductions.sss || 0),
            philhealth: acc.philhealth + (curr.deductions.philHealth || 0),
            pagibig: acc.pagibig + (curr.deductions.pagIbig || 0),
            loan: acc.loan + (curr.deductions.loanDeductions || 0),
            ca: acc.ca + (curr.deductions.cashAdvanceDeductions || 0),
            partial: acc.partial + (curr.deductions.partial || 0), // Sum partial if needed in total
            others: acc.others + othersValue, // Sum the calculated 'others' value
            totalDeductions: acc.totalDeductions + currentTotalDeductions, // Directly sum the employee's total deductions
            netPay: acc.netPay + (grossPay - currentTotalDeductions), // Use the same total deductions for net pay calculation
          };
        },
        {
          days: 0,
          rate: 0,
          holiday: 0,
          ot: 0,
          nightDifferential: 0,
          ut: 0,
          late: 0,
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
        rate: Number(totals.rate.toFixed(2)), // Format rate
        holiday: Number(totals.holiday.toFixed(2)),
        ot: Number(totals.ot.toFixed(2)),
        nightDifferential: Number(totals.nightDifferential.toFixed(2)),
        ut: Number(totals.ut.toFixed(2)),
        late: Number(totals.late.toFixed(2)),
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
        id: column.id,
        width: column.width,
        text:
          column.id === "no"
            ? ""
            : column.id === "name"
            ? "TOTAL"
            : column.id === "days"
            ? formattedTotals.days.toString()
            : column.id === "rate"
            ? formatCurrency(formattedTotals.rate)
            : column.id === "holiday"
            ? formatCurrency(formattedTotals.holiday)
            : column.id === "ot"
            ? formatCurrency(formattedTotals.ot)
            : column.id === "nd"
            ? formatCurrency(formattedTotals.nightDifferential || 0)
            : column.id === "gross"
            ? formatCurrency(formattedTotals.gross)
            : column.id === "ut"
            ? formatCurrency(formattedTotals.ut)
            : column.id === "late"
            ? formatCurrency(formattedTotals.late)
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
        color: options.columnColors?.[column.id] || "#000000", // Default color
      }));

      // Draw total row with adjusted vertical positioning
      doc.font("Helvetica-Bold");
      totalRowData.forEach((cell) => {
        // Apply column color if specified
        const columnColor = options.columnColors?.[cell.id];

        // Draw the cell background with the column color or light gray for total row
        if (columnColor) {
          doc.fillColor(columnColor);
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .fill();
        } else if (cell.text !== "") {
          // Use light gray for total row cells without a specific color
          doc.fillColor("#f5f5f5");
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .fill();
        } else {
          // Empty cells in total row get white background
          doc.fillColor("#FFFFFF");
          doc
            .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
            .fill();
        }

        // Draw the cell border
        doc.strokeColor("#000000");
        doc
          .rect(currentX, currentY, cell.width * tableWidth, rowHeight)
          .stroke();

        // Set text color to black for better contrast
        doc.fillColor("#000000");

        doc
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
      const bottomMargin = 80;
      const signatureY = pageHeight - bottomMargin;
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
          .text("_".repeat(40), x, signatureY + 20, {
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

// Add a function to evaluate formulas
function evaluateFormula(formula: string, data: any): number {
  try {
    console.log("Formula evaluation:", {
      formula,
      variables: data,
    });

    // Replace variable names with their values
    let evaluatedFormula = formula;
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "number") {
        evaluatedFormula = evaluatedFormula.replace(
          new RegExp(key, "g"),
          value.toString()
        );
      }
    }

    console.log("Processed formula:", evaluatedFormula);

    // Evaluate the formula
    const result = eval(evaluatedFormula);
    console.log("Formula result:", result);
    return result;
  } catch (error) {
    console.error("Error evaluating formula:", {
      error,
      formula,
      data,
    });
    return 0;
  }
}

// Update the data row population logic
function drawDataRows(
  doc: PDFKit.PDFDocument,
  payrolls: PayrollSummary[],
  options: PDFGeneratorOptions
) {
  payrolls.forEach((payroll, index) => {
    // Calculate values based on settings
    const grossPay =
      payroll.basicPay +
      (payroll.overtime || 0) +
      (payroll.holidayBonus || 0) +
      (payroll.nightDifferentialPay || 0);

    const others = options.calculationSettings?.others?.formula
      ? evaluateFormula(options.calculationSettings.others.formula, {
          sssLoan: payroll.deductions.sssLoan || 0,
          pagibigLoan: payroll.deductions.pagibigLoan || 0,
          partial: payroll.deductions.partial || 0,
          shorts: payroll.deductions.shortDeductions || 0,
          lateDeduction: payroll.lateDeduction || 0,
        })
      : payroll.deductions.others;

    const totalDeductions =
      (payroll.deductions.sss || 0) +
      (payroll.deductions.philHealth || 0) +
      (payroll.deductions.pagIbig || 0) +
      (payroll.deductions.cashAdvanceDeductions || 0) +
      (payroll.deductions.shortDeductions || 0) +
      (payroll.lateDeduction || 0) +
      (payroll.undertimeDeduction || 0);

    // Update the text for each column
    const columnTexts: { [key: string]: string } = {
      GROSS: grossPay?.toFixed(2) || "0.00",
      OTHERS: others?.toFixed(2) || "0.00",
      "TOTAL DED.": totalDeductions.toFixed(2),
      "NET PAY": (grossPay - totalDeductions).toFixed(2),
    };
  });
}
