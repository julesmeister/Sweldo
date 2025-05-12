import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Employee } from "@/renderer/model/employee";
import {
  EmploymentType,
  MonthSchedule,
  DailySchedule,
} from "@/renderer/model/settings";

// Define the structure of the data needed for printing
interface SchedulePrintData {
  employmentTypes: EmploymentType[];
  employeesMap: { [type: string]: Employee[] };
  allMonthSchedules: Record<string, MonthSchedule | null>;
  selectedMonth: Date;
  dateRange: Date[];
}

// Helper to format shift (similar to the original)
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

// Color management for shifts
const pdfColorSchemes = [
  "#F0FDF4", // green-50
  "#EFF6FF", // blue-50
  "#FAF5FF", // purple-50
  "#FFF7ED", // orange-50
  "#EEF2FF", // indigo-50
  "#FFF1F2", // rose-50
  "#FEFCE8", // yellow-50
  "#F0FDFA", // teal-50
  "#ECFEFF", // cyan-50
  "#ECFDF5", // emerald-50
  "#F7FEE7", // lime-50
  "#FFFBEB", // amber-50
  "#F0F9FF", // sky-50
  "#FCF4FF", // fuchsia-50
  "#FCF4F7", // pink-50
  "#F5F3FF", // violet-50
  "#FEF2F2", // red-50
  "#F8FAFC", // slate-50
  "#FAFAFA", // zinc-50
  "#FAFAFA", // neutral-50
  "#FAFAF9", // stone-50
  "#D1FAE5", // green-100
  "#DBEAFE", // blue-100
  "#F3E8FF", // purple-100
  "#FFEDD5", // orange-100
  "#E0E7FF", // indigo-100
  "#FFE4E6", // rose-100
  "#FEF9C3", // yellow-100
  "#CCFBF1", // teal-100
];

const pdfColorMap = new Map<string, string>();
let pdfNextColorIndex = 0;

function getColorForShift(timeKey: string): string {
  if (!timeKey || timeKey === "-") return "#FFFFFF";
  if (!pdfColorMap.has(timeKey)) {
    const color = pdfColorSchemes[pdfNextColorIndex];
    pdfColorMap.set(timeKey, color);
    pdfNextColorIndex = (pdfNextColorIndex + 1) % pdfColorSchemes.length;
  }
  return pdfColorMap.get(timeKey) || "#FFFFFF";
}

// Get cell color based on schedule
function getCellColor(schedule: DailySchedule | null): string {
  if (!schedule || schedule.isOff) return "#E5E7EB"; // gray-200 for OFF

  if (schedule.timeIn && schedule.timeOut) {
    const shiftKey = `${schedule.timeIn}-${schedule.timeOut}`;
    return getColorForShift(shiftKey);
  }

  return "#FEF9C3"; // yellow-100 fallback
}

// Export the function with the name matching what's imported in the component
export function generateSchedulePdf(data: SchedulePrintData): void {
  console.log("[Web PDF Generator] Starting PDF generation with data:", data);
  try {
    const {
      employmentTypes,
      employeesMap,
      allMonthSchedules,
      selectedMonth,
      dateRange,
    } = data;

    // Create PDF Document (Landscape)
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Define Layout Constants
    const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const margin = 10;

    // Add title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Duty Roster - ${selectedMonth.toLocaleString("default", {
        month: "long",
        year: "numeric",
      })}`,
      margin,
      margin
    );

    // Prepare table headers
    const tableHeaders = [
      "NAME / TYPE",
      ...dateRange.map(
        (date) => `${date.getDate()}\n${daysOfWeek[date.getDay()]}`
      ),
    ];

    // Process each employment type and its employees
    employmentTypes.forEach((empType) => {
      if (!empType.type) return;
      const employees = employeesMap[empType.type] || [];
      if (!employees.length) return;

      // Add a section title for this employment type
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${empType.type} (${employees.length} employees)`,
        margin,
        margin + 15
      );

      // Prepare table rows for this employment type
      const tableRows: any[] = [];

      employees.forEach((employee) => {
        const rowData = [employee.name];

        // Add schedule cells for each date
        dateRange.forEach((date) => {
          const dateStr = date.toISOString().split("T")[0];
          const schedule = allMonthSchedules[empType.type]?.[dateStr] || null;
          const shiftText = formatShiftForPdf(schedule);
          const cellColor = getCellColor(schedule);

          // Add the cell with the shift text and background color
          rowData.push(shiftText);
        });

        tableRows.push(rowData);
      });

      // Generate the table using jspdf-autotable
      (doc as any).autoTable({
        startY: margin + 20,
        head: [tableHeaders],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
        },
        willDrawCell: function (data: any) {
          // Skip header row
          if (data.row.index === 0) return;

          // Get the shift text and calculate background color
          const rowIndex = data.row.index - 1; // Adjust for header
          const colIndex = data.column.index;

          if (colIndex === 0) return; // Skip name column

          const dateIndex = colIndex - 1;
          if (dateIndex < dateRange.length) {
            const date = dateRange[dateIndex];
            const dateStr = date.toISOString().split("T")[0];
            const employee = employees[rowIndex];
            if (employee) {
              const schedule =
                allMonthSchedules[empType.type]?.[dateStr] || null;
              const cellColor = getCellColor(schedule);

              // Set the background color
              const rgb = hexToRgb(cellColor);
              data.cell.styles.fillColor = [rgb.r, rgb.g, rgb.b];
            }
          }
        },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: "bold" }, // Name column
        },
        styles: {
          cellPadding: 2,
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineWidth: 0.1,
        },
        margin: { left: margin, right: margin },
      });

      // Add a new page for the next employment type if needed
      if (employmentTypes.indexOf(empType) < employmentTypes.length - 1) {
        doc.addPage();
      }
    });

    // Save the PDF - in web, this downloads the file
    const filename = `Schedule-${selectedMonth.getFullYear()}-${String(
      selectedMonth.getMonth() + 1
    ).padStart(2, "0")}.pdf`;

    doc.save(filename);
    console.log("[Web PDF Generator] PDF generated successfully:", filename);
  } catch (error) {
    console.error("[Web PDF Generator] Error generating PDF:", error);
    throw error; // Re-throw for error handling in the component
  }
}

// Helper to convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace(/^#/, "");

  // Parse the hex values
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r, g, b };
}
