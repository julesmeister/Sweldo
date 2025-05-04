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
import {
  EmploymentType,
  createAttendanceSettingsModel,
} from "../model/settings";
import { Tooltip } from "./Tooltip";
import { useSchedulePrint } from "../hooks/useSchedulePrint";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import { useSettingsStore } from "../stores/settingsStore";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import WeeklyPatternSchedule from "./schedule/WeeklyPatternSchedule";
import MonthSpecificSchedule from "./schedule/MonthSpecificSchedule";

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

export default function ScheduleSettings({
  employmentTypes: initialEmploymentTypes,
  onSave,
}: ScheduleSettingsProps) {
  const [employmentTypes, setEmploymentTypes] = React.useState<
    EmploymentType[]
  >(initialEmploymentTypes);
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

  // Default scheduleMode to weekly
  const [scheduleMode, setScheduleMode] = React.useState<"weekly" | "monthly">(
    "weekly"
  );

  // Initialize selectedMonth state from the global DateSelectorStore
  const [selectedMonth, setSelectedMonth] = React.useState<Date>(() => {
    const storeYear = useDateSelectorStore.getState().selectedYear;
    const storeMonthIndex = useDateSelectorStore.getState().selectedMonth; // Month is 0-indexed

    const today = new Date();
    // Use store values if they are valid numbers, otherwise default to current year/month
    const year =
      typeof storeYear === "number" ? storeYear : today.getFullYear();
    const monthIndex =
      typeof storeMonthIndex === "number" ? storeMonthIndex : today.getMonth();

    // Create a Date object for the 1st day of the target month/year
    return new Date(year, monthIndex, 1);
  });

  // State to hold the schedule for ALL loaded types for the selected month
  const [allMonthSchedules, setAllMonthSchedules] = React.useState<
    Record<string, MonthSchedule | null>
  >({});

  const [isLoadingMonthSchedule, setIsLoadingMonthSchedule] =
    React.useState(false);

  const [showMonthPicker, setShowMonthPicker] = React.useState(false);

  // Need the model instance to load/save monthly schedules
  const { dbPath, isInitialized } = useSettingsStore();
  const settingsModel = useMemo(
    () => createAttendanceSettingsModel(dbPath),
    [dbPath]
  ); // Assuming createAttendanceSettingsModel provides the necessary methods
  const initialModeChecked = useRef(false); // Ref to run effect only once

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

  // Effect to set initial schedule mode based on data existence
  useEffect(() => {
    // Ensure settings are initialized, model exists, types loaded, and check hasn't run
    if (
      !isInitialized ||
      !settingsModel ||
      employmentTypes.length === 0 ||
      initialModeChecked.current
    ) {
      return;
    }

    const checkInitialMode = async () => {
      const initialType = employmentTypes[0]?.type;
      if (!initialType) {
        initialModeChecked.current = true; // Prevent re-checking if types load later somehow
        return;
      }

      const initialYear = selectedMonth.getFullYear();
      const initialMonth = selectedMonth.getMonth() + 1;

      try {
        const initialSchedule = await settingsModel.loadMonthSchedule(
          initialType,
          initialYear,
          initialMonth
        );

        // Check if the loaded schedule is not null AND has keys (is not empty {})
        if (initialSchedule && Object.keys(initialSchedule).length > 0) {
          setScheduleMode("monthly");
        } else {
          // Default is already weekly, no need to set explicitly
        }
      } catch (error) {
        // Keep default weekly mode on error
      } finally {
        initialModeChecked.current = true; // Mark check as complete
      }
    };

    checkInitialMode();
  }, [isInitialized, settingsModel, employmentTypes, selectedMonth]); // Dependencies

  // Effect to load the specific month schedule when type or month changes
  React.useEffect(() => {
    const loadSchedule = async () => {
      // Load schedules only when in monthly mode
      if (scheduleMode !== "monthly" || employmentTypes.length === 0) {
        setAllMonthSchedules({}); // Clear schedules if not in monthly mode
        return;
      }
      setIsLoadingMonthSchedule(true);
      const newSchedules: Record<string, MonthSchedule | null> = {};
      try {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth() + 1;

        // Load schedule for all employment types
        for (const empType of employmentTypes) {
          if (empType.type) {
            // Ensure type name exists
            const schedule = await settingsModel.loadMonthSchedule(
              empType.type,
              year,
              month
            );
            newSchedules[empType.type] = schedule || {}; // Store schedule (or empty obj) by type name
          } else {
            console.warn(
              "[ScheduleSettings Load Effect] Skipping type with empty name",
              empType
            );
          }
        }

        setAllMonthSchedules(newSchedules);
      } catch (error) {
        console.error(
          "[ScheduleSettings Load Effect] Error loading month schedule:",
          error
        );
        toast.error("Failed to load schedule for this month.");
        setAllMonthSchedules({}); // Set empty on error
      } finally {
        setIsLoadingMonthSchedule(false);
      }
    };
    loadSchedule();
  }, [selectedMonth, scheduleMode, employmentTypes, settingsModel]);

  // Function to clear monthly schedules *for the current view*
  const clearCurrentMonthSchedules = () => {
    if (!employmentTypes[selectedTypeTab]) return;
    const type = employmentTypes[selectedTypeTab].type;
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth() + 1;

    // Clear the specific type from the allMonthSchedules state
    setAllMonthSchedules((prev) => ({ ...prev, [type]: {} }));

    settingsModel
      .saveMonthSchedule(type, year, month, {}) // Save empty schedule to file
      .then(() =>
        toast.success(
          `Schedules cleared for ${selectedMonth.toLocaleString("default", {
            month: "long",
            year: "numeric",
          })} for type ${type}`
        )
      )
      .catch((err) => {
        console.error("Failed to clear month schedule file:", err);
        toast.error("Failed to clear schedule file.");
        // Optionally reload the schedule to revert UI state on error
      });
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
      setEmploymentTypes(updatedTypes as EmploymentType[]);
    }
  }, [employmentTypes]);

  React.useEffect(() => {
    // Only update if there are actual changes
    if (
      JSON.stringify(employmentTypes) !== JSON.stringify(initialEmploymentTypes)
    ) {
      setEmploymentTypes(initialEmploymentTypes as EmploymentType[]);
    }
  }, [initialEmploymentTypes]);

  const [timeOff, setTimeOff] = React.useState<{
    [key: string]: { [key: number]: boolean };
  }>({});

  const handleFixedTimeChange = (index: number, value: boolean) => {
    setFixedTimeSchedule((prev) => ({ ...prev, [index]: value }));

    if (value && employmentTypes[index].schedules) {
      // Apply Monday's schedule to Tue-Sat if enabling fixed time
      const mondaySchedule = employmentTypes[index].schedules[0];
      const updatedTypes = [...employmentTypes];
      const currentType = updatedTypes[index];

      currentType.schedules = currentType.schedules?.map(
        (schedule, dayIndex) => {
          if (dayIndex > 0 && dayIndex < 6) {
            // Tue to Sat
            return {
              ...schedule,
              timeIn: mondaySchedule.timeIn,
              timeOut: mondaySchedule.timeOut,
            };
          }
          return schedule;
        }
      );

      setEmploymentTypes(updatedTypes);
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
      },
    ] as EmploymentType[]);
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

  // --- Save Core Settings --- (Monthly schedules are saved separately now)
  const handleSaveEmploymentTypes = async () => {
    try {
      // Only save the core employment types (name, hours, weekly pattern, requires tracking)
      await onSave(employmentTypes); // onSave should call model.saveTimeSettings
      toast.success("Employment types saved successfully");
    } catch (error) {
      console.error("Error saving employment types:", error);
      toast.error("Failed to save employment types");
    }
  };

  // Function to format date as YYYY-MM-DD (Keep this utility)
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  // --- Update/Get for CURRENTLY LOADED Month Schedule --- //
  const handleUpdateSchedule = React.useCallback(
    async (typeId: string, date: Date, schedule: DailySchedule) => {
      // Ensure we are updating the currently selected type and month
      if (
        typeId !== employmentTypes[selectedTypeTab]?.type ||
        date.getFullYear() !== selectedMonth.getFullYear() ||
        date.getMonth() !== selectedMonth.getMonth()
      ) {
        return;
      }

      const dateStr = formatDate(date);
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth() + 1;

      // 1. Update local state for immediate UI feedback
      const updatedMonthSchedule = {
        ...(allMonthSchedules[typeId] || {}),
        [dateStr]: schedule,
      };
      setAllMonthSchedules((prev) => ({
        ...prev,
        [typeId]: updatedMonthSchedule,
      }));

      // 2. Save the entire updated month schedule back to its file
      try {
        await settingsModel.saveMonthSchedule(
          typeId,
          year,
          month,
          updatedMonthSchedule
        );
        // Optional: add a subtle save indicator instead of toast on every change
      } catch (error) {
        console.error("Failed to save month schedule update:", error);
        toast.error("Failed to save schedule change.");
        // TODO: Consider reverting local state or adding retry logic
      }
    },
    [
      allMonthSchedules,
      settingsModel,
      employmentTypes,
      selectedTypeTab,
      selectedMonth,
    ]
  );

  // Function to get schedule for a specific date *from the currently loaded month schedule*
  const getScheduleForDate = React.useCallback(
    (typeId: string, date: Date): DailySchedule => {
      // Check if it's for the currently loaded type and month
      if (
        typeId !== employmentTypes[selectedTypeTab]?.type ||
        date.getFullYear() !== selectedMonth.getFullYear() ||
        date.getMonth() !== selectedMonth.getMonth() ||
        !allMonthSchedules
      ) {
        // If not the current month/type, or not loaded, return default
        // This might happen briefly during loading or if data is missing
        return { timeIn: "", timeOut: "", isOff: false };
      }

      const dateStr = formatDate(date);
      // Access the schedule data for the specific typeId from allMonthSchedules
      const typeSchedule = allMonthSchedules[typeId];
      const result = typeSchedule?.[dateStr] || {
        timeIn: "",
        timeOut: "",
        isOff: false,
      };

      return result;
    },
    [allMonthSchedules, employmentTypes, selectedTypeTab, selectedMonth]
  );

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

  React.useEffect(() => {}, [scheduleMode]);

  const { handlePrintSchedules } = useSchedulePrint({
    employmentTypes,
    selectedMonth,
    getScheduleForDate,
    getDaysInMonth,
  });

  const [employeesMap, setEmployeesMap] = useState<{
    [type: string]: Employee[];
  }>({});
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

  // Define handleWeeklyScheduleChange
  const handleWeeklyScheduleChange = (
    typeIndex: number,
    dayIndex: number,
    field: "timeIn" | "timeOut",
    value: string
  ) => {
    const updatedTypes = [...employmentTypes];
    const schedules = updatedTypes[typeIndex].schedules || [];
    const updatedSchedules = [...schedules];

    if (fixedTimeSchedule[typeIndex] && dayIndex === 0) {
      // Monday with Fixed Time
      for (let day = 0; day < 6; day++) {
        // Update Mon-Sat
        updatedSchedules[day] = {
          ...updatedSchedules[day],
          [field]: value,
        };
      }
    } else {
      updatedSchedules[dayIndex] = {
        ...updatedSchedules[dayIndex],
        [field]: value,
      };
    }

    updatedTypes[typeIndex].schedules = updatedSchedules;
    setEmploymentTypes(updatedTypes);
  };

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
                                  {/* Conditional Count Display */}
                                  {(() => {
                                    if (scheduleMode === "weekly") {
                                      // Weekly mode: Count days in the default pattern
                                      const scheduledDays =
                                        type.schedules?.filter(
                                          (s) => s && s.timeIn && s.timeOut
                                        ).length || 0;
                                      const totalDays =
                                        type.schedules?.length || 7;
                                      return `${scheduledDays}/${totalDays}`;
                                    } else {
                                      // Monthly mode: Calculate for each tab using its loaded data
                                      const currentTypeSchedule =
                                        allMonthSchedules[type.type];
                                      if (currentTypeSchedule) {
                                        // Check if data is loaded for this type
                                        const daysInMonth =
                                          getDaysInMonth(selectedMonth).length;
                                        const scheduledDaysCount =
                                          Object.values(
                                            currentTypeSchedule
                                          ).filter(
                                            (daySchedule) =>
                                              daySchedule &&
                                              daySchedule.timeIn &&
                                              daySchedule.timeOut &&
                                              !daySchedule.isOff
                                          ).length;
                                        return `${scheduledDaysCount}/${daysInMonth}`;
                                      } else {
                                        // Show placeholder for non-selected tabs in monthly mode
                                        return `-/-`;
                                      }
                                    }
                                  })()}
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
                          {type.requiresTimeTracking &&
                            scheduleMode === "weekly" && (
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
                            <WeeklyPatternSchedule
                              key={type.type}
                              employmentType={type}
                              employmentTypeIndex={index}
                              fixedTimeSchedule={
                                fixedTimeSchedule[index] || false
                              }
                              onFixedTimeChange={(value) =>
                                handleFixedTimeChange(index, value)
                              }
                              onScheduleChange={(dayIndex, field, value) =>
                                handleWeeklyScheduleChange(
                                  index,
                                  dayIndex,
                                  field,
                                  value
                                )
                              }
                            />
                          )}

                          {scheduleMode === "monthly" && (
                            <MonthSpecificSchedule
                              key={type.type}
                              employmentType={type}
                              selectedMonth={selectedMonth}
                              // Pass only the schedule data relevant to this specific type
                              monthScheduleData={
                                allMonthSchedules[type.type] || {}
                              }
                              isLoading={isLoadingMonthSchedule}
                              onMonthChange={handleMonthChange}
                              onUpdateSchedule={handleUpdateSchedule}
                              getScheduleForDate={getScheduleForDate}
                              onClearSchedulesForMonth={
                                clearCurrentMonthSchedules
                              }
                            />
                          )}

                          <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200/50 shadow-sm mt-6">
                            <h4 className="text-sm font-medium text-gray-700 mb-4">
                              Employees Using This Type:
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-thin">
                              {employeesMap[type.type]?.length > 0 ? (
                                employeesMap[type.type].map((employee) => (
                                  <div
                                    key={employee.id}
                                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100"
                                  >
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
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
                                <div className="text-sm text-gray-500 italic text-center py-4">
                                  No employees currently assigned this type.
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
