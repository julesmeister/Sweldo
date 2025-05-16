"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { MissingTimeModel, MissingTimeLog } from "@/renderer/model/missingTime";
import { getMissingTimeLogsFirestore } from "@/renderer/model/missingTime_firestore";
import { createEmployeeModel } from "@/renderer/model/employee";
import { createAttendanceModel, Attendance } from "@/renderer/model/attendance";
import { createCompensationModel } from "@/renderer/model/compensation";
import { createAttendanceSettingsModel } from "@/renderer/model/settings";
import { MagicCard } from "@/renderer/components/magicui/magic-card";
import { TimeEditDialog } from "@/renderer/components/forms/TimeEditDialog";
import { useMissingTimeEdit } from "@/renderer/hooks/useMissingTimeEdit";
import { Employee } from "@/renderer/model/employee";
import { useAuthStore } from "@/renderer/stores/authStore";
import { clearMissingTimeLogCache } from "@/renderer/lib/db";
import { IoReloadOutline } from "react-icons/io5";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import DecryptedText from "@/renderer/styles/DecryptedText/DecryptedText";

export default function MissingTimeLogs() {
  const [missingLogs, setMissingLogs] = useState<MissingTimeLog[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<MissingTimeLog | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data has been loaded
  const [dialogPosition, setDialogPosition] = useState<{
    top: number;
    left: number;
    showAbove?: boolean;
  } | null>(null);
  const { setLoading } = useLoadingStore();
  const { dbPath, companyName } = useSettingsStore();
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const { accessCodes, hasAccess } = useAuthStore();
  const monthNum = storedMonth ? parseInt(storedMonth, 10) + 1 : undefined;
  const yearNum = storedYear ? parseInt(storedYear, 10) : undefined;

  const loadMissingLogs = async () => {
    // Skip if already loading
    if (isLoading) return;

    setIsLoading(true);

    // Different validation based on environment
    if (isWebEnvironment()) {
      if (!storedMonth || !storedYear || !companyName) {
        setIsLoading(false);
        return;
      }
    } else {
      if (!dbPath || !storedMonth || !storedYear) {
        setIsLoading(false);
        return;
      }
    }

    try {
      // Load missing time logs
      const actualMonth = parseInt(storedMonth!) + 1;
      const actualYear = parseInt(storedYear!);

      let logs: MissingTimeLog[] = [];

      if (isWebEnvironment()) {
        // In web mode, use Firestore directly
        if (companyName) {
          logs = await getMissingTimeLogsFirestore(actualMonth, actualYear, companyName);
        }
      } else {
        // In desktop mode, use the model which handles local files
        const model = MissingTimeModel.createMissingTimeModel(dbPath!);
        logs = await model.getMissingTimeLogs(actualMonth, actualYear);
      }

      // Only update if we got data or haven't loaded data yet
      if (logs.length > 0 || !dataLoaded) {
        // Load all employees to check their status
        let activeEmployeeIds: Set<string>;

        if (isWebEnvironment()) {
          // In web mode, we might already have activeEmployees state
          if (activeEmployees.length === 0) {
            // If not, fetch active employees directly from Firestore
            activeEmployeeIds = new Set(activeEmployees);
          } else {
            activeEmployeeIds = new Set(activeEmployees);
          }
        } else {
          // In desktop mode, load from local files
          const employeeModel = createEmployeeModel(dbPath!);
          const employees = await employeeModel.loadActiveEmployees();

          activeEmployeeIds = new Set(
            employees.filter((emp) => emp.status === "active").map((emp) => emp.id)
          );
        }

        // Filter logs to only show active employees if we have active employee IDs
        let filteredLogs = logs;
        if (activeEmployeeIds.size > 0) {
          filteredLogs = logs.filter((log) => activeEmployeeIds.has(log.employeeId));
        }

        setMissingLogs(filteredLogs);
        setDataLoaded(true);
      }
    } catch (error) {
      console.error('[loadMissingLogs] Error:', error);
      // Don't clear the data on error if we already have data
      if (!dataLoaded) {
        setMissingLogs([]);
      }
      toast.error("Failed to load missing time logs");
    } finally {
      setIsLoading(false);
    }
  };

  // Get employee data for the selected log
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );

  useEffect(() => {
    const loadEmployee = async () => {
      if (!dbPath || !selectedLog) return;

      try {
        const employeeModel = createEmployeeModel(dbPath);
        const employee = await employeeModel.loadEmployeeById(
          selectedLog.employeeId
        );
        setSelectedEmployee(employee);
      } catch (error) {
        // Error loading employee
      }
    };

    loadEmployee();
  }, [dbPath, selectedLog]);

  const { handleMissingTimeEdit } = useMissingTimeEdit({
    dbPath,
    month: storedMonth ? parseInt(storedMonth) + 1 : 0,
    year: storedYear ? parseInt(storedYear) : new Date().getFullYear(),
    employee: selectedEmployee,
    attendanceModel: createAttendanceModel(dbPath),
    compensationModel: createCompensationModel(dbPath),
    attendanceSettingsModel: createAttendanceSettingsModel(dbPath),
    onMissingLogsUpdate: loadMissingLogs,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;
  let storedYearInt = storedYear
    ? parseInt(storedYear, 10)
    : new Date().getFullYear();
  if (!storedYear) {
    const currentYear = new Date().getFullYear().toString();
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedYear", currentYear);
    }
    storedYearInt = parseInt(currentYear, 10);
  }

  useEffect(() => {
    const loadActiveEmployees = async () => {
      if (!dbPath) {
        return;
      }

      try {
        const employeeModel = createEmployeeModel(dbPath);
        const employees = await employeeModel.loadActiveEmployees();
        setActiveEmployees(employees.map((e) => e.id));
      } catch (error) {
        setActiveEmployees([]);
      }
    };

    loadActiveEmployees();
  }, [dbPath]);

  const reloadMissingLogs = async () => {
    toast('Reloading missing time logs...', { icon: '🔄' });
    if (companyName && yearNum !== undefined && monthNum !== undefined) {
      try {
        // First clear the cache
        await clearMissingTimeLogCache(companyName, yearNum, monthNum);

        // Then directly fetch from Firestore, bypassing cache
        const logs = await getMissingTimeLogsFirestore(monthNum, yearNum, companyName);

        // Update state with the fetched logs if we got data
        if (logs.length > 0) {
          setMissingLogs(logs);
          setDataLoaded(true);
        }

        toast.success(`Reloaded ${logs.length} missing time logs`);
      } catch (error) {
        console.error(`[reloadMissingLogs] Error:`, error);
        toast.error('Failed to reload missing time logs');
      }
    } else {
      toast.error('Cannot reload - missing company, year or month data');
    }
  };

  useEffect(() => {
    // Only load if we don't have data loaded yet or if essential dependencies changed
    if ((!dbPath && !isWebEnvironment()) || isLoading) return;

    if (!dataLoaded) {
      loadMissingLogs();
    }
  }, [dbPath, setLoading, storedYearInt, storedMonthInt, activeEmployees, dataLoaded]);

  useEffect(() => {
    if (selectedLog) {
      loadAttendance(selectedLog).then(setAttendance);
    } else {
      setAttendance(null);
    }
  }, [selectedLog]);

  const handleTimeEdit = async (updates: {
    timeIn: string | null;
    timeOut: string | null;
  }) => {
    if (!dbPath || !selectedLog) return;

    try {
      await handleMissingTimeEdit(selectedLog, updates);
      setIsDialogOpen(false);
      setSelectedLog(null);
      setDialogPosition(null);
    } catch (error: any) {
      // Error in handleTimeEdit
    }
  };

  const loadAttendance = async (log: MissingTimeLog) => {
    if (!dbPath) return null;
    const attendanceModel = createAttendanceModel(dbPath);
    const attendance = await attendanceModel.loadAttendanceByDay(
      parseInt(log.day),
      log.month,
      log.year,
      log.employeeId
    );
    return attendance;
  };

  const handleMissingLogDeletion = async (log: MissingTimeLog) => {
    if (!dbPath) return;
    try {
      const missingTimeModel = MissingTimeModel.createMissingTimeModel(dbPath);
      await missingTimeModel.deleteMissingTimeLog(log.id, log.month, log.year);
      toast.success(
        "Missing time log removed - Time In and Time Out are complete"
      );
      await loadMissingLogs();
    } catch (error) {
      toast.error("Failed to remove missing time log");
    }
  };

  return (
    <>
      <MagicCard
        className="p-0.5 rounded-lg"
        gradientSize={200}
        gradientColor="#9E7AFF"
        gradientOpacity={0.8}
        gradientFrom="#9E7AFF"
        gradientTo="#FE8BBB"
      >
        <div className="overflow-hidden bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              <DecryptedText text={isWebEnvironment() && companyName ? `${companyName} Missing Time Logs` : "Missing Time Logs"} animateOn="view" revealDirection='start' speed={50} sequential={true}/>
            </h2>
            {yearNum !== undefined && monthNum !== undefined && isWebEnvironment() && (
              <button
                type="button"
                onClick={reloadMissingLogs}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <IoReloadOutline className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    Day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    Missing
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {missingLogs.length > 0 ? (
                  missingLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={async (e) => {
                        e.preventDefault();

                        // Capture the dimensions immediately before any async operations
                        const rect = e.currentTarget.getBoundingClientRect();
                        const windowHeight = window.innerHeight;
                        const spaceBelow = windowHeight - rect.bottom;
                        const spaceAbove = rect.top;
                        const dialogHeight = 400;
                        const spacing = 8;
                        const showAbove =
                          spaceBelow < dialogHeight && spaceAbove > spaceBelow;

                        // Now do the async check
                        const currentAttendance = await loadAttendance(log);
                        if (
                          currentAttendance?.timeIn &&
                          currentAttendance?.timeOut
                        ) {
                          // If both times exist, delete the missing time log without showing dialog
                          await handleMissingLogDeletion(log);
                          return;
                        }

                        // If we need to show the dialog, use the previously captured dimensions
                        setSelectedLog(log);
                        setDialogPosition({
                          top: showAbove
                            ? rect.top - spacing
                            : rect.bottom + spacing,
                          left: rect.left,
                          showAbove,
                        });
                        setIsDialogOpen(true);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b border-gray-200">
                        {log.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-200">
                        {log.day}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-200">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          {log.missingType === "timeIn"
                            ? "Time In"
                            : "Time Out"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No missing time logs found for this month
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </MagicCard>
      <TimeEditDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedLog(null);
          setDialogPosition(null);
        }}
        onSave={handleTimeEdit}
        log={
          selectedLog || {
            id: "",
            employeeId: "",
            employeeName: "",
            day: "",
            month: storedMonthInt || 0,
            year: storedYearInt || 0,
            missingType: "timeIn",
            employmentType: "",
            createdAt: new Date().toISOString(),
          }
        }
        position={dialogPosition}
        attendance={attendance}
        accessCodes={accessCodes}
      />
    </>
  );
}
