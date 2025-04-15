import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  IoWalletOutline,
  IoAddOutline,
  IoTrashOutline,
  IoTimeOutline,
  IoCalendarOutline,
  IoChevronBack,
  IoChevronForward,
} from "react-icons/io5";
import { toast } from "sonner";
import { EmploymentType } from "../model/settings";
import { Tooltip } from "./Tooltip";
import { useSchedulePrint } from "../hooks/useSchedulePrint";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import { useSettingsStore } from "../stores/settingsStore";

interface ScheduleSettingsProps {
  employmentTypes: EmploymentType[];
  onSave: (types: EmploymentType[]) => Promise<void>;
}

// Add new interfaces for month-specific schedules
interface DailySchedule {
  timeIn: string;
  timeOut: string;
  isOff?: boolean;
}

interface MonthSchedule {
  [date: string]: DailySchedule; // Format: "YYYY-MM-DD"
}

interface EmploymentTypeWithMonthSchedules extends EmploymentType {
  monthSchedules: {
    [yearMonth: string]: MonthSchedule;
  };
}

interface MonthScheduleData {
  schedule: DailySchedule;
  dayOfWeek: number;
}

interface CopiedMonthSchedule {
  schedules: { [key: number]: MonthScheduleData };
  sourceMonth: number;
  sourceYear: number;
}

// Move these utility functions outside both components
const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => i + 1);
};

const getDayOfWeek = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day; // Convert Sunday from 0 to 7
};

// Add this before the MonthScheduleView component
const globalColorMap = {
  colorSchemes: [
    // Original colors
    "bg-green-50 border-green-200 hover:border-green-300",
    "bg-blue-50 border-blue-200 hover:border-blue-300",
    "bg-purple-50 border-purple-200 hover:border-purple-300",
    "bg-orange-50 border-orange-200 hover:border-orange-300",
    "bg-indigo-50 border-indigo-200 hover:border-indigo-300",
    "bg-rose-50 border-rose-200 hover:border-rose-300",
    "bg-yellow-50 border-yellow-200 hover:border-yellow-300",
    "bg-teal-50 border-teal-200 hover:border-teal-300",
    "bg-cyan-50 border-cyan-200 hover:border-cyan-300",
    "bg-emerald-50 border-emerald-200 hover:border-emerald-300",
    "bg-lime-50 border-lime-200 hover:border-lime-300",
    "bg-amber-50 border-amber-200 hover:border-amber-300",
    "bg-sky-50 border-sky-200 hover:border-sky-300",
    "bg-fuchsia-50 border-fuchsia-200 hover:border-fuchsia-300",
    "bg-pink-50 border-pink-200 hover:border-pink-300",
    "bg-violet-50 border-violet-200 hover:border-violet-300",
    // Additional lighter shades
    "bg-red-50 border-red-200 hover:border-red-300",
    "bg-slate-50 border-slate-200 hover:border-slate-300",
    "bg-zinc-50 border-zinc-200 hover:border-zinc-300",
    "bg-neutral-50 border-neutral-200 hover:border-neutral-300",
    "bg-stone-50 border-stone-200 hover:border-stone-300",
    // Slightly darker variations
    "bg-green-100 border-green-300 hover:border-green-400",
    "bg-blue-100 border-blue-300 hover:border-blue-400",
    "bg-purple-100 border-purple-300 hover:border-purple-400",
    "bg-orange-100 border-orange-300 hover:border-orange-400",
    "bg-indigo-100 border-indigo-300 hover:border-indigo-400",
    "bg-rose-100 border-rose-300 hover:border-rose-400",
    "bg-yellow-100 border-yellow-300 hover:border-yellow-400",
    "bg-teal-100 border-teal-300 hover:border-teal-400",
    "bg-cyan-100 border-cyan-300 hover:border-cyan-400",
    "bg-emerald-100 border-emerald-300 hover:border-emerald-400",
    // Even more variations
    "bg-lime-100 border-lime-300 hover:border-lime-400",
    "bg-amber-100 border-amber-300 hover:border-amber-400",
    "bg-sky-100 border-sky-300 hover:border-sky-400",
    "bg-fuchsia-100 border-fuchsia-300 hover:border-fuchsia-400",
    "bg-pink-100 border-pink-300 hover:border-pink-400",
    "bg-violet-100 border-violet-300 hover:border-violet-400",
    // Super light pastels
    "bg-red-50/70 border-red-200 hover:border-red-300",
    "bg-blue-50/70 border-blue-200 hover:border-blue-300",
    "bg-green-50/70 border-green-200 hover:border-green-300",
    "bg-yellow-50/70 border-yellow-200 hover:border-yellow-300",
    "bg-purple-50/70 border-purple-200 hover:border-purple-300",
    // Mixed variations
    "bg-indigo-50/80 border-indigo-200 hover:border-indigo-300",
    "bg-teal-50/80 border-teal-200 hover:border-teal-300",
    "bg-rose-50/80 border-rose-200 hover:border-rose-300",
    "bg-cyan-50/80 border-cyan-200 hover:border-cyan-300",
    "bg-emerald-50/80 border-emerald-200 hover:border-emerald-300",
    // Additional mixed variations
    "bg-lime-50/80 border-lime-200 hover:border-lime-300",
    "bg-amber-50/80 border-amber-200 hover:border-amber-300",
    "bg-sky-50/80 border-sky-200 hover:border-sky-300",
    "bg-fuchsia-50/80 border-fuchsia-200 hover:border-fuchsia-300",
    "bg-pink-50/80 border-pink-200 hover:border-pink-300",
    "bg-violet-50/80 border-violet-200 hover:border-violet-300",
  ],
  mappings: new Map(),
  nextColorIndex: 0,
  getColor(timeKey: string): string {
    if (!timeKey || timeKey === "-") return "bg-white border-gray-200";

    if (!this.mappings.has(timeKey)) {
      const color = this.colorSchemes[this.nextColorIndex];
      this.mappings.set(timeKey, color);
      this.nextColorIndex =
        (this.nextColorIndex + 1) % this.colorSchemes.length;
    }
    return this.mappings.get(timeKey) || "bg-white border-gray-200";
  },
};

// MonthScheduleView component definition with getScheduleColor inside it
const MonthScheduleView = React.memo(
  ({
    type,
    selectedMonth,
    onMonthChange,
    onUpdateSchedule,
    copiedSchedule,
    onCopySchedule,
    getScheduleForDate,
    onClearSchedules,
    monthSchedules = {},
  }: {
    type: EmploymentTypeWithMonthSchedules;
    selectedMonth: Date;
    onMonthChange: (newDate: Date) => void;
    onUpdateSchedule: (
      typeId: string,
      date: Date,
      schedule: DailySchedule
    ) => void;
    copiedSchedule: { timeIn: string; timeOut: string } | null;
    onCopySchedule: (schedule: { timeIn: string; timeOut: string }) => void;
    getScheduleForDate: (typeId: string, date: Date) => DailySchedule;
    onClearSchedules: () => void;
    monthSchedules?: {
      [typeId: string]: { [yearMonth: string]: MonthSchedule };
    };
  }) => {
    // Remove the reset effect and replace with initialization effect
    React.useEffect(() => {
      // Pre-populate colors for all existing schedules in this month
      const yearMonth = selectedMonth.toISOString().slice(0, 7);
      const monthData = monthSchedules[type.type]?.[yearMonth] || {};

      // Get all unique time combinations first
      const uniqueCombinations = new Set();
      Object.values(monthData).forEach((schedule) => {
        if (schedule.timeIn && schedule.timeOut && !schedule.isOff) {
          uniqueCombinations.add(`${schedule.timeIn}-${schedule.timeOut}`);
        }
      });

      // Assign colors to all unique combinations
      uniqueCombinations.forEach((timeKey) => {
        globalColorMap.getColor(timeKey as string);
      });
    }, [selectedMonth, type.type, monthSchedules]);

    const getScheduleColor = (
      timeIn: string,
      timeOut: string,
      isOff?: boolean
    ) => {
      if (isOff) return "bg-gray-50 border-gray-200";
      if (
        !timeIn ||
        !timeOut ||
        timeIn.trim() === "" ||
        timeOut.trim() === ""
      ) {
        return "bg-white border-gray-200";
      }

      const timeKey = `${timeIn}-${timeOut}`;
      return globalColorMap.getColor(timeKey);
    };

    const days = getDaysInMonth(selectedMonth);
    const firstDayOfMonth = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      1
    );
    const startingDayOfWeek = getDayOfWeek(firstDayOfMonth);

    const handleMonthChange = (direction: "prev" | "next") => {
      const newDate = new Date(selectedMonth);
      newDate.setMonth(newDate.getMonth() + (direction === "prev" ? -1 : 1));
      onMonthChange(newDate);
    };

    // Update state with proper typing
    const [copiedMonthSchedule, setCopiedMonthSchedule] =
      React.useState<CopiedMonthSchedule | null>(null);

    const handleCopyMonth = () => {
      const schedules: { [key: number]: MonthScheduleData } = {};

      getDaysInMonth(selectedMonth).forEach((day) => {
        const date = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth(),
          day
        );
        const schedule = getScheduleForDate(type.type, date);
        schedules[day] = {
          schedule,
          dayOfWeek: date.getDay(),
        };
      });

      setCopiedMonthSchedule({
        schedules,
        sourceMonth: selectedMonth.getMonth(),
        sourceYear: selectedMonth.getFullYear(),
      });
      toast.success("Monthly schedule copied");
    };

    const handlePasteMonth = () => {
      if (!copiedMonthSchedule) return;

      const targetDays = getDaysInMonth(selectedMonth);

      // Apply schedules based on the day of the month
      targetDays.forEach((day) => {
        // Only paste if we have a schedule for this day number
        if (copiedMonthSchedule.schedules[day]) {
          const targetDate = new Date(
            selectedMonth.getFullYear(),
            selectedMonth.getMonth(),
            day
          );
          onUpdateSchedule(
            type.type,
            targetDate,
            copiedMonthSchedule.schedules[day].schedule
          );
        }
      });

      toast.success("Monthly schedule pasted");
    };

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleMonthChange("prev")}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <IoChevronBack className="w-5 h-5" />
            </button>
            <h4 className="text-lg font-medium text-gray-900">
              {selectedMonth.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            <button
              type="button"
              onClick={() => handleMonthChange("next")}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <IoChevronForward className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMonth}
              className="px-3 py-1.5 text-sm border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              Copy Month
            </button>
            {copiedMonthSchedule && (
              <button
                type="button"
                onClick={handlePasteMonth}
                className="px-3 py-1.5 text-sm border border-green-200 text-green-600 rounded-md hover:bg-green-50 transition-colors flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
                Paste Month
              </button>
            )}
            <button
              type="button"
              onClick={onClearSchedules}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <IoTrashOutline className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="text-center font-medium text-gray-600 py-2"
            >
              {day}
            </div>
          ))}

          {/* Empty cells for days before the first of the month */}
          {Array.from({ length: startingDayOfWeek - 1 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 bg-gray-50 rounded-lg" />
          ))}

          {/* Calendar days */}
          {days.map((day) => {
            const date = new Date(
              selectedMonth.getFullYear(),
              selectedMonth.getMonth(),
              day
            );
            const schedule = getScheduleForDate(type.type, date);

            // Update how we get currentMonthSchedules
            const currentMonthSchedules = Object.values(
              monthSchedules[type.type]?.[date.toISOString().slice(0, 7)] || {}
            ).filter(
              (s): s is DailySchedule =>
                typeof s === "object" &&
                s !== null &&
                "timeIn" in s &&
                "timeOut" in s
            );

            const scheduleColor = getScheduleColor(
              schedule.timeIn,
              schedule.timeOut,
              schedule.isOff
            );

            return (
              <div
                key={day}
                className={`h-32 p-2 rounded-lg border ${scheduleColor} hover:bg-opacity-90 transition-colors`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium">{day}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onCopySchedule({
                          timeIn: schedule.timeIn || "",
                          timeOut: schedule.timeOut || "",
                        });
                        toast.success("Schedule copied");
                      }}
                      className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    </button>
                    {copiedSchedule && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onUpdateSchedule(type.type, date, {
                            timeIn: copiedSchedule.timeIn,
                            timeOut: copiedSchedule.timeOut,
                            isOff: false,
                          });
                          toast.success("Schedule pasted");
                        }}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path
                            fillRule="evenodd"
                            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onUpdateSchedule(type.type, date, {
                            timeIn: "",
                            timeOut: "",
                            isOff: !schedule.isOff,
                          });
                        }}
                        className={`px-2 py-0.5 text-xs rounded ${
                          schedule.isOff
                            ? "bg-blue-100 text-blue-700"
                            : !schedule.timeIn && !schedule.timeOut
                            ? "bg-gray-100 text-gray-700"
                            : !schedule.timeIn || !schedule.timeOut
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {schedule.isOff
                          ? "Off"
                          : !schedule.timeIn && !schedule.timeOut
                          ? "Day Off"
                          : !schedule.timeIn || !schedule.timeOut
                          ? "Missing"
                          : "Working"}
                      </button>
                      {!schedule.isOff && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onUpdateSchedule(type.type, date, {
                              timeIn: "",
                              timeOut: "",
                              isOff: false,
                            });
                            toast.success("Schedule cleared");
                          }}
                          className="absolute inset-0 px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-auto"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!schedule.isOff && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="time"
                      value={schedule.timeIn || ""}
                      onChange={(e) => {
                        onUpdateSchedule(type.type, date, {
                          ...schedule,
                          timeIn: e.target.value,
                        });
                      }}
                      className="w-full text-xs p-1 rounded border border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20"
                    />
                    <input
                      type="time"
                      value={schedule.timeOut || ""}
                      onChange={(e) => {
                        onUpdateSchedule(type.type, date, {
                          ...schedule,
                          timeOut: e.target.value,
                        });
                      }}
                      className="w-full text-xs p-1 rounded border border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

export default function ScheduleSettings({
  employmentTypes: initialEmploymentTypes,
  onSave,
}: ScheduleSettingsProps) {
  const [employmentTypes, setEmploymentTypes] = React.useState<
    EmploymentTypeWithMonthSchedules[]
  >(() => initialEmploymentTypes as EmploymentTypeWithMonthSchedules[]);
  const [selectedTypeTab, setSelectedTypeTab] = React.useState(0);
  const [selectedDayTab, setSelectedDayTab] = React.useState(0);
  const [copiedSchedule, setCopiedSchedule] = React.useState<{
    timeIn: string;
    timeOut: string;
  } | null>(null);
  const [fixedTimeSchedule, setFixedTimeSchedule] = React.useState<{
    [key: number]: boolean;
  }>({});
  const [requiresTimeTracking, setRequiresTimeTracking] = React.useState<{
    [key: number]: boolean;
  }>(() =>
    initialEmploymentTypes.reduce((acc, type, index) => {
      acc[index] = type.requiresTimeTracking;
      return acc;
    }, {} as { [key: number]: boolean })
  );

  // Update scheduleMode initialization to check for existing monthly data
  const [scheduleMode, setScheduleMode] = React.useState<"weekly" | "monthly">(
    () => {
      // Check if any employment type has month-specific schedules
      const hasMonthlyData = initialEmploymentTypes.some(
        (type) =>
          type.monthSchedules && Object.keys(type.monthSchedules).length > 0
      );
      return hasMonthlyData ? "monthly" : "weekly";
    }
  );

  const [selectedMonth, setSelectedMonth] = React.useState<Date>(new Date());
  const [monthSchedules, setMonthSchedules] = React.useState<{
    [typeId: string]: {
      [yearMonth: string]: MonthSchedule;
    };
  }>(() => {
    console.log("Initializing monthSchedules with:", initialEmploymentTypes);
    const initialSchedules: {
      [typeId: string]: {
        [yearMonth: string]: MonthSchedule;
      };
    } = {};

    initialEmploymentTypes.forEach((type) => {
      initialSchedules[type.type] = {};
      // Initialize current month
      const currentYearMonth = new Date().toISOString().slice(0, 7);
      initialSchedules[type.type][currentYearMonth] = {};
    });

    console.log("Initial monthSchedules:", initialSchedules);
    return initialSchedules;
  });
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  // Add effect to load monthly schedules from employment types
  React.useEffect(() => {
    const loadedSchedules: {
      [typeId: string]: {
        [yearMonth: string]: MonthSchedule;
      };
    } = {};
    employmentTypes.forEach((type) => {
      if (type.monthSchedules) {
        loadedSchedules[type.type] = type.monthSchedules;
      }
    });
    // Only update if there are actual changes
    if (JSON.stringify(loadedSchedules) !== JSON.stringify(monthSchedules)) {
      setMonthSchedules(loadedSchedules);
    }
  }, [employmentTypes]);

  // Add function to clear monthly schedules
  const clearMonthlySchedules = () => {
    const clearedSchedules: {
      [typeId: string]: {
        [yearMonth: string]: MonthSchedule;
      };
    } = {};

    // Initialize empty schedules for each employment type
    employmentTypes.forEach((type) => {
      clearedSchedules[type.type] = {};
    });

    setMonthSchedules(clearedSchedules);
    toast.success("Monthly schedules cleared");
  };

  React.useEffect(() => {
    const updatedRequiresTimeTracking = employmentTypes.reduce(
      (acc, type, index) => {
        acc[index] = type.requiresTimeTracking;
        return acc;
      },
      {} as { [key: number]: boolean }
    );
    // Only update if there are actual changes
    if (
      JSON.stringify(updatedRequiresTimeTracking) !==
      JSON.stringify(requiresTimeTracking)
    ) {
      setRequiresTimeTracking(updatedRequiresTimeTracking);
    }

    // Initialize schedules for types that require time tracking
    const updatedTypes = employmentTypes.map((type) => {
      if (
        type.requiresTimeTracking &&
        (!type.schedules || type.schedules.length === 0)
      ) {
        return {
          ...type,
          schedules: [
            { dayOfWeek: 1, timeIn: "", timeOut: "" },
            { dayOfWeek: 2, timeIn: "", timeOut: "" },
            { dayOfWeek: 3, timeIn: "", timeOut: "" },
            { dayOfWeek: 4, timeIn: "", timeOut: "" },
            { dayOfWeek: 5, timeIn: "", timeOut: "" },
            { dayOfWeek: 6, timeIn: "", timeOut: "" },
            { dayOfWeek: 7, timeIn: "", timeOut: "" },
          ],
        };
      }
      return type;
    });

    // Only update if there are actual changes
    if (JSON.stringify(updatedTypes) !== JSON.stringify(employmentTypes)) {
      console.log("Updating employment types with schedules:", updatedTypes);
      setEmploymentTypes(updatedTypes as EmploymentTypeWithMonthSchedules[]);
    }
  }, [employmentTypes]);

  // Add effect to sync with parent component
  React.useEffect(() => {
    // Only update if there are actual changes
    if (
      JSON.stringify(employmentTypes) !== JSON.stringify(initialEmploymentTypes)
    ) {
      setEmploymentTypes(
        initialEmploymentTypes as EmploymentTypeWithMonthSchedules[]
      );
    }
  }, [initialEmploymentTypes]);

  const [timeOff, setTimeOff] = React.useState<{
    [key: string]: { [key: number]: boolean };
  }>({});

  const handleFixedTimeChange = (index: number, value: boolean) => {
    setFixedTimeSchedule((prev) => ({ ...prev, [index]: value }));
    if (value && employmentTypes[index].schedules) {
      const mondaySchedule = employmentTypes[index].schedules[0];
      const updatedTypes = employmentTypes.map((type, i) => {
        if (i === index) {
          return {
            ...type,
            schedules: type.schedules?.map((schedule, dayIndex) => {
              return dayIndex < 6
                ? {
                    ...schedule,
                    timeIn: mondaySchedule.timeIn,
                    timeOut: mondaySchedule.timeOut,
                  }
                : schedule;
            }),
          };
        }
        return type;
      });
      setEmploymentTypes(updatedTypes as EmploymentTypeWithMonthSchedules[]);
    }
  };

  const handleAddEmploymentType = () => {
    setEmploymentTypes([
      ...employmentTypes,
      {
        type: "",
        schedules: [
          { dayOfWeek: 1, timeIn: "", timeOut: "" }, // Monday
          { dayOfWeek: 2, timeIn: "", timeOut: "" }, // Tuesday
          { dayOfWeek: 3, timeIn: "", timeOut: "" }, // Wednesday
          { dayOfWeek: 4, timeIn: "", timeOut: "" }, // Thursday
          { dayOfWeek: 5, timeIn: "", timeOut: "" }, // Friday
          { dayOfWeek: 6, timeIn: "", timeOut: "" }, // Saturday
          { dayOfWeek: 7, timeIn: "", timeOut: "" }, // Sunday
        ],
        requiresTimeTracking: true,
        monthSchedules: {},
      },
    ] as EmploymentTypeWithMonthSchedules[]);
  };

  const handleRemoveEmploymentType = (index: number) => {
    // If we're removing the currently selected tab or a tab before it,
    // adjust the selected tab index
    if (index <= selectedTypeTab) {
      // If we're removing the last tab, select the new last tab
      if (index === employmentTypes.length - 1) {
        setSelectedTypeTab(Math.max(0, employmentTypes.length - 2));
      } else {
        // Otherwise, stay on the same visual position by decreasing the index
        setSelectedTypeTab(Math.max(0, selectedTypeTab - 1));
      }
    }

    // Remove the employment type
    const newTypes = employmentTypes.filter((_, i) => i !== index);
    setEmploymentTypes(newTypes);
    onSave(newTypes);
  };

  // Update handleEmploymentTypeChange to handle schedule mode
  const handleEmploymentTypeChange = (
    index: number,
    field:
      | "type"
      | "requiresTimeTracking"
      | "hoursOfWork"
      | `schedules.${number}.timeIn`
      | `schedules.${number}.timeOut`,
    value: string | boolean | number
  ) => {
    const updatedTypes = [...employmentTypes];

    if (field.startsWith("schedules.")) {
      const [, dayIndex, timeField] = field.split(".");
      const schedules = updatedTypes[index].schedules || [
        { dayOfWeek: 1, timeIn: "", timeOut: "" },
        { dayOfWeek: 2, timeIn: "", timeOut: "" },
        { dayOfWeek: 3, timeIn: "", timeOut: "" },
        { dayOfWeek: 4, timeIn: "", timeOut: "" },
        { dayOfWeek: 5, timeIn: "", timeOut: "" },
        { dayOfWeek: 6, timeIn: "", timeOut: "" },
        { dayOfWeek: 7, timeIn: "", timeOut: "" },
      ];

      const updatedSchedules = [...schedules];
      if (
        fixedTimeSchedule[index] &&
        Number(dayIndex) === 0 &&
        (timeField === "timeIn" || timeField === "timeOut")
      ) {
        // If it's Monday (dayIndex 0) and fixedTimeSchedule is enabled, update Tuesday through Saturday
        for (let day = 0; day < 6; day++) {
          updatedSchedules[day] = {
            ...updatedSchedules[day],
            [timeField]: value,
          };
        }
      } else {
        updatedSchedules[Number(dayIndex)] = {
          ...updatedSchedules[Number(dayIndex)],
          [timeField]: value,
        };
      }

      updatedTypes[index] = {
        ...updatedTypes[index],
        schedules: updatedSchedules,
      };
    } else if (field === "requiresTimeTracking") {
      const requiresTimeTracking = value as boolean;
      updatedTypes[index] = {
        ...updatedTypes[index],
        requiresTimeTracking,
        schedules: requiresTimeTracking
          ? [
              { dayOfWeek: 1, timeIn: "", timeOut: "" },
              { dayOfWeek: 2, timeIn: "", timeOut: "" },
              { dayOfWeek: 3, timeIn: "", timeOut: "" },
              { dayOfWeek: 4, timeIn: "", timeOut: "" },
              { dayOfWeek: 5, timeIn: "", timeOut: "" },
              { dayOfWeek: 6, timeIn: "", timeOut: "" },
              { dayOfWeek: 7, timeIn: "", timeOut: "" },
            ]
          : undefined,
      };
    } else {
      const formattedValue =
        field === "type" && typeof value === "string"
          ? value.toLowerCase().replace(/\s+/g, "-")
          : value;
      updatedTypes[index] = {
        ...updatedTypes[index],
        [field]: formattedValue,
      };
    }

    setEmploymentTypes(updatedTypes);
  };

  const handleSaveEmploymentTypes = async () => {
    try {
      // Prepare employment types with both weekly and monthly schedules
      const updatedTypes = employmentTypes.map((type) => ({
        ...type,
        monthSchedules: monthSchedules[type.type] || {},
      }));

      console.log("ScheduleSettings saving employment types:", updatedTypes);
      await onSave(updatedTypes);
      toast.success("Employment types saved successfully");
    } catch (error) {
      console.error("Error saving employment types:", error);
      toast.error("Failed to save employment types");
    }
  };

  // Function to format date as YYYY-MM-DD
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  // Function to update schedule for a specific date
  const handleUpdateSchedule = React.useCallback(
    (typeId: string, date: Date, schedule: DailySchedule) => {
      const dateStr = formatDate(date);
      const yearMonth = date.toISOString().slice(0, 7);

      setMonthSchedules((prev) => {
        const newSchedules = { ...prev };
        if (!newSchedules[typeId]) {
          newSchedules[typeId] = {};
        }
        if (!newSchedules[typeId][yearMonth]) {
          newSchedules[typeId][yearMonth] = {};
        }
        newSchedules[typeId][yearMonth][dateStr] = schedule;
        return newSchedules;
      });
    },
    []
  );

  // Function to get schedule for a specific date
  const getScheduleForDate = (typeId: string, date: Date): DailySchedule => {
    const dateStr = formatDate(date);
    const yearMonth = date.toISOString().slice(0, 7);

    // Return empty schedule if structure doesn't exist
    if (!monthSchedules[typeId] || !monthSchedules[typeId][yearMonth]) {
      return { timeIn: "", timeOut: "", isOff: false };
    }

    return (
      monthSchedules[typeId][yearMonth][dateStr] || {
        timeIn: "",
        timeOut: "",
        isOff: false,
      }
    );
  };

  // Initialize month schedules structure when needed
  const initializeMonthSchedule = React.useCallback(
    (typeId: string, yearMonth: string) => {
      setMonthSchedules((prev) => {
        // If structure already exists, don't update
        if (prev[typeId]?.[yearMonth]) return prev;

        return {
          ...prev,
          [typeId]: {
            ...prev[typeId],
            [yearMonth]: {},
          },
        };
      });
    },
    []
  );

  // Effect to initialize schedules when type or month changes
  React.useEffect(() => {
    employmentTypes.forEach((type) => {
      const yearMonth = selectedMonth.toISOString().slice(0, 7);
      initializeMonthSchedule(type.type, yearMonth);
    });
  }, [employmentTypes, selectedMonth, initializeMonthSchedule]);

  // Move these functions outside the render
  const handleMonthChange = React.useCallback((newDate: Date) => {
    setSelectedMonth(newDate);
  }, []);

  const handleScheduleChange = (
    index: number,
    dayIndex: number,
    field: "timeIn" | "timeOut",
    value: string
  ) => {
    handleEmploymentTypeChange(
      index,
      `schedules.${dayIndex}.${field}` as
        | `schedules.${number}.timeIn`
        | `schedules.${number}.timeOut`,
      value
    );
  };

  React.useEffect(() => {
    console.log("[DEBUG] Schedule mode changed to:", scheduleMode);
  }, [scheduleMode]);

  const { handlePrintSchedules } = useSchedulePrint({
    employmentTypes,
    selectedMonth,
    getScheduleForDate,
    getDaysInMonth,
  });

  const [employeesMap, setEmployeesMap] = useState<{
    [type: string]: Employee[];
  }>({});
  const { dbPath } = useSettingsStore();
  const employeeModel = useMemo(() => createEmployeeModel(dbPath), [dbPath]);

  // Add effect to load employees
  useEffect(() => {
    const loadEmployees = async () => {
      if (!dbPath) {
        console.warn("Database path not set");
        return;
      }

      try {
        const loadedEmployees = await employeeModel.loadActiveEmployees();

        // Group employees by employment type
        const groupedEmployees = loadedEmployees.reduce((acc, employee) => {
          const type =
            employee.employmentType?.toLowerCase().replace(/\s+/g, "-") || "";
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push(employee);
          return acc;
        }, {} as { [type: string]: Employee[] });

        setEmployeesMap(groupedEmployees);
      } catch (error) {
        console.error("Error loading employees:", error);
        setEmployeesMap({});
      }
    };

    loadEmployees();
  }, [dbPath, employeeModel]);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-200/50 shadow-lg shadow-gray-200/20">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <IoWalletOutline className="w-6 h-6 text-blue-600" />
              </div>
              Employment Types
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">
                Schedule Mode:
              </span>
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => setScheduleMode("weekly")}
                  className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 ${
                    scheduleMode === "weekly"
                      ? "bg-blue-100 text-blue-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  Weekly Pattern
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("monthly")}
                  className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 ${
                    scheduleMode === "monthly"
                      ? "bg-blue-100 text-blue-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  Month Specific
                </button>
              </div>
              <button
                onClick={handleAddEmploymentType}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200 border border-blue-100 hover:border-blue-200"
              >
                <IoAddOutline className="w-5 h-5" />
                Add Employment Type
              </button>

              {scheduleMode === "monthly" && (
                <button
                  onClick={handlePrintSchedules}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-all duration-200 border border-purple-100 hover:border-purple-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Print Schedules
                </button>
              )}
            </div>
          </div>
          <div className="space-y-8">
            <div className="col-span-2">
              <div className="space-y-6">
                <div className="relative bg-gradient-to-b from-white to-gray-50/80 rounded-xl border border-gray-200/50 p-2 shadow-sm">
                  <div className="relative">
                    {/* Scroll shadows */}
                    <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white via-white to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white to-transparent z-10 pointer-events-none" />

                    {/* Left scroll button */}
                    <button
                      onClick={scrollLeft}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-white shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
                    >
                      <IoChevronBack className="w-4 h-4" />
                    </button>

                    {/* Right scroll button */}
                    <button
                      onClick={scrollRight}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-white shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
                    >
                      <IoChevronForward className="w-4 h-4" />
                    </button>

                    {/* Scrollable container */}
                    <div
                      className="overflow-x-auto scrollbar-thin"
                      ref={scrollContainerRef}
                    >
                      <nav
                        className="flex gap-2 min-w-full px-12 py-1"
                        aria-label="Employment Types"
                      >
                        {employmentTypes.map((type, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedTypeTab(index)}
                            className={`group relative min-w-[180px] flex flex-col items-start justify-center gap-2 p-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                              selectedTypeTab === index
                                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30"
                                : "bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 shadow-sm hover:shadow-md border border-gray-200/50"
                            }`}
                          >
                            <div className="relative w-full">
                              <div className="relative z-10 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`p-1.5 rounded-lg ${
                                      selectedTypeTab === index
                                        ? "bg-white/10"
                                        : "bg-blue-50"
                                    }`}
                                  >
                                    <IoWalletOutline
                                      className={`w-4 h-4 ${
                                        selectedTypeTab === index
                                          ? "text-white"
                                          : "text-blue-500"
                                      }`}
                                    />
                                  </div>
                                  <span className="font-semibold">
                                    {type.type || `Type ${index + 1}`}
                                  </span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 text-[11px] rounded-full transition-all duration-200 font-medium ${
                                    selectedTypeTab === index
                                      ? "bg-white/10 text-white"
                                      : "bg-blue-50 text-blue-600"
                                  }`}
                                >
                                  {scheduleMode === "weekly"
                                    ? `${
                                        type.schedules?.filter(
                                          (s) => s.timeIn && s.timeOut
                                        ).length || 0
                                      }/${type.schedules?.length || 0}`
                                    : `${
                                        Object.values(
                                          type.monthSchedules?.[
                                            selectedMonth
                                              .toISOString()
                                              .slice(0, 7)
                                          ] || {}
                                        ).filter((s) => s.timeIn && s.timeOut)
                                          .length || 0
                                      }/${new Date(
                                        selectedMonth.getFullYear(),
                                        selectedMonth.getMonth() + 1,
                                        0
                                      ).getDate()}`}
                                </span>
                              </div>
                            </div>
                            <div
                              className={`w-full flex items-center gap-2 text-xs ${
                                selectedTypeTab === index
                                  ? "text-white/90"
                                  : "text-gray-500"
                              }`}
                            >
                              {employeesMap[type.type]?.length === 1 ? (
                                <span className="flex items-center gap-2">
                                  <div
                                    className={`h-6 w-6 rounded-full ${
                                      selectedTypeTab === index
                                        ? "bg-white/10 ring-2 ring-white/20"
                                        : "bg-gray-100 ring-2 ring-white"
                                    } flex items-center justify-center shadow-sm`}
                                  >
                                    <span
                                      className={`text-xs font-medium ${
                                        selectedTypeTab === index
                                          ? "text-white"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      {employeesMap[type.type][0].name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                    </span>
                                  </div>
                                  <span
                                    className={`font-medium ${
                                      selectedTypeTab === index
                                        ? "text-white/90"
                                        : "text-gray-900"
                                    }`}
                                  >
                                    {employeesMap[type.type][0].name}
                                  </span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <div
                                    className={`px-2 py-1 rounded-md text-xs ${
                                      selectedTypeTab === index
                                        ? "bg-white/10"
                                        : "bg-gray-100"
                                    }`}
                                  >
                                    <span
                                      className={`font-medium ${
                                        selectedTypeTab === index
                                          ? "text-white"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      {employeesMap[type.type]?.length || 0}
                                    </span>
                                    <span
                                      className={
                                        selectedTypeTab === index
                                          ? "text-white/70"
                                          : "text-gray-500"
                                      }
                                    >
                                      {" "}
                                      employee
                                      {employeesMap[type.type]?.length !== 1
                                        ? "s"
                                        : ""}
                                    </span>
                                  </div>
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>
                {employmentTypes.map((type, index) => (
                  <div
                    key={index}
                    className={`${
                      selectedTypeTab === index ? "block" : "hidden"
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 flex items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200/50 shadow-sm">
                        <div className="flex-1 flex items-center gap-4">
                          <label className="block text-sm font-medium text-gray-700 whitespace-nowrap">
                            Type Name
                          </label>
                          <input
                            type="text"
                            name={`type-${index}`}
                            value={type.type}
                            onChange={(e) =>
                              handleEmploymentTypeChange(
                                index,
                                "type",
                                e.target.value
                              )
                            }
                            className="block w-full rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3"
                            placeholder="Enter type name..."
                          />
                        </div>
                        <div className="flex-1 flex items-center gap-4">
                          <label className="block text-sm font-medium text-gray-700 whitespace-nowrap">
                            Hours of Work
                          </label>
                          <input
                            type="number"
                            name={`hours-${index}`}
                            value={type.hoursOfWork}
                            onChange={(e) =>
                              handleEmploymentTypeChange(
                                index,
                                "hoursOfWork",
                                parseFloat(e.target.value)
                              )
                            }
                            min="0"
                            max="24"
                            step="0.5"
                            className="block w-full rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3"
                            placeholder="Enter hours of work..."
                          />
                        </div>
                        <div className="flex flex-row gap-6 items-center min-w-[200px]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 pr-5 flex items-center gap-2">
                              <IoTimeOutline className="w-4 h-4 text-gray-500" />
                              Time Tracking
                            </span>
                            <button
                              onClick={() =>
                                handleEmploymentTypeChange(
                                  index,
                                  "requiresTimeTracking",
                                  !type.requiresTimeTracking
                                )
                              }
                              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                type.requiresTimeTracking
                                  ? "bg-blue-500"
                                  : "bg-gray-200"
                              }`}
                            >
                              <span
                                className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white shadow-sm ${
                                  type.requiresTimeTracking
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                          {type.requiresTimeTracking && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700 pr-5 flex items-center gap-2">
                                <IoCalendarOutline className="w-4 h-4 text-gray-500" />
                                Fixed Time
                              </span>
                              <button
                                onClick={() =>
                                  handleFixedTimeChange(
                                    index,
                                    !fixedTimeSchedule[index]
                                  )
                                }
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                  fixedTimeSchedule[index]
                                    ? "bg-blue-500"
                                    : "bg-gray-200"
                                }`}
                              >
                                <span
                                  className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white shadow-sm ${
                                    fixedTimeSchedule[index]
                                      ? "translate-x-6"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveEmploymentType(index)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all duration-200 border border-red-100 hover:border-red-200"
                        >
                          <IoTrashOutline className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                      {type.requiresTimeTracking && (
                        <div className="col-span-2 mt-4">
                          {scheduleMode === "weekly" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {(type.schedules || []).map(
                                (schedule, dayIndex) => (
                                  <div
                                    key={dayIndex}
                                    className={`p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                                      selectedDayTab === dayIndex
                                        ? "border-blue-500 bg-blue-50/30 shadow-lg shadow-blue-100"
                                        : "border-gray-200 hover:border-blue-300 bg-white"
                                    }`}
                                    onClick={() => setSelectedDayTab(dayIndex)}
                                  >
                                    <div className="flex flex-col space-y-4">
                                      <h3 className="text-lg font-semibold text-gray-900 flex justify-between items-center">
                                        <span>
                                          {
                                            [
                                              "Monday",
                                              "Tuesday",
                                              "Wednesday",
                                              "Thursday",
                                              "Friday",
                                              "Saturday",
                                              "Sunday",
                                            ][dayIndex]
                                          }
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <Tooltip
                                            content="Copy Schedule"
                                            position="top"
                                            width="130px"
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setCopiedSchedule({
                                                  timeIn: schedule.timeIn || "",
                                                  timeOut:
                                                    schedule.timeOut || "",
                                                });
                                                toast.success(
                                                  "Schedule copied"
                                                );
                                              }}
                                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                              >
                                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                              </svg>
                                            </button>
                                          </Tooltip>
                                          {copiedSchedule && (
                                            <Tooltip
                                              content="Paste Schedule"
                                              position="top"
                                              width="130px"
                                            >
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleScheduleChange(
                                                    index,
                                                    dayIndex,
                                                    "timeIn",
                                                    copiedSchedule.timeIn
                                                  );
                                                  toast.success(
                                                    "Schedule pasted"
                                                  );
                                                }}
                                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                              >
                                                <svg
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  className="h-4 w-4"
                                                  viewBox="0 0 20 20"
                                                  fill="currentColor"
                                                >
                                                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                                  <path
                                                    fillRule="evenodd"
                                                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                                                    clipRule="evenodd"
                                                  />
                                                </svg>
                                              </button>
                                            </Tooltip>
                                          )}
                                          <Tooltip
                                            content="Day Off"
                                            position="left"
                                            width="100px"
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const newTimeOff = {
                                                  ...timeOff,
                                                };
                                                if (!newTimeOff[type.type]) {
                                                  newTimeOff[type.type] = {};
                                                }
                                                newTimeOff[type.type][
                                                  dayIndex
                                                ] =
                                                  !newTimeOff[type.type]?.[
                                                    dayIndex
                                                  ];
                                                setTimeOff(newTimeOff);

                                                if (
                                                  newTimeOff[type.type][
                                                    dayIndex
                                                  ]
                                                ) {
                                                  handleScheduleChange(
                                                    index,
                                                    dayIndex,
                                                    "timeIn",
                                                    ""
                                                  );
                                                }
                                              }}
                                              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                                timeOff[type.type]?.[dayIndex]
                                                  ? "bg-blue-500"
                                                  : "bg-gray-200"
                                              }`}
                                            >
                                              <span
                                                className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white shadow-sm ${
                                                  timeOff[type.type]?.[dayIndex]
                                                    ? "translate-x-6"
                                                    : "translate-x-1"
                                                }`}
                                              />
                                            </button>
                                          </Tooltip>
                                        </div>
                                      </h3>
                                      <div className="space-y-4">
                                        <div>
                                          <label className="text-sm font-medium text-gray-600">
                                            Time In
                                          </label>
                                          <input
                                            type="time"
                                            name={`timeIn-${index}-${dayIndex}`}
                                            value={schedule.timeIn}
                                            onChange={(e) =>
                                              handleScheduleChange(
                                                index,
                                                dayIndex,
                                                "timeIn",
                                                e.target.value
                                              )
                                            }
                                            disabled={
                                              timeOff[type.type]?.[dayIndex]
                                            }
                                            className={`mt-1 block w-full rounded-lg border-2 ${
                                              timeOff[type.type]?.[dayIndex]
                                                ? "bg-gray-50 cursor-not-allowed"
                                                : "hover:border-blue-400"
                                            } border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3`}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-gray-600">
                                            Time Out
                                          </label>
                                          <input
                                            type="time"
                                            name={`timeOut-${index}-${dayIndex}`}
                                            value={schedule.timeOut}
                                            onChange={(e) =>
                                              handleScheduleChange(
                                                index,
                                                dayIndex,
                                                "timeOut",
                                                e.target.value
                                              )
                                            }
                                            disabled={
                                              timeOff[type.type]?.[dayIndex]
                                            }
                                            className={`mt-1 block w-full rounded-lg border-2 ${
                                              timeOff[type.type]?.[dayIndex]
                                                ? "bg-gray-50 cursor-not-allowed"
                                                : "hover:border-blue-400"
                                            } border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3`}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {scheduleMode === "monthly" && (
                            <MonthScheduleView
                              key={type.type}
                              type={type as EmploymentTypeWithMonthSchedules}
                              selectedMonth={selectedMonth}
                              onMonthChange={handleMonthChange}
                              onUpdateSchedule={handleUpdateSchedule}
                              copiedSchedule={copiedSchedule}
                              onCopySchedule={setCopiedSchedule}
                              getScheduleForDate={getScheduleForDate}
                              onClearSchedules={() => {
                                setMonthSchedules((prev) => {
                                  const newSchedules = { ...prev };
                                  const yearMonth = selectedMonth
                                    .toISOString()
                                    .slice(0, 7); // Get YYYY-MM format

                                  // Only clear schedules for the selected month
                                  Object.keys(newSchedules).forEach(
                                    (typeId) => {
                                      // Keep other months' schedules, only clear the selected month
                                      newSchedules[typeId] = {
                                        ...newSchedules[typeId],
                                        [yearMonth]: {}, // Clear only this month's schedule
                                      };
                                    }
                                  );

                                  return newSchedules;
                                });
                                toast.success(
                                  `Schedules cleared for ${selectedMonth.toLocaleString(
                                    "default",
                                    { month: "long", year: "numeric" }
                                  )}`
                                );
                              }}
                              monthSchedules={monthSchedules}
                            />
                          )}

                          {/* Add employee list section */}
                          <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200/50 shadow-sm">
                            <h4 className="text-sm font-medium text-gray-700 mb-4">
                              Employees Using This Type:
                            </h4>
                            <div className="space-y-2">
                              {employeesMap[type.type]?.length > 0 ? (
                                employeesMap[type.type].map((employee) => (
                                  <div
                                    key={employee.id}
                                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
                                  >
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                      <span className="text-sm font-medium text-indigo-600">
                                        {employee.name
                                          .split(" ")
                                          .map((n) => n[0])
                                          .join("")}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {employee.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {employee.position || "No position set"}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-500 italic">
                                  No employees currently using this type
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-4">
        <button
          onClick={handleSaveEmploymentTypes}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
