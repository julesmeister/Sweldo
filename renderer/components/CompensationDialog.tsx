import React, { useEffect, useState, useMemo } from "react";
import { Compensation, DayType } from "@/renderer/model/compensation";
import {
  AttendanceSettings,
  EmploymentType,
  createAttendanceSettingsModel,
  getScheduleForDay,
} from "@/renderer/model/settings";
import { Employee } from "@/renderer/model/employee";
import { EmployeeModel } from "@/renderer/model/employee";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { IoClose } from "react-icons/io5";
import { Switch } from "@headlessui/react";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import {
  HolidayModel,
  Holiday,
  createHolidayModel,
} from "@/renderer/model/holiday";

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
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {label}
    </label>
    {type === "select" ? (
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600 ${className}`}
      >
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ) : (
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className={`w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 ${
          readOnly
            ? ""
            : "focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
        } ${className}`}
      />
    )}
  </div>
);

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
}) => {
  const [formData, setFormData] = useState<Compensation>({
    ...compensation,
    month,
    year,
    day,
    dayType: compensation.dayType || ("Regular" as DayType),
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

  useEffect(() => {
    attendanceSettingsModel.loadTimeSettings().then((timeSettings) => {
      setEmploymentTypes(timeSettings);
      const foundType = timeSettings.find(
        (type) => type.type === employee?.employmentType
      );
      setEmploymentType(foundType || null); // Ensure we set null if undefined
    });
    // Load attendance settings
    attendanceSettingsModel.loadAttendanceSettings().then((settings) => {
      setAttendanceSettings(settings);
    });
    // Load holidays
    holidayModel.loadHolidays().then((holidays) => {
      setHolidays(holidays);
    });
  }, [compensation.employeeId]);

  useEffect(() => {
    setFormData(compensation);
  }, [compensation]);

  const computedValues = useMemo(() => {
    const dailyRate: number = parseFloat((employee?.dailyRate || 0).toString());
    const entryDate = new Date(year, month - 1, day);
    const holiday = holidays.find(
      (h) =>
        entryDate >=
          new Date(
            h.startDate.getFullYear(),
            h.startDate.getMonth(),
            h.startDate.getDate()
          ) &&
        entryDate <=
          new Date(
            h.endDate.getFullYear(),
            h.endDate.getMonth(),
            h.endDate.getDate(),
            23,
            59,
            59
          )
    );

    // Create base return object with zero values
    const createBaseReturn = (grossPay = 0, manualOverride = false) => ({
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      hoursWorked: 0,
      grossPay,
      deductions: 0,
      netPay: grossPay,
      lateDeduction: 0,
      undertimeDeduction: 0,
      overtimeAddition: 0,
      holidayBonus: holiday ? dailyRate * holiday.multiplier : 0,
      manualOverride,
    });

    // For non-time-tracking employees, only check presence/absence
    if (!employmentType?.requiresTimeTracking) {
      const isPresent = !!(timeIn || timeOut);
      const grossPay = isPresent ? dailyRate : 0;
      const holidayBonus = holiday ? dailyRate * holiday.multiplier : 0;
      return {
        ...createBaseReturn(grossPay + holidayBonus, true),
        hoursWorked: isPresent ? 8 : 0,
      };
    }

    if (!timeIn || !timeOut || !attendanceSettings) {
      return createBaseReturn();
    }

    // Format date components
    const formatDateComponent = (value: number) =>
      value.toString().padStart(2, "0");
    const formattedMonth = formatDateComponent(month);
    const formattedDay = formatDateComponent(day);
    const createDateString = (time: string) =>
      `${year}-${formattedMonth}-${formattedDay}T${time}`;

    // Create time objects with local timezone
    const createLocalDate = (time: string) => {
      const dateString = createDateString(time);
      const [datePart, timePart] = dateString.split("T");
      return new Date(`${datePart}T${timePart}`);
    };

    const actualTimeIn = createLocalDate(timeIn);
    const actualTimeOut = createLocalDate(timeOut);

    // Get the schedule for the specific day of the week
    const schedule = getScheduleForDay(employmentType, entryDate.getDay());
    if (!schedule) {
      return createBaseReturn(dailyRate);
    }

    const scheduledTimeIn = createLocalDate(schedule.timeIn);
    const scheduledTimeOut = createLocalDate(schedule.timeOut);

    // Calculate time differences
    const calculateTimeDifference = (time1: Date, time2: Date) => {
      return Math.round((time1.getTime() - time2.getTime()) / (1000 * 60));
    };

    const lateMinutes =
      actualTimeIn > scheduledTimeIn
        ? calculateTimeDifference(actualTimeIn, scheduledTimeIn)
        : 0;

    const undertimeMinutes =
      actualTimeOut < scheduledTimeOut
        ? calculateTimeDifference(scheduledTimeOut, actualTimeOut)
        : 0;

    const overtimeMinutes =
      actualTimeOut > scheduledTimeOut
        ? calculateTimeDifference(actualTimeOut, scheduledTimeOut)
        : 0;

    // Calculate deduction minutes
    const calculateDeductionMinutes = (
      minutes: number,
      gracePeriod: number
    ) => {
      return minutes > gracePeriod ? minutes - gracePeriod : 0;
    };

    const lateDeductionMinutes = calculateDeductionMinutes(
      lateMinutes,
      attendanceSettings.lateGracePeriod
    );
    const undertimeDeductionMinutes = calculateDeductionMinutes(
      undertimeMinutes,
      attendanceSettings.undertimeGracePeriod
    );
    const overtimeDeductionMinutes = calculateDeductionMinutes(
      overtimeMinutes,
      attendanceSettings.overtimeGracePeriod
    );

    // Calculate hours worked
    const hoursWorked =
      calculateTimeDifference(actualTimeOut, actualTimeIn) / 60;

    // Calculate deductions and pay
    const deductions =
      lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute +
      undertimeDeductionMinutes *
        attendanceSettings.undertimeDeductionPerMinute +
      overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute;

    const baseGrossPay =
      dailyRate +
      overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute;
    const holidayBonus = holiday ? dailyRate * holiday.multiplier : 0;
    const grossPay = holiday ? baseGrossPay + holidayBonus : baseGrossPay;
    const netPay = grossPay - deductions;

    return {
      lateMinutes,
      undertimeMinutes,
      overtimeMinutes,
      hoursWorked,
      grossPay,
      deductions,
      netPay,
      lateDeduction:
        lateDeductionMinutes * attendanceSettings.lateDeductionPerMinute,
      undertimeDeduction:
        undertimeDeductionMinutes *
        attendanceSettings.undertimeDeductionPerMinute,
      overtimeAddition:
        overtimeDeductionMinutes * attendanceSettings.overtimeAdditionPerMinute,
      holidayBonus,
      manualOverride: false,
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
    // Update formData whenever computedValues change
    if (computedValues) {
      setFormData((prev) => ({
        ...prev,
        lateMinutes: computedValues.lateMinutes,
        undertimeMinutes: computedValues.undertimeMinutes,
        overtimeMinutes: computedValues.overtimeMinutes,
        hoursWorked: computedValues.hoursWorked,
        grossPay: computedValues.grossPay,
        deductions: computedValues.deductions,
        netPay: computedValues.netPay,
        overtimePay: computedValues.overtimeAddition,
        undertimeDeduction: computedValues.undertimeDeduction,
        lateDeduction: computedValues.lateDeduction,
        holidayBonus: computedValues.holidayBonus,
        manualOverride: computedValues.manualOverride,
      }));
    }
  }, [computedValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onClose();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name.includes("Pay") ||
        name.includes("Deduction") ||
        name.includes("Hours") ||
        name.includes("Minutes")
          ? parseFloat(value) || 0
          : value,
    }));
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
            <h3 className="text-lg font-medium text-gray-100">
              Edit Compensation Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 focus:outline-none"
            >
              <IoClose className="h-5 w-5" />
            </button>
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
              />

              <FormField
                label="Hours Worked"
                name="hoursWorked"
                value={formData.hoursWorked || 0}
                onChange={handleInputChange}
                readOnly
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
              />

              <FormField
                label="Overtime Minutes"
                name="overtimeMinutes"
                value={formData.overtimeMinutes || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Overtime Pay"
                name="overtimePay"
                value={formData.overtimePay || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Undertime Minutes"
                name="undertimeMinutes"
                value={formData.undertimeMinutes || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Undertime Deduction"
                name="undertimeDeduction"
                value={formData.undertimeDeduction || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Late Minutes"
                name="lateMinutes"
                value={formData.lateMinutes || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Late Deduction"
                name="lateDeduction"
                value={formData.lateDeduction || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Holiday Bonus"
                name="holidayBonus"
                value={formData.holidayBonus || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Leave Pay"
                name="leavePay"
                value={formData.leavePay || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Gross Pay"
                name="grossPay"
                value={formData.grossPay || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Deductions"
                name="deductions"
                value={formData.deductions || 0}
                onChange={handleInputChange}
              />

              <FormField
                label="Net Pay"
                name="netPay"
                value={formData.netPay || 0}
                onChange={handleInputChange}
              />

              <div className="col-span-5">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
                  <Switch
                    checked={formData.manualOverride || false}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, manualOverride: e }))
                    }
                    className={`${
                      formData.manualOverride ? "bg-blue-600" : "bg-gray-700"
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
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
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
