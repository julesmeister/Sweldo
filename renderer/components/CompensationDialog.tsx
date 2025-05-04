import React, { useEffect, useState, useMemo, useRef } from "react";
import { Compensation, DayType } from "@/renderer/model/compensation";
import {
  AttendanceSettings,
  EmploymentType,
  createAttendanceSettingsModel,
  getScheduleForDate,
} from "@/renderer/model/settings";
import { Employee } from "@/renderer/model/employee";
import { EmployeeModel } from "@/renderer/model/employee";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { IoClose, IoCalculator } from "react-icons/io5";
import { Switch } from "@headlessui/react";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import {
  HolidayModel,
  Holiday,
  createHolidayModel,
} from "@/renderer/model/holiday";
import {
  createTimeObjects,
  calculateTimeMetrics,
  calculatePayMetrics,
  isHolidayDate,
  getPaymentBreakdown,
  calculateTimeDifference,
  createDateString,
} from "@/renderer/hooks/utils/compensationUtils";
import { toast } from "sonner";
import { ComputationBreakdownButton } from "@/renderer/components/ComputationBreakdownButton";
import {
  useSchedule,
  formatTime,
  ScheduleInfo,
} from "@/renderer/hooks/utils/useSchedule";

interface CompensationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (compensation: Compensation) => Promise<void>;
  employee: Employee | null;
  compensation: Compensation;
  month: number;
  year: number;
  day: number;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
  } | null;
  timeIn?: string;
  timeOut?: string;
  accessCodes?: string[];
}

interface FormFieldProps {
  label: string;
  name: string;
  value: any;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  readOnly?: boolean;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
  className?: string;
  manualOverride?: boolean;
  isComputedField?: boolean;
  hasEditAccess?: boolean;
  enableHoursDropdown?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  value,
  onChange,
  readOnly = false,
  type = "text",
  options,
  className = "",
  manualOverride = false,
  isComputedField = false,
  hasEditAccess = true,
  enableHoursDropdown = false,
}) => {
  const [isHoursDropdownOpen, setIsHoursDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">(
    "bottom"
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  const isFieldReadOnly =
    readOnly || (isComputedField && !manualOverride) || !hasEditAccess;
  const fieldClassName = `w-full px-3 py-1.5 text-sm ${
    isFieldReadOnly
      ? "bg-gray-800/50 text-gray-400 cursor-not-allowed"
      : "bg-gray-800 text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
  } border border-gray-700 rounded-md ${className}`;

  // Determine if this is a monetary field (contains 'Pay' or 'Deduction')
  const isMonetaryField = name.includes("Pay") || name.includes("Deduction");
  // Determine if this is a minutes field
  const isMinutesField = name.includes("Minutes");
  // Determine if this is an hours field
  const isHoursField = name.includes("Hours");

  // Format the value based on field type
  const formattedValue =
    typeof value === "number"
      ? isMonetaryField
        ? name === "overtimePay" ||
          name === "undertimeDeduction" ||
          name === "lateDeduction"
          ? Math.round(value)
          : Number(value).toFixed(2)
        : isMinutesField || isHoursField
        ? Math.round(value)
        : value
      : value;

  useEffect(() => {
    if (isHoursDropdownOpen && fieldRef.current) {
      const rect = fieldRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      setDropdownPosition(spaceBelow < 200 ? "top" : "bottom");
    }
  }, [isHoursDropdownOpen]);

  const handleHourSelect = (hours: number) => {
    const value = name === "overtimeMinutes" ? hours * 60 : hours;
    onChange({
      target: {
        name,
        value: value.toString(),
      },
    } as React.ChangeEvent<HTMLInputElement>);
    setIsHoursDropdownOpen(false);
  };

  const renderHoursDropdown = () => {
    if (
      !isHoursDropdownOpen ||
      (name !== "overtimeMinutes" && name !== "nightDifferentialHours")
    )
      return null;

    const currentHours =
      name === "overtimeMinutes"
        ? Math.floor(Number(value) / 60)
        : Math.floor(Number(value));

    return (
      <div
        className={`absolute ${
          dropdownPosition === "bottom" ? "top-full" : "bottom-full"
        } left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50 p-2 mt-1 w-[300px]`}
      >
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((hour) => (
            <button
              key={hour}
              onClick={() => handleHourSelect(hour)}
              className={`
                px-2 py-1.5 text-sm rounded
                transition-all duration-150
                ${
                  currentHours === hour
                    ? "bg-blue-600 text-white font-medium"
                    : "hover:bg-gray-800 text-gray-300"
                }
              `}
            >
              {hour}h
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      {type === "select" ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={isFieldReadOnly}
          className={fieldClassName}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative" ref={fieldRef}>
          <input
            ref={inputRef}
            type="text"
            name={name}
            value={formattedValue}
            onChange={onChange}
            onFocus={() => {
              if (
                (name === "overtimeMinutes" ||
                  name === "nightDifferentialHours") &&
                !isFieldReadOnly
              ) {
                setIsHoursDropdownOpen(true);
              }
            }}
            onBlur={(e) => {
              // Only hide if the click was outside our component
              const isClickInside =
                e.relatedTarget &&
                fieldRef.current?.contains(e.relatedTarget as Node);
              if (!isClickInside) {
                setTimeout(() => setIsHoursDropdownOpen(false), 200);
              }
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldClassName}`}
            disabled={!hasEditAccess || !manualOverride}
            min="0"
            step={
              name === "overtimePay" ||
              name === "undertimeDeduction" ||
              name === "lateDeduction"
                ? "1"
                : "0.01"
            }
          />
          {name !== "hoursWorked" && (
            <button
              onClick={(e) => {
                e.preventDefault();
                if (hasEditAccess && manualOverride) {
                  onChange({ target: { name, value: "0" } } as any);
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-[55%] text-gray-400 hover:text-gray-600 text-xl font-bold"
              title="Clear value"
            >
              ×
            </button>
          )}
          {renderHoursDropdown()}
        </div>
      )}
    </div>
  );
};

export const CompensationDialog: React.FC<CompensationDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  employee,
  compensation,
  month,
  year,
  day,
  position,
  timeIn,
  timeOut,
  accessCodes = [],
}) => {
  const [formData, setFormData] = useState<Compensation>({
    ...compensation,
    month,
    year,
    day,
    dayType: compensation.dayType || ("Regular" as DayType),
    manualOverride: compensation.manualOverride || false,
  });
  const { dbPath } = useSettingsStore();
  const attendanceSettingsModel = useMemo(
    () => createAttendanceSettingsModel(dbPath),
    [dbPath]
  );
  const holidayModel = useMemo(
    () => createHolidayModel(dbPath, year, month),
    [dbPath, year, month]
  );
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [employmentType, setEmploymentType] = useState<EmploymentType | null>(
    null
  );
  const [attendanceSettings, setAttendanceSettings] =
    useState<AttendanceSettings | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const hasEditAccess =
    accessCodes.includes("MANAGE_PAYROLL") ||
    accessCodes.includes("MANAGE_ATTENDANCE");

  const date = useMemo(
    () => new Date(year, month - 1, day),
    [year, month, day]
  );

  const scheduleInfo = useSchedule(
    attendanceSettingsModel,
    employmentType,
    date
  );

  const { schedule, hasSchedule, isRestDay, formattedSchedule } =
    useMemo(() => {
      return (
        scheduleInfo || {
          schedule: null,
          hasSchedule: false,
          isRestDay: false,
          formattedSchedule: "Loading...",
        }
      );
    }, [scheduleInfo]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!dbPath || !attendanceSettingsModel || !holidayModel) return;

      try {
        const timeSettings = await attendanceSettingsModel.loadTimeSettings();
        const currentEmploymentType =
          timeSettings.find((type) => type.type === employee?.employmentType) ||
          null;
        setEmploymentType(currentEmploymentType);

        const [settings, loadedHolidays] = await Promise.all([
          attendanceSettingsModel.loadAttendanceSettings(),
          holidayModel.loadHolidays(),
        ]);
        setAttendanceSettings(settings);
        setHolidays(loadedHolidays);
      } catch (error) {
        console.error("Error loading initial data for dialog:", error);
        toast.error("Failed to load settings or holidays for dialog");
      }
    };

    if (isOpen) {
      loadInitialData();
    }
  }, [
    dbPath,
    attendanceSettingsModel,
    holidayModel,
    employee?.employmentType,
    isOpen,
  ]);

  useEffect(() => {
    if (isOpen && scheduleInfo) {
      setFormData((prev) => ({
        ...prev,
        dayType: scheduleInfo.isRestDay ? "Rest Day" : prev.dayType,
        hoursWorked: scheduleInfo.isRestDay
          ? 0
          : Math.round(prev.hoursWorked || 0),
      }));
    }
  }, [isOpen, scheduleInfo]);

  useEffect(() => {
    setFormData(compensation);
  }, [compensation]);

  const computedValues = useMemo(() => {
    if (!employmentType || !attendanceSettings || !scheduleInfo) {
      const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
      return {
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
        hoursWorked: 0,
        grossPay: dailyRate,
        dailyRate,
        deductions: 0,
        netPay: dailyRate,
        lateDeduction: 0,
        undertimeDeduction: 0,
        overtimePay: 0,
        holidayBonus: 0,
        nightDifferentialHours: 0,
        nightDifferentialPay: 0,
        manualOverride: false,
        absence: false,
        dayType: "Regular" as DayType,
      };
    }

    const dailyRate: number =
      formData.dailyRate || parseFloat((employee?.dailyRate || 0).toString());
    const entryDate = new Date(year, month - 1, day);
    const holiday = holidays.find((h) => isHolidayDate(entryDate, h));

    const scheduleDetails = scheduleInfo.schedule;
    const isWorkday = scheduleInfo.hasSchedule && !scheduleInfo.isRestDay;

    const isHoliday = !!holiday;
    const isPaidHoliday = holiday && holiday.multiplier > 0;
    const hasTimeEntries = !!(timeIn && timeOut);
    const isPresent = hasTimeEntries;

    const createBaseReturn = (props: Partial<Compensation> = {}) => ({
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      hoursWorked: 0,
      grossPay: 0,
      dailyRate,
      deductions: 0,
      netPay: 0,
      lateDeduction: 0,
      undertimeDeduction: 0,
      overtimePay: 0,
      nightDifferentialHours: 0,
      nightDifferentialPay: 0,
      holidayBonus: 0,
      manualOverride: false,
      absence: false,
      ...props,
    });

    if (!isPresent) {
      if (isPaidHoliday) {
        const holidayBasePay = dailyRate * 1.0;
        return createBaseReturn({
          grossPay: holidayBasePay,
          netPay: holidayBasePay,
          holidayBonus: 0,
          absence: false,
          dayType: holiday?.type === "Regular" ? "Holiday" : "Special",
        });
      } else {
        return createBaseReturn({ absence: isWorkday });
      }
    }

    if (scheduleInfo.isRestDay || !attendanceSettings) {
      const basePay = dailyRate;
      const totalHolidayPay = holiday ? dailyRate * holiday.multiplier : 0;
      const presentPay = holiday ? totalHolidayPay : basePay;

      let hoursWorked = 0;
      if (timeIn && timeOut) {
        try {
          hoursWorked =
            calculateTimeDifference(
              new Date(createDateString(year, month, day, timeOut)),
              new Date(createDateString(year, month, day, timeIn))
            ) / 60;
        } catch (e) {
          console.error("Error calculating time difference for rest day:", e);
        }
      }

      const standardHours = employmentType?.hoursOfWork || 8;
      const rawOvertimeMinutes = Math.max(
        0,
        hoursWorked * 60 - standardHours * 60
      );
      const overtimeMinutes = Math.floor(rawOvertimeMinutes / 60) * 60;
      const hourlyRate =
        dailyRate > 0 && standardHours > 0 ? dailyRate / standardHours : 0;
      const overtimePay =
        (overtimeMinutes / 60) *
        hourlyRate *
        (attendanceSettings?.overtimeHourlyMultiplier || 1.25);

      return createBaseReturn({
        grossPay: presentPay + overtimePay,
        netPay: presentPay + overtimePay,
        holidayBonus: holiday ? totalHolidayPay : 0,
        dayType: holiday
          ? holiday.type === "Regular"
            ? "Holiday"
            : "Special"
          : "Rest Day",
        hoursWorked: Math.round(hoursWorked),
        overtimeMinutes: overtimeMinutes,
        overtimePay: overtimePay,
      });
    }

    if (!timeIn || !timeOut) {
      return createBaseReturn({ absence: true });
    }

    const { actual, scheduled } = createTimeObjects(
      year,
      month,
      day,
      timeIn,
      timeOut,
      scheduleDetails
    );

    if (!scheduled) {
      console.warn(
        "[CompensationDialog] Scheduled time objects could not be created. Check schedule details."
      );
      return createBaseReturn({
        grossPay: dailyRate,
        netPay: dailyRate,
        hoursWorked: Math.round(
          calculateTimeDifference(actual.timeOut, actual.timeIn) / 60
        ),
      });
    }

    const timeMetrics = calculateTimeMetrics(
      actual,
      scheduled,
      attendanceSettings,
      employmentType
    );

    const payMetrics = calculatePayMetrics(
      timeMetrics,
      attendanceSettings,
      dailyRate,
      holiday,
      actual.timeIn,
      actual.timeOut,
      scheduled,
      employmentType
    );

    return {
      ...timeMetrics,
      grossPay: payMetrics.grossPay,
      dailyRate,
      deductions: payMetrics.deductions,
      netPay: payMetrics.netPay,
      lateDeduction: payMetrics.lateDeduction,
      undertimeDeduction: payMetrics.undertimeDeduction,
      overtimePay: payMetrics.overtimePay,
      holidayBonus: payMetrics.holidayBonus,
      nightDifferentialHours: payMetrics.nightDifferentialHours,
      nightDifferentialPay: payMetrics.nightDifferentialPay,
      manualOverride: false,
      absence: false,
      dayType: holiday
        ? holiday.type === "Regular"
          ? "Holiday"
          : "Special"
        : "Regular",
    };
  }, [
    employmentType,
    timeIn,
    timeOut,
    attendanceSettings,
    employee,
    holidays,
    year,
    month,
    day,
    formData.dailyRate,
    scheduleInfo,
  ]);

  useEffect(() => {
    if (computedValues && !formData.manualOverride) {
      setFormData((prev) => {
        const nightHours = computedValues.nightDifferentialHours;
        const standardHours = employmentType?.hoursOfWork || 8;
        const hourlyRate = (employee?.dailyRate || 0) / standardHours;
        const nightDiffMultiplier =
          attendanceSettings?.nightDifferentialMultiplier || 0.1;
        const nightDiffPay = nightHours * hourlyRate * nightDiffMultiplier;

        return {
          ...prev,
          lateMinutes: computedValues.lateMinutes,
          undertimeMinutes: computedValues.undertimeMinutes,
          overtimeMinutes: computedValues.overtimeMinutes,
          hoursWorked: Math.round(computedValues.hoursWorked),
          grossPay: computedValues.grossPay,
          deductions: computedValues.deductions,
          netPay: computedValues.netPay,
          overtimePay: computedValues.overtimePay,
          undertimeDeduction: computedValues.undertimeDeduction,
          lateDeduction: computedValues.lateDeduction,
          holidayBonus: computedValues.holidayBonus,
          nightDifferentialHours: nightHours,
          nightDifferentialPay: nightDiffPay,
          absence: computedValues.absence,
        };
      });
    }
  }, [
    computedValues,
    formData.manualOverride,
    employmentType,
    employee?.dailyRate,
    attendanceSettings,
  ]);

  useEffect(() => {
    if (compensation) {
      setFormData({
        ...compensation,
        month,
        year,
        day,
        dayType: compensation.dayType || ("Regular" as DayType),
        manualOverride: compensation.manualOverride || false,
      });
    }
  }, [compensation, month, year, day]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasEditAccess) {
      toast.error("You do not have permission to edit compensation records");
      return;
    }

    await onSave(formData);
    onClose();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (!hasEditAccess) {
      toast.error("You do not have permission to edit compensation records");
      return;
    }

    const isComputedField = [
      "lateMinutes",
      "undertimeMinutes",
      "overtimeMinutes",
      "hoursWorked",
      "grossPay",
      "deductions",
      "netPay",
      "overtimePay",
      "undertimeDeduction",
      "lateDeduction",
      "holidayBonus",
    ].includes(name);

    if (isComputedField && !formData.manualOverride) {
      toast.error("Enable manual override to edit computed fields");
      return;
    }

    const numericValue = parseFloat(value) || 0;

    setFormData((prev) => {
      const newData = { ...prev };

      if (name === "overtimeMinutes" && formData.manualOverride) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        const standardHours = employmentType?.hoursOfWork || 8;
        const hourlyRate = (employee?.dailyRate || 0) / standardHours;
        const overtimeMultiplier =
          attendanceSettings?.overtimeHourlyMultiplier || 1.25;
        newData.overtimePay =
          Math.floor(numericValue / 60) * hourlyRate * overtimeMultiplier;
        newData.grossPay =
          (formData.dailyRate || 0) +
          newData.overtimePay +
          (formData.nightDifferentialPay || 0) +
          (formData.holidayBonus || 0);
        newData.netPay = newData.grossPay - (formData.deductions || 0);
      } else if (name === "undertimeMinutes" && formData.manualOverride) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        const gracePeriod = attendanceSettings?.undertimeGracePeriod || 0;
        newData.undertimeDeduction =
          numericValue > gracePeriod
            ? (numericValue - gracePeriod) *
              (attendanceSettings?.undertimeDeductionPerMinute || 0)
            : 0;
        newData.deductions =
          newData.undertimeDeduction + (formData.lateDeduction || 0);
        newData.netPay = (formData.grossPay || 0) - newData.deductions;
      } else if (name === "lateMinutes" && formData.manualOverride) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        const gracePeriod = attendanceSettings?.lateGracePeriod || 0;
        newData.lateDeduction =
          numericValue > gracePeriod
            ? (numericValue - gracePeriod) *
              (attendanceSettings?.lateDeductionPerMinute || 0)
            : 0;
        newData.deductions =
          (formData.undertimeDeduction || 0) + newData.lateDeduction;
        newData.netPay = (formData.grossPay || 0) - newData.deductions;
      } else if (name === "nightDifferentialHours" && formData.manualOverride) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        if (numericValue === 0) {
          newData.nightDifferentialPay = 0;
        } else {
          const standardHours = employmentType?.hoursOfWork || 8;
          const hourlyRate = (employee?.dailyRate || 0) / standardHours;
          const nightDiffMultiplier =
            attendanceSettings?.nightDifferentialMultiplier || 0.1;
          newData.nightDifferentialPay =
            numericValue * hourlyRate * nightDiffMultiplier;
        }
        newData.grossPay =
          (formData.dailyRate || 0) +
          (formData.overtimePay || 0) +
          newData.nightDifferentialPay +
          (formData.holidayBonus || 0);
        newData.netPay = newData.grossPay - (formData.deductions || 0);
      } else if (
        name === "overtimePay" ||
        name === "holidayBonus" ||
        name === "nightDifferentialPay"
      ) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        const baseGrossPay =
          (prev.grossPay || 0) - ((prev[key] as number) || 0);
        newData.grossPay = baseGrossPay + numericValue;
        newData.netPay = newData.grossPay - (prev.deductions || 0);
      } else if (name === "undertimeDeduction" || name === "lateDeduction") {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        const totalDeductions =
          (prev.undertimeDeduction || 0) + (prev.lateDeduction || 0);
        newData.deductions = totalDeductions;
        newData.netPay = (prev.grossPay || 0) - totalDeductions;
      } else if (name === "leavePay") {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        newData.netPay =
          (prev.grossPay || 0) - (prev.deductions || 0) + numericValue;
      } else if (name === "grossPay") {
        newData.grossPay = numericValue;
        newData.netPay = numericValue - (prev.deductions || 0);
      } else if (name === "netPay") {
        newData.netPay = numericValue;
        newData.grossPay = numericValue + (prev.deductions || 0);
      } else {
        const key = name as keyof Compensation;
        (newData[key] as string | number) =
          name.includes("Pay") ||
          name.includes("Deduction") ||
          name.includes("Hours") ||
          name.includes("Minutes")
            ? numericValue
            : value;
      }

      return newData;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700 w-full max-w-7xl overflow-visible"
        style={{
          top: position?.top,
          left: position?.left,
          transform: position?.showAbove ? "translateY(-100%)" : "none",
          maxHeight: "calc(100vh - 100px)",
        }}
      >
        <div
          className="absolute left-8 w-0 h-0"
          style={{
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            ...(position?.showAbove
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
        <div
          className="absolute left-8 w-0 h-0"
          style={{
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            ...(position?.showAbove
              ? {
                  bottom: "-6px",
                  borderTop: "7px solid rgb(17, 24, 39)",
                }
              : {
                  top: "-6px",
                  borderBottom: "7px solid rgb(17, 24, 39)",
                }),
          }}
        />

        <div className="relative">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-100 flex items-center">
                {hasEditAccess
                  ? "Edit Compensation Details"
                  : "View Compensation Details"}
                <span
                  className="text-sm text-gray-400 font-normal ml-2 flex items-center"
                  title="Scheduled working hours for this day"
                >
                  <svg
                    className="w-4 h-4 mx-2 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {scheduleInfo
                    ? formattedSchedule || "Day Off"
                    : "Loading Schedule..."}
                  {employmentType && scheduleInfo
                    ? ` based on ${employmentType.type}`
                    : ""}
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {formData.manualOverride && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      overtimeMinutes: 0,
                      overtimePay: 0,
                      undertimeMinutes: 0,
                      undertimeDeduction: 0,
                      lateMinutes: 0,
                      lateDeduction: 0,
                      holidayBonus: 0,
                      leaveType: "None" as "None",
                      leavePay: 0,
                      nightDifferentialHours: 0,
                      nightDifferentialPay: 0,
                      grossPay: compensation.dailyRate,
                      netPay: compensation.dailyRate,
                      deductions: 0,
                    });
                  }}
                  className="inline-flex items-center px-2 py-1 border border-gray-600 text-xs font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reset
                </button>
              )}
              {attendanceSettings && (
                <ComputationBreakdownButton
                  breakdown={
                    formData.manualOverride
                      ? {
                          basePay: parseFloat(
                            (
                              formData.dailyRate ||
                              employee?.dailyRate ||
                              0
                            ).toString()
                          ),
                          overtimePay: formData.overtimePay || 0,
                          nightDifferentialPay:
                            formData.nightDifferentialPay || 0,
                          holidayBonus: formData.holidayBonus || 0,
                          deductions: {
                            late: formData.lateDeduction || 0,
                            undertime: formData.undertimeDeduction || 0,
                            total: formData.deductions || 0,
                          },
                          netPay: formData.netPay || 0,
                          details: {
                            hourlyRate:
                              parseFloat(
                                (
                                  formData.dailyRate ||
                                  employee?.dailyRate ||
                                  0
                                ).toString()
                              ) / 8,
                            overtimeHourlyRate:
                              (parseFloat(
                                (
                                  formData.dailyRate ||
                                  employee?.dailyRate ||
                                  0
                                ).toString()
                              ) /
                                8) *
                              (attendanceSettings.overtimeHourlyMultiplier ||
                                1.25),
                            overtimeMinutes: formData.overtimeMinutes || 0,
                            nightDifferentialHours:
                              formData.nightDifferentialHours || 0,
                            lateMinutes: formData.lateMinutes || 0,
                            undertimeMinutes: formData.undertimeMinutes || 0,
                            lateGracePeriod:
                              attendanceSettings.lateGracePeriod || 0,
                            undertimeGracePeriod:
                              attendanceSettings.undertimeGracePeriod || 0,
                            lateDeductionPerMinute:
                              attendanceSettings.lateDeductionPerMinute || 0,
                            undertimeDeductionPerMinute:
                              attendanceSettings.undertimeDeductionPerMinute ||
                              0,
                          },
                        }
                      : getPaymentBreakdown(
                          calculateTimeMetrics(
                            createTimeObjects(
                              year,
                              month,
                              day,
                              timeIn || "00:00",
                              timeOut || "00:00",
                              employmentType
                            ).actual,
                            createTimeObjects(
                              year,
                              month,
                              day,
                              timeIn || "00:00",
                              timeOut || "00:00",
                              employmentType
                            ).scheduled,
                            attendanceSettings,
                            employmentType
                          ),
                          calculatePayMetrics(
                            calculateTimeMetrics(
                              createTimeObjects(
                                year,
                                month,
                                day,
                                timeIn || "00:00",
                                timeOut || "00:00",
                                employmentType
                              ).actual,
                              createTimeObjects(
                                year,
                                month,
                                day,
                                timeIn || "00:00",
                                timeOut || "00:00",
                                employmentType
                              ).scheduled,
                              attendanceSettings,
                              employmentType
                            ),
                            attendanceSettings,
                            parseFloat(
                              (
                                formData.dailyRate ||
                                employee?.dailyRate ||
                                0
                              ).toString()
                            ),
                            holidays.find((h) =>
                              isHolidayDate(new Date(year, month - 1, day), h)
                            ),
                            createTimeObjects(
                              year,
                              month,
                              day,
                              timeIn || "00:00",
                              timeOut || "00:00",
                              employmentType
                            ).actual.timeIn,
                            createTimeObjects(
                              year,
                              month,
                              day,
                              timeIn || "00:00",
                              timeOut || "00:00",
                              employmentType
                            ).actual.timeOut,
                            createTimeObjects(
                              year,
                              month,
                              day,
                              timeIn || "00:00",
                              timeOut || "00:00",
                              employmentType
                            ).scheduled,
                            employmentType
                          ),
                          attendanceSettings,
                          parseFloat(
                            (
                              formData.dailyRate ||
                              employee?.dailyRate ||
                              0
                            ).toString()
                          ),
                          employmentType
                        )
                  }
                  attendanceSettings={attendanceSettings}
                  holiday={holidays.find((h) =>
                    isHolidayDate(new Date(year, month - 1, day), h)
                  )}
                />
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 focus:outline-none"
              >
                <IoClose className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-4 space-y-3 bg-gray-900 rounded-b-lg"
          >
            <div className="grid grid-cols-7 gap-4">
              <FormField
                label="Day Type"
                name="dayType"
                value={formData.dayType}
                onChange={handleInputChange}
                type="select"
                options={[
                  { value: "Regular", label: "Regular" },
                  { value: "Holiday", label: "Holiday" },
                  { value: "Rest Day", label: "Rest Day" },
                ]}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Hours Worked"
                name="hoursWorked"
                value={formData.hoursWorked || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Leave Type"
                name="leaveType"
                value={formData.leaveType || "None"}
                onChange={handleInputChange}
                type="select"
                options={[
                  { value: "None", label: "None" },
                  { value: "Vacation", label: "Vacation" },
                  { value: "Sick", label: "Sick" },
                  { value: "Unpaid", label: "Unpaid" },
                ]}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Overtime Minutes"
                name="overtimeMinutes"
                value={formData.overtimeMinutes || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Overtime Pay"
                name="overtimePay"
                value={formData.overtimePay || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Undertime Minutes"
                name="undertimeMinutes"
                value={formData.undertimeMinutes || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Undertime Deduction"
                name="undertimeDeduction"
                value={formData.undertimeDeduction || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Late Minutes"
                name="lateMinutes"
                value={formData.lateMinutes || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Late Deduction"
                name="lateDeduction"
                value={formData.lateDeduction || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Night Differential Hours"
                name="nightDifferentialHours"
                value={formData.nightDifferentialHours || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
                enableHoursDropdown={true}
              />

              <FormField
                label="Night Differential Pay"
                name="nightDifferentialPay"
                value={formData.nightDifferentialPay || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Holiday Bonus"
                name="holidayBonus"
                value={formData.holidayBonus || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Leave Pay"
                name="leavePay"
                value={formData.leavePay || 0}
                onChange={handleInputChange}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Deductions"
                name="deductions"
                value={formData.deductions || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Gross Pay"
                name="grossPay"
                value={formData.grossPay || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <FormField
                label="Net Pay"
                name="netPay"
                value={formData.netPay || 0}
                onChange={handleInputChange}
                manualOverride={formData.manualOverride}
                isComputedField={true}
                hasEditAccess={hasEditAccess}
              />

              <div className="col-start-7 flex items-center h-[4.5rem] mt-1">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
                  <Switch
                    checked={formData.manualOverride || false}
                    onChange={(e) => {
                      if (!hasEditAccess) {
                        toast.error(
                          "You do not have permission to edit compensation records"
                        );
                        return;
                      }
                      setFormData((prev) => ({ ...prev, manualOverride: e }));
                    }}
                    disabled={!hasEditAccess}
                    className={`${
                      formData.manualOverride ? "bg-blue-600" : "bg-gray-700"
                    } relative inline-flex h-6 w-11 flex-shrink-0 ${
                      hasEditAccess
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-50"
                    } rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  >
                    <span className="sr-only">Manual Override</span>
                    <span
                      className={`${
                        formData.manualOverride
                          ? "translate-x-5"
                          : "translate-x-0"
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-gray-100 shadow transform transition-transform duration-200 ease-in-out`}
                    />
                  </Switch>
                  <span>Manual Override</span>
                </label>
              </div>

              <div className="col-span-7 flex items-center space-x-3">
                <input
                  type="text"
                  name="notes"
                  placeholder="Notes"
                  value={formData.notes || ""}
                  onChange={handleInputChange}
                  disabled={!hasEditAccess}
                  className={`flex-1 px-3 py-2.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 ${
                    hasEditAccess
                      ? "focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
                >
                  {hasEditAccess ? "Cancel" : "Close"}
                </button>
                {hasEditAccess && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
