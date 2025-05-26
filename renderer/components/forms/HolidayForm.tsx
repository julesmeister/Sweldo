import React, { useState, useEffect } from "react";
import { Holiday } from "@/renderer/model/holiday";
import { createAttendanceSettingsModel } from "@/renderer/model/settings";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import BaseFormDialog from "../dialogs/BaseFormDialog";

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
  position?: Position;
  isOpen: boolean;
}

export default function HolidayForm({
  onClose,
  onSave,
  initialData,
  isOpen,
}: HolidayFormProps) {
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

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    new Date(
      `${storedYear}-${String(storedMonthInt + 1).padStart(2, "0")}-01`
    )
      .toISOString()
      .split("T")[0]
  );
  const [endDate, setEndDate] = useState(startDate);
  const [type, setType] = useState<"Regular" | "Special">("Regular");
  const [multiplier, setMultiplier] = useState(1);
  const [errors, setErrors] = useState<{
    name?: string;
    multiplier?: string;
  }>({});
  const [attendanceSettings, setAttendanceSettings] = useState<{
    regularHolidayMultiplier: number;
    specialHolidayMultiplier: number;
  } | null>(null);
  const { dbPath } = useSettingsStore();

  // Load attendance settings first
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

  // Update form fields when initialData changes, after settings are loaded
  useEffect(() => {
    if (!isOpen) return; // Don't update when dialog is closed

    if (initialData) {
      console.log("[HolidayForm] Setting form with initialData:", initialData);
      setName(initialData.name || "");
      setStartDate(
        initialData.startDate
          ? new Date(initialData.startDate).toISOString().split("T")[0]
          : startDate
      );
      setType(initialData.type || "Regular");

      // First try to use the multiplier from initialData
      if (initialData.multiplier && initialData.multiplier > 0) {
        console.log("[HolidayForm] Using initialData multiplier:", initialData.multiplier);
        setMultiplier(initialData.multiplier);
      }
      // If no valid multiplier in initialData, use the one from settings based on type
      else if (attendanceSettings) {
        const settingsMultiplier = initialData.type === "Regular"
          ? attendanceSettings.regularHolidayMultiplier
          : attendanceSettings.specialHolidayMultiplier;
        console.log("[HolidayForm] Using settings multiplier:", settingsMultiplier);
        setMultiplier(settingsMultiplier);
      }
      // Fallback to 1 if no other value is available
      else {
        console.log("[HolidayForm] Using default multiplier: 1");
        setMultiplier(1);
      }
    } else {
      // Reset form when adding a new holiday
      console.log("[HolidayForm] Resetting form for new holiday");
      setName("");
      setStartDate(
        new Date(
          `${storedYear}-${String(storedMonthInt + 1).padStart(2, "0")}-01`
        )
          .toISOString()
          .split("T")[0]
      );
      setType("Regular");

      // Set multiplier from settings if available, otherwise use 1
      if (attendanceSettings) {
        console.log("[HolidayForm] Setting default Regular multiplier:", attendanceSettings.regularHolidayMultiplier);
        setMultiplier(attendanceSettings.regularHolidayMultiplier);
      } else {
        console.log("[HolidayForm] No settings available, using default multiplier: 1");
        setMultiplier(1);
      }
    }
  }, [initialData, isOpen, attendanceSettings]); // Include attendanceSettings in the dependency array

  // Update useEffect to set endDate when startDate changes
  useEffect(() => {
    setEndDate(startDate);
  }, [startDate]);

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
      multiplier?: string;
    } = {};

    if (!name.trim()) {
      newErrors.name = "Holiday name is required";
    }

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
    <BaseFormDialog
      title={initialData ? "Edit Holiday" : "Add Holiday"}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={initialData ? "Update" : "Add"}
      isBottomSheet={true}
    >
      <form className="space-y-4">
        {/* All fields in one line */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Holiday Name */}
          <div className="md:col-span-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Holiday Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors({ ...errors, name: undefined });
              }}
              className={`block w-full bg-white border ${errors.name ? "border-red-500" : "border-gray-300"
                } text-gray-900 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400`}
              required
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Date */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
              }}
              className="block w-full bg-white border border-gray-300 text-gray-900 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
              required
            />
          </div>

          {/* Pay Multiplier */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Multiplier
            </label>
            <input
              type="number"
              value={multiplier}
              min="0.1"
              step="0.1"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setMultiplier(isNaN(val) ? 0 : val);
                setErrors({ ...errors, multiplier: undefined });
              }}
              className={`block w-full bg-white border ${errors.multiplier ? "border-red-500" : "border-gray-300"
                } text-gray-900 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400`}
              required
            />
            {errors.multiplier && (
              <p className="mt-1 text-sm text-red-500">{errors.multiplier}</p>
            )}
          </div>

          {/* Holiday Type */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <div className="grid grid-cols-2 gap-0 h-10 border border-gray-300">
              <button
                type="button"
                onClick={() => handleTypeChange("Regular")}
                className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${type === "Regular"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("Special")}
                className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${type === "Special"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Special
              </button>
            </div>
          </div>
        </div>
      </form>
    </BaseFormDialog>
  );
}
