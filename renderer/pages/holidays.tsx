"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { toast } from "sonner";
import { Holiday, createHolidayModel } from "@/renderer/model/holiday";
import { createAttendanceSettingsModel } from "@/renderer/model/settings";
import HolidayForm from "@/renderer/components/HolidayForm";
import { fetchHolidays } from "@/renderer/services/fetchHolidays";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";
import path from "path";

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [suggestedHolidays, setSuggestedHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | undefined>(
    undefined
  );
  const [attendanceSettings, setAttendanceSettings] = useState<{
    regularHolidayMultiplier: number;
    specialHolidayMultiplier: number;
  } | null>(null);
  const { dbPath } = useSettingsStore();

  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMonth = localStorage.getItem("selectedMonth");
      setStoredMonth(storedMonth);

      let storedYear = localStorage.getItem("selectedYear");
      if (!storedYear) {
        const currentYear = new Date().getFullYear().toString();
        localStorage.setItem("selectedYear", currentYear);
        storedYear = currentYear;
      }
      setStoredYear(storedYear);
    }
  }, []);

  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
    caretLeft: number;
  } | null>(null);

  const [currentHeight, setCurrentHeight] = useState(0);

  useEffect(() => {
    const updateHeights = () => {
      const currentSection = document.querySelector(".current-holidays");
      const suggestedSection = document.querySelector(".suggested-holidays");

      if (currentSection && suggestedSection) {
        // Get the content height without padding
        const currentContent = currentSection.querySelector(".px-4.py-5");
        const suggestedContent = suggestedSection.querySelector(".px-4.py-5");

        if (currentContent && suggestedContent) {
          const currentHeight = currentContent.scrollHeight;
          const suggestedHeight = suggestedContent.scrollHeight;

          const maxHeight = Math.max(currentHeight, suggestedHeight);
          setCurrentHeight(maxHeight);
        }
      }
    };

    // Update heights on initial render and when data changes
    updateHeights();

    // Update on window resize
    window.addEventListener("resize", updateHeights);

    // Update when holidays or suggested holidays change
    const observer = new MutationObserver(updateHeights);
    const config = { childList: true, subtree: true };

    if (document.querySelector(".current-holidays")) {
      observer.observe(document.querySelector(".current-holidays")!, config);
    }
    if (document.querySelector(".suggested-holidays")) {
      observer.observe(document.querySelector(".suggested-holidays")!, config);
    }

    return () => {
      window.removeEventListener("resize", updateHeights);
      observer.disconnect();
    };
  }, [holidays, suggestedHolidays]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsModel = createAttendanceSettingsModel(dbPath);
        const settings = await settingsModel.loadAttendanceSettings();
        setAttendanceSettings(settings);
      } catch (error) {
        console.error("Error loading attendance settings:", error);
      }
    };
    loadSettings();
  }, [dbPath]);

  const setDialogPosition = (event: React.MouseEvent, holiday: Holiday) => {
    event.stopPropagation(); // Prevent event bubbling
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 400; // Approximate height of dialog
    const dialogWidth = 400; // Approximate width of dialog
    const spacing = 8; // Space between dialog and trigger

    // Calculate vertical position
    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove
      ? rect.top - dialogHeight - spacing
      : rect.bottom + spacing;

    // Calculate horizontal position
    // Center the dialog relative to the clicked element
    let left = rect.left + rect.width / 2 - dialogWidth / 2;

    // Keep dialog within window bounds
    left = Math.max(
      spacing,
      Math.min(left, windowWidth - dialogWidth - spacing)
    );

    // Calculate caret position relative to the dialog
    const caretLeft = rect.left + rect.width / 2 - left;

    setClickPosition({
      top,
      left,
      showAbove,
      caretLeft,
    });

    setSelectedHoliday(holiday);
    setIsDialogOpen(true);
  };

  const handleNewHolidayClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent event bubbling
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 400; // Approximate height of dialog
    const dialogWidth = 400; // Approximate width of dialog
    const spacing = 8; // Space between dialog and trigger

    // Calculate vertical position
    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove
      ? rect.top - dialogHeight - spacing
      : rect.bottom + spacing;

    // Calculate horizontal position
    // Center the dialog relative to the clicked element
    let left = rect.left + rect.width / 2 - dialogWidth / 2;

    // Keep dialog within window bounds
    left = Math.max(
      spacing,
      Math.min(left, windowWidth - dialogWidth - spacing)
    );

    // Calculate caret position relative to the dialog
    const caretLeft = rect.left + rect.width / 2 - left;

    setClickPosition({
      top,
      left,
      showAbove,
      caretLeft,
    });

    setSelectedHoliday(undefined);
    setIsDialogOpen(true);
  };

  const handleSuggestedHolidayClick = (
    holiday: Holiday,
    event: React.MouseEvent
  ) => {
    setDialogPosition(event, holiday);
  };

  const loadSuggestedHolidays = async () => {
    if (holidays.length === 0 && storedYear && storedMonth) {
      setIsLoading(true);
      try {
        const year = parseInt(storedYear, 10);
        const month = parseInt(storedMonth, 10) + 1; // Convert from 0-based to 1-based
        const suggestions = await fetchHolidays(year);

        // Filter holidays for the selected month
        const monthHolidays = suggestions.filter((holiday) => {
          const holidayMonth = new Date(holiday.startDate).getMonth() + 1; // Convert to 1-based
          return holidayMonth === month;
        });

        if (monthHolidays.length > 0) {
          setSuggestedHolidays(monthHolidays);
        } else {
          console.warn("No holidays found for month:", month);
        }
      } catch (error) {
        console.error("Error fetching suggested holidays:", error);
        toast.error(
          "Failed to load holiday suggestions. Please try again later."
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadSuggestedHolidays();
    if (!dbPath) {
      console.error("Invalid dbPath:", dbPath);
      return; // Prevent further execution if dbPath is invalid
    }

    const holidayModel = createHolidayModel(
      dbPath,
      parseInt(storedYear!, 10),
      parseInt(storedMonth!, 10) + 1
    );
    holidayModel.loadHolidays().then((loadedHolidays) => {
      setHolidays(loadedHolidays); // Update the state with loaded holidays
    });
  }, [holidays.length, storedYear, storedMonth]);

  useEffect(() => {}, [selectedHoliday]);

  function handleSaveHoliday(data: Holiday): void {
    if (!dbPath) {
      console.error("Invalid dbPath:", dbPath);
      return;
    }

    const holidayModel = createHolidayModel(
      dbPath,
      parseInt(storedYear!, 10),
      parseInt(storedMonth!, 10) + 1
    );
    holidayModel.saveOrUpdateHoliday(data).then(() => {
      holidayModel.loadHolidays().then((loadedHolidays) => {
        setHolidays(loadedHolidays); // Update the state with loaded holidays
      });
    });
  }

  return (
    <RootLayout>
      <main className="max-w-12xl mx-auto py-12 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Existing Holidays Section */}
            <MagicCard
              className="p-0.5 rounded-lg col-span-2"
              gradientSize={200}
              gradientColor="#9E7AFF"
              gradientOpacity={0.8}
              gradientFrom="#9E7AFF"
              gradientTo="#FE8BBB"
            >
              <div
                className="bg-white shadow rounded-lg col-span-2 current-holidays"
                style={{ height: currentHeight }}
              >
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium text-gray-900">
                      Current Holidays
                    </h2>
                    {holidays.filter((holiday) => {
                      const startDate = new Date(holiday.startDate);
                      const endDate = new Date(holiday.endDate);
                      return (
                        !isNaN(startDate.getTime()) &&
                        !isNaN(endDate.getTime()) &&
                        !isNaN(holiday.multiplier)
                      );
                    }).length > 0 && (
                      <AddButton
                        text="Add Holiday"
                        onClick={handleNewHolidayClick}
                      />
                    )}
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : holidays.filter((holiday) => {
                      const startDate = new Date(holiday.startDate);
                      const endDate = new Date(holiday.endDate);
                      return (
                        !isNaN(startDate.getTime()) &&
                        !isNaN(endDate.getTime()) &&
                        !isNaN(holiday.multiplier)
                      );
                    }).length > 0 ? (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr className="bg-gray-50">
                            <th
                              scope="col"
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-2/4"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Date</span>
                              </div>
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-2/4"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Name</span>
                              </div>
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Type</span>
                              </div>
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4"
                            >
                              <div className="flex items-center space-x-1">
                                <span>Multiplier</span>
                              </div>
                            </th>
                            <th
                              scope="col"
                              className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                            >
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {holidays
                            .filter((holiday) => {
                              const startDate = new Date(holiday.startDate);
                              const endDate = new Date(holiday.endDate);
                              return (
                                !isNaN(startDate.getTime()) &&
                                !isNaN(endDate.getTime()) &&
                                !isNaN(holiday.multiplier)
                              );
                            })
                            .map((holiday) => (
                              <tr
                                key={holiday.id}
                                className="hover:bg-gray-50 cursor-pointer transition-colors duration-150 ease-in-out"
                                onClick={(e) => setDialogPosition(e, holiday)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {new Date(
                                      holiday.startDate
                                    ).toLocaleDateString()}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {new Date(
                                      holiday.endDate
                                    ).toLocaleDateString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {holiday.name}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${
                                      holiday.type === "Regular"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-purple-100 text-purple-800"
                                    }`}
                                  >
                                    {holiday.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {attendanceSettings
                                      ? holiday.type === "Regular"
                                        ? attendanceSettings.regularHolidayMultiplier
                                        : attendanceSettings.specialHolidayMultiplier
                                      : holiday.multiplier}
                                    x
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Handle delete
                                      const holidayModel = createHolidayModel(
                                        dbPath,
                                        parseInt(storedYear!, 10),
                                        parseInt(storedMonth!, 10) + 1
                                      );
                                      holidayModel
                                        .deleteHoliday(holiday.id)
                                        .then(() => {
                                          holidayModel
                                            .loadHolidays()
                                            .then((loadedHolidays) => {
                                              setHolidays(loadedHolidays); // Update the state with loaded holidays
                                              toast.success(
                                                `Deleted holiday ${holiday.name}`
                                              );
                                            });
                                        });
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 ease-in-out"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">
                        {isLoading
                          ? "Loading holidays..."
                          : "No holidays added yet."}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Click "Add Holiday" or select from suggestions to add
                        one.
                      </p>
                      <div className="mt-6">
                        <AddButton
                          text="Add Holiday"
                          onClick={handleNewHolidayClick}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </MagicCard>

            {/* Suggested Holidays Section */}
            <MagicCard
              className="p-0.5 rounded-lg"
              gradientSize={200}
              gradientColor="#9E7AFF"
              gradientOpacity={0.8}
              gradientFrom="#9E7AFF"
              gradientTo="#FE8BBB"
            >
              <div
                className="bg-white shadow rounded-lg suggested-holidays"
                style={{ height: currentHeight }}
              >
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Suggested Holidays for{" "}
                    {new Date(
                      parseInt(storedYear!),
                      parseInt(storedMonth!),
                      1
                    ).toLocaleString("default", { month: "long" })}{" "}
                    {storedYear!}
                  </h2>
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-blue-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Important Tip:</span>{" "}
                          Please ensure the holiday dates are correct. For
                          single-day holidays, set both start and end dates to
                          the same day.
                        </p>
                      </div>
                    </div>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : suggestedHolidays.length > 0 ? (
                    <div className="space-y-3">
                      {suggestedHolidays.map((holiday) => (
                        <div
                          key={holiday.id}
                          onClick={(e) =>
                            handleSuggestedHolidayClick(holiday, e)
                          }
                          className="group relative flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
                              {holiday.name}
                            </h3>
                            <div className="mt-1 flex items-center space-x-2 text-sm text-gray-500">
                              <span>
                                {new Date(
                                  holiday.startDate
                                ).toLocaleDateString()}
                              </span>
                              {new Date(holiday.startDate).toDateString() !==
                                new Date(holiday.endDate).toDateString() && (
                                <>
                                  <span>-</span>
                                  <span>
                                    {new Date(
                                      holiday.endDate
                                    ).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="ml-4 flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                holiday.type === "Regular"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {holiday.type}
                            </span>
                            <span className="text-sm text-gray-500">
                              {attendanceSettings
                                ? holiday.type === "Regular"
                                  ? attendanceSettings.regularHolidayMultiplier
                                  : attendanceSettings.specialHolidayMultiplier
                                : holiday.multiplier}
                              x
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">
                        No holiday suggestions available for this month.
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        You can still add holidays manually.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </MagicCard>
          </div>
        </div>
        {isDialogOpen && (
          <div className="fixed inset-0 bg-black opacity-50 z-40" />
        )}
        {isDialogOpen && (
          <div className="fixed inset-0 z-50">
            <HolidayForm
              onClose={() => {
                setIsDialogOpen(false);
                setClickPosition(null);
              }}
              onSave={handleSaveHoliday}
              initialData={selectedHoliday}
              position={clickPosition!}
            />
          </div>
        )}
      </main>
    </RootLayout>
  );
}
