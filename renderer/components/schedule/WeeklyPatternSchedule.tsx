"use client";
import React, { useState, useCallback } from "react";
import { IoTimeOutline, IoCalendarOutline } from "react-icons/io5";
import { toast } from "sonner";
import { EmploymentType } from "../../model/settings";
import { Tooltip } from "../Tooltip";

interface WeeklyPatternScheduleProps {
  employmentType: EmploymentType;
  employmentTypeIndex: number;
  fixedTimeSchedule: boolean;
  onFixedTimeChange: (value: boolean) => void;
  onScheduleChange: (
    dayIndex: number,
    field: "timeIn" | "timeOut",
    value: string
  ) => void;
}

export default function WeeklyPatternSchedule({
  employmentType,
  employmentTypeIndex,
  fixedTimeSchedule,
  onFixedTimeChange,
  onScheduleChange,
}: WeeklyPatternScheduleProps) {
  const [selectedDayTab, setSelectedDayTab] = useState(0);
  const [copiedSchedule, setCopiedSchedule] = useState<{
    timeIn: string;
    timeOut: string;
  } | null>(null);
  const [timeOff, setTimeOff] = useState<{ [key: number]: boolean }>({});

  const handleDayOffToggle = (dayIndex: number) => {
    const newTimeOff = { ...timeOff };
    newTimeOff[dayIndex] = !newTimeOff[dayIndex];
    setTimeOff(newTimeOff);

    // If marking as day off, clear times
    if (newTimeOff[dayIndex]) {
      onScheduleChange(dayIndex, "timeIn", "");
      onScheduleChange(dayIndex, "timeOut", "");
    }
  };

  const handlePaste = (dayIndex: number) => {
    if (copiedSchedule) {
      onScheduleChange(dayIndex, "timeIn", copiedSchedule.timeIn);
      onScheduleChange(dayIndex, "timeOut", copiedSchedule.timeOut);
      toast.success("Schedule pasted");
    }
  };

  const handleCopy = (dayIndex: number) => {
    const schedule = employmentType.schedules?.[dayIndex];
    if (schedule) {
      setCopiedSchedule({
        timeIn: schedule.timeIn || "",
        timeOut: schedule.timeOut || "",
      });
      toast.success("Schedule copied");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div className="col-span-full flex items-center justify-end pr-4 pt-0 pb-2">
        {" "}
        {/* Moved Fixed Time toggle here */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 pr-3 flex items-center gap-2">
            <IoCalendarOutline className="w-4 h-4 text-gray-500" />
            Fixed Time (Mon-Sat)
          </span>
          <button
            onClick={() => onFixedTimeChange(!fixedTimeSchedule)}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              fixedTimeSchedule ? "bg-blue-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white shadow-sm ${
                fixedTimeSchedule ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
      {(employmentType.schedules || []).map((schedule, dayIndex) => (
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
                <Tooltip content="Copy Schedule" position="top" width="130px">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(dayIndex);
                    }}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    aria-label="Copy schedule"
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
                        handlePaste(dayIndex);
                      }}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label="Paste schedule"
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
                <Tooltip content="Day Off" position="left" width="100px">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDayOffToggle(dayIndex);
                    }}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      timeOff[dayIndex] ? "bg-blue-500" : "bg-gray-200"
                    }`}
                    aria-pressed={timeOff[dayIndex]}
                    aria-label="Toggle day off"
                  >
                    <span
                      className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white shadow-sm ${
                        timeOff[dayIndex] ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </Tooltip>
              </div>
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`timeIn-${employmentTypeIndex}-${dayIndex}`}
                  className="text-sm font-medium text-gray-600"
                >
                  Time In
                </label>
                <input
                  id={`timeIn-${employmentTypeIndex}-${dayIndex}`}
                  type="time"
                  name={`timeIn-${employmentTypeIndex}-${dayIndex}`}
                  value={schedule.timeIn || ""}
                  onChange={(e) =>
                    onScheduleChange(dayIndex, "timeIn", e.target.value)
                  }
                  disabled={timeOff[dayIndex]}
                  className={`mt-1 block w-full rounded-lg border-2 ${
                    timeOff[dayIndex]
                      ? "bg-gray-50 cursor-not-allowed"
                      : "hover:border-blue-400"
                  } border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3`}
                />
              </div>
              <div>
                <label
                  htmlFor={`timeOut-${employmentTypeIndex}-${dayIndex}`}
                  className="text-sm font-medium text-gray-600"
                >
                  Time Out
                </label>
                <input
                  id={`timeOut-${employmentTypeIndex}-${dayIndex}`}
                  type="time"
                  name={`timeOut-${employmentTypeIndex}-${dayIndex}`}
                  value={schedule.timeOut || ""}
                  onChange={(e) =>
                    onScheduleChange(dayIndex, "timeOut", e.target.value)
                  }
                  disabled={timeOff[dayIndex]}
                  className={`mt-1 block w-full rounded-lg border-2 ${
                    timeOff[dayIndex]
                      ? "bg-gray-50 cursor-not-allowed"
                      : "hover:border-blue-400"
                  } border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3`}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
