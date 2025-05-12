"use client";
import React from "react";
import { toast } from "sonner";
import {
  IoChevronBack,
  IoChevronForward,
  IoTrashOutline,
  IoCopyOutline,
  IoClipboardOutline,
} from "react-icons/io5";
import {
  EmploymentType,
  DailySchedule,
  MonthSchedule,
} from "../../model/settings";
import { globalColorMap } from "@/renderer/lib/colorUtils";
import CalendarDayCell from "./CalendarDayCell";

// Interfaces moved here
interface EmploymentTypeWithMonthSchedules extends EmploymentType {
  monthSchedules?: {
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

// Utility functions moved here
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

// Props for the component
interface MonthSpecificScheduleProps {
  employmentType: EmploymentType; // Use base type now
  selectedMonth: Date;
  monthScheduleData: MonthSchedule | null;
  isLoading: boolean; // Add loading state prop
  onMonthChange: (newDate: Date) => void;
  onUpdateSchedule: (
    typeId: string,
    date: Date,
    schedule: DailySchedule
  ) => void;
  getScheduleForDate: (typeId: string, date: Date) => DailySchedule;
  onClearSchedulesForMonth: () => void; // Renamed for clarity
}

// Component renamed and exported
const MonthSpecificSchedule = React.memo(
  ({
    employmentType,
    selectedMonth,
    monthScheduleData,
    isLoading,
    onMonthChange,
    onUpdateSchedule,
    getScheduleForDate,
    onClearSchedulesForMonth,
  }: MonthSpecificScheduleProps) => {
    // Add debug logging to check what data is being received
    React.useEffect(() => {
      console.log("[MonthSpecificSchedule] Component mounted/updated");
      console.log("[MonthSpecificSchedule] Employment Type:", employmentType);
      console.log("[MonthSpecificSchedule] Selected Month:", selectedMonth);
      console.log("[MonthSpecificSchedule] Month Schedule Data:", monthScheduleData);
      console.log("[MonthSpecificSchedule] Is Loading:", isLoading);
    }, [employmentType, selectedMonth, monthScheduleData, isLoading]);

    const [copiedDaySchedule, setCopiedDaySchedule] = React.useState<{
      timeIn: string;
      timeOut: string;
    } | null>(null);
    const [copiedMonthSchedule, setCopiedMonthSchedule] =
      React.useState<CopiedMonthSchedule | null>(null);

    // Handler for the copy day action, passed down to the cell
    const handleCopyDaySchedule = React.useCallback(
      (schedule: { timeIn: string; timeOut: string }) => {
        setCopiedDaySchedule(schedule);
      },
      []
    );

    const days = getDaysInMonth(selectedMonth);
    const firstDayOfMonth = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      1
    );
    const startingDayOfWeek = getDayOfWeek(firstDayOfMonth);

    const handleMonthNav = (direction: "prev" | "next") => {
      const newDate = new Date(selectedMonth);
      newDate.setMonth(newDate.getMonth() + (direction === "prev" ? -1 : 1));
      onMonthChange(newDate);
    };

    const handleCopyMonth = () => {
      const schedules: { [key: number]: MonthScheduleData } = {};
      getDaysInMonth(selectedMonth).forEach((day) => {
        const date = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth(),
          day
        );
        const schedule = getScheduleForDate(employmentType.type, date);
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
      targetDays.forEach((day) => {
        if (copiedMonthSchedule.schedules[day]) {
          const targetDate = new Date(
            selectedMonth.getFullYear(),
            selectedMonth.getMonth(),
            day
          );
          onUpdateSchedule(
            employmentType.type,
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
              onClick={() => handleMonthNav("prev")}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <IoChevronBack className="w-5 h-5" />
            </button>
            <h4 className="text-lg font-medium text-gray-900 w-36 text-center">
              {selectedMonth.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            <button
              type="button"
              onClick={() => handleMonthNav("next")}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <IoChevronForward className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMonth}
              className="px-3 py-1.5 text-sm border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-2"
              aria-label="Copy this month's schedule"
            >
              <IoCopyOutline className="h-4 w-4" />
              Copy Month
            </button>
            {copiedMonthSchedule && (
              <button
                type="button"
                onClick={handlePasteMonth}
                className="px-3 py-1.5 text-sm border border-green-200 text-green-600 rounded-md hover:bg-green-50 transition-colors flex items-center gap-2"
                aria-label="Paste copied monthly schedule"
              >
                <IoClipboardOutline className="h-4 w-4" />
                Paste Month
              </button>
            )}
            <button
              type="button"
              onClick={onClearSchedulesForMonth} // Use the passed handler
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2"
              aria-label="Clear schedules for this month"
            >
              <IoTrashOutline className="w-4 h-4" />
              Clear Month
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="text-center font-medium text-gray-600 py-2 text-xs"
            >
              {day}
            </div>
          ))}

          {Array.from({ length: startingDayOfWeek - 1 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 bg-gray-50 rounded-lg" />
          ))}

          {days.map((day) => {
            const date = new Date(
              selectedMonth.getFullYear(),
              selectedMonth.getMonth(),
              day
            );
            const schedule = getScheduleForDate(employmentType.type, date);

            // Add debug logging for each day's schedule
            if (day === 1 || day === 15) {  // Log just a couple days to avoid console flood
              console.log(`[MonthSpecificSchedule] Day ${day} schedule for ${employmentType.type}:`, schedule);
            }

            return (
              <CalendarDayCell
                key={day}
                day={day}
                date={date}
                schedule={schedule}
                employmentTypeId={employmentType.type}
                copiedDaySchedule={copiedDaySchedule}
                onUpdateSchedule={onUpdateSchedule}
                onCopyDaySchedule={handleCopyDaySchedule}
              />
            );
          })}
        </div>
      </div>
    );
  }
);

export default MonthSpecificSchedule;
