import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ColumnVisibility {
  name: string;
  visible: boolean;
  key: string;
  isTimeColumn?: boolean;
  originalName?: string;
}

interface ColumnVisibilityState {
  columns: ColumnVisibility[];
  setColumns: (
    columns:
      | ColumnVisibility[]
      | ((cols: ColumnVisibility[]) => ColumnVisibility[])
  ) => void;
  resetToDefault: () => void;
}

const defaultColumns: ColumnVisibility[] = [
  { name: "Day", visible: true, key: "day" },
  {
    name: "Time In",
    visible: true,
    key: "timeIn",
    isTimeColumn: true,
    originalName: "Time In",
  },
  {
    name: "Time Out",
    visible: true,
    key: "timeOut",
    isTimeColumn: true,
    originalName: "Time Out",
  },
  { name: "Day Type", visible: true, key: "dayType" },
  { name: "Hours Worked", visible: true, key: "hoursWorked" },
  { name: "Overtime Minutes", visible: true, key: "overtimeMinutes" },
  { name: "Overtime Pay", visible: true, key: "overtimePay" },
  { name: "Undertime Minutes", visible: true, key: "undertimeMinutes" },
  { name: "Undertime Deduction", visible: true, key: "undertimeDeduction" },
  { name: "Late (mins)", visible: true, key: "lateMinutes" },
  { name: "Late Deduction", visible: true, key: "lateDeduction" },
  { name: "Night Diff Hours", visible: true, key: "nightDifferentialHours" },
  { name: "Night Diff Pay", visible: true, key: "nightDifferentialPay" },
  { name: "Holiday Bonus", visible: true, key: "holidayBonus" },
  { name: "Leave Type", visible: true, key: "leaveType" },
  { name: "Leave Pay", visible: true, key: "leavePay" },
  { name: "Gross Pay", visible: true, key: "grossPay" },
  { name: "Deductions", visible: true, key: "deductions" },
  { name: "Net Pay", visible: true, key: "netPay" },
];

export const useColumnVisibilityStore = create<ColumnVisibilityState>()(
  persist(
    (set, get) => {
      // Function to merge stored columns with default columns
      const mergeWithDefaultColumns = (storedColumns: ColumnVisibility[]) => {
        const mergedColumns = [...defaultColumns];

        // Preserve visibility settings from stored columns
        storedColumns.forEach((storedCol) => {
          const defaultColIndex = mergedColumns.findIndex(
            (col) => col.key === storedCol.key
          );
          if (defaultColIndex !== -1) {
            mergedColumns[defaultColIndex].visible = storedCol.visible;
          }
        });

        return mergedColumns;
      };

      // Get stored columns or use defaults
      const storedColumns =
        typeof window !== "undefined" &&
        localStorage.getItem("column-visibility-storage")
          ? JSON.parse(localStorage.getItem("column-visibility-storage")!)
          : defaultColumns;

      // Merge stored columns with defaults to ensure new columns are included
      const initialColumns = mergeWithDefaultColumns(storedColumns);

      return {
        columns: initialColumns,
        setColumns: (columns) => {
          const newColumns =
            typeof columns === "function" ? columns(get().columns) : columns;
          set({ columns: newColumns });
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "column-visibility-storage",
              JSON.stringify(newColumns)
            );
          }
        },
        resetToDefault: () => {
          set({ columns: defaultColumns });
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "column-visibility-storage",
              JSON.stringify(defaultColumns)
            );
          }
        },
      };
    },
    {
      name: "column-visibility-storage",
    }
  )
);
