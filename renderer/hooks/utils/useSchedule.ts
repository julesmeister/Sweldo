import { useState, useEffect, useMemo } from "react";
import {
  EmploymentType,
  DailySchedule,
  AttendanceSettingsModel,
} from "@/renderer/model/settings";
import {
  isWebEnvironment,
  getCompanyName,
} from "@/renderer/lib/firestoreService";
import { loadMonthScheduleFirestore } from "@/renderer/model/settings_firestore";

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
  model: AttendanceSettingsModel | null,
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

  let schedule: DailySchedule | null = null;

  // Handle web mode without model
  if (isWebEnvironment() && !model) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // Month is 1-based here
    const dateStr = date.toISOString().split("T")[0];

    try {
      const companyName = await getCompanyName();
      // First check month-specific schedule
      const monthSchedule = await loadMonthScheduleFirestore(
        employmentType.type,
        year,
        month,
        companyName
      );

      if (monthSchedule && monthSchedule[dateStr]) {
        schedule = monthSchedule[dateStr];
      } else if (employmentType.schedules) {
        // Fall back to weekly schedule
        const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, etc.
        const scheduleDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust to 0-6 index (Mon-Sun)
        const weeklySchedule = employmentType.schedules[scheduleDay];

        if (weeklySchedule) {
          schedule = {
            timeIn: weeklySchedule.timeIn,
            timeOut: weeklySchedule.timeOut,
            isOff: !weeklySchedule.timeIn || !weeklySchedule.timeOut,
          };
        }
      }
    } catch (error) {
      console.error(
        "[useSchedule] Error fetching schedule in web mode:",
        error
      );
    }
  } else if (model) {
    // Desktop mode or model provided in web mode
    schedule = await model.getScheduleForDate(employmentType, date);
  }

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
  attendanceSettingsModel: AttendanceSettingsModel | null,
  employmentType: EmploymentType | null,
  dates: Date[]
) => {
  const [scheduleMap, setScheduleMap] = useState<
    Map<number, { isRestDay: boolean; hasSchedule: boolean }>
  >(new Map());
  const isWeb = isWebEnvironment();

  useEffect(() => {
    const calculateSchedules = async () => {
      if (!dates.length || !employmentType) {
        const defaultMap = new Map<
          number,
          { isRestDay: boolean; hasSchedule: boolean }
        >();
        if (dates.length > 0) {
          for (const date of dates) {
            const day = date.getDate();
            const dayOfWeek = date.getDay();
            const isRestDay = dayOfWeek === 0 || dayOfWeek === 6;
            const hasSchedule = !isRestDay;
            defaultMap.set(day, { isRestDay, hasSchedule });
          }
        }
        setScheduleMap(defaultMap);
        return;
      }

      try {
        const newScheduleMap = new Map<
          number,
          { isRestDay: boolean; hasSchedule: boolean }
        >();

        for (const date of dates) {
          const day = date.getDate();

          // Use getScheduleInfo which now handles web mode correctly
          const scheduleInfo = await getScheduleInfo(
            attendanceSettingsModel,
            employmentType,
            date
          );

          newScheduleMap.set(day, {
            isRestDay: scheduleInfo.isRestDay,
            hasSchedule: scheduleInfo.hasSchedule,
          });
        }

        setScheduleMap(newScheduleMap);
      } catch (error) {
        console.error("useSchedules - Error calculating schedules:", error);
        const errorMap = new Map<
          number,
          { isRestDay: boolean; hasSchedule: boolean }
        >();
        if (dates.length > 0) {
          for (const date of dates) {
            const day = date.getDate();
            errorMap.set(day, { isRestDay: true, hasSchedule: false });
          }
        }
        setScheduleMap(errorMap);
      }
    };

    calculateSchedules();
  }, [attendanceSettingsModel, employmentType, dates, isWeb]);

  return scheduleMap;
};

// Legacy hook for single date (refactored for async)
export const useSchedule = (
  model: AttendanceSettingsModel | null,
  employmentType: EmploymentType | null,
  date: Date | null
): ScheduleInfo | null => {
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null);
  const isWeb = isWebEnvironment();

  useEffect(() => {
    if (!employmentType || !date) {
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
        // Model can be null in web mode, getScheduleInfo now handles this
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
  }, [model, employmentType?.type, date, isWeb]);

  return scheduleInfo;
};

// Utility function that can be used without the hook (now async)
export const checkHasSchedule = async (
  model: AttendanceSettingsModel | null,
  employmentType: EmploymentType | null,
  date: Date
): Promise<boolean> => {
  if (!employmentType) return false;

  // getScheduleInfo now handles null model in web mode
  const scheduleInfo = await getScheduleInfo(model, employmentType, date);
  return scheduleInfo.hasSchedule;
};

// Utility function to check if a date should be marked as absent (now async)
export const shouldMarkAsAbsent = async (
  model: AttendanceSettingsModel | null,
  employmentType: EmploymentType | null,
  date: Date,
  hasTimeEntries: boolean
): Promise<boolean> => {
  if (!employmentType) return false;

  const scheduleInfo = await getScheduleInfo(model, employmentType, date);

  if (!scheduleInfo.hasSchedule || scheduleInfo.isRestDay) {
    return false;
  }

  return !hasTimeEntries;
};
