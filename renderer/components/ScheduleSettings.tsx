import React from "react";
import {
  IoWalletOutline,
  IoAddOutline,
  IoTrashOutline,
  IoTimeOutline,
  IoCalendarOutline,
} from "react-icons/io5";
import { toast } from "sonner";
import { EmploymentType } from "../model/settings";
import { Tooltip } from "./Tooltip";

interface ScheduleSettingsProps {
  employmentTypes: EmploymentType[];
  onSave: (types: EmploymentType[]) => Promise<void>;
}

export default function ScheduleSettings({
  employmentTypes: initialEmploymentTypes,
  onSave,
}: ScheduleSettingsProps) {
  const [employmentTypes, setEmploymentTypes] = React.useState<
    EmploymentType[]
  >(() => initialEmploymentTypes);
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
      setEmploymentTypes(updatedTypes);
    }
  }, [employmentTypes]);

  // Add effect to sync with parent component
  React.useEffect(() => {
    if (
      JSON.stringify(employmentTypes) !== JSON.stringify(initialEmploymentTypes)
    ) {
      setEmploymentTypes(initialEmploymentTypes);
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
    ]);
  };

  const handleRemoveEmploymentType = (index: number) => {
    setEmploymentTypes(employmentTypes.filter((_, i) => i !== index));
  };

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
    setEmploymentTypes(updatedTypes as EmploymentType[]);
  };

  const handleSaveEmploymentTypes = async () => {
    try {
      console.log("ScheduleSettings saving employment types:", employmentTypes);
      await onSave(employmentTypes);
      toast.success("Employment types saved successfully");
    } catch (error) {
      console.error("Error saving employment types:", error);
      toast.error("Failed to save employment types");
    }
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
            <button
              onClick={handleAddEmploymentType}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200 border border-blue-100 hover:border-blue-200"
            >
              <IoAddOutline className="w-5 h-5" />
              Add Employment Type
            </button>
          </div>
          <div className="space-y-8">
            <div className="col-span-2">
              <div className="space-y-6">
                <div className="relative bg-gradient-to-b from-white to-gray-50/80 rounded-xl border border-gray-200/50 p-2 shadow-sm">
                  <div className="relative">
                    {/* Scroll shadows */}
                    <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white via-white to-transparent z-10 pointer-events-none" />
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white to-transparent z-10 pointer-events-none" />

                    {/* Scrollable container */}
                    <div className="overflow-x-auto scrollbar-none">
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

                    {/* Scroll buttons */}
                    <button
                      onClick={() => {
                        const container =
                          document.querySelector(".overflow-x-auto");
                        if (container) {
                          container.scrollBy({
                            left: -200,
                            behavior: "smooth",
                          });
                        }
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg border border-gray-200/50 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200 z-20"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const container =
                          document.querySelector(".overflow-x-auto");
                        if (container) {
                          container.scrollBy({ left: 200, behavior: "smooth" });
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg border border-gray-200/50 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200 z-20"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
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
                                                timeOut: schedule.timeOut || "",
                                              });
                                              toast.success("Schedule copied");
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
                                              const newTimeOff = { ...timeOff };
                                              if (!newTimeOff[type.type]) {
                                                newTimeOff[type.type] = {};
                                              }
                                              newTimeOff[type.type][dayIndex] =
                                                !newTimeOff[type.type]?.[
                                                  dayIndex
                                                ];
                                              setTimeOff(newTimeOff);

                                              if (
                                                newTimeOff[type.type][dayIndex]
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
                                          value={schedule.timeIn || ""}
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
                                          value={schedule.timeOut || ""}
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
            <div className="pt-4">
              <button
                onClick={handleSaveEmploymentTypes}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
