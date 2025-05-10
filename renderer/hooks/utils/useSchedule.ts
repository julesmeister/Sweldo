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
  attendanceSettingsModel: AttendanceSettingsModel | null,
  employmentType: EmploymentType | null,
  dates: Date[]
) => {
  const [scheduleMap, setScheduleMap] = useState<
    Map<number, { isRestDay: boolean; hasSchedule: boolean }>
  >(new Map());

  useEffect(() => {
    const calculateSchedules = async () => {
      if (!attendanceSettingsModel || !dates.length || !employmentType) {
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
          const dailySchedule =
            await attendanceSettingsModel.getScheduleForDate(
              employmentType,
              date
            );

          const hasSchedule =
            !!dailySchedule &&
            !!dailySchedule.timeIn &&
            !!dailySchedule.timeOut &&
            !dailySchedule.isOff;

          const isRestDay =
            !hasSchedule || (!!dailySchedule && dailySchedule.isOff === true);

          newScheduleMap.set(day, { isRestDay, hasSchedule });
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
