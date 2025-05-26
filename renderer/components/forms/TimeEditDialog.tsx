"use client";

import React, { useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { MissingTimeLog } from "@/renderer/model/missingTime";
import {
  AttendanceSettings,
  EmploymentType,
  createAttendanceSettingsModel,
} from "@/renderer/model/settings";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { Attendance } from "@/renderer/model/attendance";
import { toast } from "sonner";
import BaseFormDialog from "@/renderer/components/dialogs/BaseFormDialog";

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
        const employmentTypeData = employmentTypes.find(
          (type) => type.type === log.employmentType
        );

        if (employmentTypeData) {
          const date = new Date(log.year, log.month - 1, parseInt(log.day));
          const schedule = await settingsModel.getScheduleForDate(
            employmentTypeData,
            date
          );

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

  return (
    <BaseFormDialog
      title={hasEditAccess ? "Edit Time" : "View Time"}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={hasEditAccess ? "Save" : "Close"}
      position={position}
      isBottomSheet={true}
    >
      <form className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time In
            </label>
            <input
              type="time"
              value={timeIn || ""}
              onChange={(e) => setTimeIn(e.target.value || "")}
              disabled={!hasEditAccess}
              className={`w-full px-3 py-1.5 h-10 text-sm bg-white border border-gray-300 text-gray-900 ${hasEditAccess
                ? "focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
                : "opacity-50 cursor-not-allowed"
                }`}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Out
            </label>
            <input
              type="time"
              value={timeOut || ""}
              onChange={(e) => setTimeOut(e.target.value || "")}
              disabled={!hasEditAccess}
              className={`w-full px-3 py-1.5 h-10 text-sm bg-white border border-gray-300 text-gray-900 ${hasEditAccess
                ? "focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
                : "opacity-50 cursor-not-allowed"
                }`}
            />
          </div>
        </div>
      </form>
    </BaseFormDialog>
  );
};
