"use client";
import React, { useState, useEffect, useRef } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useAuthStore } from "@/renderer/stores/authStore";
import {
  IoTimeOutline,
  IoCalendarOutline,
  IoWalletOutline,
  IoShieldCheckmarkOutline,
  IoSettingsOutline,
  IoInformationCircleOutline,
  IoPeopleOutline,
  IoArrowForward,
  IoArrowBack,
  IoShieldOutline,
  IoFolderOutline,
  IoImageOutline,
  IoSyncOutline,
} from "react-icons/io5";
import { MdOutlineDataset } from "react-icons/md";
import {
  Employee,
  EmployeeModel,
  createEmployeeModel,
} from "@/renderer/model/employee";
import { toast } from "sonner";
import {
  createAttendanceSettingsModel,
  AttendanceSettings,
  EmploymentType,
} from "@/renderer/model/settings";
import { MagicCard } from "../components/magicui/magic-card";
import ScheduleSettings from "../components/ScheduleSettings";
import RoleManagement from "../components/RoleManagement";
import DataMigrationSettings from "../components/DataMigrationSettings";
import { RoleModelImpl } from "../model/role";
import { Switch } from "@headlessui/react";

interface SettingSection {
  key: string;
  title: string;
  icon: React.ReactNode;
  requiredAccess: string;
  content: React.ReactNode;
}

// Helper function to convert hour number to time string (e.g., 22 -> "22:00")
const hourToTimeString = (hour: number | null | undefined): string => {
  if (hour === null || hour === undefined) return "";
  return `${hour.toString().padStart(2, "0")}:00`;
};

// Helper function to convert time string to hour number (e.g., "22:00" -> 22)
const timeStringToHour = (timeString: string): number => {
  return parseInt(timeString.split(":")[0], 10);
};

// Create a reusable AutoSaveInput component
const AutoSaveInput = ({
  value,
  onChange,
  placeholder,
  showSaved,
  setShowSaved,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showSaved: boolean;
  setShowSaved: (show: boolean) => void;
  label?: string;
}) => (
  <div className="flex-1 relative">
    <input
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setShowSaved(true);
        toast.success(`${label || "Formula"} updated successfully`);
        setTimeout(() => setShowSaved(false), 2000);
      }}
      className="w-full p-2 border rounded-md"
      placeholder={placeholder}
    />
    <div
      className={`
      absolute right-2 top-1/2 -translate-y-1/2 
      flex items-center bg-green-50 px-2 py-0.5 rounded-full
      transition-all duration-200 ease-in-out
      ${showSaved ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}
    `}
    >
      <svg
        className="w-3.5 h-3.5 text-green-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span className="text-xs text-green-600 ml-1 font-medium">Saved</span>
    </div>
  </div>
);

export default function SettingsPage() {
  const {
    dbPath,
    logoPath,
    preparedBy,
    approvedBy,
    companyName,
    columnColors,
    calculationSettings,
    setDbPath,
    setLogoPath,
    setPreparedBy,
    setApprovedBy,
    setCompanyName,
    setColumnColor,
    setCalculationSettings,
    isInitialized,
    initialize,
  } = useSettingsStore();
  const { hasAccess, isAuthInitialized } = useAuthStore();
  const [logoExists, setLogoExists] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [isCheckingLogo, setIsCheckingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = React.useState<string>("attendance");
  const [currentPath, setCurrentPath] = useState(dbPath);
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [inactiveEmployees, setInactiveEmployees] = useState<Employee[]>([]);
  const [employeeModel, setEmployeeModel] = useState<EmployeeModel | null>(
    null
  );
  const [hasRoles, setHasRoles] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const attendanceSettingsModel = createAttendanceSettingsModel(dbPath || "");
  const [attendanceSettings, setAttendanceSettings] =
    useState<AttendanceSettings>();
  const [holidayMultipliers, setHolidayMultipliers] = useState({
    regular: "",
    special: "",
  });
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [sssRate, setSssRate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreparedBySaved, setShowPreparedBySaved] = React.useState(false);
  const [showApprovedBySaved, setShowApprovedBySaved] = React.useState(false);
  const [showCompanyNameSaved, setShowCompanyNameSaved] = useState(false);
  const [showColumnColorSaved, setShowColumnColorSaved] = useState<{
    [key: string]: boolean;
  }>({});
  const [showGrossPaySaved, setShowGrossPaySaved] = useState(false);
  const [showOthersSaved, setShowOthersSaved] = useState(false);
  const [showTotalDeductionsSaved, setShowTotalDeductionsSaved] =
    useState(false);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const calculationSettingsRef = useRef<HTMLDivElement>(null);
  const variablesPanelRef = useRef<HTMLDivElement>(null);
  const [showVariablesPanel, setShowVariablesPanel] = useState(false);
  // const [canAccessSettings, setCanAccessSettings] = useState<boolean | null>(null); // State for async access check - REMOVED

  // Initialization is now handled in RootLayout

  // Define handleInputChange higher up
  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | { target: { name: string; value: boolean } },
    field: keyof AttendanceSettings
  ) => {
    if (!attendanceSettings) return;
    setAttendanceSettings({
      ...attendanceSettings,
      [field]:
        typeof e.target.value === "boolean"
          ? e.target.value
          : Number(e.target.value),
    });
  };

  const handleSaveChanges = async () => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You do not have permission to modify attendance settings");
      return;
    }
    if (!attendanceSettings) {
      toast.error("No attendance settings to save");
      return;
    }
    try {
      await attendanceSettingsModel?.saveAttendanceSettings(attendanceSettings);
      toast.success("Attendance settings saved successfully!");
    } catch (error) {
      console.error("Error saving attendance settings:", error);
      toast.error("Failed to save attendance settings. Please try again.");
    }
  };

  const handleSaveHolidayMultipliers = async () => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You do not have permission to modify holiday settings");
      return;
    }
    try {
      const regular = Number(holidayMultipliers.regular);
      const special = Number(holidayMultipliers.special);

      if (isNaN(regular) || isNaN(special)) {
        toast.error("Please enter valid numbers for multipliers");
        return;
      }

      if (regular <= 0 || special <= 0) {
        toast.error("Multipliers must be greater than 0");
        return;
      }

      await attendanceSettingsModel?.setRegularHolidayMultiplier(regular);
      await attendanceSettingsModel?.setSpecialHolidayMultiplier(special);

      const settings = await attendanceSettingsModel.loadAttendanceSettings();
      setAttendanceSettings(settings);

      toast.success("Holiday multipliers updated successfully");
    } catch (error) {
      console.error("Error saving holiday multipliers:", error);
      toast.error("Failed to update holiday multipliers");
    }
  };

  // Define sections first
  const sections: SettingSection[] = [
    {
      key: "attendance",
      title: "Attendance & Time",
      icon: <IoTimeOutline className="w-5 h-5" />,
      requiredAccess: "MANAGE_ATTENDANCE",
      content: (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <IoTimeOutline className="w-5 h-5 text-blue-600" />
                Attendance & Time
              </h3>
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
                      <span className="font-medium">Helpful Tip:</span> Select
                      any field and use your scroll wheel to adjust values
                      precisely.
                      <br />
                      <span className="text-xs italic">
                        Scrolling provides more precise control than typing.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Time Penalties Section */}
                  <div className="space-y-6">
                    <div className="border-b border-gray-200 pb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Time Penalties
                      </h3>
                      <p className="text-sm text-gray-500">
                        Configure late and undertime deductions
                      </p>
                    </div>

                    {/* Late Settings */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                      <h4 className="text-md font-medium text-gray-800">
                        Late Arrival Settings
                      </h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Grace Period
                        </label>
                        <div className="mt-1 relative">
                          <input
                            type="number"
                            name="lateGracePeriod"
                            className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 px-3"
                            placeholder="5"
                            value={attendanceSettings?.lateGracePeriod ?? ""}
                            onChange={(e) =>
                              handleInputChange(e, "lateGracePeriod")
                            }
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">
                              minutes
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Employees can be up to this many minutes late without
                          penalty
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Deduction Rate
                        </label>
                        <div className="mt-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₱</span>
                          </div>
                          <input
                            type="number"
                            name="lateDeductionPerMinute"
                            className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 pl-7 pr-12"
                            placeholder="1"
                            value={
                              attendanceSettings?.lateDeductionPerMinute ?? ""
                            }
                            onChange={(e) =>
                              handleInputChange(e, "lateDeductionPerMinute")
                            }
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">
                              per minute
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Amount deducted for each minute late after grace
                          period
                        </p>
                      </div>
                    </div>

                    {/* Undertime Settings */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                      <h4 className="text-md font-medium text-gray-800">
                        Undertime Settings
                      </h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Grace Period
                        </label>
                        <div className="mt-1 relative">
                          <input
                            type="number"
                            name="undertimeGracePeriod"
                            className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 px-3"
                            placeholder="5"
                            value={
                              attendanceSettings?.undertimeGracePeriod ?? ""
                            }
                            onChange={(e) =>
                              handleInputChange(e, "undertimeGracePeriod")
                            }
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">
                              minutes
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Employees can leave up to this many minutes early
                          without penalty
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Deduction Rate
                        </label>
                        <div className="mt-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₱</span>
                          </div>
                          <input
                            type="number"
                            name="undertimeDeductionPerMinute"
                            className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 pl-7 pr-12"
                            placeholder="1"
                            value={
                              attendanceSettings?.undertimeDeductionPerMinute ??
                              ""
                            }
                            onChange={(e) =>
                              handleInputChange(
                                e,
                                "undertimeDeductionPerMinute"
                              )
                            }
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">
                              per minute
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Amount deducted for each minute early after grace
                          period
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Pay Section */}
                  <div className="space-y-6">
                    <div className="border-b border-gray-200 pb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Additional Pay
                      </h3>
                      <p className="text-sm text-gray-500">
                        Configure overtime, night differential, and holiday
                        rates
                      </p>
                    </div>

                    {/* Overtime Settings */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-medium text-gray-800 flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          Overtime Settings
                        </h4>
                        <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
                          <input
                            type="checkbox"
                            name="toggle"
                            id="overtime-toggle"
                            checked={
                              attendanceSettings?.countEarlyTimeInAsOvertime ??
                              false
                            }
                            onChange={(checked) =>
                              handleInputChange(
                                {
                                  target: {
                                    name: "countEarlyTimeInAsOvertime",
                                    value:
                                      !attendanceSettings?.countEarlyTimeInAsOvertime,
                                  },
                                },
                                "countEarlyTimeInAsOvertime"
                              )
                            }
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-200 appearance-none cursor-pointer peer"
                          />
                          <label
                            htmlFor="overtime-toggle"
                            className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-200 cursor-pointer peer-checked:bg-indigo-600 peer-checked:border-indigo-600"
                          ></label>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg flex items-center gap-3 border border-blue-100">
                        <div className="rounded-full bg-blue-100 p-1.5 flex-shrink-0">
                          <svg
                            className="w-4 h-4 text-blue-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            ></path>
                          </svg>
                        </div>
                        <p className="py-0.5">
                          {attendanceSettings?.countEarlyTimeInAsOvertime
                            ? "When enabled, overtime includes both early time-in and extended time-out periods"
                            : "When disabled, overtime is calculated only from extended time-out periods, regardless of early arrival"}
                        </p>
                      </div>

                      {/* --- Enhanced Example Scenario --- */}
                      <div className="mt-5 pt-5 border-t border-gray-100">
                        <h5 className="font-semibold text-gray-700 mb-4 text-base flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="3"
                              y="4"
                              width="18"
                              height="18"
                              rx="2"
                              ry="2"
                            ></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                          Example Scenario
                        </h5>
                        {/* Shift/Actual/Threshold Info */}
                        <div className="space-y-3 text-base mb-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 p-5 rounded-xl border border-blue-100 shadow-sm">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-700 flex items-center gap-2">
                              <svg
                                className="w-4 h-4 text-blue-500"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                              </svg>
                              Shift:
                            </span>
                            <span className="text-slate-800 font-mono bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                              9:00 AM - 5:00 PM
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-700 flex items-center gap-2">
                              <svg
                                className="w-4 h-4 text-green-500"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                              </svg>
                              Actual:
                            </span>
                            <span className="text-slate-800 font-mono bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                              8:30 AM - 5:30 PM
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-slate-700 flex items-center gap-2">
                              <svg
                                className="w-4 h-4 text-amber-500"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                              </svg>
                              Threshold:
                            </span>
                            <span className="text-slate-800 font-mono bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                              {attendanceSettings?.overtimeThreshold ?? 0} min
                            </span>
                          </div>
                        </div>

                        {/* Calculation based on Toggle */}
                        <div className="bg-white border border-gray-100 rounded-xl shadow-md">
                          <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100 rounded-t-xl">
                            <p className="font-semibold text-gray-800 flex items-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 mr-2 rounded-full ${
                                  attendanceSettings?.countEarlyTimeInAsOvertime
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {attendanceSettings?.countEarlyTimeInAsOvertime ? (
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </span>
                              Calculation with Toggle{" "}
                              <span
                                className={`ml-1.5 px-2 py-0.5 text-sm rounded-md ${
                                  attendanceSettings?.countEarlyTimeInAsOvertime
                                    ? "bg-indigo-100 text-indigo-700 font-medium"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {attendanceSettings?.countEarlyTimeInAsOvertime
                                  ? "ON"
                                  : "OFF"}
                              </span>
                            </p>
                          </div>

                          <div className="p-5">
                            {attendanceSettings?.countEarlyTimeInAsOvertime ? (
                              <div className="space-y-4">
                                <div className="pl-4 border-l-2 border-indigo-300 space-y-3 py-2">
                                  <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-700">
                                      <span className="w-3 h-3 rounded-full bg-green-400 mr-2.5"></span>
                                      Early (8:30 vs 9:00)
                                    </span>
                                    <span className="font-mono bg-green-50 text-green-700 px-2.5 py-1 rounded-md shadow-sm border border-green-100">
                                      +30 min
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-700">
                                      <span className="w-3 h-3 rounded-full bg-amber-400 mr-2.5"></span>
                                      Late (5:30 vs 5:00)
                                    </span>
                                    <span className="font-mono bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md shadow-sm border border-amber-100">
                                      +30 min
                                    </span>
                                  </div>
                                </div>

                                <div className="flex justify-between font-semibold text-gray-900 pt-3 border-t border-gray-200 mt-3 items-center">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2.5"></span>
                                    Total Potential OT:
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg shadow-sm border border-indigo-200">
                                      60 min
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="pl-4 border-l-2 border-gray-300 space-y-3 py-2">
                                  <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-500">
                                      <span className="w-3 h-3 rounded-full bg-gray-300 mr-2.5"></span>
                                      Early (8:30 vs 9:00)
                                    </span>
                                    <span className="font-mono bg-gray-100 text-gray-500 px-2.5 py-1 rounded-md shadow-sm border border-gray-200">
                                      Ignored
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="flex items-center text-gray-700">
                                      <span className="w-3 h-3 rounded-full bg-amber-400 mr-2.5"></span>
                                      Late (5:30 vs 5:00)
                                    </span>
                                    <span className="font-mono bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md shadow-sm border border-amber-100">
                                      +30 min
                                    </span>
                                  </div>
                                </div>

                                <div className="flex justify-between font-semibold text-gray-900 pt-3 border-t border-gray-200 mt-3 items-center">
                                  <span className="flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2.5"></span>
                                    Total Potential OT:
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-lg shadow-sm border border-blue-200">
                                      30 min
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="text-xs bg-gray-50 p-3.5 rounded-lg mt-4 border border-gray-200 flex items-start gap-2">
                              <svg
                                className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                  clipRule="evenodd"
                                ></path>
                              </svg>
                              <div className="text-gray-600">
                                <span className="font-medium text-gray-700">
                                  Eligibility Rule:
                                </span>{" "}
                                Overtime is only eligible when the total minutes{" "}
                                <span className="font-medium text-gray-700">
                                  exceed
                                </span>{" "}
                                the threshold (
                                {attendanceSettings?.overtimeThreshold} min).
                                {(attendanceSettings?.countEarlyTimeInAsOvertime &&
                                  60 ===
                                    (attendanceSettings?.overtimeThreshold ??
                                      0)) ||
                                (!attendanceSettings?.countEarlyTimeInAsOvertime &&
                                  30 ===
                                    (attendanceSettings?.overtimeThreshold ??
                                      0)) ? (
                                  <span className="block mt-1 italic">
                                    {" "}
                                    In this example, OT exactly equals the
                                    threshold, so it's ineligible for payment.
                                  </span>
                                ) : (
                                  ""
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* --- End Enhanced Example --- */}

                      <div className="grid grid-cols-2 gap-6 pt-6 mt-2">
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                            <svg
                              className="w-4 h-4 text-indigo-600"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                                clipRule="evenodd"
                              ></path>
                            </svg>
                            Minimum Duration
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              name="overtimeThreshold"
                              className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-11 px-3"
                              placeholder="30"
                              value={
                                attendanceSettings?.overtimeThreshold ?? ""
                              }
                              onChange={(e) =>
                                handleInputChange(e, "overtimeThreshold")
                              }
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 text-sm">
                                minutes
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Minimum minutes required before overtime pay applies
                          </p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                            <svg
                              className="w-4 h-4 text-indigo-600"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              ></path>
                            </svg>
                            Rate Multiplier
                          </label>
                          <div className="relative flex items-center">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">
                                ×
                              </span>
                            </div>
                            <input
                              type="number"
                              name="overtimeHourlyMultiplier"
                              className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-11 pl-7"
                              placeholder="1.25"
                              value={
                                attendanceSettings?.overtimeHourlyMultiplier ??
                                ""
                              }
                              onChange={(e) =>
                                handleInputChange(e, "overtimeHourlyMultiplier")
                              }
                              step="0.01"
                            />
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Multiplier for overtime rate (e.g., 1.25 = 25%
                            extra)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Night Differential Settings */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                      <h4 className="text-md font-medium text-gray-800">
                        Night Differential
                      </h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Rate Increase
                        </label>
                        <div className="mt-1 relative">
                          <input
                            type="number"
                            name="nightDifferentialMultiplier"
                            className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 px-3 pr-8"
                            placeholder="10"
                            value={
                              attendanceSettings?.nightDifferentialMultiplier
                                ? (
                                    attendanceSettings.nightDifferentialMultiplier *
                                    100
                                  ).toString()
                                : ""
                            }
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) / 100;
                              if (!attendanceSettings) return;
                              setAttendanceSettings({
                                ...attendanceSettings,
                                nightDifferentialMultiplier: value,
                              });
                            }}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">%</span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Additional percentage added to regular rate during
                          night hours
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Start Time
                          </label>
                          <input
                            type="time"
                            name="nightDifferentialStartHour"
                            className="mt-1 block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 px-3"
                            value={hourToTimeString(
                              attendanceSettings?.nightDifferentialStartHour
                            )}
                            onChange={(e) => {
                              const hour = timeStringToHour(e.target.value);
                              handleInputChange(
                                {
                                  target: {
                                    name: "nightDifferentialStartHour",
                                    value: hour,
                                  },
                                } as any,
                                "nightDifferentialStartHour"
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            End Time
                          </label>
                          <input
                            type="time"
                            name="nightDifferentialEndHour"
                            className="mt-1 block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 px-3"
                            value={hourToTimeString(
                              attendanceSettings?.nightDifferentialEndHour
                            )}
                            onChange={(e) => {
                              const hour = timeStringToHour(e.target.value);
                              handleInputChange(
                                {
                                  target: {
                                    name: "nightDifferentialEndHour",
                                    value: hour,
                                  },
                                } as any,
                                "nightDifferentialEndHour"
                              );
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Holiday Settings */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                      <h4 className="text-md font-medium text-gray-800">
                        Holiday Pay Rates
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Regular Holiday
                          </label>
                          <div className="mt-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">
                                ×
                              </span>
                            </div>
                            <input
                              type="number"
                              className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 px-3 pl-7"
                              placeholder="2"
                              value={holidayMultipliers.regular}
                              onChange={(e) =>
                                setHolidayMultipliers((prev) => ({
                                  ...prev,
                                  regular: e.target.value,
                                }))
                              }
                              step="0.01"
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Multiplier for regular holidays (e.g., 1.00 = double
                            pay)
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Special Holiday
                          </label>
                          <div className="mt-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">
                                ×
                              </span>
                            </div>
                            <input
                              type="number"
                              className="block w-full rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:ring focus:ring-indigo-500/20 sm:text-sm h-10 px-3 pl-7"
                              placeholder="1.3"
                              value={holidayMultipliers.special}
                              onChange={(e) =>
                                setHolidayMultipliers((prev) => ({
                                  ...prev,
                                  special: e.target.value,
                                }))
                              }
                              step="0.01"
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Multiplier for special holidays (e.g., 0.30 = 30%
                            additional)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveChanges}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30"
            >
              Save Changes
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "types",
      title: "Schedules",
      icon: <IoWalletOutline className="w-5 h-5" />,
      requiredAccess: "MANAGE_SETTINGS",
      content: (
        <ScheduleSettings
          employmentTypes={employmentTypes}
          onSave={async (types) => {
            try {
              setEmploymentTypes(types);
              // Need to ensure attendanceSettingsModel is available here
              // Maybe initialize it in a useEffect based on dbPath?
              const model = createAttendanceSettingsModel(dbPath || "");
              await model.saveTimeSettings(types);
            } catch (error) {
              console.error("Error saving employment types:", error);
            }
          }}
        />
      ),
    },
    {
      key: "roles",
      title: "Role Management",
      icon: <IoShieldOutline className="w-5 h-5" />,
      requiredAccess: hasRoles ? "MANAGE_SETTINGS" : "",
      content: !dbPath ? (
        <MagicCard>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <IoFolderOutline className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Database Path Not Set
                </h3>
                <p className="text-sm text-gray-600">
                  Please configure the database path in the Database Management
                  section before managing roles.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelected("database")}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200 border border-blue-100 hover:border-blue-200"
            >
              <IoFolderOutline className="w-5 h-5" />
              Configure Database Path
            </button>
          </div>
        </MagicCard>
      ) : (
        <RoleManagement roleModel={new RoleModelImpl(dbPath)} />
      ),
    },
    {
      key: "employeeManagement",
      title: "Employee",
      icon: <IoPeopleOutline className="w-5 h-5" />,
      requiredAccess: "MANAGE_EMPLOYEES",
      content: (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <IoPeopleOutline className="w-5 h-5 text-blue-600" />
              Manage Employees
            </h3>
            <div className="flex justify-between gap-8">
              {/* Active Employees Box */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Active Employees
                  </h4>
                  <span className="text-sm text-gray-500">
                    {activeEmployees.length} employees
                  </span>
                </div>
                <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {activeEmployees.map((employee) => (
                    <li
                      key={`active-${employee.id}`}
                      className={`rounded-lg p-3 flex items-center justify-between border border-gray-100 transition-all ${
                        selectedEmployees.some(
                          (selected) => selected.id === employee.id
                        )
                          ? "bg-blue-100"
                          : "bg-white"
                      } hover:border-blue-200 hover:shadow-sm`}
                      onClick={() => {
                        setSelectedEmployees((current) => {
                          if (
                            current.some(
                              (selected) => selected.id === employee.id
                            )
                          ) {
                            return current.filter(
                              (selected) => selected.id !== employee.id
                            );
                          } else {
                            return [...current, employee];
                          }
                        });
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {employee.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {employee.position || "No position set"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToInactive(employee);
                        }}
                        className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        Deactivate
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Center Controls */}
              <div className="flex flex-col items-center justify-center space-y-4">
                {selectedEmployees.length > 0 &&
                selectedEmployees[0].status === "inactive" ? (
                  <button
                    onClick={async () => {
                      if (!employeeModel) return;

                      try {
                        // Process employees one at a time to avoid file contention
                        for (const employee of selectedEmployees) {
                          const updatedEmployee = {
                            ...employee,
                            status: "active" as const,
                          };
                          await employeeModel.updateEmployeeStatus(
                            updatedEmployee
                          );

                          // Update UI state after each successful update
                          setInactiveEmployees((current) =>
                            current.filter((emp) => emp.id !== employee.id)
                          );
                          setActiveEmployees((current) => {
                            const withoutCurrent = current.filter(
                              (emp) => emp.id !== employee.id
                            );
                            return [...withoutCurrent, updatedEmployee];
                          });
                        }

                        // Clear selection after all updates are complete
                        setSelectedEmployees([]);
                        toast.success("Successfully updated employee status");
                      } catch (error) {
                        console.error("Error updating employee status:", error);
                        toast.error(
                          "Failed to update some employees. Please try again."
                        );
                      }
                    }}
                    className="group relative px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-2"
                  >
                    <IoArrowBack className="w-5 h-5" />
                    Activate
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!employeeModel) return;

                      try {
                        // Process employees one at a time to avoid file contention
                        for (const employee of selectedEmployees) {
                          const updatedEmployee = {
                            ...employee,
                            status: "inactive" as const,
                          };
                          await employeeModel.updateEmployeeStatus(
                            updatedEmployee
                          );

                          // Update UI state after each successful update
                          setActiveEmployees((currentActive) =>
                            currentActive.filter(
                              (emp) => emp.id !== employee.id
                            )
                          );
                          setInactiveEmployees((currentInactive) => {
                            const withoutCurrent = currentInactive.filter(
                              (emp) => emp.id !== employee.id
                            );
                            return [...withoutCurrent, updatedEmployee];
                          });
                        }

                        // Clear selection after all updates are complete
                        setSelectedEmployees([]);
                        toast.success("Successfully updated employee status");
                      } catch (error) {
                        console.error("Error updating employee status:", error);
                        toast.error(
                          "Failed to update some employees. Please try again."
                        );
                      }
                    }}
                    className="group relative px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                  >
                    <IoArrowForward className="w-5 h-5" />
                    Terminate
                  </button>
                )}
              </div>

              {/* Inactive Employees Box */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    Inactive Employees
                  </h4>
                  <span className="text-sm text-gray-500">
                    {inactiveEmployees.length} employees
                  </span>
                </div>
                <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {inactiveEmployees.map((employee) => (
                    <li
                      key={`inactive-${employee.id}`}
                      className={`rounded-lg p-3 flex items-center justify-between border border-gray-100 transition-all ${
                        selectedEmployees.some(
                          (selected) => selected.id === employee.id
                        )
                          ? "bg-blue-100"
                          : "bg-white"
                      } hover:border-green-200 hover:shadow-sm`}
                      onClick={() => {
                        setSelectedEmployees((current) => {
                          if (
                            current.some(
                              (selected) => selected.id === employee.id
                            )
                          ) {
                            return current.filter(
                              (selected) => selected.id !== employee.id
                            );
                          } else {
                            return [...current, employee];
                          }
                        });
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {employee.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {employee.position || "No position set"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToActive(employee);
                        }}
                        className="text-sm px-3 py-1 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      >
                        Activate
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "payslip",
      title: "Payslip & Payroll",
      icon: <MdOutlineDataset className="h-5 w-5" />,
      requiredAccess: "MANAGE_SETTINGS",
      content: (
        <div className="">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Company Logo</h2>
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
                    <span className="font-medium">Note:</span> Select your
                    company logo image file (PNG, JPG, or JPEG). The logo will
                    be used in reports and other company documents.
                  </p>
                </div>
              </div>
            </div>
            {logoError && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
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
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Error:</span> {logoError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Logo Preview */}
            {isCheckingLogo ? (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-center h-24 gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600"></div>
                  <div className="text-sm text-gray-500">
                    Checking logo file...
                  </div>
                </div>
              </div>
            ) : !logoPath ? (
              <div
                className={`mb-4 p-4 border rounded-lg bg-gray-50 border-dashed transition-colors duration-200 ${
                  isDragging ? "border-blue-500 bg-blue-50" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  setLogoError("");

                  const file = e.dataTransfer.files[0];
                  if (!file) return;

                  const ext = file.name.toLowerCase().split(".").pop();
                  if (!["png", "jpg", "jpeg"].includes(ext || "")) {
                    setLogoError(
                      "Please select a valid image file (PNG, JPG, or JPEG)"
                    );
                    return;
                  }

                  setLogoPath(file.path);
                }}
              >
                <div className="flex flex-col items-center justify-center h-24 gap-2 text-gray-400">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <div className="text-sm">
                    {isDragging
                      ? "Drop image here"
                      : "No logo selected - Click browse or drag an image here"}
                  </div>
                </div>
              </div>
            ) : (
              logoPath &&
              logoExists && (
                <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Logo Preview
                  </h3>
                  <div className="flex items-center justify-center bg-white border rounded-lg p-4">
                    <img
                      src={logoPath ? `local-file://${logoPath}` : ""}
                      alt="Company Logo"
                      className="max-h-24 object-contain"
                      onError={(e) => {
                        e.currentTarget.src = ""; // Clear the source on error
                        console.error("Error loading logo:", logoPath);
                      }}
                    />
                  </div>
                </div>
              )
            )}

            <div className="flex items-center space-x-4">
              <input
                type="text"
                value={logoPath}
                readOnly
                className="flex-1 p-2 border rounded-md bg-gray-50"
                placeholder="Select logo image..."
              />
              <button
                onClick={async () => {
                  // Clear any existing error messages
                  setLogoError("");

                  const result = await window.electron.showOpenDialog({
                    properties: ["openFile"],
                    filters: [
                      { name: "Images", extensions: ["png", "jpg", "jpeg"] },
                    ],
                  });

                  if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    const ext = filePath.toLowerCase().split(".").pop();
                    if (!["png", "jpg", "jpeg"].includes(ext || "")) {
                      setLogoError(
                        "Please select a valid image file (PNG, JPG, or JPEG)"
                      );
                      return;
                    }
                    setLogoError("");
                    setLogoPath(filePath);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Browse
              </button>
              {logoPath && (
                <button
                  onClick={() => {
                    setLogoPath("");
                    setLogoError("");
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md border hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Payslip Settings Info */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 mt-6">
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
                    <span className="font-medium">Helpful Tip:</span> Any
                    changes made to these fields are saved automatically.
                    <br />
                    <span className="text-xs italic">
                      No need to manually save your changes.
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Company Name Field */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">
                Company Information
              </h2>
              <div className="relative">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (window.saveTimeout) {
                      clearTimeout(window.saveTimeout);
                    }
                    window.saveTimeout = setTimeout(() => {
                      setShowCompanyNameSaved(true);
                      setTimeout(() => setShowCompanyNameSaved(false), 2000);
                    }, 500);
                  }}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter company name..."
                />
                <div
                  className={`
                    absolute right-2 top-1/2 -translate-y-1/2 
                    flex items-center bg-green-50 px-2 py-0.5 rounded-full
                    transition-all duration-200 ease-in-out
                    ${
                      showCompanyNameSaved
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 translate-x-2"
                    }
                  `}
                >
                  {showCompanyNameSaved && (
                    <div className="fireworks-container">
                      <div className="firework"></div>
                      <div className="firework"></div>
                      <div className="firework"></div>
                      <div className="firework"></div>
                      <div className="firework"></div>
                    </div>
                  )}
                  <svg
                    className="w-3.5 h-3.5 text-green-600 z-10"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-xs text-green-600 ml-1 font-medium z-10">
                    Saved
                  </span>
                </div>
              </div>
            </div>

            {/* Signature Fields */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">Signature Fields</h2>
              <div className="grid grid-cols-2 gap-6">
                {/* Prepared By section */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-700">
                    Prepared By
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={preparedBy}
                        onChange={(e) => {
                          setPreparedBy(e.target.value);
                          if (window.preparedByTimeout) {
                            clearTimeout(window.preparedByTimeout);
                          }
                          window.preparedByTimeout = setTimeout(() => {
                            setShowPreparedBySaved(true);
                            setTimeout(
                              () => setShowPreparedBySaved(false),
                              2000
                            );
                          }, 500);
                        }}
                        className="w-full p-2 border rounded-md"
                        placeholder="Enter name of preparer..."
                      />
                      <div
                        className={`
                        absolute right-2 top-1/2 -translate-y-1/2 
                        flex items-center bg-green-50 px-2 py-0.5 rounded-full
                        transition-all duration-200 ease-in-out
                        ${
                          showPreparedBySaved
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 translate-x-2"
                        }
                      `}
                      >
                        {showPreparedBySaved && (
                          <div className="fireworks-container">
                            <div className="firework"></div>
                            <div className="firework"></div>
                            <div className="firework"></div>
                            <div className="firework"></div>
                            <div className="firework"></div>
                          </div>
                        )}
                        <svg
                          className="w-3.5 h-3.5 text-green-600 z-10"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-xs text-green-600 ml-1 font-medium z-10">
                          Saved
                        </span>
                      </div>
                    </div>
                    {preparedBy && (
                      <button
                        onClick={() => setPreparedBy("")}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md border hover:bg-gray-200 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Approved By section */}
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-700">
                    Approved By
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={approvedBy}
                        onChange={(e) => {
                          setApprovedBy(e.target.value);
                          if (window.approvedByTimeout) {
                            clearTimeout(window.approvedByTimeout);
                          }
                          window.approvedByTimeout = setTimeout(() => {
                            setShowApprovedBySaved(true);
                            setTimeout(
                              () => setShowApprovedBySaved(false),
                              2000
                            );
                          }, 500);
                        }}
                        className="w-full p-2 border rounded-md"
                        placeholder="Enter name of approver..."
                      />
                      <div
                        className={`
                        absolute right-2 top-1/2 -translate-y-1/2 
                        flex items-center bg-green-50 px-2 py-0.5 rounded-full
                        transition-all duration-200 ease-in-out
                        ${
                          showApprovedBySaved
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 translate-x-2"
                        }
                      `}
                      >
                        {showApprovedBySaved && (
                          <div className="fireworks-container">
                            <div className="firework"></div>
                            <div className="firework"></div>
                            <div className="firework"></div>
                            <div className="firework"></div>
                            <div className="firework"></div>
                          </div>
                        )}
                        <svg
                          className="w-3.5 h-3.5 text-green-600 z-10"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-xs text-green-600 ml-1 font-medium z-10">
                          Saved
                        </span>
                      </div>
                    </div>
                    {approvedBy && (
                      <button
                        onClick={() => setApprovedBy("")}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md border hover:bg-gray-200 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Column Color Settings */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">
                Column Color Settings
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
                      <span className="font-medium">Note:</span> Customize the
                      colors of columns in your payroll PDF.
                      <br />
                      <span className="text-xs italic">
                        These colors will be applied to the text in the
                        corresponding columns.
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: "no", label: "No." },
                  { id: "name", label: "Name of Employee" },
                  { id: "days", label: "Days" },
                  { id: "rate", label: "Rate" },
                  { id: "holiday", label: "Holiday" },
                  { id: "ot", label: "OT" },
                  { id: "gross", label: "Gross" },
                  { id: "ut", label: "UT" },
                  { id: "sss", label: "SSS" },
                  { id: "philhealth", label: "PhilHealth" },
                  { id: "pagibig", label: "Pag-IBIG" },
                  { id: "loan", label: "Loan" },
                  { id: "ca", label: "CA" },
                  { id: "partial", label: "Partial" },
                  { id: "others", label: "Others" },
                  { id: "totalDeductions", label: "Total Deductions" },
                  { id: "netPay", label: "Net Pay" },
                  { id: "signature", label: "Signature" },
                ].map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700 w-1/3 flex items-center">
                      {column.label}
                      {columnColors[column.id] &&
                        columnColors[column.id] !== "#000000" && (
                          <span
                            className="ml-2 w-2 h-2 rounded-full"
                            style={{ backgroundColor: columnColors[column.id] }}
                          />
                        )}
                    </label>
                    <div className="flex-1 flex items-center">
                      <div className="relative">
                        <input
                          type="color"
                          value={columnColors[column.id] || "#000000"}
                          onChange={(e) =>
                            handleColumnColorChange(column.id, e.target.value)
                          }
                          className="h-8 w-8 rounded border border-gray-300 cursor-pointer"
                        />
                        {columnColors[column.id] &&
                          columnColors[column.id] !== "#000000" && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                          )}
                      </div>
                      <button
                        onClick={() =>
                          handleColumnColorChange(column.id, "#000000")
                        }
                        className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Reset
                      </button>
                      {showColumnColorSaved[column.id] && (
                        <span className="ml-2 text-xs text-green-600 flex items-center">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Saved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculation Settings */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Calculation Settings
                </div>
                <button
                  onClick={() => setShowVariablesPanel(!showVariablesPanel)}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {showVariablesPanel ? (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Hide Variables
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16m-7 6h7"
                        />
                      </svg>
                      Show Variables
                    </>
                  )}
                </button>
              </h2>

              <div className="flex gap-6">
                {/* Formulas Column - Left Side */}
                <div className="flex-1 space-y-6">
                  {/* Gross Pay Formula */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Gross Pay Formula
                    </h3>
                    <div
                      className={`p-3 border rounded-md bg-gray-50 min-h-[60px] mb-2 ${
                        !selectedOperator ? "cursor-not-allowed" : ""
                      }`}
                      onDragOver={(e) => {
                        if (!selectedOperator) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        e.currentTarget.classList.add(
                          "bg-blue-50",
                          "border-blue-200"
                        );
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove(
                          "bg-blue-50",
                          "border-blue-200"
                        );
                      }}
                      onDrop={(e) => {
                        if (!selectedOperator) {
                          toast.error(
                            "Please select an operator first (e.g., +, -, *, /)"
                          );
                          return;
                        }
                        e.preventDefault();
                        const variable = e.dataTransfer.getData("text/plain");
                        const currentFormula =
                          calculationSettings.grossPay?.formula || "";
                        const newFormula = currentFormula
                          ? `${currentFormula} ${selectedOperator} ${variable}`
                          : variable;
                        setCalculationSettings({
                          ...calculationSettings,
                          grossPay: {
                            formula: newFormula,
                            description:
                              calculationSettings.grossPay?.description ||
                              "Basic pay plus overtime and holiday bonus, minus undertime deductions",
                          },
                        });
                        setShowGrossPaySaved(true);
                        toast.success("Gross Pay formula updated successfully");
                        setTimeout(() => setShowGrossPaySaved(false), 2000);
                        setSelectedOperator(null);
                      }}
                    >
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={
                            calculationSettings.grossPay?.formula ||
                            "basicPay + overtime + holidayBonus - undertimeDeduction"
                          }
                          onChange={(e) => {
                            setCalculationSettings({
                              ...calculationSettings,
                              grossPay: {
                                formula: e.target.value,
                                description:
                                  calculationSettings.grossPay?.description ||
                                  "Basic pay plus overtime and holiday bonus, minus undertime deductions",
                              },
                            });
                            setShowGrossPaySaved(true);
                            toast.success(
                              "Gross Pay formula updated successfully"
                            );
                            setTimeout(() => setShowGrossPaySaved(false), 2000);
                          }}
                          className="w-full p-2 bg-white border rounded font-mono text-sm"
                          placeholder="Enter or drag variables to build formula..."
                        />
                        <div className="flex gap-2">
                          {["+", "-", "*", "/", "(", ")"].map((operator) => (
                            <button
                              key={operator}
                              onClick={() => {
                                if (selectedOperator === operator) {
                                  setSelectedOperator(null);
                                } else {
                                  setSelectedOperator(operator);
                                }
                              }}
                              className={`px-3 py-1 border rounded transition-all duration-200 font-mono
                                ${
                                  selectedOperator === operator
                                    ? "bg-blue-100 border-blue-300 text-blue-700 ring-2 ring-blue-200 ring-opacity-50"
                                    : "bg-white hover:bg-gray-50 text-gray-600 border-gray-200"
                                }`}
                            >
                              {operator}
                            </button>
                          ))}
                        </div>
                        {!selectedOperator && (
                          <div className="text-xs text-gray-500 italic mt-1">
                            Select an operator before dragging variables
                          </div>
                        )}
                        <div className="font-mono text-sm bg-white p-2 rounded border">
                          {(
                            calculationSettings.grossPay?.formula ||
                            "basicPay + overtime + holidayBonus - undertimeDeduction"
                          )
                            .split(/([+\-*/()])/g)
                            .map((part, index) => {
                              const isVariable = /^[a-zA-Z][a-zA-Z0-9]*$/.test(
                                part.trim()
                              );
                              return (
                                <span
                                  key={index}
                                  className={`${
                                    isVariable
                                      ? "bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {part}
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
                      <p className="font-medium mb-1">Description:</p>
                      <p className="italic">
                        {calculationSettings.grossPay?.description ||
                          "Basic pay plus overtime and holiday bonus, minus undertime deductions"}
                      </p>
                    </div>
                  </div>

                  {/* Others Formula */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      Others Formula
                    </h3>
                    <div
                      className={`p-3 border rounded-md bg-gray-50 min-h-[60px] mb-2 ${
                        !selectedOperator ? "cursor-not-allowed" : ""
                      }`}
                      onDragOver={(e) => {
                        if (!selectedOperator) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        e.currentTarget.classList.add(
                          "bg-blue-50",
                          "border-blue-200"
                        );
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove(
                          "bg-blue-50",
                          "border-blue-200"
                        );
                      }}
                      onDrop={(e) => {
                        if (!selectedOperator) {
                          toast.error(
                            "Please select an operator first (e.g., +, -, *, /)"
                          );
                          return;
                        }
                        e.preventDefault();
                        const variable = e.dataTransfer.getData("text/plain");
                        const currentFormula =
                          calculationSettings.others?.formula || "";
                        const newFormula = currentFormula
                          ? `${currentFormula} ${selectedOperator} ${variable}`
                          : variable;
                        setCalculationSettings({
                          ...calculationSettings,
                          others: {
                            formula: newFormula,
                            description:
                              calculationSettings.others?.description ||
                              "Sum of SSS loan, Pag-IBIG loan, and partial payments",
                          },
                        });
                        setShowOthersSaved(true);
                        toast.success("Others formula updated successfully");
                        setTimeout(() => setShowOthersSaved(false), 2000);
                        setSelectedOperator(null);
                      }}
                    >
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={
                            calculationSettings.others?.formula ||
                            "sssLoan + pagibigLoan + partial"
                          }
                          onChange={(e) => {
                            setCalculationSettings({
                              ...calculationSettings,
                              others: {
                                formula: e.target.value,
                                description:
                                  calculationSettings.others?.description ||
                                  "Sum of SSS loan, Pag-IBIG loan, and partial payments",
                              },
                            });
                            setShowOthersSaved(true);
                            toast.success(
                              "Others formula updated successfully"
                            );
                            setTimeout(() => setShowOthersSaved(false), 2000);
                          }}
                          className="w-full p-2 bg-white border rounded font-mono text-sm"
                          placeholder="Enter or drag variables to build formula..."
                        />
                        <div className="flex gap-2">
                          {["+", "-", "*", "/", "(", ")"].map((operator) => (
                            <button
                              key={operator}
                              onClick={() => {
                                if (selectedOperator === operator) {
                                  setSelectedOperator(null);
                                } else {
                                  setSelectedOperator(operator);
                                }
                              }}
                              className={`px-3 py-1 border rounded transition-all duration-200 font-mono
                                ${
                                  selectedOperator === operator
                                    ? "bg-blue-100 border-blue-300 text-blue-700 ring-2 ring-blue-200 ring-opacity-50"
                                    : "bg-white hover:bg-gray-50 text-gray-600 border-gray-200"
                                }`}
                            >
                              {operator}
                            </button>
                          ))}
                        </div>
                        {!selectedOperator && (
                          <div className="text-xs text-gray-500 italic mt-1">
                            Select an operator before dragging variables
                          </div>
                        )}
                        <div className="font-mono text-sm bg-white p-2 rounded border">
                          {(
                            calculationSettings.others?.formula ||
                            "sssLoan + pagibigLoan + partial"
                          )
                            .split(/([+\-*/()])/g)
                            .map((part, index) => {
                              const isVariable = /^[a-zA-Z][a-zA-Z0-9]*$/.test(
                                part.trim()
                              );
                              return (
                                <span
                                  key={index}
                                  className={`${
                                    isVariable
                                      ? "bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {part}
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
                      <p className="font-medium mb-1">Description:</p>
                      <p className="italic">
                        {calculationSettings.others?.description ||
                          "Sum of SSS loan, Pag-IBIG loan, and partial payments"}
                      </p>
                    </div>
                  </div>

                  {/* Total Deductions Formula */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      Total Deductions Formula
                    </h3>
                    <div
                      className={`p-3 border rounded-md bg-gray-50 min-h-[60px] mb-2 ${
                        !selectedOperator ? "cursor-not-allowed" : ""
                      }`}
                      onDragOver={(e) => {
                        if (!selectedOperator) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        if (!selectedOperator) {
                          toast.error(
                            "Please select an operator first (e.g., +, -, *, /)"
                          );
                          return;
                        }
                        e.preventDefault();
                        const variable = e.dataTransfer.getData("text/plain");
                        const currentFormula =
                          calculationSettings.totalDeductions?.formula || "";
                        const newFormula = currentFormula
                          ? `${currentFormula} ${selectedOperator} ${variable}`
                          : variable;
                        setCalculationSettings({
                          ...calculationSettings,
                          totalDeductions: {
                            ...calculationSettings.totalDeductions,
                            formula: newFormula,
                            description:
                              calculationSettings.totalDeductions
                                ?.description ||
                              "Sum of all statutory and voluntary deductions",
                          },
                        });
                        setShowSaved(true);
                        setTimeout(() => setShowSaved(false), 2000);
                        setSelectedOperator(null);
                      }}
                    >
                      <AutoSaveInput
                        value={
                          calculationSettings.totalDeductions?.formula ||
                          "sss + philHealth + pagIbig + cashAdvanceDeductions + shorts + others"
                        }
                        onChange={(value) => {
                          setCalculationSettings({
                            ...calculationSettings,
                            totalDeductions: {
                              ...calculationSettings.totalDeductions,
                              formula: value,
                              description:
                                calculationSettings.totalDeductions
                                  ?.description ||
                                "Sum of all statutory and voluntary deductions",
                            },
                          });
                          setShowSaved(true);
                          setTimeout(() => setShowSaved(false), 2000);
                        }}
                        placeholder="Enter or drag variables to build formula..."
                        showSaved={showSaved}
                        setShowSaved={setShowSaved}
                        label="Total Deductions"
                      />
                      <div className="flex gap-2 mt-2">
                        {["+", "-", "*", "/", "(", ")"].map((operator) => (
                          <button
                            key={operator}
                            onClick={() => {
                              if (selectedOperator === operator) {
                                setSelectedOperator(null);
                              } else {
                                setSelectedOperator(operator);
                              }
                            }}
                            className={`px-3 py-1 border rounded transition-all duration-200 font-mono
                              ${
                                selectedOperator === operator
                                  ? "bg-blue-100 border-blue-300 text-blue-700 ring-2 ring-blue-200 ring-opacity-50"
                                  : "bg-white hover:bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                          >
                            {operator}
                          </button>
                        ))}
                      </div>
                      {!selectedOperator && (
                        <div className="text-xs text-gray-500 italic mt-1">
                          Select an operator before dragging variables
                        </div>
                      )}
                      <div className="font-mono text-sm bg-white p-2 rounded border">
                        {(
                          calculationSettings.totalDeductions?.formula ||
                          "sss + philHealth + pagIbig + cashAdvanceDeductions + shorts + others"
                        )
                          .split(/([+\-*/()])/g)
                          .map((part, index) => {
                            const isVariable = /^[a-zA-Z][a-zA-Z0-9]*$/.test(
                              part.trim()
                            );
                            return (
                              <span
                                key={index}
                                className={`${
                                  isVariable
                                    ? "bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                    : "text-gray-600"
                                }`}
                              >
                                {part}
                              </span>
                            );
                          })}
                      </div>
                      <p className="italic">
                        {calculationSettings.totalDeductions?.description ||
                          "Sum of all statutory and voluntary deductions"}
                      </p>
                    </div>
                  </div>

                  {/* Net Pay Formula */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Net Pay Formula
                    </h3>
                    <div
                      className={`p-3 border rounded-md bg-gray-50 min-h-[60px] mb-2 ${
                        !selectedOperator ? "cursor-not-allowed" : ""
                      }`}
                      onDragOver={(e) => {
                        if (!selectedOperator) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        if (!selectedOperator) {
                          toast.error(
                            "Please select an operator first (e.g., +, -, *, /)"
                          );
                          return;
                        }
                        e.preventDefault();
                        const variable = e.dataTransfer.getData("text/plain");
                        const currentFormula =
                          calculationSettings.netPay?.formula || "";
                        const newFormula = currentFormula
                          ? `${currentFormula} ${selectedOperator} ${variable}`
                          : variable;
                        setCalculationSettings({
                          ...calculationSettings,
                          netPay: {
                            ...calculationSettings.netPay,
                            formula: newFormula,
                            description:
                              calculationSettings.netPay?.description ||
                              "Gross pay minus total deductions",
                          },
                        });
                        setShowSaved(true);
                        setTimeout(() => setShowSaved(false), 2000);
                        setSelectedOperator(null);
                      }}
                    >
                      <AutoSaveInput
                        value={
                          calculationSettings.netPay?.formula ||
                          "grossPay - totalDeductions"
                        }
                        onChange={(value) => {
                          setCalculationSettings({
                            ...calculationSettings,
                            netPay: {
                              ...calculationSettings.netPay,
                              formula: value,
                              description:
                                calculationSettings.netPay?.description ||
                                "Gross pay minus total deductions",
                            },
                          });
                          setShowSaved(true);
                          setTimeout(() => setShowSaved(false), 2000);
                        }}
                        placeholder="Enter or drag variables to build formula..."
                        showSaved={showSaved}
                        setShowSaved={setShowSaved}
                        label="Net Pay"
                      />
                      <div className="flex gap-2 mt-2">
                        {["+", "-", "*", "/", "(", ")"].map((operator) => (
                          <button
                            key={operator}
                            onClick={() => {
                              if (selectedOperator === operator) {
                                setSelectedOperator(null);
                              } else {
                                setSelectedOperator(operator);
                              }
                            }}
                            className={`px-3 py-1 border rounded transition-all duration-200 font-mono
                              ${
                                selectedOperator === operator
                                  ? "bg-blue-100 border-blue-300 text-blue-700 ring-2 ring-blue-200 ring-opacity-50"
                                  : "bg-white hover:bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                          >
                            {operator}
                          </button>
                        ))}
                      </div>
                      {!selectedOperator && (
                        <div className="text-xs text-gray-500 italic mt-1">
                          Select an operator before dragging variables
                        </div>
                      )}
                      <div className="font-mono text-sm bg-white p-2 rounded border">
                        {(
                          calculationSettings.netPay?.formula ||
                          "grossPay - totalDeductions"
                        )
                          .split(/([+\-*/()])/g)
                          .map((part, index) => {
                            const isVariable = /^[a-zA-Z][a-zA-Z0-9]*$/.test(
                              part.trim()
                            );
                            return (
                              <span
                                key={index}
                                className={`${
                                  isVariable
                                    ? "bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                    : "text-gray-600"
                                }`}
                              >
                                {part}
                              </span>
                            );
                          })}
                      </div>
                      <p className="italic">
                        {calculationSettings.netPay?.description ||
                          "Gross pay minus total deductions"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Variables Column - Right Side */}
                {showVariablesPanel && (
                  <div className="w-64" ref={variablesPanelRef}>
                    <div
                      className="bg-white rounded-lg border border-gray-200 p-4 scrollbar-thin"
                      style={{
                        position: "fixed",
                        width: "16rem",
                        right: "2rem",
                        top: "6rem",
                        maxHeight: "calc(100vh - 8rem)",
                        overflowY: "auto",
                        zIndex: 10,
                      }}
                    >
                      <div className="flex items-center justify-between mb-4 pb-2 border-b">
                        <h3 className="text-sm font-medium text-gray-700 flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 6h16M4 12h16m-7 6h7"
                            />
                          </svg>
                          Available Variables
                        </h3>
                        <button
                          onClick={() => setShowVariablesPanel(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-2 mt-2">
                        {[
                          { name: "basicPay", description: "Basic Pay" },
                          { name: "overtime", description: "Overtime Pay" },
                          {
                            name: "holidayBonus",
                            description: "Holiday Bonus",
                          },
                          {
                            name: "undertimeDeduction",
                            description: "Undertime Deduction",
                          },
                          {
                            name: "lateDeduction",
                            description: "Late Deduction",
                          },
                          {
                            name: "nightDifferentialPay",
                            description: "Night Differential",
                          },
                          { name: "sss", description: "SSS Contribution" },
                          { name: "philHealth", description: "PhilHealth" },
                          { name: "pagIbig", description: "Pag-IBIG" },
                          { name: "sssLoan", description: "SSS Loan" },
                          { name: "pagibigLoan", description: "Pag-IBIG Loan" },
                          {
                            name: "cashAdvanceDeductions",
                            description: "Cash Advance",
                          },
                          { name: "shorts", description: "Shorts Deductions" },
                          { name: "partial", description: "Partial Payment" },
                        ].map((variable) => (
                          <div
                            key={variable.name}
                            className="bg-white p-2 rounded border border-gray-200 cursor-move hover:bg-blue-50 hover:border-blue-200 transition-colors"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "text/plain",
                                variable.name
                              );
                            }}
                          >
                            <div className="text-sm font-medium text-gray-700">
                              {variable.description}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {variable.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "database",
      title: "Database Management",
      icon: <MdOutlineDataset className="h-5 w-5" />,
      requiredAccess: "MANAGE_SETTINGS",
      content: (
        <div className="">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Database Location</h2>
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
                    <span className="font-medium">Important Note:</span> Select
                    the directory where your database (CSV) files will be
                    stored.
                    <br />
                    <span className="text-xs italic">
                      A folder named 'SweldoDB' will be created here if it
                      doesn't already exist and will contain CSV files and
                      folders with employee and payroll data.
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                value={currentPath}
                readOnly
                className="flex-1 p-2 border rounded-md bg-gray-50"
                placeholder="Select database directory..."
              />
              <input
                ref={fileInputRef}
                type="file"
                {...({ webkitdirectory: "true" } as any)}
                style={{ display: "none" }}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    const file = files[0];
                    const relativePath = file.webkitRelativePath;
                    if (relativePath) {
                      setDbPath(relativePath);
                      setCurrentPath(relativePath);
                    }
                  }
                }}
              />
              <button
                onClick={async () => {
                  const folderPath = await window.electron.openFolderDialog();
                  if (folderPath) {
                    try {
                      await setDbPath(folderPath);
                      setCurrentPath(folderPath);
                      // Ensure the path is properly persisted in localStorage
                      const persistedState =
                        localStorage.getItem("settings-storage");
                      if (persistedState) {
                        const parsed = JSON.parse(persistedState);
                        parsed.state.dbPath = folderPath;
                        localStorage.setItem(
                          "settings-storage",
                          JSON.stringify(parsed)
                        );
                      } else {
                        // Initialize storage if it doesn't exist
                        localStorage.setItem(
                          "settings-storage",
                          JSON.stringify({
                            state: { dbPath: folderPath, logoPath: "" },
                            version: 0,
                          })
                        );
                      }
                      // Reload only after ensuring persistence
                      window.location.reload();
                    } catch (error) {
                      console.error("Error setting database path:", error);
                      toast.error(
                        "Failed to set database path. Please try again."
                      );
                    }
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Browse
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "dataMigration",
      title: "Data Migration",
      icon: <IoSyncOutline className="w-5 h-5" />,
      requiredAccess: "MANAGE_SETTINGS",
      content: dbPath ? (
        <DataMigrationSettings dbPath={dbPath} />
      ) : (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
          Please configure the database path in the 'Database Management'
          section before running migrations.
        </div>
      ),
    },
  ];

  // Filter accessible sections
  const accessibleSections = sections.filter((section) =>
    section.key === "roles" && !hasRoles
      ? true
      : hasAccess(section.requiredAccess)
  );

  // Effects
  useEffect(() => {
    if (
      accessibleSections.length > 0 &&
      !accessibleSections.find((section) => section.key === selected)
    ) {
      setSelected(accessibleSections[0].key);
    }
  }, [selected, accessibleSections]);

  useEffect(() => {
    const checkRoles = async () => {
      try {
        const roleModel = new RoleModelImpl(dbPath);
        const roles = await roleModel.getRoles();
        setHasRoles(roles.length > 0);
      } catch (error) {
        console.error("Error checking roles:", error);
      }
    };
    checkRoles();
  }, [dbPath]);

  useEffect(() => {
    const loadAttendanceSettings = async () => {
      if (!dbPath) return;

      try {
        const settings = await attendanceSettingsModel.loadAttendanceSettings();
        const timeSettings = await attendanceSettingsModel.loadTimeSettings();
        setEmploymentTypes(timeSettings);
        console.log("[Settings] Attendance settings loaded:", settings);
        setAttendanceSettings(settings);
        setHolidayMultipliers({
          regular: settings.regularHolidayMultiplier.toString(),
          special: settings.specialHolidayMultiplier.toString(),
        });
      } catch (error) {
        console.error("[Settings] Error loading attendance settings:", error);
        toast.error("Failed to load attendance settings");
      }
    };

    loadAttendanceSettings();
  }, [dbPath]);

  useEffect(() => {
    if (!currentPath) return;

    const model = createEmployeeModel(currentPath);
    setEmployeeModel(model);

    const loadAndFilterEmployees = async () => {
      try {
        const allEmployees = await model.loadEmployees();
        // Ensure each employee is only in one list
        const activeList = allEmployees.filter(
          (emp) => emp.status === "active"
        );
        const inactiveList = allEmployees.filter(
          (emp) => emp.status === "inactive"
        );

        // Reset selected employees when loading new data
        setSelectedEmployees([]);
        setActiveEmployees(activeList);
        setInactiveEmployees(inactiveList);
      } catch (error) {
        console.error("Error loading employees:", error);
      }
    };

    loadAndFilterEmployees();
  }, [currentPath]);

  // Function to move selected employee to inactive
  const moveToInactive = async (employee: Employee) => {
    try {
      if (!employeeModel) {
        console.error("Employee model is not initialized");
        return;
      }

      const updatedEmployee = { ...employee, status: "inactive" as const };

      // Update the employee status in the database
      await employeeModel.updateEmployeeStatus(updatedEmployee);

      // Update the UI state using functional updates to ensure we have the latest state
      setActiveEmployees((currentActive) =>
        currentActive.filter((emp) => emp.id !== employee.id)
      );
      setInactiveEmployees((currentInactive) => {
        // Ensure we don't add duplicates
        const withoutCurrent = currentInactive.filter(
          (emp) => emp.id !== employee.id
        );
        return [...withoutCurrent, updatedEmployee];
      });

      // Clear selection after moving
      setSelectedEmployees((current) =>
        current.filter((emp) => emp.id !== employee.id)
      );
    } catch (error) {
      console.error("Error moving employee to inactive:", error);
    }
  };

  // Function to move selected employee back to active
  const moveToActive = async (employee: Employee) => {
    try {
      if (!employeeModel) {
        console.error("Employee model is not initialized");
        return;
      }

      const updatedEmployee = { ...employee, status: "active" as const };

      // Update the employee status in the database
      await employeeModel.updateEmployeeStatus(updatedEmployee);

      // Update the UI state using functional updates to ensure we have the latest state
      setInactiveEmployees((currentInactive) =>
        currentInactive.filter((emp) => emp.id !== employee.id)
      );
      setActiveEmployees((currentActive) => {
        // Ensure we don't add duplicates
        const withoutCurrent = currentActive.filter(
          (emp) => emp.id !== employee.id
        );
        return [...withoutCurrent, updatedEmployee];
      });

      // Clear selection after moving
      setSelectedEmployees((current) =>
        current.filter((emp) => emp.id !== employee.id)
      );
    } catch (error) {
      console.error("Error moving employee to active:", error);
    }
  };

  // Function to check if an employee is selected
  const isEmployeeSelected = (employee: Employee) => {
    return selectedEmployees.some((selected) => selected.id === employee.id);
  };

  const handleSelectionChange = (key: string | number) => {
    setSelected(key.toString());
  };

  const handleSaveEmploymentTypes = async (types: EmploymentType[]) => {
    if (!hasAccess("MANAGE_SETTINGS")) {
      toast.error("You do not have permission to modify employment types");
      return;
    }
    try {
      console.log("SettingsPage received employment types:", types);
      await attendanceSettingsModel?.saveTimeSettings(types);
      toast.success("Employment types saved successfully");
    } catch (error) {
      console.error("Error saving employment types:", error);
      toast.error("Failed to save employment types");
    }
  };

  // Initialize models and data
  const initializeData = React.useCallback(async () => {
    if (!dbPath) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Initialize models
      const attendanceSettingsModel = createAttendanceSettingsModel(dbPath);
      const model = createEmployeeModel(dbPath);
      setEmployeeModel(model);

      // Load attendance settings
      const settings = await attendanceSettingsModel.loadAttendanceSettings();
      const timeSettings = await attendanceSettingsModel.loadTimeSettings();
      setEmploymentTypes(timeSettings);
      console.log("[Settings] Attendance settings loaded:", settings);
      setAttendanceSettings(settings);
      setHolidayMultipliers({
        regular: settings.regularHolidayMultiplier.toString(),
        special: settings.specialHolidayMultiplier.toString(),
      });

      // Load employees
      const allEmployees = await model.loadEmployees();
      const activeList = allEmployees.filter((emp) => emp.status === "active");
      const inactiveList = allEmployees.filter(
        (emp) => emp.status === "inactive"
      );
      setSelectedEmployees([]);
      setActiveEmployees(activeList);
      setInactiveEmployees(inactiveList);

      // Check roles
      const roleModel = new RoleModelImpl(dbPath);
      const roles = await roleModel.getRoles();
      setHasRoles(roles.length > 0);

      setIsLoading(false);
    } catch (error) {
      console.error("[Settings] Error initializing data:", error);
      setError("Failed to load settings data. Please try again.");
      setIsLoading(false);
    }
  }, [dbPath]);

  // Effect for initialization
  useEffect(() => {
    console.log("[Settings] Initializing with dbPath:", dbPath);
    initializeData();
  }, [dbPath, initializeData]);

  // Function to handle column color changes
  const handleColumnColorChange = (columnId: string, color: string) => {
    setColumnColor(columnId, color);
    setShowColumnColorSaved((prev) => ({ ...prev, [columnId]: true }));
    setTimeout(() => {
      setShowColumnColorSaved((prev) => ({ ...prev, [columnId]: false }));
    }, 2000);
  };

  // Add useEffect to handle scroll events for the variables panel
  useEffect(() => {
    const handleScroll = () => {
      if (calculationSettingsRef.current) {
        const rect = calculationSettingsRef.current.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        setShowVariables(isVisible);
      }
    };

    window.addEventListener("scroll", handleScroll);
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Show loading state
  // console.log("[SettingsPage] Checking isLoading:", isLoading);
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto"></div>
          <div className="text-gray-600">Loading settings...</div>
        </div>
      </div>
    );
  }

  // Show error state
  // console.log("[SettingsPage] Checking error state:", error);
  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-red-600 text-xl">⚠️</div>
          <div className="text-gray-800 font-medium">{error}</div>
          <button
            onClick={initializeData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Early return for access restriction - Use synchronous check directly
  // console.log(
  //   `[SettingsPage] Checking access: hasRoles=${hasRoles}, dbPath=${!!dbPath}`
  // );
  if (!hasAccess("MANAGE_SETTINGS") && hasRoles && dbPath) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <IoShieldOutline className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-500">
            You don't have permission to access settings.
          </p>
        </div>
      </div>
    );
  }

  // If no dbPath, only show database configuration section
  // console.log("[SettingsPage] Checking !dbPath:", !dbPath);
  if (!dbPath) {
    return (
      <main className="max-w-12xl mx-auto py-12 sm:px-6 lg:px-8">
        <MagicCard
          className="p-0.5 rounded-2xl col-span-2"
          gradientSize={400}
          gradientColor="#9E7AFF"
          gradientOpacity={0.8}
          gradientFrom="#9E7AFF"
          gradientTo="#FE8BBB"
        >
          <div className="px-4 sm:px-0">
            <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100">
                <div className="flex items-center gap-1 px-6 bg-gray-50">
                  <div className="flex items-center gap-2 px-4 py-4 text-sm font-medium text-blue-600">
                    <MdOutlineDataset className="h-5 w-5" />
                    <span>Database Management</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-2">
                    Initial Database Setup
                  </h2>
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 flex items-center gap-2 border border-yellow-300">
                    <IoInformationCircleOutline className="w-6 h-6 text-yellow-900" />
                    <p className="text-sm text-gray-800 font-light">
                      Welcome to Sweldo! Before you can start using the
                      application, please select a directory where your database
                      files will be stored. A folder named 'SweldoDB' will be
                      created in this location.
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <input
                      type="text"
                      value={currentPath}
                      readOnly
                      className="flex-1 p-2 border rounded-md bg-gray-50"
                      placeholder="Select database directory..."
                    />
                    <button
                      onClick={async () => {
                        const folderPath =
                          await window.electron.openFolderDialog();
                        if (folderPath) {
                          setDbPath(folderPath);
                          setCurrentPath(folderPath);
                          // Reload the page after setting the path
                          window.location.reload();
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MagicCard>
      </main>
    );
  }

  // Early return for no accessible sections
  if (accessibleSections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <IoShieldOutline className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            No Available Settings
          </h2>
          <p className="text-gray-500">
            You don't have access to any settings sections.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-12xl mx-auto py-20 sm:px-6 lg:px-8">
      <MagicCard
        className="p-0.5 rounded-2xl col-span-2"
        gradientSize={400}
        gradientColor="#9E7AFF"
        gradientOpacity={0.8}
        gradientFrom="#9E7AFF"
        gradientTo="#FE8BBB"
      >
        <div className="px-4 sm:px-0">
          <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100">
              <div className="flex items-center gap-1 px-6 bg-gray-50 overflow-x-auto scrollbar-thin">
                {accessibleSections.map((section) => (
                  <button
                    key={section.key}
                    onClick={() => handleSelectionChange(section.key)}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all whitespace-nowrap ${
                      selected === section.key
                        ? "text-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <div
                      className={`transition-colors ${
                        selected === section.key
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    >
                      {section.icon}
                    </div>
                    <span>{section.title}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6">
              {
                accessibleSections.find((section) => section.key === selected)
                  ?.content
              }
            </div>
          </div>
        </div>
      </MagicCard>
    </main>
  );
}
