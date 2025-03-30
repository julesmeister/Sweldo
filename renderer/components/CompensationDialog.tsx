import React, { useEffect, useState, useMemo } from "react";
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
} from "@/renderer/hooks/utils/compensationUtils";
import { toast } from "sonner";
import { ComputationBreakdownButton } from "@/renderer/components/ComputationBreakdownButton";
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
  value: string | number;
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
}) => {
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
        ? Number(value).toFixed(2)
        : isMinutesField || isHoursField
        ? Math.round(value)
        : value
      : value;

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
        <div className="relative">
          <input
            type="number"
            name={name}
            value={formattedValue}
            onChange={onChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldClassName}`}
            disabled={!hasEditAccess || !manualOverride}
            min="0"
            step={isMonetaryField ? "0.01" : "1"}
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
  const attendanceSettingsModel = createAttendanceSettingsModel(dbPath);
  const holidayModel = createHolidayModel(dbPath, year, month);
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

  useEffect(() => {
    const loadSchedule = async () => {
      if (!dbPath) return;

      try {
        const settingsModel = createAttendanceSettingsModel(dbPath);
        const timeSettings = await settingsModel.loadTimeSettings();
        const employmentType = timeSettings.find(
          (type) => type.type === employee?.employmentType
        );

        if (employmentType) {
          const date = new Date(year, month - 1, day);
          const schedule = getScheduleForDate(employmentType, date);

          if (schedule && !schedule.isOff) {
            setFormData((prev) => ({
              ...prev,
              dayType: schedule.isOff ? "Rest Day" : prev.dayType,
              hoursWorked: schedule.isOff
                ? 0
                : Math.round(prev.hoursWorked || 0),
            }));
          }
        }

        setEmploymentType(employmentType || null);
        const settings = await settingsModel.loadAttendanceSettings();
        setAttendanceSettings(settings);
      } catch (error) {
        toast.error("Failed to load schedule");
      }
    };

    if (isOpen) {
      loadSchedule();
    }
  }, [dbPath, employee?.employmentType, isOpen, year, month, day]);

  useEffect(() => {
    setFormData(compensation);
  }, [compensation]);

  const computedValues = useMemo(() => {
    const dailyRate: number = parseFloat((employee?.dailyRate || 0).toString());
    const entryDate = new Date(year, month - 1, day);
    const holiday = holidays.find((h) => isHolidayDate(entryDate, h));

    // Create base return object with zero values
    const createBaseReturn = (
      grossPay = 0,
      manualOverride = false,
      absence = false
    ) => ({
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      hoursWorked: 0,
      grossPay,
      dailyRate: 0,
      deductions: 0,
      netPay: grossPay,
      lateDeduction: 0,
      undertimeDeduction: 0,
      overtimeAddition: 0,
      nightDifferentialHours: 0,
      nightDifferentialPay: 0,
      holidayBonus: holiday ? dailyRate * holiday.multiplier : 0,
      manualOverride,
      absence,
    });
    // Get the schedule for the specific day of the week
    const jsDay = entryDate.getDay(); // 0-6 (0 = Sunday)
    // Convert JavaScript day (0-6) to your schedule format (1-7)
    const scheduleDay = jsDay === 0 ? 7 : jsDay;

    const schedule = employmentType
      ? getScheduleForDate(employmentType, entryDate)
      : null;

    // Separate checks for workday and holiday
    const isWorkday = !!schedule;
    const isHoliday = !!holiday;

    // If it's a workday (not a holiday) and no time entries, mark as absent
    if (isWorkday && !isHoliday && (!timeIn || !timeOut)) {
      return createBaseReturn(0, false, true);
    }

    // If it's a holiday, they should get holiday pay regardless of attendance
    if (isHoliday) {
      const holidayPay = dailyRate * (holiday?.multiplier || 1);
      return createBaseReturn(holidayPay, false, false);
    }

    // If no schedule (rest day) and no holiday, return base values without marking absent
    if (!isWorkday && !isHoliday) {
      return createBaseReturn(0, false, false);
    }

    // Continue with time tracking logic for regular workdays with time entries
    if (!timeIn || !timeOut || !attendanceSettings || !schedule) {
      return createBaseReturn();
    }

    // Use shared utility functions for calculations
    const { actual, scheduled } = createTimeObjects(
      year,
      month,
      day,
      timeIn,
      timeOut,
      employmentType
    );

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
      scheduled
    );

    return {
      lateMinutes: timeMetrics.lateMinutes,
      undertimeMinutes: timeMetrics.undertimeMinutes,
      overtimeMinutes: timeMetrics.overtimeMinutes,
      hoursWorked: timeMetrics.hoursWorked,
      grossPay: payMetrics.grossPay,
      dailyRate,
      deductions: payMetrics.deductions,
      netPay: payMetrics.netPay,
      lateDeduction: payMetrics.lateDeduction,
      undertimeDeduction: payMetrics.undertimeDeduction,
      overtimeAddition: payMetrics.overtimePay,
      holidayBonus: payMetrics.holidayBonus,
      nightDifferentialHours: payMetrics.nightDifferentialHours,
      nightDifferentialPay: payMetrics.nightDifferentialPay,
      manualOverride: false,
      absence: false,
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
  ]);

  useEffect(() => {
    // Only update formData with computed values if manualOverride is false
    if (computedValues && !formData.manualOverride) {
      setFormData((prev) => ({
        ...prev,
        lateMinutes: computedValues.lateMinutes,
        undertimeMinutes: computedValues.undertimeMinutes,
        overtimeMinutes: computedValues.overtimeMinutes,
        hoursWorked: Math.round(computedValues.hoursWorked),
        grossPay: computedValues.grossPay,
        deductions: computedValues.deductions,
        netPay: computedValues.netPay,
        overtimePay: computedValues.overtimeAddition,
        undertimeDeduction: computedValues.undertimeDeduction,
        lateDeduction: computedValues.lateDeduction,
        holidayBonus: computedValues.holidayBonus,
        nightDifferentialHours: computedValues.nightDifferentialHours,
        nightDifferentialPay: computedValues.nightDifferentialPay,
        absence: computedValues.absence,
      }));
    }
  }, [computedValues, formData.manualOverride]);

  // Update formData when compensation prop changes
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

    // Check if trying to change computed fields without manual override
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

      // Handle minute fields affecting their corresponding pay/deduction fields
      if (name === "overtimeMinutes" && formData.manualOverride) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        const standardHours = employmentType?.hoursOfWork || 8;
        const hourlyRate = (employee?.dailyRate || 0) / standardHours;
        const overtimeMultiplier =
          attendanceSettings?.overtimeHourlyMultiplier || 1.25;
        newData.overtimePay =
          Math.floor(numericValue / 60) * hourlyRate * overtimeMultiplier;
        // Update gross pay and net pay
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
        // Update total deductions and net pay
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
        // Update total deductions and net pay
        newData.deductions =
          (formData.undertimeDeduction || 0) + newData.lateDeduction;
        newData.netPay = (formData.grossPay || 0) - newData.deductions;
      } else if (name === "nightDifferentialHours" && formData.manualOverride) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        const standardHours = employmentType?.hoursOfWork || 8;
        const hourlyRate = (employee?.dailyRate || 0) / standardHours;
        const nightDiffMultiplier =
          attendanceSettings?.nightDifferentialMultiplier || 0.1;
        newData.nightDifferentialPay =
          numericValue * hourlyRate * nightDiffMultiplier;
        // Update gross pay and net pay
        newData.grossPay =
          (formData.dailyRate || 0) +
          (formData.overtimePay || 0) +
          newData.nightDifferentialPay +
          (formData.holidayBonus || 0);
        newData.netPay = newData.grossPay - (formData.deductions || 0);
      }
      // Handle fields that affect gross pay
      else if (
        name === "overtimePay" ||
        name === "holidayBonus" ||
        name === "nightDifferentialPay"
      ) {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        // Recalculate gross pay by adding the new value to the base gross pay
        const baseGrossPay =
          (prev.grossPay || 0) - ((prev[key] as number) || 0);
        newData.grossPay = baseGrossPay + numericValue;
        // Update net pay to reflect the new gross pay minus deductions
        newData.netPay = newData.grossPay - (prev.deductions || 0);
      }
      // Handle fields that affect net pay (deductions)
      else if (name === "undertimeDeduction" || name === "lateDeduction") {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        // Recalculate total deductions
        const totalDeductions =
          (prev.undertimeDeduction || 0) + (prev.lateDeduction || 0);
        newData.deductions = totalDeductions;
        // Update net pay by subtracting total deductions from gross pay
        newData.netPay = (prev.grossPay || 0) - totalDeductions;
      }
      // Handle leave pay (affects net pay)
      else if (name === "leavePay") {
        const key = name as keyof Compensation;
        (newData[key] as number) = numericValue;
        // Update net pay by adding leave pay to gross pay minus deductions
        newData.netPay =
          (prev.grossPay || 0) - (prev.deductions || 0) + numericValue;
      }
      // Handle direct gross pay edits
      else if (name === "grossPay") {
        newData.grossPay = numericValue;
        // Update net pay by subtracting deductions from new gross pay
        newData.netPay = numericValue - (prev.deductions || 0);
      }
      // Handle direct net pay edits
      else if (name === "netPay") {
        newData.netPay = numericValue;
        // Update gross pay by adding deductions to new net pay
        newData.grossPay = numericValue + (prev.deductions || 0);
      }
      // Handle other fields normally
      else {
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
        {/* Caret */}
        <div
          className="absolute left-8 w-0 h-0"
          style={{
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            ...(position?.showAbove
              ? {
                  bottom: "-8px",
                  borderTop: "8px solid rgb(55, 65, 81)", // matches border-gray-700
                }
              : {
                  top: "-8px",
                  borderBottom: "8px solid rgb(55, 65, 81)", // matches border-gray-700
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
                  borderTop: "7px solid rgb(17, 24, 39)", // matches bg-gray-900
                }
              : {
                  top: "-6px",
                  borderBottom: "7px solid rgb(17, 24, 39)", // matches bg-gray-900
                }),
          }}
        />

        {/* Dialog content */}
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
                  {employmentType
                    ? (() => {
                        const schedule = getScheduleForDate(
                          employmentType,
                          new Date(
                            compensation.year,
                            compensation.month - 1,
                            compensation.day
                          )
                        );
                        return schedule
                          ? `${schedule.timeIn.replace(
                              /(\d{2}):(\d{2})/,
                              (_, h, m) => {
                                const hour = parseInt(h);
                                return `${hour % 12 || 12}:${m}${
                                  hour < 12 ? "AM" : "PM"
                                }`;
                              }
                            )} - ${schedule.timeOut.replace(
                              /(\d{2}):(\d{2})/,
                              (_, h, m) => {
                                const hour = parseInt(h);
                                return `${hour % 12 || 12}:${m}${
                                  hour < 12 ? "AM" : "PM"
                                }`;
                              }
                            )}`
                          : "Day Off";
                      })()
                    : "No Schedule"}
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
                          basePay: formData.dailyRate || 0,
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
                            hourlyRate: (formData.dailyRate || 0) / 8,
                            overtimeHourlyRate:
                              ((formData.dailyRate || 0) / 8) *
                              (attendanceSettings.overtimeHourlyMultiplier ||
                                1.25),
                            overtimeMinutes: formData.overtimeMinutes || 0,
                            nightDifferentialHours:
                              formData.nightDifferentialHours || 0,
                            lateMinutes: formData.lateMinutes || 0,
                            undertimeMinutes: formData.undertimeMinutes || 0,
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
                            formData.dailyRate,
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
                          formData.dailyRate,
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
