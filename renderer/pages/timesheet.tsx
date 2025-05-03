"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  AttendanceModel,
  createAttendanceModel,
} from "@/renderer/model/attendance";
import { Attendance } from "@/renderer/model/attendance";
import {
  CompensationModel,
  createCompensationModel,
} from "@/renderer/model/compensation";
import { Compensation, DayType } from "@/renderer/model/compensation";
import {
  createAttendanceSettingsModel,
  EmploymentType,
} from "@/renderer/model/settings";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useColumnVisibilityStore } from "@/renderer/stores/columnVisibilityStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import {
  IoSettingsOutline,
  IoRefreshOutline,
  IoShieldOutline,
  IoTimeOutline,
  IoChevronDownOutline,
  IoWarningOutline,
} from "react-icons/io5";
import { EditableCell } from "@/renderer/components/EditableCell";
import { CompensationDialog } from "@/renderer/components/CompensationDialog";
import {
  Employee,
  EmployeeModel,
  createEmployeeModel,
} from "@/renderer/model/employee";
import { useComputeAllCompensations } from "@/renderer/hooks/computeAllCompensations";
import { Tooltip } from "@/renderer/components/Tooltip";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";
import { useTimesheetCheckbox } from "@/renderer/hooks/useTimesheetCheckbox";
import { useTimesheetEdit } from "@/renderer/hooks/useTimesheetEdit";
import { useAuthStore } from "@/renderer/stores/authStore";
import { DateRangePicker } from "@/renderer/components/DateRangePicker";
import { useDateRangeStore } from "@/renderer/stores/dateRangeStore";
import { RecomputeDialog } from "@/renderer/components/RecomputeDialog";
import {
  useSchedules,
  shouldMarkAsAbsent,
} from "@/renderer/hooks/utils/useSchedule";
import { AttendanceHistoryDialog } from "@/renderer/components/AttendanceHistoryDialog";
import { useAttendanceOperations } from "@/renderer/hooks/useAttendanceOperations";
import { useTimesheetHistoryOperations } from "@/renderer/hooks/useTimesheetHistoryOperations";
import { useEmployeeLoader } from "@/renderer/hooks/useEmployeeLoader";
import { useTimesheetCoreLoader } from "@/renderer/hooks/useTimesheetCoreLoader";
import { useEmploymentTypeLoader } from "@/renderer/hooks/useEmploymentTypeLoader";
import { useEditCellManager } from "@/renderer/hooks/useEditCellManager";

const formatName = (name: string): string => {
  if (!name) return "";

  // Split the name into parts
  const nameParts = name.split(" ");

  // Capitalize each part
  return nameParts
    .map((part) => {
      if (!part) return "";
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
};

const TimesheetPage: React.FC = () => {
  const [timesheetEntries, setTimesheetEntries] = useState<Attendance[]>([]);
  const [compensationEntries, setCompensationEntries] = useState<
    Compensation[]
  >([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<{
    entry: Attendance;
    compensation: Compensation;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
  } | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [timeSettings, setTimeSettings] = useState<EmploymentType[]>([]);
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const { columns, setColumns, resetToDefault } = useColumnVisibilityStore();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [validEntriesCount, setValidEntriesCount] = useState<number>(0);
  const { accessCodes, hasAccess } = useAuthStore();
  const { dateRange, setDateRange } = useDateRangeStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showRecomputeDialog, setShowRecomputeDialog] = useState(false);
  const [hasAttemptedInitialRefresh, setHasAttemptedInitialRefresh] =
    useState(false);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  useEffect(() => {
    if (!storedYear) {
      const currentYear = new Date().getFullYear().toString();
      localStorage.setItem("selectedYear", currentYear);
      setStoredYear(currentYear);
    }
  }, [storedYear]);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;
  const year = storedYear ? parseInt(storedYear, 10) : 0;
  const pathname = usePathname();

  // Create model instances with proper dbPath
  // Removed incorrect dbPath[0] access and used dbPath directly as it's already a string
  const attendanceModel = useMemo(
    () => createAttendanceModel(dbPath),
    [dbPath]
  );
  const compensationModel = useMemo(
    () => createCompensationModel(dbPath),
    [dbPath]
  );
  const attendanceSettingsModel = useMemo(
    () => createAttendanceSettingsModel(dbPath),
    [dbPath]
  );
  const employeeModel = useMemo(() => createEmployeeModel(dbPath), [dbPath]);

  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const computeCompensations = useComputeAllCompensations(
    employee,
    year,
    storedMonthInt,
    1,
    compensationModel,
    attendanceModel,
    attendanceSettingsModel,
    dbPath,
    (newCompensations) => {
      setCompensationEntries(newCompensations);
    }
  );

  const onDataUpdateHandler = async (
    newAttendance: Attendance[],
    newCompensations: Compensation[]
  ) => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You don't have permission to modify attendance records");
      return;
    }
    // Update both states immediately
    setTimesheetEntries(newAttendance);
    setCompensationEntries(newCompensations);
    // Recompute compensations ONLY if attendance potentially changed?
    // Or always recompute after any edit/revert?
    // For simplicity and safety, let's recompute if the function is called.
    // The hook calling this might need adjustment if recompute isn't always desired.
    // await computeCompensations(newAttendance, newCompensations);
  };

  const { handleTimesheetEdit } = useTimesheetEdit({
    attendanceModel,
    compensationModel,
    attendanceSettingsModel,
    employee,
    selectedEmployeeId: selectedEmployeeId!,
    compensationEntries,
    month: storedMonthInt,
    year,
    dbPath,
    onDataUpdate: onDataUpdateHandler, // Use the shared handler
  });

  // Instantiate the checkbox hook
  const { handleCheckboxChange } = useTimesheetCheckbox({
    attendanceModel,
    compensationModel,
    attendanceSettingsModel,
    employee,
    selectedEmployeeId: selectedEmployeeId!,
    compensationEntries,
    month: storedMonthInt,
    year,
    dbPath,
    onDataUpdate: onDataUpdateHandler,
  });

  // Use the renamed hook and pass additional props
  const {
    handleSwapTimes,
    handleRevertAttendanceToHistory,
    handleRevertCompensationToHistory,
  } = useTimesheetHistoryOperations({
    hasAccess,
    handleTimesheetEdit, // Still needed for attendance revert
    compensationModel, // Pass compensation model
    timesheetEntries, // Pass current attendance state
    compensationEntries, // Pass current compensation state
    storedMonthInt,
    year,
    selectedEmployeeId,
    employee,
    onDataUpdate: onDataUpdateHandler, // Use the shared handler
  });

  // First effect: Load employee only
  useEffect(() => {
    const loadEmployee = async () => {
      if (!dbPath || !selectedEmployeeId || employeeModel == undefined) {
        return;
      }
      if (selectedEmployeeId) {
        try {
          setLoading(true);
          const emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
          if (emp !== null) {
            setEmployee(emp);
          }
        } catch (error) {
          toast.error("Error loading employee");
        } finally {
          setLoading(false);
        }
      }
    };

    loadEmployee();
  }, [selectedEmployeeId, dbPath, employeeModel, setLoading]);

  const refreshTimesheetData = async (showToast: boolean = true) => {
    if (!employee || !dbPath || !selectedEmployeeId) {
      return;
    }

    try {
      setLoading(true);
      const [attendanceData, compensationData] = await Promise.all([
        attendanceModel.loadAttendancesById(
          storedMonthInt,
          year,
          selectedEmployeeId
        ),
        compensationModel.loadRecords(storedMonthInt, year, selectedEmployeeId),
      ]);

      setTimesheetEntries(attendanceData);
      setCompensationEntries(compensationData);
      setValidEntriesCount(
        compensationData.filter((comp) => comp.absence).length
      );

      if (attendanceData.length > 0 || compensationData.length > 0) {
        await computeCompensations(attendanceData, compensationData);
        if (showToast) {
          toast.success("Records refreshed successfully");
        }
      } else if (showToast) {
        toast.error("No timesheet entries found after refresh");
      }
    } catch (error) {
      if (showToast) {
        toast.error("Error refreshing records");
      }
    } finally {
      setLoading(false);
    }
  };

  // Second effect: Load and compute data when employee is loaded
  useEffect(() => {
    const loadData = async () => {
      if (!employee || !dbPath || !selectedEmployeeId) {
        return;
      }

      try {
        setLoading(true);
        setIsLoading(true);

        const [attendanceData, compensationData] = await Promise.all([
          attendanceModel.loadAttendancesById(
            storedMonthInt,
            year,
            selectedEmployeeId
          ),
          compensationModel.loadRecords(
            storedMonthInt,
            year,
            selectedEmployeeId
          ),
        ]);

        setTimesheetEntries(attendanceData);
        setCompensationEntries(compensationData);
        setValidEntriesCount(
          compensationData.filter((comp) => comp.absence).length
        );

        if (attendanceData.length > 0 || compensationData.length > 0) {
          await computeCompensations(attendanceData, compensationData);
        } else if (!hasAttemptedInitialRefresh) {
          setHasAttemptedInitialRefresh(true);
          await refreshTimesheetData(true);
        }
      } catch (error) {
        toast.error("Error loading timesheet data");
      } finally {
        setLoading(false);
        setIsLoading(false);
      }
    };

    loadData();
  }, [employee, selectedEmployeeId, storedMonthInt, year]);

  // Find the employee's time tracking setting
  const employeeTimeSettings = useMemo(() => {
    if (!employee || !timeSettings.length) return null;
    const settings = timeSettings.find(
      (type) =>
        type.type.toLowerCase() === employee.employmentType?.toLowerCase()
    );
    return settings;
  }, [employee, timeSettings]);

  useEffect(() => {
    const loadEmploymentTypes = async () => {
      try {
        const types = await attendanceSettingsModel.loadTimeSettings();
        setTimeSettings(types);
        setEmploymentTypes(types);

        if (employee) {
          const employeeType = types.find(
            (type) =>
              type.type.toLowerCase() === employee.employmentType?.toLowerCase()
          );

          if (employeeType) {
            const updatedColumns = columns.map((col) => {
              if (col.key === "timeIn") {
                return {
                  ...col,
                  name: employeeType.requiresTimeTracking
                    ? "Time In"
                    : "Attendance Status",
                  visible: true,
                };
              }
              if (col.key === "timeOut") {
                return {
                  ...col,
                  visible: employeeType.requiresTimeTracking,
                };
              }
              return col;
            });

            setColumns(updatedColumns);
          }
        }
      } catch (error) {
        toast.error("Failed to load employment types");
      }
    };
    loadEmploymentTypes();
  }, [attendanceSettingsModel, employee, setColumns]);

  const handleColumnVisibilityChange = (columnKey: string) => {
    const newColumns = columns.map((col) =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
  };

  const handleRowClick = (
    entry: Attendance,
    compensation: Compensation | undefined | null,
    event: React.MouseEvent
  ) => {
    // Stop any active cell editing before opening the dialog
    handleStopEdit();
    // Close history dialog if open
    setIsHistoryDialogOpen(false);
    setSelectedHistoryDay(null);

    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dialogHeight = 400; // Approximate height of dialog
    const spacing = 8; // Space between dialog and row

    // If there's not enough space below and more space above, show above
    const showAbove = spaceBelow < dialogHeight && spaceAbove > spaceBelow;

    setClickPosition({
      top: showAbove ? rect.top - spacing : rect.bottom + spacing,
      left: rect.left,
      showAbove,
    });

    const defaultCompensation: Compensation = {
      employeeId: entry.employeeId,
      month: storedMonthInt,
      year: year,
      day: entry.day,
      dayType: "Regular" as DayType,
      dailyRate: 0,
      hoursWorked: 0,
      grossPay: 0,
      netPay: 0,
      manualOverride: false,
      nightDifferentialHours: 0,
      nightDifferentialPay: 0,
    };
    setSelectedEntry({
      entry,
      compensation: compensation || defaultCompensation,
    });
    setIsDialogOpen(true);
  };

  const handleSaveCompensation = async (updatedCompensation: Compensation) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to modify compensation records");
      return;
    }
    try {
      if (
        !updatedCompensation.employeeId ||
        !updatedCompensation.month ||
        !updatedCompensation.year
      ) {
        throw new Error("Missing required fields in compensation");
      }

      await compensationModel.saveOrUpdateCompensations(
        [updatedCompensation],
        updatedCompensation.month,
        updatedCompensation.year,
        updatedCompensation.employeeId
      );

      const newCompensationEntries = await compensationModel.loadRecords(
        storedMonthInt,
        year,
        selectedEmployeeId!
      );
      setCompensationEntries(newCompensationEntries);

      toast.success("Compensation saved successfully");
    } catch (error) {
      toast.error("Failed to save compensation");
    }
  };

  const handleRecompute = async () => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to recompute compensations");
      return;
    }
    if (!timesheetEntries || !compensationEntries) return;

    setIsRecomputing(true);
    try {
      setLoading(true);
      await computeCompensations(
        timesheetEntries,
        compensationEntries,
        true
      ).finally(() => {
        toast.success("Compensations recomputed successfully!");
      });
    } catch (error) {
      toast.error("Failed to recompute compensations.");
    } finally {
      setLoading(false);
      setIsRecomputing(false);
    }
  };

  const tooltipContent: Record<"grossPay" | "deductions", string> = {
    grossPay: "Gross pay is calculated as the daily rate plus overtime pay",
    deductions: "Deductions include late and undertime deductions only",
  };

  const router = useRouter();
  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  const filteredTimesheetEntries = useMemo(() => {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      return timesheetEntries;
    }

    const startDate = new Date(dateRange.startDate).getTime();
    const endDate = new Date(dateRange.endDate).getTime();

    return timesheetEntries.filter((entry) => {
      const entryDate = new Date(year, storedMonthInt - 1, entry.day).getTime();
      return entryDate >= startDate && entryDate <= endDate;
    });
  }, [
    timesheetEntries,
    dateRange?.startDate,
    dateRange?.endDate,
    year,
    storedMonthInt,
  ]);

  // Remove performance monitoring for employee loading
  useEffect(() => {
    const loadEmployees = async () => {
      if (!dbPath) return;
      try {
        const employeeModel = createEmployeeModel(dbPath);
        const loadedEmployees = await employeeModel.loadActiveEmployees();
        setEmployees(loadedEmployees);
      } catch (error) {
        toast.error("Error loading employees");
      }
    };

    loadEmployees();
  }, [dbPath]);

  // Simplify dropdown render without performance monitoring
  const employeeDropdown = useMemo(() => {
    const activeEmployees = employees.filter((emp) => emp.status === "active");

    return (
      <div className="absolute z-50 mt-2 w-72 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100/30 max-h-[320px] overflow-y-auto opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 scrollbar-thin">
        <div className="py-2">
          {activeEmployees.map((emp) => (
            <div
              key={emp.id}
              className={`mx-2 px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-all duration-200 ${
                emp.id === selectedEmployeeId
                  ? "bg-gradient-to-r from-blue-50/90 to-indigo-50/90 text-blue-700 shadow-sm"
                  : "hover:bg-gradient-to-r hover:from-gray-50/90 hover:to-blue-50/50"
              }`}
              onClick={() => setSelectedEmployeeId(emp.id)}
            >
              <div className="flex items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 shadow-sm transition-all duration-200 ${
                    emp.id === selectedEmployeeId
                      ? "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700"
                      : "bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {emp.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div>
                  <div
                    className={`font-medium transition-colors duration-200 ${
                      emp.id === selectedEmployeeId
                        ? "text-blue-900"
                        : "text-gray-800"
                    }`}
                  >
                    {formatName(emp.name)}
                  </div>
                  <div
                    className={`text-xs mt-0.5 transition-colors duration-200 ${
                      emp.id === selectedEmployeeId
                        ? "text-blue-600/70"
                        : "text-gray-500"
                    }`}
                  >
                    {emp.position || "No position set"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [employees, selectedEmployeeId]);

  // Optimize row rendering with memoization
  const memoizedDays = useMemo(() => {
    return Array.from(
      new Set(filteredTimesheetEntries.map((entry) => entry.day))
    );
  }, [filteredTimesheetEntries]);

  // Optimize compensation lookup with memoization
  const compensationLookup = useMemo(() => {
    const lookup = new Map();
    compensationEntries.forEach((comp) => {
      const key = `${comp.year}-${comp.month}-${comp.day}`;
      lookup.set(key, comp);
    });
    return lookup;
  }, [compensationEntries]);

  // Add this before the return statement
  const employmentTypeObj = useMemo(
    () =>
      employmentTypes.find(
        (type) =>
          type.type.toLowerCase() === employee?.employmentType?.toLowerCase()
      ) || null,
    [employmentTypes, employee?.employmentType]
  );

  // Create dates array for all days
  const dates = useMemo(
    () => memoizedDays.map((day) => new Date(year, storedMonthInt - 1, day)),
    [memoizedDays, year, storedMonthInt]
  );

  // Get schedule info for all days at once
  const scheduleMap = useSchedules(employmentTypeObj, dates);

  // --- Handlers for Single Edit Mode ---
  const handleStartEdit = (cellKey: string) => {
    // Close the compensation dialog if it's open
    if (isDialogOpen) {
      setIsDialogOpen(false);
      setSelectedEntry(null);
      setClickPosition(null);
    }
    // Close history dialog if open
    if (isHistoryDialogOpen) {
      setIsHistoryDialogOpen(false);
      setSelectedHistoryDay(null);
    }

    if (editingCellKey && editingCellKey !== cellKey) {
      toast.warning(
        "Please save or cancel the current edit before starting another."
      );
    } else {
      setEditingCellKey(cellKey);
    }
  };

  const handleStopEdit = () => {
    setEditingCellKey(null);
  };
  // --- End Handlers ---

  // --- Handler to open History Dialog ---
  const handleDayCellClick = (day: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click (CompensationDialog)
    handleStopEdit(); // Close any active editable cell
    // Close compensation dialog if open
    if (isDialogOpen) {
      setIsDialogOpen(false);
      setSelectedEntry(null);
      setClickPosition(null);
    }

    setSelectedHistoryDay(day);
    setIsHistoryDialogOpen(true);
  };
  // --- End History Handler ---

  // Check if user has basic access to view timesheets
  if (!hasAccess("VIEW_TIMESHEETS")) {
    return (
      <RootLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <IoShieldOutline className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Access Restricted
            </h2>
            <p className="text-gray-500">
              You don't have permission to view timesheets.
            </p>
          </div>
        </div>
      </RootLayout>
    );
  }

  // Move the helper function inside the component
  const renderColumnContent = (
    columnKey: string,
    entry: Attendance,
    compensation: Compensation | null
  ) => {
    switch (columnKey) {
      case "day":
        return (
          <div className="flex flex-col items-center">
            <span>{entry.day}</span>
            <span className="text-sm text-gray-500">
              {new Date(year, storedMonthInt - 1, entry.day).toLocaleDateString(
                "en-US",
                {
                  weekday: "short",
                }
              )}
            </span>
          </div>
        );
      case "dayType":
        const scheduleInfo = scheduleMap.get(entry.day);
        if (scheduleInfo?.isRestDay) {
          return "Day Off";
        }
        return compensation?.dayType || "Regular";
      case "hoursWorked":
        return compensation?.hoursWorked
          ? Math.round(compensation.hoursWorked)
          : "-";
      case "overtimeMinutes":
        return compensation?.overtimeMinutes || "-";
      case "overtimePay":
        return compensation?.overtimePay
          ? Math.round(compensation.overtimePay)
          : "-";
      case "undertimeMinutes":
        return compensation?.undertimeMinutes || "-";
      case "undertimeDeduction":
        return compensation?.undertimeDeduction
          ? Math.round(compensation.undertimeDeduction)
          : "-";
      case "lateMinutes":
        return compensation?.lateMinutes || "-";
      case "lateDeduction":
        return compensation?.lateDeduction
          ? Math.round(compensation.lateDeduction)
          : "-";
      case "holidayBonus":
        return compensation?.holidayBonus
          ? Math.round(compensation.holidayBonus)
          : "-";
      case "leaveType":
        return compensation?.leaveType || "-";
      case "leavePay":
        return compensation?.leavePay ? Math.round(compensation.leavePay) : "-";
      case "grossPay":
        return compensation?.grossPay ? Math.round(compensation.grossPay) : "-";
      case "deductions":
        return compensation?.deductions
          ? Math.round(compensation.deductions)
          : "-";
      case "netPay":
        return compensation?.netPay ? Math.round(compensation.netPay) : "-";
      case "nightDifferentialHours":
        return compensation?.nightDifferentialHours || "-";
      case "nightDifferentialPay":
        return compensation?.nightDifferentialPay
          ? Math.round(compensation.nightDifferentialPay)
          : "-";
      default:
        return "-";
    }
  };

  const renderRow = (
    foundEntry: Attendance,
    compensation: Compensation | null,
    day: number
  ) => {
    const entryDate = new Date(year, storedMonthInt - 1, day);
    const scheduleInfo = scheduleMap.get(day);
    const hasTimeEntries = !!(foundEntry.timeIn || foundEntry.timeOut);

    // Only mark as absent if there's a schedule and no time entries
    const isAbsent =
      scheduleInfo?.hasSchedule && !scheduleInfo.isRestDay && !hasTimeEntries;

    const rowClass = `cursor-pointer ${
      isAbsent
        ? "bg-red-50 hover:bg-red-100"
        : scheduleInfo?.isRestDay
        ? "bg-gray-50/50 hover:bg-gray-100/50"
        : "hover:bg-gray-50"
    } ${selectedEntry?.entry.day === day ? "bg-indigo-50" : ""}`;

    return (
      <tr
        key={day}
        onClick={(event) => handleRowClick(foundEntry, compensation, event)}
        className={rowClass}
      >
        {columns.map(
          (column) =>
            column.visible &&
            (column.key === "timeIn" || column.key === "timeOut" ? (
              employeeTimeSettings?.requiresTimeTracking ? (
                hasAccess("MANAGE_ATTENDANCE") ? (
                  (() => {
                    // IIFE to calculate cellKey
                    const cellKey = `${column.key}-${day}`;
                    const isCurrentlyEditing = editingCellKey === cellKey;
                    return (
                      <EditableCell
                        key={cellKey} // Use cellKey for React key as well
                        value={
                          column.key === "timeIn"
                            ? foundEntry.timeIn || ""
                            : foundEntry.timeOut || ""
                        }
                        dbPath={dbPath} // Pass dbPath
                        column={column}
                        rowData={foundEntry}
                        isEditing={isCurrentlyEditing} // Pass isEditing state
                        onStartEdit={() => handleStartEdit(cellKey)} // Pass start edit handler
                        onStopEdit={handleStopEdit} // Pass stop edit handler
                        onSave={async (value, rowData) => {
                          await handleTimesheetEdit(
                            value.toString(),
                            rowData,
                            column.key
                          );
                          handleStopEdit(); // Stop editing on successful save
                        }}
                        onSwapTimes={handleSwapTimes} // Pass swap handler
                        employmentTypes={employmentTypes}
                      />
                    );
                  })()
                ) : (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                  >
                    {column.key === "timeIn"
                      ? foundEntry.timeIn || ""
                      : foundEntry.timeOut || ""}
                  </td>
                )
              ) : column.key === "timeIn" ? (
                <td
                  key={column.key}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasAccess("MANAGE_ATTENDANCE") ? (
                      <>
                        <input
                          type="checkbox"
                          checked={
                            foundEntry?.timeIn === "present" &&
                            foundEntry?.timeOut === "present"
                          }
                          onChange={(e) => handleCheckboxChange(e, foundEntry)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        />
                        <span
                          className="ml-2 text-sm font-medium text-gray-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!!(foundEntry.timeIn || foundEntry.timeOut)
                            ? "Present"
                            : scheduleInfo?.isRestDay
                            ? "Rest Day"
                            : "Absent"}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-gray-700">
                        {!!(foundEntry.timeIn || foundEntry.timeOut)
                          ? "Present"
                          : scheduleInfo?.isRestDay
                          ? "Rest Day"
                          : "Absent"}
                      </span>
                    )}
                  </div>
                </td>
              ) : null
            ) : (
              <td
                key={column.key}
                className={`${
                  column.key === "day" ? "sticky left-0 z-10" : ""
                } px-6 py-4 whitespace-nowrap text-sm ${
                  column.key === "day"
                    ? new Date(
                        year,
                        storedMonthInt - 1,
                        day
                      ).toLocaleDateString("en-US", { weekday: "short" }) ===
                      "Sun"
                      ? "bg-yellow-100 font-medium text-gray-900"
                      : "bg-white font-medium text-gray-900"
                    : "text-gray-500"
                }`}
              >
                {column.key === "day" ? (
                  // Wrap day content in a div and add onClick for history
                  <div
                    onClick={(e) => handleDayCellClick(day, e)}
                    className="cursor-pointer hover:text-blue-600 w-full h-full flex flex-col items-center justify-center"
                  >
                    {renderColumnContent(column.key, foundEntry, compensation)}
                  </div>
                ) : (
                  renderColumnContent(column.key, foundEntry, compensation)
                )}
              </td>
            ))
        )}
      </tr>
    );
  };

  return (
    <RootLayout>
      <main className="w-full h-screen pt-16">
        <div className="w-full h-full">
          <div className="bg-white flex flex-col h-full">
            {/* Title header - always visible */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <div className="flex items-center space-x-4 flex-1">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  {selectedEmployeeId ? (
                    <div className="relative inline-block group">
                      <span className="cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-1">
                        {employee?.name
                          ? `${formatName(employee.name)}${
                              employee.name.toLowerCase().endsWith("s")
                                ? "'"
                                : "'s"
                            } Timesheet`
                          : "Select Employee"}
                      </span>
                      {employeeDropdown}
                    </div>
                  ) : (
                    "Timesheet"
                  )}
                </h2>
                {selectedEmployeeId && (
                  <div className="w-[480px]">
                    <DateRangePicker
                      variant="timesheet"
                      onRefresh={refreshTimesheetData}
                    />
                  </div>
                )}
              </div>
              {selectedEmployeeId && (
                <div className="relative flex items-center space-x-4">
                  <div className="flex items-center px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-600">
                    <span>Absences:</span>
                    <span className="ml-1.5 font-semibold text-gray-900">
                      {validEntriesCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasAccess("MANAGE_PAYROLL") && (
                      <button
                        type="button"
                        className="mr-1 p-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150"
                        onClick={() => setShowRecomputeDialog(true)}
                      >
                        <span className="sr-only">Recompute Compensations</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 transition-transform duration-300 ${
                            isRecomputing ? "rotate-180" : ""
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      className="p-1 rounded-md bg-gray-100 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onMouseEnter={() => setShowColumnMenu(true)}
                    >
                      <span className="sr-only">Column Settings</span>
                      <IoSettingsOutline
                        className="h-5 w-5"
                        aria-hidden="true"
                      />
                    </button>

                    {showColumnMenu && (
                      <div
                        className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                        onMouseLeave={() => setShowColumnMenu(false)}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-3">
                            <h3 className="text-sm font-medium text-gray-200">
                              Visible Columns
                            </h3>
                            <button
                              onClick={() =>
                                setColumns((cols) =>
                                  cols.map((col) => ({
                                    ...col,
                                    visible: true,
                                  }))
                                )
                              }
                              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors duration-150"
                            >
                              Show All
                            </button>
                          </div>
                          <div className="space-y-1 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            {columns.map((column) => (
                              <div
                                key={column.key}
                                className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg group transition-colors duration-150"
                              >
                                <span className="text-sm text-gray-300">
                                  {column.name}
                                </span>
                                <div className="relative">
                                  <button
                                    onClick={() => {
                                      if (column.key === "day") return;
                                      handleColumnVisibilityChange(column.key);
                                    }}
                                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none ${
                                      column.key === "day"
                                        ? "bg-gray-600 cursor-not-allowed"
                                        : column.visible
                                        ? "bg-blue-500"
                                        : "bg-gray-700"
                                    }`}
                                    disabled={column.key === "day"}
                                  >
                                    <span
                                      className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white ${
                                        column.visible
                                          ? "translate-x-6"
                                          : "translate-x-1"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedEmployeeId ? (
              <div className="flex-1 overflow-x-auto scrollbar-y-none">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* Sticky column headers */}
                  <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                      {columns.map(
                        (column) =>
                          column.visible && (
                            <th
                              key={column.key}
                              scope="col"
                              className={`${
                                column.key === "day"
                                  ? "sticky left-0 z-30 bg-gray-50 shadow-sm"
                                  : "bg-gray-50"
                              } px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                                column.key === "day" ? "w-20" : ""
                              }`}
                            >
                              {tooltipContent[
                                column.key as "grossPay" | "deductions"
                              ] ? (
                                <Tooltip
                                  content={
                                    tooltipContent[
                                      column.key as "grossPay" | "deductions"
                                    ]
                                  }
                                  position="left"
                                  width="500px"
                                >
                                  {column.name}
                                </Tooltip>
                              ) : (
                                column.name
                              )}
                            </th>
                          )
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTimesheetEntries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.filter((col) => col.visible).length}
                          className="px-6 py-12 text-center"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <svg
                              className="mx-auto h-12 w-12 text-gray-400 mb-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">
                              No Timesheet Entries
                            </h3>
                            <p className="text-sm text-gray-500">
                              No attendance records found for this period.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      memoizedDays.map((day) => {
                        const foundEntry = filteredTimesheetEntries.find(
                          (entry) => entry.day === day
                        );
                        const compensationKey = `${year}-${storedMonthInt}-${day}`;
                        const compensation =
                          compensationLookup.get(compensationKey) || null;

                        if (!foundEntry) {
                          return null;
                        }

                        return renderRow(foundEntry, compensation, day);
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="mb-6">
                  <svg
                    className="mx-auto h-24 w-24 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="mt-2 text-xl font-semibold text-gray-900">
                  No Employee Selected
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Please select an employee from the dropdown menu to view their
                  timesheet.
                </p>
                <div className="mt-6">
                  <AddButton
                    text="Select Employee"
                    onClick={() => handleLinkClick("/")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {isDialogOpen && (
          <div className="fixed inset-0 bg-black opacity-50 z-40" />
        )}
        {selectedEntry && (
          <CompensationDialog
            employee={employee}
            isOpen={isDialogOpen}
            onClose={() => {
              setIsDialogOpen(false);
              setSelectedEntry(null);
              setClickPosition(null);
            }}
            onSave={handleSaveCompensation}
            compensation={selectedEntry.compensation}
            month={storedMonthInt}
            year={year}
            day={selectedEntry.entry.day}
            timeIn={selectedEntry.entry.timeIn || undefined}
            timeOut={selectedEntry.entry.timeOut || undefined}
            position={clickPosition}
            accessCodes={accessCodes}
          />
        )}
        <RecomputeDialog
          isOpen={showRecomputeDialog}
          onClose={() => setShowRecomputeDialog(false)}
          onRecompute={handleRecompute}
        />
        {/* Render the Attendance History Dialog */}
        {selectedEmployeeId && selectedHistoryDay !== null && (
          <AttendanceHistoryDialog
            isOpen={isHistoryDialogOpen}
            onClose={() => {
              setIsHistoryDialogOpen(false);
              setSelectedHistoryDay(null);
            }}
            employeeId={selectedEmployeeId}
            year={year}
            month={storedMonthInt}
            day={selectedHistoryDay}
            dbPath={dbPath}
            onRevertAttendance={handleRevertAttendanceToHistory}
            onRevertCompensation={handleRevertCompensationToHistory}
          />
        )}
      </main>
    </RootLayout>
  );
};

<style jsx global>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(75, 85, 99, 0.1);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(75, 85, 99, 0.5);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(75, 85, 99, 0.7);
  }

  /* Modern minimal scrollbar styling */
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.3);
    border-radius: 9999px;
    transition: all 0.2s ease;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.5);
  }

  /* Hide scrollbar for Chrome, Safari and Opera when not hovering */
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }

  /* Show scrollbar on hover */
  .scrollbar-thin:hover {
    scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
  }

  /* Firefox */
  .scrollbar-thin {
    scrollbar-width: thin;
  }
`}</style>;

export default TimesheetPage;
