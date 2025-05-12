// Re-export the function for simplicity and add types to avoid any issues
import { EmploymentType, MonthSchedule } from "@/renderer/model/settings";
import { Employee } from "@/renderer/model/employee";

// Define the type explicitly to match what's expected
export interface SchedulePrintData {
  employmentTypes: EmploymentType[];
  employeesMap: { [type: string]: Employee[] };
  allMonthSchedules: Record<string, MonthSchedule | null>;
  selectedMonth: Date;
  dateRange: Date[];
}

export { generateSchedulePdf } from "./web/schedulePDF";
