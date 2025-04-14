import { useMemo } from "react";
import {
  EmploymentType,
  getScheduleForDate,
  DailySchedule,
} from "@/renderer/model/settings";

// Use DailySchedule type directly instead of defining our own Schedule interface
export type { DailySchedule as Schedule };

export interface ScheduleInfo {
  schedule: DailySchedule | null;
  hasSchedule: boolean;
  isRestDay: boolean;
  formattedSchedule: string | null;
}

export const formatTime = (time: string): string => {
  return time.replace(/(\d{2}):(\d{2})/, (_, h, m) => {
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m}${hour < 12 ? "AM" : "PM"}`;
  });
};

// Non-hook version for calculating schedule info for a single date
export const getScheduleInfo = (
  employmentType: EmploymentType | null,
  date: Date
): ScheduleInfo => {
  if (!employmentType) {
    return {
      schedule: null,
      hasSchedule: false,
      isRestDay: false,
      formattedSchedule: null,
    };
  }

  const schedule = getScheduleForDate(employmentType, date);
  // Consider a schedule valid only if it has both timeIn and timeOut values
  const hasSchedule =
    !!schedule && !!schedule.timeIn && !!schedule.timeOut && !schedule.isOff;
  const isRestDay = !hasSchedule || (!!schedule && schedule.isOff === true);

  let formattedSchedule = null;
  if (schedule && schedule.timeIn && schedule.timeOut && !schedule.isOff) {
    formattedSchedule = `${formatTime(schedule.timeIn)} - ${formatTime(
      schedule.timeOut
    )}`;
  }

  return {
    schedule,
    hasSchedule,
    isRestDay,
    formattedSchedule,
  };
};

// Hook version for calculating schedule info for multiple dates
export const useSchedules = (
  employmentType: EmploymentType | null,
  dates: Date[]
): Map<number, ScheduleInfo> => {
  return useMemo(() => {
    const map = new Map();
    dates.forEach((date) => {
      map.set(date.getDate(), getScheduleInfo(employmentType, date));
    });
    return map;
  }, [employmentType, dates]);
};

// Legacy hook for single date (for backward compatibility)
export const useSchedule = (
  employmentType: EmploymentType | null,
  date: Date
): ScheduleInfo => {
  return useMemo(
    () => getScheduleInfo(employmentType, date),
    [employmentType, date]
  );
};

// Utility function that can be used without the hook
export const checkHasSchedule = (
  employmentType: EmploymentType | null,
  date: Date
): boolean => {
  if (!employmentType) return false;
  const schedule = getScheduleForDate(employmentType, date);
  return !!schedule && !schedule.isOff;
};

// Utility function to check if a date should be marked as absent
export const shouldMarkAsAbsent = (
  employmentType: EmploymentType | null,
  date: Date,
  hasTimeEntries: boolean
): boolean => {
  if (!employmentType) return false;

  // Get schedule info for the date
  const scheduleInfo = getScheduleInfo(employmentType, date);

  // If there's no schedule or it's a rest day, don't mark as absent
  if (!scheduleInfo.hasSchedule || scheduleInfo.isRestDay) {
    return false;
  }

  // If there's a schedule but no time entries, mark as absent
  return !hasTimeEntries;
};
