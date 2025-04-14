"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { MissingTimeModel, MissingTimeLog } from "@/renderer/model/missingTime";
import { createEmployeeModel } from "@/renderer/model/employee";
import { createAttendanceModel, Attendance } from "@/renderer/model/attendance";
import { createCompensationModel } from "@/renderer/model/compensation";
import { createAttendanceSettingsModel } from "@/renderer/model/settings";
import { MagicCard } from "./magicui/magic-card";
import { TimeEditDialog } from "./TimeEditDialog";
import { useMissingTimeEdit } from "@/renderer/hooks/useMissingTimeEdit";
import { Employee } from "@/renderer/model/employee";
import { useAuthStore } from "../stores/authStore";

export default function MissingTimeLogs() {
  const [missingLogs, setMissingLogs] = useState<MissingTimeLog[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<MissingTimeLog | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [dialogPosition, setDialogPosition] = useState<{
    top: number;
    left: number;
    showAbove?: boolean;
  } | null>(null);
  const { setLoading } = useLoadingStore();
  const { dbPath } = useSettingsStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const { accessCodes, hasAccess } = useAuthStore();

  const loadMissingLogs = async () => {
    if (!dbPath || !storedMonth || !storedYear) {
      return;
    }

    try {
      // Load missing time logs
      const model = MissingTimeModel.createMissingTimeModel(dbPath);
      const logs = await model.getMissingTimeLogs(
        parseInt(storedMonth) + 1,
        parseInt(storedYear)
      );

      // Load all employees to check their status
      const employeeModel = createEmployeeModel(dbPath);
      const employees = await employeeModel.loadEmployees();
      const activeEmployeeIds = new Set(
        employees.filter((emp) => emp.status === "active").map((emp) => emp.id)
      );

      // Filter logs to only show active employees
      const filteredLogs = logs.filter((log) =>
        activeEmployeeIds.has(log.employeeId)
      );

      setMissingLogs(filteredLogs);
    } catch (error) {
      toast.error("Failed to load missing time logs");
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

  useEffect(() => {
    if (!dbPath) return;
    loadMissingLogs();
  }, [dbPath, setLoading, storedYearInt, storedMonthInt, activeEmployees]);

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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Missing Time Logs
          </h2>
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
