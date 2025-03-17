import React from "react";
import { IoWalletOutline } from "react-icons/io5";
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
      if (type.requiresTimeTracking && !type.schedules) {
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
    if (JSON.stringify(updatedTypes) !== JSON.stringify(employmentTypes)) {
      setEmploymentTypes(updatedTypes);
    }
  }, []);
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
    let updatedTypes = employmentTypes.map((type, i) => {
      if (i === index) {
        if (field.startsWith("schedules.")) {
          const [, dayIndex, timeField] = field.split(".");
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
          return { ...type, schedules: updatedSchedules };
        }

        if (field === "requiresTimeTracking") {
          return {
            ...type,
            requiresTimeTracking: value,
            schedules: value
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
            const schedules = type.schedules ? [...type.schedules] : [];
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

    setEmploymentTypes(updatedTypes as EmploymentType[]);
  };

  const handleSaveEmploymentTypes = async () => {
    try {
      await onSave(employmentTypes);
      toast.success("Employment types saved successfully");
    } catch (error) {
      console.error("Error saving employment types:", error);
      toast.error("Failed to save employment types");
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <IoWalletOutline className="w-5 h-5 text-blue-600" />
            Employment Types
          </h3>
          <div className="space-y-6">
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={handleAddEmploymentType}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                >
                  Add Type
                </button>
              </div>
              <div className="space-y-4">
                <div className="border-b border-gray-200">
                  <nav
                    className="-mb-px flex space-x-4"
                    aria-label="Employment Types"
                  >
                    {employmentTypes.map((type, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedTypeTab(index)}
                        className={`whitespace-nowrap py-2 px-4 border-b-2 font-medium text-sm ${
                          selectedTypeTab === index
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {type.type || `Type ${index + 1}`}
                      </button>
                    ))}
                  </nav>
                </div>
                {employmentTypes.map((type, index) => (
                  <div
                    key={index}
                    className={`p-4 border-2 border-gray-200 rounded-lg ${
                      selectedTypeTab === index ? "block" : "hidden"
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 flex items-center justify-between gap-4">
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
                            className="block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3"
                          />
                        </div>
                        <div className="flex flex-row gap-4 items-center min-w-[200px]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 pr-5">
                              Requires Time Tracking
                            </span>
                            <button
                              onClick={() =>
                                handleEmploymentTypeChange(
                                  index,
                                  "requiresTimeTracking",
                                  !type.requiresTimeTracking
                                )
                              }
                              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none ${
                                type.requiresTimeTracking
                                  ? "bg-blue-500"
                                  : "bg-gray-700"
                              }`}
                            >
                              <span
                                className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white ${
                                  type.requiresTimeTracking
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                          {type.requiresTimeTracking && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700 pr-5">
                                Fixed Time Schedule
                              </span>
                              <button
                                onClick={() =>
                                  handleFixedTimeChange(
                                    index,
                                    !fixedTimeSchedule[index]
                                  )
                                }
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none ${
                                  fixedTimeSchedule[index]
                                    ? "bg-blue-500"
                                    : "bg-gray-700"
                                }`}
                              >
                                <span
                                  className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white ${
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
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                      {type.requiresTimeTracking && (
                        <div className="col-span-2 mt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {(type.schedules || []).map(
                              (schedule, dayIndex) => (
                                <div
                                  key={dayIndex}
                                  className={`p-4 rounded-lg border-2 ${
                                    selectedDayTab === dayIndex
                                      ? "border-blue-500 bg-blue-50"
                                      : "border-gray-200 hover:border-blue-300"
                                  }
                                cursor-pointer transition-all duration-200`}
                                  onClick={() => setSelectedDayTab(dayIndex)}
                                >
                                  <div className="flex flex-col space-y-3">
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
                                          width="120px"
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
                                            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
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
                                            width="120px"
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
                                              className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
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
                                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none ${
                                              timeOff[type.type]?.[dayIndex]
                                                ? "bg-blue-500"
                                                : "bg-gray-700"
                                            }`}
                                          >
                                            <span
                                              className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white ${
                                                timeOff[type.type]?.[dayIndex]
                                                  ? "translate-x-6"
                                                  : "translate-x-1"
                                              }`}
                                            />
                                          </button>
                                        </Tooltip>
                                      </div>
                                    </h3>
                                    <div className="space-y-2">
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
                                          className={`mt-1 block w-full rounded-md border-2 ${
                                            timeOff[type.type]?.[dayIndex]
                                              ? "bg-gray-100"
                                              : ""
                                          } border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3`}
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
                                          className={`mt-1 block w-full rounded-md border-2 ${
                                            timeOff[type.type]?.[dayIndex]
                                              ? "bg-gray-100"
                                              : ""
                                          } border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 px-3`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
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
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
