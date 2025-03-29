import React, { useRef } from "react";
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
import { EmploymentType } from "../model/settings";
import { Tooltip } from "./Tooltip";

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

interface EmploymentTypeWithMonthSchedules extends EmploymentType {
  monthSchedules: {
    [yearMonth: string]: MonthSchedule;
  };
}

export default function ScheduleSettings({
  employmentTypes: initialEmploymentTypes,
  onSave,
}: ScheduleSettingsProps) {
  const [employmentTypes, setEmploymentTypes] = React.useState<
    EmploymentTypeWithMonthSchedules[]
  >(() => initialEmploymentTypes as EmploymentTypeWithMonthSchedules[]);
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

  // Add new state for month scheduling
  const [scheduleMode, setScheduleMode] = React.useState<"weekly" | "monthly">(
    "weekly"
  );
  const [selectedMonth, setSelectedMonth] = React.useState<Date>(new Date());
  const [monthSchedules, setMonthSchedules] = React.useState<{
    [typeId: string]: {
      [yearMonth: string]: MonthSchedule;
    };
  }>({});
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);

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

  // Add effect to load monthly schedules from employment types
  React.useEffect(() => {
    const loadedSchedules: {
      [typeId: string]: {
        [yearMonth: string]: MonthSchedule;
      };
    } = {};
    employmentTypes.forEach((type) => {
      if (type.monthSchedules) {
        loadedSchedules[type.type] = type.monthSchedules;
      }
    });
    setMonthSchedules(loadedSchedules);
  }, [employmentTypes]);

  // Add function to clear monthly schedules
  const clearMonthlySchedules = () => {
    const clearedSchedules: {
      [typeId: string]: {
        [yearMonth: string]: MonthSchedule;
      };
    } = {};

    // Initialize empty schedules for each employment type
    employmentTypes.forEach((type) => {
      clearedSchedules[type.type] = {};
    });

    setMonthSchedules(clearedSchedules);
    toast.success("Monthly schedules cleared");
  };

  React.useEffect(() => {
    const updatedRequiresTimeTracking = employmentTypes.reduce(
      (acc, type, index) => {
        acc[index] = type.requiresTimeTracking;
        return acc;
      },
      {} as { [key: number]: boolean }
    );
    setRequiresTimeTracking(updatedRequiresTimeTracking);

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
      console.log("Updating employment types with schedules:", updatedTypes);
      setEmploymentTypes(updatedTypes as EmploymentTypeWithMonthSchedules[]);
    }
  }, [employmentTypes]);

  // Add effect to sync with parent component
  React.useEffect(() => {
    if (
      JSON.stringify(employmentTypes) !== JSON.stringify(initialEmploymentTypes)
    ) {
      setEmploymentTypes(
        initialEmploymentTypes as EmploymentTypeWithMonthSchedules[]
      );
    }
  }, [initialEmploymentTypes]);

  const [timeOff, setTimeOff] = React.useState<{
    [key: string]: { [key: number]: boolean };
  }>({});

  const handleFixedTimeChange = (index: number, value: boolean) => {
    setFixedTimeSchedule((prev) => ({ ...prev, [index]: value }));
    if (value && employmentTypes[index].schedules) {
      const mondaySchedule = employmentTypes[index].schedules[0];
      const updatedTypes = employmentTypes.map((type, i) => {
        if (i === index) {
          return {
            ...type,
            schedules: type.schedules?.map((schedule, dayIndex) => {
              return dayIndex < 6
                ? {
                    ...schedule,
                    timeIn: mondaySchedule.timeIn,
                    timeOut: mondaySchedule.timeOut,
                  }
                : schedule;
            }),
          };
        }
        return type;
      });
      setEmploymentTypes(updatedTypes as EmploymentTypeWithMonthSchedules[]);
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
        monthSchedules: {},
      },
    ] as EmploymentTypeWithMonthSchedules[]);
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

  // Add effect to set schedule mode based on monthly data
  React.useEffect(() => {
    if (employmentTypes.length > 0) {
      const selectedType = employmentTypes[selectedTypeTab];
      const hasMonthlyData =
        selectedType.monthSchedules &&
        Object.keys(selectedType.monthSchedules).length > 0;
      setScheduleMode(hasMonthlyData ? "monthly" : "weekly");
    }
  }, [selectedTypeTab, employmentTypes]);

  // Update handleEmploymentTypeChange to handle schedule mode
  const handleEmploymentTypeChange = (
    index: number,
    field: string,
    value: string | boolean,
    additionalUpdates?: { field: string; value: string }[]
  ) => {
    console.log("Employment type change:", {
      index,
      field,
      value,
      additionalUpdates,
    });
    let updatedTypes = employmentTypes.map((type, i) => {
      if (i === index) {
        if (field.startsWith("schedules.")) {
          const [, dayIndex, timeField] = field.split(".");
          console.log("Updating schedule:", { dayIndex, timeField, value });
          const schedules = type.schedules || [
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
          console.log("Updated schedules:", updatedSchedules);
          return { ...type, schedules: updatedSchedules };
        }

        if (field === "requiresTimeTracking") {
          const requiresTimeTracking = value as boolean;
          const updatedType = {
            ...type,
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
          console.log("Updated type with time tracking:", updatedType);
          return updatedType;
        }

        const formattedValue =
          field === "type" && typeof value === "string"
            ? value.toLowerCase().replace(/\s+/g, "-")
            : value;
        return { ...type, [field]: formattedValue };
      }
      return type;
    });

    // Handle additional updates if provided
    if (additionalUpdates) {
      additionalUpdates.forEach((update) => {
        updatedTypes = updatedTypes.map((type, i) => {
          if (i === index && update.field.startsWith("schedules.")) {
            const [, dayIndex, timeField] = update.field.split(".");
            const schedules = type.schedules
              ? [...type.schedules]
              : [
                  { dayOfWeek: 1, timeIn: "", timeOut: "" },
                  { dayOfWeek: 2, timeIn: "", timeOut: "" },
                  { dayOfWeek: 3, timeIn: "", timeOut: "" },
                  { dayOfWeek: 4, timeIn: "", timeOut: "" },
                  { dayOfWeek: 5, timeIn: "", timeOut: "" },
                  { dayOfWeek: 6, timeIn: "", timeOut: "" },
                  { dayOfWeek: 7, timeIn: "", timeOut: "" },
                ];
            schedules[Number(dayIndex)] = {
              ...schedules[Number(dayIndex)],
              [timeField]: update.value,
            };
            return { ...type, schedules };
          }
          return type;
        });
      });
    }

    console.log("Final updated types:", updatedTypes);
    setEmploymentTypes(updatedTypes as EmploymentTypeWithMonthSchedules[]);
  };

  const handleSaveEmploymentTypes = async () => {
    try {
      // Prepare employment types with both weekly and monthly schedules
      const updatedTypes = employmentTypes.map((type) => ({
        ...type,
        monthSchedules: monthSchedules[type.type] || {},
      }));

      console.log("ScheduleSettings saving employment types:", updatedTypes);
      await onSave(updatedTypes);
      toast.success("Employment types saved successfully");
    } catch (error) {
      console.error("Error saving employment types:", error);
      toast.error("Failed to save employment types");
    }
  };

  // Function to get days in a month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => i + 1);
  };

  // Function to get day of week for a date
  const getDayOfWeek = (date: Date) => {
    const day = date.getDay();
    return day === 0 ? 7 : day; // Convert Sunday from 0 to 7
  };

  // Function to format date as YYYY-MM-DD
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  // Function to update schedule for a specific date
  const updateDateSchedule = (
    typeId: string,
    date: Date,
    schedule: DailySchedule
  ) => {
    const dateStr = formatDate(date);
    const yearMonth = date.toISOString().slice(0, 7); // Format: YYYY-MM

    setMonthSchedules((prev) => {
      const newSchedules = { ...prev };
      if (!newSchedules[typeId]) {
        newSchedules[typeId] = {};
      }
      if (!newSchedules[typeId][yearMonth]) {
        newSchedules[typeId][yearMonth] = {};
      }

      newSchedules[typeId][yearMonth][dateStr] = schedule;
      return newSchedules;
    });
  };

  // Function to get schedule for a specific date
  const getScheduleForDate = (typeId: string, date: Date): DailySchedule => {
    const dateStr = formatDate(date);
    const yearMonth = date.toISOString().slice(0, 7); // Format: YYYY-MM
    const monthSchedule = monthSchedules[typeId]?.[yearMonth]?.[dateStr];

    // If there's a month-specific schedule, return it
    if (monthSchedule) {
      return monthSchedule;
    }

    // If no month-specific schedule exists, return empty schedule
    // This prevents showing weekly schedule data in the monthly view
    return {
      timeIn: "",
      timeOut: "",
      isOff: false,
    };
  };

  // Add color scheme for different schedule patterns
  const getScheduleColor = (
    timeIn: string,
    timeOut: string,
    isOff?: boolean
  ) => {
    if (isOff) return "bg-gray-50 border-gray-200";

    // If no time is set, return default color
    if (!timeIn || !timeOut) return "bg-white border-gray-200";

    // Convert time strings to hours for comparison
    const [inHour] = timeIn.split(":").map(Number);
    const [outHour] = timeOut.split(":").map(Number);

    // Define color schemes for different time ranges
    const colorSchemes: { [key: string]: string } = {
      early: "bg-blue-50 border-blue-200 hover:border-blue-300", // 4-8 AM
      morning: "bg-green-50 border-green-200 hover:border-green-300", // 8-12 PM
      afternoon: "bg-orange-50 border-orange-200 hover:border-orange-300", // 12-4 PM
      evening: "bg-purple-50 border-purple-200 hover:border-purple-300", // 4-8 PM
      night: "bg-indigo-50 border-indigo-200 hover:border-indigo-300", // 8-12 AM
      late: "bg-rose-50 border-rose-200 hover:border-rose-300", // 12-4 AM
    };

    // Determine which time range the schedule falls into
    let timeRange = "default";
    if (inHour >= 4 && inHour < 8) timeRange = "early";
    else if (inHour >= 8 && inHour < 12) timeRange = "morning";
    else if (inHour >= 12 && inHour < 16) timeRange = "afternoon";
    else if (inHour >= 16 && inHour < 20) timeRange = "evening";
    else if (inHour >= 20 && inHour < 24) timeRange = "night";
    else if (inHour >= 0 && inHour < 4) timeRange = "late";

    return colorSchemes[timeRange] || "bg-white border-gray-200";
  };

  // Add the month schedule UI component
  const MonthScheduleView = ({
    type,
    index,
  }: {
    type: EmploymentTypeWithMonthSchedules;
    index: number;
  }) => {
    const days = getDaysInMonth(selectedMonth);
    const firstDayOfMonth = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      1
    );
    const startingDayOfWeek = getDayOfWeek(firstDayOfMonth);

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newDate = new Date(selectedMonth);
                newDate.setMonth(selectedMonth.getMonth() - 1);
                setSelectedMonth(newDate);
              }}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <h4 className="text-lg font-medium text-gray-900">
              {selectedMonth.toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            <button
              onClick={() => {
                const newDate = new Date(selectedMonth);
                newDate.setMonth(selectedMonth.getMonth() + 1);
                setSelectedMonth(newDate);
              }}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowMonthPicker(true);
              }}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <IoCalendarOutline className="w-4 h-4" />
              Change Month
            </button>
            <button
              onClick={clearMonthlySchedules}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <IoTrashOutline className="w-4 h-4" />
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="text-center font-medium text-gray-600 py-2"
            >
              {day}
            </div>
          ))}

          {/* Empty cells for days before the first of the month */}
          {Array.from({ length: startingDayOfWeek - 1 }).map((_, i) => (
            <div key={`empty-${i}`} className="h-32 bg-gray-50 rounded-lg" />
          ))}

          {/* Calendar days */}
          {days.map((day) => {
            const date = new Date(
              selectedMonth.getFullYear(),
              selectedMonth.getMonth(),
              day
            );
            const schedule = getScheduleForDate(type.type, date);
            const scheduleColor = getScheduleColor(
              schedule.timeIn,
              schedule.timeOut,
              schedule.isOff
            );

            return (
              <div
                key={day}
                className={`h-32 p-2 rounded-lg transition-colors ${scheduleColor}`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium">{day}</span>
                  <div className="flex items-center gap-1">
                    <Tooltip
                      content="Copy Schedule"
                      position="top"
                      width="130px"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopiedSchedule({
                            timeIn: schedule.timeIn || "",
                            timeOut: schedule.timeOut || "",
                          });
                          toast.success("Schedule copied");
                        }}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                            updateDateSchedule(type.type, date, {
                              ...schedule,
                              timeIn: copiedSchedule.timeIn,
                              timeOut: copiedSchedule.timeOut,
                            });
                            toast.success("Schedule pasted");
                          }}
                          className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                    <button
                      onClick={() => {
                        const isOff = !schedule.isOff;
                        updateDateSchedule(type.type, date, {
                          ...schedule,
                          isOff,
                          timeIn: isOff ? "" : schedule.timeIn,
                          timeOut: isOff ? "" : schedule.timeOut,
                        });
                      }}
                      className={`px-2 py-0.5 text-xs rounded ${
                        schedule.isOff
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {schedule.isOff ? "Off" : "Working"}
                    </button>
                  </div>
                </div>

                {!schedule.isOff && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="time"
                      value={schedule.timeIn}
                      onChange={(e) => {
                        updateDateSchedule(type.type, date, {
                          ...schedule,
                          timeIn: e.target.value,
                        });
                      }}
                      className="w-full text-xs p-1 rounded border focus:border-blue-500 focus:ring focus:ring-blue-500/20"
                    />
                    <input
                      type="time"
                      value={schedule.timeOut}
                      onChange={(e) => {
                        updateDateSchedule(type.type, date, {
                          ...schedule,
                          timeOut: e.target.value,
                        });
                      }}
                      className="w-full text-xs p-1 rounded border focus:border-blue-500 focus:ring focus:ring-blue-500/20"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
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
                  onClick={() => {
                    const selectedType = employmentTypes[selectedTypeTab];
                    const hasMonthlyData =
                      selectedType.monthSchedules &&
                      Object.keys(selectedType.monthSchedules).length > 0;
                    if (hasMonthlyData) {
                      toast.warning(
                        "This employment type has monthly schedules. Switching to monthly mode."
                      );
                      setScheduleMode("monthly");
                    } else {
                      setScheduleMode("weekly");
                    }
                  }}
                  className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 ${
                    scheduleMode === "weekly"
                      ? "bg-blue-100 text-blue-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  Weekly Pattern
                </button>
                <button
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
                            className={`group relative min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                              selectedTypeTab === index
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            <div className="relative">
                              <span className="relative z-10 flex items-center gap-2">
                                {type.type || `Type ${index + 1}`}
                                <span
                                  className={`px-2 py-0.5 text-xs rounded-full transition-all duration-200 ${
                                    selectedTypeTab === index
                                      ? "bg-white/20 text-white"
                                      : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                                  }`}
                                >
                                  {type.schedules?.filter(
                                    (s) => s.timeIn && s.timeOut
                                  ).length || 0}
                                  /{type.schedules?.length || 0}
                                </span>
                              </span>
                              {selectedTypeTab === index && (
                                <div className="absolute inset-0 bg-blue-500 rounded-lg transition-all duration-200 animate-pulse opacity-50 blur-xl" />
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
                          {type.requiresTimeTracking && (
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
                      {type.requiresTimeTracking ? (
                        <div className="col-span-2 mt-4">
                          {/* Weekly schedule view */}
                          {scheduleMode === "weekly" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {(type.schedules || []).map(
                                (schedule, dayIndex) => (
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
                                          <Tooltip
                                            content="Copy Schedule"
                                            position="top"
                                            width="130px"
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setCopiedSchedule({
                                                  timeIn: schedule.timeIn || "",
                                                  timeOut:
                                                    schedule.timeOut || "",
                                                });
                                                toast.success(
                                                  "Schedule copied"
                                                );
                                              }}
                                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                                                  handleEmploymentTypeChange(
                                                    index,
                                                    `schedules.${dayIndex}.timeIn`,
                                                    copiedSchedule.timeIn,
                                                    [
                                                      {
                                                        field: `schedules.${dayIndex}.timeOut`,
                                                        value:
                                                          copiedSchedule.timeOut,
                                                      },
                                                    ]
                                                  );
                                                  toast.success(
                                                    "Schedule pasted"
                                                  );
                                                }}
                                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                                          <Tooltip
                                            content="Day Off"
                                            position="left"
                                            width="100px"
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const newTimeOff = {
                                                  ...timeOff,
                                                };
                                                if (!newTimeOff[type.type]) {
                                                  newTimeOff[type.type] = {};
                                                }
                                                newTimeOff[type.type][
                                                  dayIndex
                                                ] =
                                                  !newTimeOff[type.type]?.[
                                                    dayIndex
                                                  ];
                                                setTimeOff(newTimeOff);

                                                if (
                                                  newTimeOff[type.type][
                                                    dayIndex
                                                  ]
                                                ) {
                                                  handleEmploymentTypeChange(
                                                    index,
                                                    `schedules.${dayIndex}.timeIn`,
                                                    "",
                                                    [
                                                      {
                                                        field: `schedules.${dayIndex}.timeOut`,
                                                        value: "",
                                                      },
                                                    ]
                                                  );
                                                }
                                              }}
                                              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                                timeOff[type.type]?.[dayIndex]
                                                  ? "bg-blue-500"
                                                  : "bg-gray-200"
                                              }`}
                                            >
                                              <span
                                                className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white shadow-sm ${
                                                  timeOff[type.type]?.[dayIndex]
                                                    ? "translate-x-6"
                                                    : "translate-x-1"
                                                }`}
                                              />
                                            </button>
                                          </Tooltip>
                                        </div>
                                      </h3>
                                      <div className="space-y-4">
                                        <div>
                                          <label className="text-sm font-medium text-gray-600">
                                            Time In
                                          </label>
                                          <input
                                            type="time"
                                            name={`timeIn-${index}-${dayIndex}`}
                                            value={schedule.timeIn}
                                            onChange={(e) =>
                                              handleEmploymentTypeChange(
                                                index,
                                                `schedules.${dayIndex}.timeIn`,
                                                e.target.value
                                              )
                                            }
                                            disabled={
                                              timeOff[type.type]?.[dayIndex]
                                            }
                                            className={`mt-1 block w-full rounded-lg border-2 ${
                                              timeOff[type.type]?.[dayIndex]
                                                ? "bg-gray-50 cursor-not-allowed"
                                                : "hover:border-blue-400"
                                            } border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3`}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium text-gray-600">
                                            Time Out
                                          </label>
                                          <input
                                            type="time"
                                            name={`timeOut-${index}-${dayIndex}`}
                                            value={schedule.timeOut}
                                            onChange={(e) =>
                                              handleEmploymentTypeChange(
                                                index,
                                                `schedules.${dayIndex}.timeOut`,
                                                e.target.value
                                              )
                                            }
                                            disabled={
                                              timeOff[type.type]?.[dayIndex]
                                            }
                                            className={`mt-1 block w-full rounded-lg border-2 ${
                                              timeOff[type.type]?.[dayIndex]
                                                ? "bg-gray-50 cursor-not-allowed"
                                                : "hover:border-blue-400"
                                            } border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 sm:text-sm h-10 px-3`}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          {/* Monthly schedule view */}
                          {scheduleMode === "monthly" && (
                            <MonthScheduleView
                              key={index}
                              type={type}
                              index={index}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="col-span-2 mt-4">
                          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-dashed border-gray-200 p-8">
                            <div className="max-w-2xl mx-auto text-center">
                              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 mb-4">
                                <svg
                                  className="w-6 h-6 text-blue-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                  />
                                </svg>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Simplified Attendance Tracking
                              </h3>
                              <p className="text-gray-600 mb-6">
                                Time tracking is disabled for this employment
                                type. Instead of recording specific time-in and
                                time-out, employees can be marked as present or
                                absent with a simple checkbox.
                              </p>
                              <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg text-blue-700 text-sm">
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                  />
                                </svg>
                                Perfect for roles with flexible hours or
                                project-based work
                              </div>
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
