"use client";
import React from "react";
import { toast } from "sonner";
import { DailySchedule } from "../../model/settings";
import { globalColorMap } from "@/renderer/lib/colorUtils";
import { IoCopyOutline, IoClipboardOutline } from "react-icons/io5";

interface CalendarDayCellProps {
  day: number;
  date: Date;
  schedule: DailySchedule;
  employmentTypeId: string;
  copiedDaySchedule: { timeIn: string; timeOut: string } | null;
  onUpdateSchedule: (
    typeId: string,
    date: Date,
    schedule: DailySchedule
  ) => void;
  onCopyDaySchedule: (schedule: { timeIn: string; timeOut: string }) => void;
}

// Helper function (can be moved to utils if needed elsewhere)
const getScheduleColor = (
  timeIn: string | undefined,
  timeOut: string | undefined,
  isOff?: boolean
) => {
  // console.log(`[getScheduleColor] Input - timeIn: '${timeIn}', timeOut: '${timeOut}', isOff: ${isOff}`);
  if (isOff) return "bg-gray-100 border-gray-200";
  if (!timeIn || !timeOut || timeIn.trim() === "" || timeOut.trim() === "") {
    return "bg-white border-gray-200";
  }
  const timeKey = `${timeIn}-${timeOut}`;
  // console.log(`[getScheduleColor] Generated timeKey: '${timeKey}'`);
  const colorClass = globalColorMap.getColor(timeKey);
  // console.log(`[getScheduleColor] Color class from map for '${timeKey}': '${colorClass}'`);
  return colorClass;
};

const CalendarDayCell = React.memo(
  ({
    day,
    date,
    schedule,
    employmentTypeId,
    copiedDaySchedule,
    onUpdateSchedule,
    onCopyDaySchedule,
  }: CalendarDayCellProps) => {
    const scheduleColor = getScheduleColor(
      schedule.timeIn,
      schedule.timeOut,
      schedule.isOff
    );

    return (
      <div
        key={day} // Key moved here from parent loop
        className={`h-32 p-2 rounded-lg border ${scheduleColor} hover:bg-opacity-90 transition-colors relative group`}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="font-medium text-sm">{day}</span>
          <div className="flex items-center gap-1 opacity-100 transition-opacity duration-150">
            {/* Copy Button - Use IoCopyOutline */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCopyDaySchedule({
                  timeIn: schedule.timeIn || "",
                  timeOut: schedule.timeOut || "",
                });
                toast.success("Daily schedule copied");
              }}
              className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md"
              aria-label="Copy daily schedule"
            >
              <IoCopyOutline className="h-4 w-4" />
            </button>
            {/* Paste Button - Use IoClipboardOutline */}
            {copiedDaySchedule && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUpdateSchedule(employmentTypeId, date, {
                    timeIn: copiedDaySchedule.timeIn,
                    timeOut: copiedDaySchedule.timeOut,
                    isOff: false, // Pasting always assumes a working day
                  });
                  toast.success("Daily schedule pasted");
                }}
                className="p-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md"
                aria-label="Paste daily schedule"
              >
                <IoClipboardOutline className="h-4 w-4" />
              </button>
            )}
            {/* Toggle Off/Work Button wrapped for hover effect */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUpdateSchedule(employmentTypeId, date, {
                    // Simple toggle logic, clear button handles clearing times for working days
                    timeIn: schedule.timeIn || "",
                    timeOut: schedule.timeOut || "",
                    isOff: !schedule.isOff,
                  });
                }}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors flex items-center justify-center ${schedule.isOff
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200" // Status button styling
                  }`}
                aria-label={schedule.isOff ? "Mark as Working" : "Mark as Off"}
              >
                {(!schedule.isOff && (schedule.timeIn !== "" || schedule.timeOut !== "")) ? "Work" : "Day Off"}
              </button>
              {/* Clear button shown on hover only if it's a working day */}
              {!schedule.isOff && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onUpdateSchedule(employmentTypeId, date, {
                      timeIn: "",
                      timeOut: "",
                      isOff: false, // Keep as working day but clear times
                    });
                    toast.success("Daily schedule cleared");
                  }}
                  className="absolute inset-0 w-full h-full px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                  aria-label="Clear schedule times"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Time Inputs (conditional) */}
        {!schedule.isOff && (
          <div className="mt-1 space-y-1">
            <input
              type="time"
              value={schedule.timeIn || ""}
              onChange={(e) => {
                onUpdateSchedule(employmentTypeId, date, {
                  ...schedule,
                  isOff: false, // Ensure isOff is false when time changes
                  timeIn: e.target.value,
                });
              }}
              className="w-full text-xs p-1 rounded border border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20"
              aria-label={`Time in for day ${day}`}
            />
            <input
              type="time"
              value={schedule.timeOut || ""}
              onChange={(e) => {
                onUpdateSchedule(employmentTypeId, date, {
                  ...schedule,
                  isOff: false, // Ensure isOff is false when time changes
                  timeOut: e.target.value,
                });
              }}
              className="w-full text-xs p-1 rounded border border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20"
              aria-label={`Time out for day ${day}`}
            />
          </div>
        )}
      </div>
    );
  }
);

CalendarDayCell.displayName = "CalendarDayCell";

export default CalendarDayCell;
