import { useState, useEffect, useMemo } from "react";
import {
  EmploymentType,
  DailySchedule,
  AttendanceSettingsModel,
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
export const getScheduleInfo = async (
  model: AttendanceSettingsModel,
  employmentType: EmploymentType | null,
  date: Date
): Promise<ScheduleInfo> => {
  if (!employmentType) {
    return {
      schedule: null,
      hasSchedule: false,
      isRestDay: false,
      formattedSchedule: null,
    };
  }

  const schedule = await model.getScheduleForDate(employmentType, date);
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
  attendanceSettingsModel: any,
  employmentType: EmploymentType | null,
  dates: Date[]
) => {
  const [scheduleMap, setScheduleMap] = useState<
    Map<number, { isRestDay: boolean; hasSchedule: boolean }>
  >(new Map());

  useEffect(() => {
    const calculateSchedules = async () => {
      if (!attendanceSettingsModel || !dates.length) {
        return;
      }

      try {
        // Create a map to store schedule information for each day
        const newScheduleMap = new Map<
          number,
          { isRestDay: boolean; hasSchedule: boolean }
        >();

        // If we have an employment type, use its schedule
        if (employmentType) {
          // Process each date
          for (const date of dates) {
            const day = date.getDate();
            const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday

            // Check if this day is a rest day based on employment type settings
            // Add null checks to prevent TypeError
            const isRestDay =
              employmentType.restDays && Array.isArray(employmentType.restDays)
                ? employmentType.restDays.includes(dayOfWeek)
                : dayOfWeek === 0 || dayOfWeek === 6; // Default to weekends if restDays is missing

            // Determine if there's a schedule for this day
            const hasSchedule =
              employmentType.workDays && Array.isArray(employmentType.workDays)
                ? employmentType.workDays.includes(dayOfWeek)
                : dayOfWeek > 0 && dayOfWeek < 6; // Default to weekdays if workDays is missing

            // Store schedule info in the map
            newScheduleMap.set(day, { isRestDay, hasSchedule });
          }
        } else {
          // If no employment type is available, assume all days have a schedule but none are rest days
          for (const date of dates) {
            const day = date.getDate();
            const dayOfWeek = date.getDay();

            // Default: Weekends (Saturday and Sunday) are rest days
            const isRestDay = dayOfWeek === 0 || dayOfWeek === 6;

            // Default: Weekdays have schedules
            const hasSchedule = dayOfWeek > 0 && dayOfWeek < 6;

            newScheduleMap.set(day, { isRestDay, hasSchedule });
          }
        }

        // Load any custom schedules from the settings model
        try {
          // This would be where you'd load custom schedules if implemented
          // For example:
          // const customSchedules = await attendanceSettingsModel.loadCustomSchedules();
          // for (const schedule of customSchedules) {
          //   // Update the scheduleMap with custom schedule information
          // }
        } catch (error) {
          console.error(
            "useSchedules - Error loading custom schedules:",
            error
          );
        }

        setScheduleMap(newScheduleMap);
      } catch (error) {
        console.error("useSchedules - Error calculating schedules:", error);
      }
    };

    calculateSchedules();
  }, [attendanceSettingsModel, employmentType, dates]);

  return scheduleMap;
};

// Legacy hook for single date (refactored for async)
export const useSchedule = (
  model: AttendanceSettingsModel | null,
  employmentType: EmploymentType | null,
  date: Date | null
): ScheduleInfo | null => {
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null);

  useEffect(() => {
    if (!model || !employmentType || !date) {
      setScheduleInfo({
        schedule: null,
        hasSchedule: false,
        isRestDay: false,
        formattedSchedule: null,
      });
      return;
    }

    let isMounted = true;
    const fetchSchedule = async () => {
      try {
        const info = await getScheduleInfo(model, employmentType, date);
        if (isMounted) {
          setScheduleInfo(info);
        }
      } catch (error) {
        console.error("Error fetching schedule info:", error);
        if (isMounted) {
          setScheduleInfo({
            schedule: null,
            hasSchedule: false,
            isRestDay: false,
            formattedSchedule: null,
          });
        }
      }
    };

    fetchSchedule();

    return () => {
      isMounted = false;
    };
  }, [model, employmentType?.type, date]);

  return scheduleInfo;
};

// Utility function that can be used without the hook (now async)
export const checkHasSchedule = async (
  model: AttendanceSettingsModel,
  employmentType: EmploymentType | null,
  date: Date
): Promise<boolean> => {
  if (!employmentType || !model) return false;
  const schedule = await model.getScheduleForDate(employmentType, date);
  return (
    !!schedule && !!schedule.timeIn && !!schedule.timeOut && !schedule.isOff
  );
};

// Utility function to check if a date should be marked as absent (now async)
export const shouldMarkAsAbsent = async (
  model: AttendanceSettingsModel,
  employmentType: EmploymentType | null,
  date: Date,
  hasTimeEntries: boolean
): Promise<boolean> => {
  if (!employmentType || !model) return false;

  const scheduleInfo = await getScheduleInfo(model, employmentType, date);

  if (!scheduleInfo.hasSchedule || scheduleInfo.isRestDay) {
    return false;
  }

  return !hasTimeEntries;
};
