import PDFDocument from "pdfkit";
import fs from "fs";
import { dialog, BrowserWindow } from "electron"; // Import dialog and BrowserWindow
import {
  EmploymentType,
  DailySchedule,
  MonthSchedule,
} from "@/renderer/model/settings"; // Adjust path as needed
import { Employee } from "@/renderer/model/employee"; // Adjust path as needed
// REMOVE import { globalColorMap } from "@/renderer/lib/colorUtils";

// --- Color Logic Duplicated from renderer/lib/colorUtils.ts ---
const pdfColorSchemes = [
  "bg-green-50",
  "bg-blue-50",
  "bg-purple-50",
  "bg-orange-50",
  "bg-indigo-50",
  "bg-rose-50",
  "bg-yellow-50",
  "bg-teal-50",
  "bg-cyan-50",
  "bg-emerald-50",
  "bg-lime-50",
  "bg-amber-50",
  "bg-sky-50",
  "bg-fuchsia-50",
  "bg-pink-50",
  "bg-violet-50",
  "bg-red-50",
  "bg-slate-50",
  "bg-zinc-50",
  "bg-neutral-50",
  "bg-stone-50",
  "bg-green-100",
  "bg-blue-100",
  "bg-purple-100",
  "bg-orange-100",
  "bg-indigo-100",
  "bg-rose-100",
  "bg-yellow-100",
  "bg-teal-100",
  "bg-cyan-100",
  "bg-emerald-100",
  "bg-lime-100",
  "bg-amber-100",
  "bg-sky-100",
  "bg-fuchsia-100",
  "bg-pink-100",
  "bg-violet-100",
  "bg-red-100",
  // Added some darker variants manually if needed, or keep it simpler
  // "bg-green-200", "bg-blue-200", "bg-purple-200", "bg-orange-200",
  // "bg-indigo-200", "bg-rose-200", "bg-yellow-200", "bg-teal-200",
];
const pdfColorMap = new Map<string, string>();
let pdfNextColorIndex = 0;

function getColorClassForPdfKey(timeKey: string): string {
  if (!timeKey || timeKey === "-") return "bg-white";
  if (!pdfColorMap.has(timeKey)) {
    const colorClass = pdfColorSchemes[pdfNextColorIndex];
    pdfColorMap.set(timeKey, colorClass);
    pdfNextColorIndex = (pdfNextColorIndex + 1) % pdfColorSchemes.length;
  }
  return pdfColorMap.get(timeKey) || "bg-white";
}
// --- End of Duplicated Color Logic ---

// Define the structure of the data expected from the renderer
interface SchedulePrintData {
  employmentTypes: EmploymentType[];
  employeesMap: { [type: string]: Employee[] };
  allMonthSchedules: Record<string, MonthSchedule | null>;
  selectedMonth: Date; // Still useful for the title
  dateRange: Date[]; // Expect the filtered date range now
}

// Helper to format shift (similar to renderer, adapt as needed)
function formatShiftForPdf(schedule: DailySchedule | null): string {
  if (!schedule || schedule.isOff) return "OFF";
  if (schedule.timeIn && schedule.timeOut) {
    const formatTime = (time: string) => {
      try {
        const [hourStr, minuteStr] = time.split(":");
        let hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        if (isNaN(hour) || isNaN(minute)) return time; // Return original if parse fails

        const period = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12; // Convert 0/24 to 12
        return `${hour}${
          minute > 0 ? `:${String(minute).padStart(2, "0")}` : ""
        }${period}`;
      } catch (e) {
        return time; // Return original on error
      }
    };
    return `${formatTime(schedule.timeIn)}-${formatTime(schedule.timeOut)}`;
  }
  return "-"; // Indicate missing data
}

// Helper function to map Tailwind background classes to Hex codes
function tailwindBgToHex(className: string | null): string | null {
  if (!className) return null;
  const bgClass = className.split(" ").find((cls) => cls.startsWith("bg-"));
  if (!bgClass) return "#FFFFFF";
  const mapping: { [key: string]: string } = {
    "bg-gray-100": "#F3F4F6",
    "bg-gray-200": "#E5E7EB",
    "bg-red-50": "#FEF2F2", // Adjusted from -100
    "bg-red-100": "#FEE2E2",
    "bg-orange-50": "#FFF7ED",
    "bg-orange-100": "#FFEDD5",
    "bg-amber-50": "#FFFBEB",
    "bg-amber-100": "#FEF3C7",
    "bg-yellow-50": "#FEFCE8",
    "bg-yellow-100": "#FEF9C3",
    "bg-lime-50": "#F7FEE7",
    "bg-lime-100": "#ECFCCB",
    "bg-green-50": "#F0FDF4",
    "bg-green-100": "#D1FAE5",
    "bg-emerald-50": "#ECFDF5",
    "bg-emerald-100": "#D1FAE5",
    "bg-teal-50": "#F0FDFA",
    "bg-teal-100": "#CCFBF1",
    "bg-cyan-50": "#ECFEFF",
    "bg-cyan-100": "#CFFAFE",
    "bg-sky-50": "#F0F9FF",
    "bg-sky-100": "#E0F2FE",
    "bg-blue-50": "#EFF6FF",
    "bg-blue-100": "#DBEAFE",
    "bg-indigo-50": "#EEF2FF",
    "bg-indigo-100": "#E0E7FF",
    "bg-violet-50": "#F5F3FF",
    "bg-violet-100": "#EDE9FE",
    "bg-purple-50": "#FAF5FF",
    "bg-purple-100": "#F3E8FF",
    "bg-fuchsia-50": "#FCF4FF",
    "bg-fuchsia-100": "#FAE8FF",
    "bg-pink-50": "#FCF4F7",
    "bg-pink-100": "#FCE7F3",
    "bg-rose-50": "#FFF1F2",
    "bg-rose-100": "#FFE4E6",
    "bg-slate-50": "#F8FAFC",
    "bg-zinc-50": "#FAFAFA",
    "bg-neutral-50": "#FAFAFA",
    "bg-stone-50": "#FAFAF9",
    "bg-white": "#FFFFFF",
  };
  return mapping[bgClass] || "#FFFFFF";
}

// Updated Helper to get cell background color using the duplicated logic
function getCellColor(schedule: DailySchedule | null): string | null {
  if (!schedule || schedule.isOff) return "#E5E7EB"; // gray-200

  if (schedule.timeIn && schedule.timeOut) {
    const shiftKey = `${schedule.timeIn}-${schedule.timeOut}`;
    // Get color class using the duplicated logic
    const colorClass = getColorClassForPdfKey(shiftKey);
    const hexColor = tailwindBgToHex(colorClass);
    if (hexColor) return hexColor;

    // Fallback logic based on start hour if not found in map (should be less common now)
    try {
      const startHour = parseInt(schedule.timeIn.split(":")[0], 10);
      if (!isNaN(startHour)) {
        if (startHour < 12) return tailwindBgToHex("bg-blue-100");
        if (startHour < 18) return tailwindBgToHex("bg-green-100");
        return tailwindBgToHex("bg-indigo-100");
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  return tailwindBgToHex("bg-yellow-100"); // Default fallback
}

export async function generateSchedulePdf(
  data: SchedulePrintData,
  mainWindow: BrowserWindow // Pass the window for dialog parent
): Promise<string | null> {
  const {
    employmentTypes,
    employeesMap,
    allMonthSchedules,
    selectedMonth,
    dateRange, // Use dateRange instead of allDates
  } = data;

  // 1. Ask user where to save
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save Schedule PDF",
    defaultPath: `Schedule-${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}.pdf`,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  });

  if (canceled || !filePath) {
    return null; // User cancelled
  }

  return new Promise((resolve, reject) => {
    try {
      // 2. Create PDF Document (Landscape)
      const doc = new PDFDocument({
        // Use A4 for better international compatibility, or LETTER
        // A4 Landscape: 841.89 x 595.28 points
        // Letter Landscape: 792 x 612 points
        size: "A4",
        layout: "landscape",
        margin: 30, // Adjust margin as needed
        bufferPages: true,
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      writeStream.on("finish", () => resolve(filePath));
      writeStream.on("error", (err) => reject(err));

      // 3. Define Layout Constants
      const pageHeight =
        doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const nameColWidth = 70; // Reduced width slightly, type goes below
      const dateColCount = dateRange.length;
      const dateColWidth =
        dateColCount > 0 ? (pageWidth - nameColWidth) / dateColCount : 0;
      const headerHeight = 25;
      const tableHeaderHeight = 20;
      const rowHeight = 18; // Slightly increase row height for two lines in first col
      const titleFontSize = 12;
      const headerFontSize = 7;
      const cellFontSize = 7; // Base font size for name/shift
      const typeFontSize = 6; // Smaller for type
      const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

      // Helper function to add table row
      const drawRow = (
        employeeName: string,
        employeeType: string,
        y: number
      ) => {
        let currentX = doc.page.margins.left;
        const textPadding = 3;
        const nameY = y + textPadding; // Y pos for first line (name)
        const typeY = nameY + cellFontSize - 1; // Y pos for second line (type)

        // Draw Name/Type Cell Border
        doc.rect(currentX, y, nameColWidth, rowHeight).stroke();

        // Draw Name
        doc
          .fontSize(cellFontSize)
          .font("Helvetica-Bold")
          .text(employeeName, currentX + textPadding, nameY, {
            width: nameColWidth - textPadding * 2,
            lineBreak: false,
            ellipsis: true, // Add ellipsis if name is too long
          });

        // Draw Type below Name
        doc
          .fontSize(typeFontSize)
          .font("Helvetica")
          .fillColor("#555555") // Slightly dimmer color for type
          .text(employeeType.toUpperCase(), currentX + textPadding, typeY, {
            width: nameColWidth - textPadding * 2,
            lineBreak: false,
            ellipsis: true,
          });

        currentX += nameColWidth;

        // Draw Date Cells
        dateRange.forEach((date) => {
          const dateStr = date.toISOString().split("T")[0];
          const schedule = allMonthSchedules[employeeType]?.[dateStr] || null;
          const shiftText = formatShiftForPdf(schedule);
          const bgColor = getCellColor(schedule);
          const cellCenterY = y + rowHeight / 2 - cellFontSize / 2; // Center text vertically

          // Draw background first if color exists
          if (bgColor) {
            doc
              .rect(currentX, y, dateColWidth, rowHeight)
              .fillAndStroke(bgColor, "#AAAAAA"); // Lighter stroke
          } else {
            doc.rect(currentX, y, dateColWidth, rowHeight).stroke("#AAAAAA"); // Lighter stroke
          }

          // Draw shift text
          doc
            .fontSize(cellFontSize)
            .fillColor("#000000") // Reset to black text
            .font("Helvetica")
            .text(shiftText, currentX, cellCenterY, {
              width: dateColWidth,
              align: "center",
            });
          currentX += dateColWidth;
        });
      };

      // 4. Draw Content
      // Title
      doc
        .fontSize(titleFontSize)
        .font("Helvetica-Bold")
        .text(
          `Duty Roster - ${selectedMonth.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}`,
          doc.page.margins.left,
          doc.page.margins.top
        );

      // Table Header
      let tableStartY = doc.page.margins.top + headerHeight;
      let currentX = doc.page.margins.left;
      const headerCenterY =
        tableStartY + tableHeaderHeight / 2 - headerFontSize; // Approx center for header
      const dateNumY = tableStartY + 3;
      const dayNameY = dateNumY + headerFontSize + 1;

      // -- Name Header
      doc
        .rect(currentX, tableStartY, nameColWidth, tableHeaderHeight)
        .stroke("#AAAAAA");
      doc
        .fontSize(headerFontSize)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text("NAME / TYPE", currentX, headerCenterY, {
          width: nameColWidth,
          align: "center",
        });
      currentX += nameColWidth;

      // -- Date Headers
      dateRange.forEach((date) => {
        doc
          .rect(currentX, tableStartY, dateColWidth, tableHeaderHeight)
          .stroke("#AAAAAA");
        doc
          .fontSize(headerFontSize)
          .font("Helvetica-Bold")
          .text(String(date.getDate()), currentX, dateNumY, {
            width: dateColWidth,
            align: "center",
          });
        doc
          .fontSize(headerFontSize - 1)
          .font("Helvetica")
          .text(daysOfWeek[date.getDay()], currentX, dayNameY, {
            width: dateColWidth,
            align: "center",
          });
        currentX += dateColWidth;
      });

      // Table Rows
      let currentY = tableStartY + tableHeaderHeight;
      employmentTypes.forEach((empType) => {
        if (!empType.type) return;
        const employees = employeesMap[empType.type] || [];

        employees.forEach((employee) => {
          // Check for page break
          if (
            currentY + rowHeight >
            doc.page.height - doc.page.margins.bottom
          ) {
            doc.addPage({ size: "A4", layout: "landscape", margin: 30 });
            currentY = doc.page.margins.top;
            // Redraw table headers on new page
            let headerX = doc.page.margins.left;
            const newPageHeaderCenterY =
              currentY + tableHeaderHeight / 2 - headerFontSize;
            const newPageDateNumY = currentY + 3;
            const newPageDayNameY = newPageDateNumY + headerFontSize + 1;

            doc
              .rect(headerX, currentY, nameColWidth, tableHeaderHeight)
              .stroke("#AAAAAA");
            doc
              .fontSize(headerFontSize)
              .font("Helvetica-Bold")
              .text("NAME / TYPE", headerX, newPageHeaderCenterY, {
                width: nameColWidth,
                align: "center",
              });
            headerX += nameColWidth;
            dateRange.forEach((date) => {
              doc
                .rect(headerX, currentY, dateColWidth, tableHeaderHeight)
                .stroke("#AAAAAA");
              doc
                .fontSize(headerFontSize)
                .font("Helvetica-Bold")
                .text(String(date.getDate()), headerX, newPageDateNumY, {
                  width: dateColWidth,
                  align: "center",
                });
              doc
                .fontSize(headerFontSize - 1)
                .font("Helvetica")
                .text(daysOfWeek[date.getDay()], headerX, newPageDayNameY, {
                  width: dateColWidth,
                  align: "center",
                });
              headerX += dateColWidth;
            });
            currentY += tableHeaderHeight;
          }
          drawRow(employee.name, empType.type, currentY);
          currentY += rowHeight;
        });
      });

      // 5. Finalize PDF
      doc.end();
    } catch (error) {
      console.error("Error generating schedule PDF:", error);
      reject(error); // Reject the promise on error
    }
  });
}
