"use client";

import React, { useState, useMemo, useEffect } from "react";
import RootLayout from "@/renderer/components/layout";
import { useRouter, usePathname } from "next/navigation";
import { IoShieldOutline } from "react-icons/io5";
import { toast } from "sonner";

// Components
import TimesheetHeader from "@/renderer/components/timesheet/TimesheetHeader";
import TimesheetRow from "@/renderer/components/timesheet/TimesheetRow";
import EmptyTimesheet from "@/renderer/components/timesheet/EmptyTimesheet";
import NoDataPlaceholder from "@/renderer/components/NoDataPlaceholder";
import { CompensationDialog } from "@/renderer/components/forms/CompensationDialog";
import { RecomputeDialog } from "@/renderer/components/RecomputeDialog";
import { AttendanceHistoryDialog } from "@/renderer/components/AttendanceHistoryDialog";

// Hooks
import { useTimesheetData } from "@/renderer/hooks/timesheet/useTimesheetData";
import { useTimesheetCheckbox } from "@/renderer/hooks/useTimesheetCheckbox";
import { useTimesheetEdit } from "@/renderer/hooks/useTimesheetEdit";
import { useTimesheetHistoryOperations } from "@/renderer/hooks/useTimesheetHistoryOperations";
import { useComputeAllCompensations } from "@/renderer/hooks/computeAllCompensations";
import { useSchedules } from "@/renderer/hooks/utils/useSchedule";

// Stores
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { useColumnVisibilityStore } from "@/renderer/stores/columnVisibilityStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useAuthStore } from "@/renderer/stores/authStore";
import { useDateRangeStore } from "@/renderer/stores/dateRangeStore";

// Models
import {
  createAttendanceModel,
  Attendance
} from "@/renderer/model/attendance";
import {
  createCompensationModel,
  Compensation
} from "@/renderer/model/compensation";
import {
  createAttendanceSettingsModel,
  EmploymentType,
} from "@/renderer/model/settings";
import {
  Employee,
  createEmployeeModel
} from "@/renderer/model/employee";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";

// Service for timesheet data
import { TimesheetService } from "@/renderer/services/TimesheetService";

const TimesheetPage: React.FC = () => {
  // State
  const [timesheetEntries, setTimesheetEntries] = useState<Attendance[]>([]);
  const [compensationEntries, setCompensationEntries] = useState<Compensation[]>([]);
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
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [validEntriesCount, setValidEntriesCount] = useState<number>(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showRecomputeDialog, setShowRecomputeDialog] = useState(false);
  const [hasAttemptedInitialRefresh, setHasAttemptedInitialRefresh] = useState(false);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<number | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Stores
  const { dbPath, companyName } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const { columns, setColumns, resetToDefault } = useColumnVisibilityStore();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const { accessCodes, hasAccess } = useAuthStore();
  const { dateRange } = useDateRangeStore();

  // Detect environment
  const isWeb = useMemo(() => isWebEnvironment(), []);

  // Routing
  const pathname = usePathname();
  const router = useRouter();

  // Initialize month/year from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  // Set default year if not in localStorage
  useEffect(() => {
    if (!storedYear) {
      const currentYear = new Date().getFullYear().toString();
      localStorage.setItem("selectedYear", currentYear);
      setStoredYear(currentYear);
    }
  }, [storedYear]);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : new Date().getMonth() + 1;
  const year = storedYear ? parseInt(storedYear, 10) : new Date().getFullYear();

  // Create model instances based on environment
  const attendanceModel = useMemo(() => {
    if (!dbPath && !isWeb) return null; // Only return null if no dbPath AND not web
    return createAttendanceModel(isWeb ? "" : dbPath || ""); // Pass empty string for dbPath in web mode
  }, [dbPath, isWeb]);

  const compensationModel = useMemo(() => {
    if (!dbPath && !isWeb) return null; // Only return null if no dbPath AND not web
    // Ensure createCompensationModel can handle empty dbPath for web mode
    // The CompensationModel constructor in compensation.ts takes a single `filePath` argument,
    // which is used as `this.folderPath`. For web mode, this isn't directly used for Firestore ops.
    // We might need to adjust createCompensationModel or CompensationModel constructor if it strictly expects a non-empty path
    // for non-Firestore related initializations, but for now, let's assume passing "" is acceptable.
    return createCompensationModel(isWeb ? "" : dbPath || "");
  }, [dbPath, isWeb]);

  const attendanceSettingsModel = useMemo(() => {
    // For settings, we still need the model in both modes
    if (!dbPath && !isWeb) return null;
    return createAttendanceSettingsModel(dbPath);
  }, [dbPath, isWeb]);

  const employeeModel = useMemo(() => {
    // In web mode, we don't need a model instance
    if (isWeb) return null;
    if (!dbPath) return null;
    return createEmployeeModel(dbPath);
  }, [dbPath, isWeb]);

  // Compute compensations
  const computeCompensations = useComputeAllCompensations(
    employee,
    year,
    storedMonthInt,
    1,
    isWeb ? null : compensationModel,
    isWeb ? null : attendanceModel,
    attendanceSettingsModel,
    dbPath,
    (newCompensations) => {
      setCompensationEntries(newCompensations);
    }
  );

  // Shared data update handler
  const onDataUpdateHandler = async (
    newAttendance: Attendance[],
    newCompensations: Compensation[]
  ) => {
    if (!hasAccess("MANAGE_ATTENDANCE")) {
      toast.error("You don't have permission to modify attendance records");
      return;
    }
    setTimesheetEntries(newAttendance);
    setCompensationEntries(newCompensations);
  };

  // Initialize hooks
  const { handleTimesheetEdit } = useTimesheetEdit({
    attendanceModel: attendanceModel, // Pass the model instance directly
    compensationModel: compensationModel, // Pass the model instance directly
    attendanceSettingsModel,
    employee,
    selectedEmployeeId: selectedEmployeeId!,
    compensationEntries,
    month: storedMonthInt,
    year,
    dbPath,
    onDataUpdate: onDataUpdateHandler,
  });

  const { handleCheckboxChange } = useTimesheetCheckbox({
    attendanceModel: attendanceModel, // Pass the model instance directly
    compensationModel: compensationModel, // Pass the model instance directly
    attendanceSettingsModel,
    employee,
    selectedEmployeeId: selectedEmployeeId!,
    compensationEntries,
    month: storedMonthInt,
    year,
    dbPath,
    onDataUpdate: onDataUpdateHandler,
  });

  const {
    handleSwapTimes,
    handleRevertAttendanceToHistory,
    handleRevertCompensationToHistory,
  } = useTimesheetHistoryOperations({
    hasAccess,
    handleTimesheetEdit,
    compensationModel: compensationModel, // Pass the model instance directly
    timesheetEntries,
    compensationEntries,
    storedMonthInt,
    year,
    selectedEmployeeId,
    employee,
    onDataUpdate: onDataUpdateHandler,
  });

  // Load employee
  useEffect(() => {
    const loadEmployee = async () => {
      if (!selectedEmployeeId) return;

      try {
        setLoading(true);

        if (isWeb) {
          // Web mode - find employee in already loaded list
          if (!companyName) {
            console.error("Company name not available for web mode");
            return;
          }

          // If we already have employees loaded, find the selected one
          if (employees.length > 0) {
            const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
            if (selectedEmployee) {
              setEmployee(selectedEmployee);
              return;
            }
          }

          // Otherwise, we need to load employees first
          const firestoreEmployees = await loadActiveEmployeesFirestore(companyName);
          setEmployees(firestoreEmployees);

          const selectedEmployee = firestoreEmployees.find(emp => emp.id === selectedEmployeeId);
          setEmployee(selectedEmployee || null);
        } else {
          // Desktop mode
          if (!dbPath || !employeeModel) {
            console.error("Database path or employee model not available for desktop mode");
            return;
          }

          const emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
          if (emp !== null) {
            setEmployee(emp);
          }
        }
      } catch (error) {
        toast.error("Error loading employee");
        console.error("Error loading employee:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [selectedEmployeeId, dbPath, employeeModel, setLoading, isWeb, companyName, employees]);

  // Use the hook for timesheet data
  const {
    timesheetEntries: loadedTimesheetEntries,
    compensationEntries: loadedCompensationEntries,
    validEntriesCount: loadedValidEntriesCount,
    refreshData,
  } = useTimesheetData({
    dbPath,
    companyName,
    employeeId: selectedEmployeeId,
    employee,
    year,
    month: storedMonthInt,
  });

  // Sync data from hook
  useEffect(() => {
    setTimesheetEntries(loadedTimesheetEntries || []);
    setCompensationEntries(loadedCompensationEntries || []);
    setValidEntriesCount(loadedValidEntriesCount || 0);
  }, [loadedTimesheetEntries, loadedCompensationEntries, loadedValidEntriesCount]);

  // Load employment types
  useEffect(() => {
    const loadEmploymentTypes = async () => {
      try {
        if (!attendanceSettingsModel && !isWeb) {
          console.error("Attendance settings model not available");
          return;
        }

        // If we already have types loaded, don't reload
        if (employmentTypes.length > 0 && timeSettings.length > 0) {
          return;
        }

        // In web mode, we need to handle this differently if needed
        // For now, just use the attendanceSettingsModel if available
        if (attendanceSettingsModel) {
          const types = await attendanceSettingsModel.loadTimeSettings();
          setTimeSettings(types);
          setEmploymentTypes(types);

          if (employee) {
            const employeeType = types.find(
              (type) => type.type.toLowerCase() === employee.employmentType?.toLowerCase()
            );

            if (employeeType) {
              const updatedColumns = columns.map((col) => {
                if (col.key === "timeIn") {
                  return {
                    ...col,
                    name: employeeType.requiresTimeTracking ? "Time In" : "Attendance Status",
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
        }
      } catch (error) {
        toast.error("Failed to load employment types");
        console.error("Failed to load employment types:", error);
      }
    };

    loadEmploymentTypes();
  }, [attendanceSettingsModel, employee, setColumns, columns, isWeb, employmentTypes.length, timeSettings.length]);

  // Load employees
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoading(true);

        if (isWeb) {
          // Web mode - load from Firestore
          if (!companyName) {
            console.error("Company name not available for web mode");
            return;
          }

          // Only load if employees array is empty
          if (employees.length === 0) {
            const firestoreEmployees = await loadActiveEmployeesFirestore(companyName);
            setEmployees(firestoreEmployees);
          }
        } else {
          // Desktop mode - load from local DB
          if (!dbPath) {
            console.error("Database path not available for desktop mode");
            return;
          }

          // Only load if employees array is empty
          if (employees.length === 0) {
            const employeeModel = createEmployeeModel(dbPath);
            const loadedEmployees = await employeeModel.loadActiveEmployees();
            setEmployees(loadedEmployees);
          }
        }
      } catch (error) {
        toast.error("Error loading employees");
        console.error("Error loading employees:", error);
      } finally {
        setLoading(false);
      }
    };

    // Only load employees if the array is empty
    if (employees.length === 0) {
      loadEmployees();
    }
  }, [dbPath, companyName, isWeb, employees.length]);

  // Column visibility handler
  const handleColumnVisibilityChange = (columnKey: string) => {
    const newColumns = columns.map((col) =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
  };

  // Row click handler
  const handleRowClick = (
    entry: Attendance,
    compensation: Compensation | undefined | null,
    event: React.MouseEvent
  ) => {
    const targetElement = event.target as HTMLElement;
    console.log(`TimesheetPage: handleRowClick. Target: ${targetElement.tagName}, Classes: ${targetElement.className}. editingCellKey: ${editingCellKey}`);

    // First, check if the click is on an editable cell or its child elements 
    if (
      targetElement.closest('.editable-cell-container') ||
      targetElement.closest('input, button') ||
      targetElement.tagName === 'INPUT' ||
      targetElement.tagName === 'BUTTON'
    ) {
      console.log("TimesheetPage: handleRowClick - click on editable cell container or form element, returning without action.");
      return;
    }

    // If we're currently editing a cell and the click is somewhere else, stop editing
    if (editingCellKey) {
      console.log(`TimesheetPage: handleRowClick - editingCellKey is ${editingCellKey}, calling handleStopEdit.`);
      handleStopEdit();
    }

    // Proceed to open the CompensationDialog
    console.log("TimesheetPage: handleRowClick - proceeding to open CompensationDialog.");
    setIsHistoryDialogOpen(false);
    setSelectedHistoryDay(null);

    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dialogHeight = 400; // Approximate height of dialog
    const spacing = 8; // Space between dialog and row

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
      dayType: "Regular",
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

  // Save compensation handler
  const handleSaveCompensation = async (updatedCompensation: Compensation) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to modify compensation records");
      return;
    }

    try {
      console.log("[Timesheet] Saving compensation:", updatedCompensation);

      if (
        !updatedCompensation.employeeId ||
        !updatedCompensation.month ||
        !updatedCompensation.year
      ) {
        throw new Error("Missing required fields in compensation");
      }

      if (isWeb) {
        // In web mode, use TimesheetService
        if (!companyName) {
          throw new Error("Company name not available for web mode");
        }

        console.log("[Timesheet] Web mode - saving compensation using TimesheetService");
        // Create a temporary service instance to save the compensation
        const timesheetService = new TimesheetService(dbPath, companyName);
        await timesheetService.saveCompensation(updatedCompensation);

        // Update local state immediately for a responsive UI
        setCompensationEntries(prevEntries => {
          // Create a new array to ensure React detects the change
          const newEntries = [...prevEntries];

          // Find and replace the existing entry, or add if not found
          const index = newEntries.findIndex(comp =>
            comp.employeeId === updatedCompensation.employeeId &&
            comp.year === updatedCompensation.year &&
            comp.month === updatedCompensation.month &&
            comp.day === updatedCompensation.day
          );

          if (index !== -1) {
            console.log("[Timesheet] Updating existing compensation entry at index:", index);
            newEntries[index] = updatedCompensation;
          } else {
            console.log("[Timesheet] Adding new compensation entry");
            newEntries.push(updatedCompensation);
          }

          return newEntries;
        });

        console.log("[Timesheet] Web mode - compensation saved and local state updated");
      } else {
        // Desktop mode
        if (!compensationModel) {
          throw new Error("Compensation model not available");
        }

        console.log("[Timesheet] Desktop mode - saving compensation using model");
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

        console.log("[Timesheet] Desktop mode - loaded updated compensation entries:", newCompensationEntries.length);
        setCompensationEntries(newCompensationEntries);
      }

      toast.success("Compensation saved successfully");
    } catch (error) {
      toast.error("Failed to save compensation");
      console.error("Failed to save compensation:", error);
    }
  };

  // Recompute compensations handler
  const handleRecompute = async (useRange: boolean) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to recompute compensations");
      return;
    }

    if (!timesheetEntries || !compensationEntries) return;

    setIsRecomputing(true);
    try {
      setLoading(true);

      if (isWeb) {
        // In web mode, we need to implement a different approach
        // For now, just refresh the data
        await refreshData(true);
        toast.success("Data refreshed successfully!");
      } else {
        // Desktop mode
        let entriesToCompute = timesheetEntries;
        let compsToCompute = compensationEntries;

        // If using date range, filter the entries
        if (useRange && dateRange?.startDate && dateRange?.endDate) {
          // Adjust startDate by subtracting one day
          const adjustedStartDate = new Date(dateRange.startDate);
          adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
          const startDateMs = adjustedStartDate.getTime();
          const endDateMs = new Date(dateRange.endDate).getTime();

          entriesToCompute = timesheetEntries.filter((entry) => {
            // Ensure entry.day is valid before creating a date
            if (typeof entry.day !== 'number' || entry.day < 1 || entry.day > 31) {
              return false;
            }
            const entryDate = new Date(year, storedMonthInt - 1, entry.day).getTime();
            return entryDate >= startDateMs && entryDate <= endDateMs;
          });

          compsToCompute = compensationEntries.filter((comp) => {
            if (typeof comp.day !== 'number' || comp.day < 1 || comp.day > 31) {
              return false;
            }
            const compDate = new Date(year, storedMonthInt - 1, comp.day).getTime();
            return compDate >= startDateMs && compDate <= endDateMs;
          });
        }

        await computeCompensations(
          entriesToCompute,
          compsToCompute,
          true
        ).finally(() => {
          const rangeText = useRange && dateRange?.startDate && dateRange?.endDate
            ? `for ${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`
            : "for the whole month";
          toast.success(`Compensations recomputed successfully ${rangeText}!`);
        });
      }
    } catch (error) {
      toast.error("Failed to recompute compensations.");
      console.error("Failed to recompute compensations:", error);
    } finally {
      setLoading(false);
      setIsRecomputing(false);
    }
  };

  // Navigation handler
  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  // Filter timesheet entries by date range
  const filteredTimesheetEntries = useMemo(() => {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      return timesheetEntries;
    }

    // Adjust startDate by subtracting one day
    const adjustedStartDate = new Date(dateRange.startDate);
    adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
    const startDateMs = adjustedStartDate.getTime();

    const endDateMs = new Date(dateRange.endDate).getTime();

    return timesheetEntries.filter((entry) => {
      // Ensure entry.day is valid before creating a date
      if (typeof entry.day !== 'number' || entry.day < 1 || entry.day > 31) {
        return false; // Or handle as an error
      }
      const entryDate = new Date(year, storedMonthInt - 1, entry.day).getTime();
      return entryDate >= startDateMs && entryDate <= endDateMs;
    });
  }, [timesheetEntries, dateRange?.startDate, dateRange?.endDate, year, storedMonthInt]);

  // Get unique days - stabilize array reference with useMemo
  const memoizedDays = useMemo(() => {
    const uniqueDays = Array.from(
      new Set(filteredTimesheetEntries.map((entry) => entry.day))
    ).sort((a, b) => a - b); // Sort to ensure consistent order
    return uniqueDays;
  }, [filteredTimesheetEntries]);

  // Compensation lookup map - stabilize reference with useMemo
  const compensationLookup = useMemo(() => {
    const lookup = new Map();
    if (compensationEntries && compensationEntries.length > 0) {
      compensationEntries.forEach((comp) => {
        if (comp && comp.year && comp.month && comp.day) {
          const key = `${comp.year}-${comp.month}-${comp.day}`;
          lookup.set(key, comp);
        }
      });
    }
    console.log(`[Timesheet] Built compensationLookup with ${lookup.size} entries for ${year}-${storedMonthInt}`);
    return lookup;
  }, [compensationEntries]);

  // Add a useEffect to debug compensation updates
  useEffect(() => {
    if (compensationEntries.length > 0) {
      console.log(`[Timesheet] Compensation entries updated - now have ${compensationEntries.length} entries`);
      // Log a sample of a few entries
      const sample = compensationEntries.slice(0, Math.min(3, compensationEntries.length));
      console.log('[Timesheet] Sample compensation entries:', sample);
    }
  }, [compensationEntries]);

  // Find employee's employment type
  const employmentTypeObj = useMemo(
    () =>
      employmentTypes.find(
        (type) =>
          type.type.toLowerCase() === employee?.employmentType?.toLowerCase()
      ) || null,
    [employmentTypes, employee?.employmentType]
  );

  // Find employee's time tracking settings
  const employeeTimeSettings = useMemo(() => {
    if (!employee || !timeSettings.length) return null;
    const settings = timeSettings.find(
      (type) =>
        type.type.toLowerCase() === employee.employmentType?.toLowerCase()
    );
    return settings;
  }, [employee, timeSettings]);

  // Create dates array for schedules with useMemo
  const dates = useMemo(
    () => memoizedDays.map((day) => new Date(year, storedMonthInt - 1, day)),
    [memoizedDays, year, storedMonthInt]
  );

  // Get schedules with more stable references
  const scheduleMap = useSchedules(
    attendanceSettingsModel,
    employmentTypeObj,
    dates
  );

  // Edit mode handlers
  const handleStartEdit = (cellKey: string) => {
    console.log(`TimesheetPage: handleStartEdit called with cellKey: ${cellKey}. Current editingCellKey: ${editingCellKey}`);
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
      console.log(`TimesheetPage: Attempted to edit ${cellKey} while ${editingCellKey} is active. Warning toast shown.`);
      toast.warning("Please save or cancel the current edit before starting another.");
    } else {
      console.log(`TimesheetPage: Setting editingCellKey to: ${cellKey}`);
      setEditingCellKey(cellKey);
    }
  };

  const handleStopEdit = () => {
    console.log(`TimesheetPage: handleStopEdit called. Current editingCellKey: ${editingCellKey}. Setting to null.`);
    setEditingCellKey(null);
  };

  // History dialog handler
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

  useEffect(() => {
    console.log(`TimesheetPage: editingCellKey STATE CHANGED to: ${editingCellKey}`);
  }, [editingCellKey]);

  // Check if user has basic access
  if (!hasAccess("VIEW_TIMESHEETS")) {
    return (
      <RootLayout>
        <div className="flex items-center justify-center min-h-screen">
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

  return (
    <RootLayout>
      <main className="w-full h-screen pt-16">
        <div className="w-full h-full">
          <div className="bg-white flex flex-col h-full">
            <TimesheetHeader
              employeeId={selectedEmployeeId}
              onSelectEmployee={setSelectedEmployeeId}
              employees={employees}
              validEntriesCount={validEntriesCount}
              onRefresh={refreshData}
              onColumnSettings={() => setShowColumnMenu(!showColumnMenu)}
              hasPayrollAccess={hasAccess("MANAGE_PAYROLL")}
              onRecompute={() => setShowRecomputeDialog(true)}
            />

            {!selectedEmployeeId ? (
              <NoDataPlaceholder
                dataType="timesheet data"
                actionText="Select Employee"
                onActionClick={() => handleLinkClick("/")}
                onSelectEmployeeClick={() => handleLinkClick("/")}
              />
            ) : (
              <div className="flex-1 overflow-x-auto scrollbar-y-none">
                {showColumnMenu && (
                  <div
                    className="absolute right-4 top-28 mt-2 w-80 rounded-lg bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50"
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
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none ${column.key === "day"
                                  ? "bg-gray-600 cursor-not-allowed"
                                  : column.visible
                                    ? "bg-blue-500"
                                    : "bg-gray-700"
                                  }`}
                                disabled={column.key === "day"}
                              >
                                <span
                                  className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white ${column.visible
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

                {filteredTimesheetEntries.length === 0 ? (
                  <NoDataPlaceholder
                    employeeName={employee?.name || "Selected Employee"}
                    dataType="timesheet entries"
                    actionText="Add Entry"
                    onActionClick={() => {
                      console.log("Add Entry / Primary Action Clicked for NoDataPlaceholder");
                      toast.info("Action for 'No timesheet entries' placeholder clicked.");
                    }}
                    onSelectEmployeeClick={() => handleLinkClick("/")}
                  />
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 border-collapse border-gray-200 timesheet-table">
                    {/* Sticky column headers */}
                    <thead className="bg-gray-50 sticky top-0 z-20">
                      <tr className="border-b border-gray-200">
                        {columns.map(
                          (column) =>
                            column.visible && (
                              <th
                                key={column.key}
                                scope="col"
                                className={`${column.key === "day"
                                  ? "sticky left-0 z-30 bg-gray-50 shadow-sm"
                                  : "bg-gray-50"
                                  } px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.key === "day" ? "w-20" : ""
                                  }`}
                              >
                                {column.name}
                              </th>
                            )
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {memoizedDays.map((day) => {
                        const foundEntry = filteredTimesheetEntries.find(
                          (entry) => entry.day === day
                        );
                        const compensationKey = `${year}-${storedMonthInt}-${day}`;
                        const compensation =
                          compensationLookup.get(compensationKey) || null;

                        if (!foundEntry) {
                          return null;
                        }

                        return (
                          <TimesheetRow
                            key={day}
                            day={day}
                            foundEntry={foundEntry}
                            compensation={compensation}
                            columns={columns}
                            employeeTimeSettings={employeeTimeSettings || null}
                            employmentTypes={employmentTypes}
                            selectedEntry={selectedEntry}
                            scheduleMap={scheduleMap}
                            hasAccess={hasAccess}
                            editingCellKey={editingCellKey}
                            handleTimesheetEdit={handleTimesheetEdit}
                            handleCheckboxChange={handleCheckboxChange}
                            handleStartEdit={handleStartEdit}
                            handleStopEdit={handleStopEdit}
                            handleRowClick={handleRowClick}
                            handleDayCellClick={handleDayCellClick}
                            handleSwapTimes={handleSwapTimes}
                            year={year}
                            storedMonthInt={storedMonthInt}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
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
          onRecompute={(useRange) => handleRecompute(useRange)}
        />

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
            companyName={companyName}
            isWebMode={isWeb}
            onRevertAttendance={(day, timeIn, timeOut) => {
              // This is a simplified adapter to make types compatible
              if (!selectedHistoryDay) return Promise.resolve();
              const historicalAttendance: Attendance = {
                employeeId: selectedEmployeeId,
                day,
                month: storedMonthInt,
                year,
                timeIn,
                timeOut,
                schedule: null
              };
              return handleRevertAttendanceToHistory(historicalAttendance);
            }}
            onRevertCompensation={(day, backupData) => {
              // This is a simplified adapter to make types compatible
              if (!selectedHistoryDay) return Promise.resolve();
              const historicalCompensation: Compensation = {
                ...backupData,
                employeeId: selectedEmployeeId,
                day,
                month: storedMonthInt,
                year
              };
              return handleRevertCompensationToHistory(historicalCompensation);
            }}
          />
        )}
      </main>
    </RootLayout>
  );
};

export default TimesheetPage;