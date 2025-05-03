"use client";

import React, { useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { MissingTimeLog } from "@/renderer/model/missingTime";
import {
  AttendanceSettings,
  EmploymentType,
  createAttendanceSettingsModel,
  getScheduleForDate,
} from "@/renderer/model/settings";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { Attendance } from "../model/attendance_old";
import { toast } from "sonner";

interface TimeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: {
    timeIn: string | null;
    timeOut: string | null;
  }) => Promise<void>;
  log: MissingTimeLog;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
  } | null;
  attendance?: Attendance | null;
  accessCodes?: string[];
}

export const TimeEditDialog: React.FC<TimeEditDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  log,
  position,
  attendance,
  accessCodes = [],
}) => {
  const [timeIn, setTimeIn] = useState<string>("");
  const [timeOut, setTimeOut] = useState<string>("");
  const { dbPath } = useSettingsStore();
  const [employmentType, setEmploymentType] = useState<EmploymentType | null>(
    null
  );
  const [attendanceSettings, setAttendanceSettings] =
    useState<AttendanceSettings | null>(null);
  const [scheduledTimeIn, setScheduledTimeIn] = useState<string>("");
  const [scheduledTimeOut, setScheduledTimeOut] = useState<string>("");

  const hasEditAccess = accessCodes.includes("MANAGE_ATTENDANCE");

  useEffect(() => {
    const loadSchedule = async () => {
      if (!dbPath) return;

      try {
        const settingsModel = createAttendanceSettingsModel(dbPath);
        const employmentTypes = await settingsModel.loadTimeSettings();
        const employmentType = employmentTypes.find(
          (type) => type.type === log.employmentType
        );

        if (employmentType) {
          const date = new Date(log.year, log.month - 1, parseInt(log.day));
          const schedule = getScheduleForDate(employmentType, date);

          if (schedule && !schedule.isOff) {
            setScheduledTimeIn(schedule.timeIn);
            setScheduledTimeOut(schedule.timeOut);
          } else {
            setScheduledTimeIn("");
            setScheduledTimeOut("");
            toast.error(
              "No schedule found for this date or it's marked as day off"
            );
          }
        }
      } catch (error) {
        console.error("Error loading schedule:", error);
        toast.error("Failed to load schedule");
      }
    };

    if (isOpen) {
      loadSchedule();
    }
  }, [isOpen, dbPath, log]);

  useEffect(() => {
    // First try to set from attendance data
    if (attendance) {
      setTimeIn(attendance.timeIn || "");
      setTimeOut(attendance.timeOut || "");
      return;
    }

    // If no attendance data, check which field is missing and set the other from schedule
    if (log.missingType === "timeIn") {
      setTimeIn(""); // This is the missing field
      setTimeOut(scheduledTimeOut); // Use scheduled time for the non-missing field
    } else {
      setTimeIn(scheduledTimeIn); // Use scheduled time for the non-missing field
      setTimeOut(""); // This is the missing field
    }
  }, [attendance, log.missingType, scheduledTimeIn, scheduledTimeOut]);

  const validateTime = (time: string): boolean => {
    if (!time) return true; // Empty is valid
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasEditAccess) {
      toast.error("You do not have permission to edit attendance records");
      return;
    }

    // Validate both times
    if (!validateTime(timeIn) || !validateTime(timeOut)) {
      console.error("Invalid time format");
      return;
    }

    try {
      await onSave({
        timeIn: timeIn === "" ? null : timeIn,
        timeOut: timeOut === "" ? null : timeOut,
      });
      onClose();
    } catch (error) {
      console.error("Error saving time:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700 w-full max-w-md overflow-visible"
        style={{
          top: position?.top,
          left: position?.left,
          transform: position?.showAbove ? "translateY(-100%)" : "none",
          maxHeight: "calc(100vh - 100px)",
        }}
      >
        {/* Caret */}
        <div
          className="absolute left-8 w-0 h-0"
          style={{
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            ...(position?.showAbove
              ? {
                  bottom: "-8px",
                  borderTop: "8px solid rgb(55, 65, 81)", // matches border-gray-700
                }
              : {
                  top: "-8px",
                  borderBottom: "8px solid rgb(55, 65, 81)", // matches border-gray-700
                }),
          }}
        />
        <div
          className="absolute left-8 w-0 h-0"
          style={{
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            ...(position?.showAbove
              ? {
                  bottom: "-6px",
                  borderTop: "7px solid rgb(17, 24, 39)", // matches bg-gray-900
                }
              : {
                  top: "-6px",
                  borderBottom: "7px solid rgb(17, 24, 39)", // matches bg-gray-900
                }),
          }}
        />

        {/* Dialog content */}
        <div className="relative">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 rounded-t-lg">
            <h3 className="text-lg font-medium text-gray-100">
              {hasEditAccess ? "Edit Time" : "View Time"}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 focus:outline-none"
            >
              <IoClose className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="bg-gray-900 rounded-b-lg">
            <div className="p-4 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Time In
                  </label>
                  <input
                    type="time"
                    value={timeIn || ""}
                    onChange={(e) => setTimeIn(e.target.value || "")}
                    disabled={!hasEditAccess}
                    className={`w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 [color-scheme:dark] ${
                      hasEditAccess
                        ? "focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Time Out
                  </label>
                  <input
                    type="time"
                    value={timeOut || ""}
                    onChange={(e) => setTimeOut(e.target.value || "")}
                    disabled={!hasEditAccess}
                    className={`w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 [color-scheme:dark] ${
                      hasEditAccess
                        ? "focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                        : "opacity-50 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
              <div className="flex flex-row space-x-3 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
                >
                  {hasEditAccess ? "Cancel" : "Close"}
                </button>
                {hasEditAccess && (
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
