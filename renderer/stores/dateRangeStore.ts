import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangeState {
  dateRange: DateRange;
  setDateRange: (startDate: Date | null, endDate: Date | null) => void;
}

// Safe storage wrapper for Electron/Next.js environment
const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return localStorage.getItem(name);
      }
      return null;
    } catch (error) {
      console.warn("Failed to read from localStorage:", error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(name, value);
      }
    } catch (error) {
      console.warn("Failed to write to localStorage:", error);
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(name);
      }
    } catch (error) {
      console.warn("Failed to remove from localStorage:", error);
    }
  },
};

export const useDateRangeStore = create<DateRangeState>()(
  persist(
    (set) => ({
      dateRange: {
        startDate: null,
        endDate: null,
      },
      setDateRange: (startDate: Date | null, endDate: Date | null) => {
        const validStartDate =
          startDate instanceof Date && !isNaN(startDate.getTime())
            ? startDate
            : null;
        const validEndDate =
          endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate : null;
        set({
          dateRange: { startDate: validStartDate, endDate: validEndDate },
        });
      },
    }),
    {
      name: "date-range-storage",
      storage: createJSONStorage(() => safeLocalStorage, {
        replacer: (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          return value;
        },
        reviver: (key, value) => {
          if (key === "startDate" || key === "endDate") {
            if (typeof value === "string") {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                return date;
              }
            }
            return null; // Return null if value is not a valid date string
          }
          return value;
        },
      }),
    }
  )
);
