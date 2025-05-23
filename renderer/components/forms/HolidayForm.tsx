import React, { useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { Holiday } from "@/renderer/model/holiday";
import { createAttendanceSettingsModel } from "@/renderer/model/settings";
import { useSettingsStore } from "@/renderer/stores/settingsStore";

interface Position {
  top: number;
  left: number;
  showAbove?: boolean;
  caretLeft?: number;
}

interface HolidayFormProps {
  onClose: () => void;
  onSave: (holiday: Holiday) => void;
  initialData?: Holiday;
  position: Position;
}

export default function HolidayForm({
  onClose,
  onSave,
  initialData,
  position,
}: HolidayFormProps) {
  if (!position) {
    return null; // Prevent rendering if position is not set
  }

  const storedMonth = localStorage.getItem("selectedMonth");
  let storedMonthInt = storedMonth
    ? parseInt(storedMonth, 10)
    : new Date().getMonth();
  if (isNaN(storedMonthInt) || storedMonthInt < 1 || storedMonthInt > 12) {
    storedMonthInt = new Date().getMonth();
  }

  let storedYear = localStorage.getItem("selectedYear");
  if (!storedYear || isNaN(parseInt(storedYear))) {
    const currentYear = new Date().getFullYear().toString();
    localStorage.setItem("selectedYear", currentYear);
    storedYear = currentYear;
  }

  const [name, setName] = useState(initialData?.name || "");
  const [startDate, setStartDate] = useState(
    initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : new Date(
          `${storedYear}-${String(storedMonthInt + 1).padStart(2, "0")}-01`
        )
          .toISOString()
          .split("T")[0] // Ensure month is padded
  );
  // End date will now mirror start date
  const [endDate, setEndDate] = useState(startDate); // Initialize endDate with startDate

  const [type, setType] = useState<"Regular" | "Special">(
    initialData?.type || "Regular"
  );
  const [multiplier, setMultiplier] = useState(initialData?.multiplier || 1);
  const [errors, setErrors] = useState<{
    name?: string;
    dates?: string;
    multiplier?: string;
  }>({});
  const [attendanceSettings, setAttendanceSettings] = useState<{
    regularHolidayMultiplier: number;
    specialHolidayMultiplier: number;
  } | null>(null);
  const { dbPath } = useSettingsStore();

  // Update useEffect to set endDate when startDate changes
  useEffect(() => {
    setEndDate(startDate);
  }, [startDate]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsModel = createAttendanceSettingsModel(dbPath);
        const settings = await settingsModel.loadAttendanceSettings();
        setAttendanceSettings(settings);

        // Only set initial multiplier on first load or when initialData changes
        if (!attendanceSettings) {
          if (initialData) {
            setMultiplier(
              initialData.type === "Regular"
                ? settings.regularHolidayMultiplier
                : settings.specialHolidayMultiplier
            );
          } else {
            setMultiplier(
              type === "Regular"
                ? settings.regularHolidayMultiplier
                : settings.specialHolidayMultiplier
            );
          }
        }
      } catch (error) {
        console.error("Error loading attendance settings:", error);
      }
    };
    loadSettings();
    // Depend on initialData and dbPath. Type changes are handled by handleTypeChange.
  }, [initialData, dbPath]);

  const handleTypeChange = (newType: "Regular" | "Special") => {
    setType(newType);
    if (attendanceSettings) {
      const newMultiplier =
        newType === "Regular"
          ? attendanceSettings.regularHolidayMultiplier
          : attendanceSettings.specialHolidayMultiplier;
      console.log(
        `[HolidayForm] Setting multiplier to ${newMultiplier} for ${newType} type`
      );
      setMultiplier(newMultiplier);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      name?: string;
      // dates?: string; // No longer needed as end date mirrors start date
      multiplier?: string;
    } = {};

    if (!name.trim()) {
      newErrors.name = "Holiday name is required";
    }

    // const start = new Date(startDate);
    // const end = new Date(endDate); // endDate is always >= startDate now

    // if (end < start) { // This validation is no longer necessary
    //   newErrors.dates = 'End date cannot be before start date';
    // }

    if (multiplier <= 0) {
      newErrors.multiplier = "Multiplier must be greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Ensure endDate is correctly formatted from state
    const finalEndDate = new Date(endDate);

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      name,
      startDate: new Date(startDate),
      endDate: finalEndDate, // Use the state endDate which mirrors startDate
      type,
      multiplier,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700"
        style={{
          top: position.top,
          // Shift the modal left by 150px, adjust as needed
          left: position.left - 150,
          width: "560px",
          transform: "translate(0, 0)", // Keep transform if needed for other positioning, otherwise could use translate
          zIndex: 50,
        }}
      >
        {/* Caret - outer border */}
        <div
          className="absolute"
          style={{
            // Keep caretLeft relative to the original trigger position
            left: position.caretLeft ? position.caretLeft + 150 : undefined, // Add the offset back to keep caret in place
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            ...(position.showAbove
              ? {
                  bottom: "-8px",
                  borderTop: "8px solid rgb(55, 65, 81)",
                }
              : {
                  top: "-8px",
                  borderBottom: "8px solid rgb(55, 65, 81)",
                }),
          }}
        />
        {/* Caret - inner fill */}
        <div
          className="absolute"
          style={{
            // Keep caretLeft relative to the original trigger position
            left: position.caretLeft ? position.caretLeft + 150 : undefined, // Add the offset back to keep caret in place
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            ...(position.showAbove
              ? {
                  bottom: "-6px",
                  borderTop: "7px solid rgb(31, 41, 55)",
                }
              : {
                  top: "-6px",
                  borderBottom: "7px solid rgb(31, 41, 55)",
                }),
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 rounded-t-lg">
          <h2 className="text-lg font-semibold text-gray-100">
            {initialData ? "Edit Holiday" : "Add Holiday"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
          >
            <IoClose size={24} />
          </button>
        </div>

        {/* Form Content */}
        <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Name and Multiplier */}
            <div className="grid grid-cols-2 gap-4">
              {/* Holiday Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors({ ...errors, name: undefined });
                  }}
                  className={`block w-full bg-gray-800 border ${
                    errors.name ? "border-red-500" : "border-gray-700"
                  } rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600`}
                  required
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Pay Multiplier */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Pay Multiplier
                </label>
                <input
                  type="number"
                  value={multiplier}
                  min="0.1"
                  step="0.1"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMultiplier(isNaN(val) ? 0 : val); // Handle potential NaN
                    setErrors({ ...errors, multiplier: undefined });
                  }}
                  className={`block w-full bg-gray-800 border ${
                    errors.multiplier ? "border-red-500" : "border-gray-700"
                  } rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover-gray-600`}
                  required
                />
                {errors.multiplier && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.multiplier}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Start Date, End Date, and Type */}
            <div className="grid grid-cols-3 gap-4">
              {" "}
              {/* Changed to grid-cols-3 */}
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                  }}
                  className={`block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600 [color-scheme:dark]`}
                  required
                />
              </div>
              {/* End Date (Read Only) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate} // Value is synced with startDate via useEffect
                  onChange={(e) => {
                    setEndDate(e.target.value);
                  }}
                  className={`block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600 [color-scheme:dark]`}
                />
              </div>
              {/* Holiday Type */}
              <div className="flex flex-col justify-end">
                {" "}
                {/* Align items to bottom */}
                <div className="grid grid-cols-2 gap-2 h-10">
                  {" "}
                  {/* Set height to match input */}
                  <button
                    type="button"
                    onClick={() => handleTypeChange("Regular")}
                    className={`w-full h-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      type === "Regular"
                        ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                        : "bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    Regular
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("Special")}
                    className={`w-full h-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      type === "Special"
                        ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                        : "bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    Special
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
          <div className="flex flex-row space-x-3 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              {initialData ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
