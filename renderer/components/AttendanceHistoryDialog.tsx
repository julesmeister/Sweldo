import React, { useEffect, useState, useCallback } from "react";
import {
  IoClose,
  IoWarningOutline,
  IoInformationCircleOutline,
} from "react-icons/io5";
import { ImSpinner9 } from "react-icons/im";
import { FaUndo } from "react-icons/fa";
import { toast } from "sonner";
import { Tooltip } from "@/renderer/components/Tooltip";

// Interface for backup entries (JSON structure)
interface AttendanceBackupEntry {
  timestamp: string;
  employeeId: string;
  day: number;
  month: number;
  year: number;
  timeIn: string | null;
  timeOut: string | null;
}

// Add interface for compensation backup entries
interface CompensationBackupEntry {
  timestamp: string;
  employeeId: string;
  day: number;
  month: number;
  year: number;
  grossPay: number | null;
  netPay: number | null;
  hoursWorked: number | null;
  dayType: string | null;
  absence: boolean | null;
  deductions: number | null;
  dailyRate: number | null;
  overtimeMinutes: number | null;
  overtimePay: number | null;
  undertimeMinutes: number | null;
  undertimeDeduction: number | null;
  lateMinutes: number | null;
  lateDeduction: number | null;
  holidayBonus: number | null;
  leaveType: string | null;
  leavePay: number | null;
  manualOverride: boolean | null;
  notes: string | null;
  nightDifferentialHours: number | null;
  nightDifferentialPay: number | null;
}

// Define structure for individual display entries
interface DisplayEntry {
  timestamp: string;
  type: "attendance" | "compensation";
  // Include data for both types, but only one will be populated per entry
  attendanceData?: {
    timeIn: string | null;
    timeOut: string | null;
  };
  compensationData?: CompensationBackupEntry;
}

// New interface for the backup file format
interface BackupFile {
  employeeId: string;
  year: number;
  month: number;
  backups: {
    timestamp: string;
    changes: {
      day: number;
      field: string;
      oldValue: any;
      newValue: any;
    }[];
  }[];
}

interface AttendanceHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  year: number;
  month: number;
  day: number; // Specific day to show history for
  dbPath: string;
  onRevertAttendance: (
    day: number,
    timeIn: string | null,
    timeOut: string | null
  ) => Promise<void>;
  onRevertCompensation: (
    day: number,
    backupCompensationData: any // Pass the specific backup data object
  ) => Promise<void>;
}

// Define common class name for table headers
const thClassName =
  "px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider";

// Define common class name for table data cells
const tdClassName = "px-4 py-4 whitespace-nowrap text-sm text-gray-700";

export const AttendanceHistoryDialog: React.FC<
  AttendanceHistoryDialogProps
> = ({
  isOpen,
  onClose,
  employeeId,
  year,
  month,
  day,
  dbPath,
  onRevertAttendance,
  onRevertCompensation,
}) => {
  const [combinedEntries, setCombinedEntries] = useState<DisplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to parse attendance backup JSON content
  const parseAttendanceBackup = (
    content: string,
    defaultEmployeeId: string,
    defaultMonth: number,
    defaultYear: number
  ): AttendanceBackupEntry[] => {
    if (!content || content.trim().length === 0) return [];

    try {
      // Try to parse as the new format first
      const data = JSON.parse(content);

      // Check if it matches the new format with backups array
      if (data.backups && Array.isArray(data.backups)) {
        console.log("[AttendanceHistoryDialog] Detected new backup format");

        // Process the backups array
        const entries: AttendanceBackupEntry[] = [];

        for (const backup of data.backups) {
          // Create a map to collect changes by day
          const dayChanges = new Map<number, Map<string, any>>();

          // Process each change in this backup
          for (const change of backup.changes) {
            if (!dayChanges.has(change.day)) {
              dayChanges.set(change.day, new Map<string, any>());
            }

            // Store the new value for this field
            dayChanges.get(change.day)!.set(change.field, change.newValue);
          }

          // Create attendance entries for each day that has changes
          for (const [dayNum, changes] of dayChanges) {
            if (changes.has("timeIn") || changes.has("timeOut")) {
              entries.push({
                timestamp: backup.timestamp,
                employeeId: data.employeeId || defaultEmployeeId,
                day: dayNum,
                month: data.month || defaultMonth,
                year: data.year || defaultYear,
                timeIn: changes.get("timeIn") || null,
                timeOut: changes.get("timeOut") || null,
              });
            }
          }
        }

        return entries;
      }

      // If not new format, try the previous format (array of entries)
      if (Array.isArray(data)) {
        console.log("[AttendanceHistoryDialog] Processing as array format");
        return data
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            if (!entry.day || !entry.timestamp) return null;

            return {
              timestamp: entry.timestamp || "",
              employeeId: entry.employeeId || defaultEmployeeId,
              day: parseInt(entry.day, 10),
              month: parseInt(entry.month, 10) || defaultMonth,
              year: parseInt(entry.year, 10) || defaultYear,
              timeIn: entry.timeIn || null,
              timeOut: entry.timeOut || null,
            } as AttendanceBackupEntry;
          })
          .filter((entry): entry is AttendanceBackupEntry => entry !== null);
      }

      console.warn("[AttendanceHistoryDialog] Unknown backup format", data);
      return [];
    } catch (e) {
      console.error("Error parsing attendance backup JSON:", e);
      return [];
    }
  };

  // Helper function to parse compensation backup JSON content
  const parseCompensationBackup = (
    content: string,
    defaultEmployeeId: string,
    defaultMonth: number,
    defaultYear: number
  ): CompensationBackupEntry[] => {
    if (!content || content.trim().length === 0) return [];

    try {
      // Try to parse as the new format first
      const data = JSON.parse(content);

      // Check if it matches the new format with backups array
      if (data.backups && Array.isArray(data.backups)) {
        console.log(
          "[AttendanceHistoryDialog] Detected new compensation backup format"
        );

        // Process the backups array
        const entries: CompensationBackupEntry[] = [];

        for (const backup of data.backups) {
          // Create a map to collect changes by day
          const dayChanges = new Map<number, Map<string, any>>();

          // Process each change in this backup
          for (const change of backup.changes) {
            if (!dayChanges.has(change.day)) {
              dayChanges.set(change.day, new Map<string, any>());
            }

            // Store the new value for this field
            const value = change.newValue;
            // Try to parse numeric values
            const parsedValue =
              typeof value === "string" && !isNaN(Number(value))
                ? Number(value)
                : value;

            dayChanges.get(change.day)!.set(change.field, parsedValue);
          }

          // Create compensation entries for each day that has changes
          for (const [dayNum, changes] of dayChanges) {
            // Check if this change includes compensation-related fields
            // We consider it a compensation entry if at least one key compensation field exists
            const hasCompensationFields =
              changes.has("grossPay") ||
              changes.has("netPay") ||
              changes.has("dayType") ||
              changes.has("dailyRate");

            if (hasCompensationFields) {
              entries.push({
                timestamp: backup.timestamp,
                employeeId: data.employeeId || defaultEmployeeId,
                day: dayNum,
                month: data.month || defaultMonth,
                year: data.year || defaultYear,
                grossPay: changes.get("grossPay") || null,
                netPay: changes.get("netPay") || null,
                hoursWorked: changes.get("hoursWorked") || null,
                dayType: changes.get("dayType") || null,
                absence:
                  changes.get("absence") === "true" ||
                  changes.get("absence") === true ||
                  null,
                deductions: changes.get("deductions") || null,
                dailyRate: changes.get("dailyRate") || null,
                overtimeMinutes: changes.get("overtimeMinutes") || null,
                overtimePay: changes.get("overtimePay") || null,
                undertimeMinutes: changes.get("undertimeMinutes") || null,
                undertimeDeduction: changes.get("undertimeDeduction") || null,
                lateMinutes: changes.get("lateMinutes") || null,
                lateDeduction: changes.get("lateDeduction") || null,
                holidayBonus: changes.get("holidayBonus") || null,
                leaveType: changes.get("leaveType") || null,
                leavePay: changes.get("leavePay") || null,
                manualOverride:
                  changes.get("manualOverride") === "true" ||
                  changes.get("manualOverride") === true ||
                  null,
                notes: changes.get("notes") || null,
                nightDifferentialHours:
                  changes.get("nightDifferentialHours") || null,
                nightDifferentialPay:
                  changes.get("nightDifferentialPay") || null,
              });
            }
          }
        }

        return entries;
      }

      // If not new format, try the previous format (array of entries)
      if (Array.isArray(data)) {
        console.log("[AttendanceHistoryDialog] Processing as array format");
        return data
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            if (!entry.day) return null;

            return {
              timestamp: entry.timestamp || "",
              employeeId: entry.employeeId || defaultEmployeeId,
              day: parseInt(entry.day, 10),
              month: parseInt(entry.month, 10) || defaultMonth,
              year: parseInt(entry.year, 10) || defaultYear,
              grossPay: entry.grossPay,
              netPay: entry.netPay,
              hoursWorked: entry.hoursWorked,
              dayType: entry.dayType,
              absence: entry.absence,
              deductions: entry.deductions,
              dailyRate: entry.dailyRate,
              overtimeMinutes: entry.overtimeMinutes,
              overtimePay: entry.overtimePay,
              undertimeMinutes: entry.undertimeMinutes,
              undertimeDeduction: entry.undertimeDeduction,
              lateMinutes: entry.lateMinutes,
              lateDeduction: entry.lateDeduction,
              holidayBonus: entry.holidayBonus,
              leaveType: entry.leaveType,
              leavePay: entry.leavePay,
              manualOverride: entry.manualOverride,
              notes: entry.notes,
              nightDifferentialHours: entry.nightDifferentialHours,
              nightDifferentialPay: entry.nightDifferentialPay,
            } as CompensationBackupEntry;
          })
          .filter((entry): entry is CompensationBackupEntry => entry !== null);
      }

      console.warn(
        "[AttendanceHistoryDialog] Unknown compensation backup format",
        data
      );
      return [];
    } catch (e) {
      console.error("Error parsing compensation backup JSON:", e);
      return [];
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isOpen || !employeeId || !year || !month || !day || !dbPath) {
        setCombinedEntries([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      setCombinedEntries([]);

      const baseBackupDir = `${dbPath}/SweldoDB/attendances/${employeeId}`;
      const attendanceBackupFilePath = `${baseBackupDir}/${year}_${month}_attendance_backup.json`;
      const compensationBackupFilePath = `${baseBackupDir}/${year}_${month}_compensation_backup.json`;

      console.log(
        `[AttendanceHistoryDialog] Backup directory: ${baseBackupDir}`
      );

      try {
        // First try to load JSON backup files
        let attendanceContent = await window.electron
          .readFile(attendanceBackupFilePath)
          .catch(() => null);

        // Fallback to CSV if JSON doesn't exist
        if (!attendanceContent) {
          const csvFilePath = `${baseBackupDir}/${year}_${month}_attendance_backup.csv`;
          console.log(
            `[AttendanceHistoryDialog] JSON not found, trying CSV: ${csvFilePath}`
          );
          attendanceContent = await window.electron
            .readFile(csvFilePath)
            .catch(() => null);
        }

        // Parse attendance data
        const attendanceData = parseAttendanceBackup(
          attendanceContent || "",
          employeeId,
          month,
          year
        );

        // First try to load JSON backup files for compensation
        let compensationContent = await window.electron
          .readFile(compensationBackupFilePath)
          .catch((err) => {
            console.error(
              `[AttendanceHistoryDialog] Error reading compensation JSON file:`,
              err
            );
            return null;
          });

        // Fallback to CSV if JSON doesn't exist
        if (!compensationContent) {
          const csvFilePath = `${baseBackupDir}/${year}_${month}_compensation_backup.csv`;
          console.log(
            `[AttendanceHistoryDialog] JSON not found, trying CSV: ${csvFilePath}`
          );
          compensationContent = await window.electron
            .readFile(csvFilePath)
            .catch(() => null);
        }

        // Parse compensation data
        const compensationData = parseCompensationBackup(
          compensationContent || "",
          employeeId,
          month,
          year
        );

        // Filter for the specific day
        const filteredAttendanceData = attendanceData.filter(
          (entry) => entry.day === day
        );
        const filteredCompensationData = compensationData.filter(
          (entry) => entry.day === day
        );

        console.log(`[AttendanceHistoryDialog] Filtered data for day ${day}:`, {
          attendanceCount: filteredAttendanceData.length,
          compensationCount: filteredCompensationData.length,
        });

        // Create display entries
        const attendanceDisplayEntries: DisplayEntry[] =
          filteredAttendanceData.map((entry) => ({
            timestamp: entry.timestamp,
            type: "attendance",
            attendanceData: {
              timeIn: entry.timeIn,
              timeOut: entry.timeOut,
            },
          }));

        const compensationDisplayEntries: DisplayEntry[] =
          filteredCompensationData.map((entry) => ({
            timestamp: entry.timestamp,
            type: "compensation",
            compensationData: entry,
          }));

        // Combine and sort
        const allDisplayEntries = [
          ...attendanceDisplayEntries,
          ...compensationDisplayEntries,
        ];
        allDisplayEntries.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        console.log(
          `[AttendanceHistoryDialog] Total display entries created: ${allDisplayEntries.length}`
        );
        if (allDisplayEntries.length > 0) {
          console.log(
            `[AttendanceHistoryDialog] Sample display entry:`,
            allDisplayEntries[0]
          );
        }

        setCombinedEntries(allDisplayEntries);

        if (allDisplayEntries.length === 0) {
          setError(`No history found for day ${day} in the backup files.`);
        }
      } catch (err: any) {
        console.error(
          `[AttendanceHistoryDialog] Error reading or processing backup files:`,
          err
        );
        if (err.message?.includes("ENOENT")) {
          setError("Backup files not found for this month.");
        } else {
          setError("Failed to load attendance history.");
          toast.error(
            "Could not load history: " + (err.message || "Unknown error")
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, employeeId, year, month, day, dbPath]);

  if (!isOpen) return null;

  const headerDate = new Date(year, month - 1, day).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const formatDate = useCallback((dateString: string) => {
    try {
      return new Date(dateString).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return dateString;
    }
  }, []);

  const formatTime = useCallback((time: string | null): string => {
    if (!time) return "-";
    const parts = time.split(":");
    if (parts.length !== 2) return "-";
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (isNaN(hours) || isNaN(minutes)) return "-";
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  }, []);

  const formatCurrency = useCallback((amount: number | null): string => {
    if (amount === null || isNaN(Number(amount))) return "-";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);

  const formatHours = useCallback((hours: number | null): string => {
    if (hours === null || isNaN(Number(hours))) return "-";
    return hours.toFixed(2);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-5xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">
            Attendance & Compensation History for {headerDate}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto bg-white scrollbar-thin">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <ImSpinner9 className="animate-spin h-8 w-8 mb-3 text-blue-500" />
              <p className="text-lg font-medium">Loading History...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-40 text-red-600">
              <IoWarningOutline className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium text-center px-4">{error}</p>
            </div>
          )}
          {!isLoading && !error && combinedEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <IoInformationCircleOutline className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium text-center px-4">
                No changes found for this day in the backup logs.
              </p>
            </div>
          )}
          {!isLoading && !error && combinedEntries.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th
                    scope="col"
                    className="px-2 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Revert
                  </th>
                  <th scope="col" className={thClassName}>
                    Timestamp
                  </th>
                  <th scope="col" className={thClassName}>
                    Time In
                  </th>
                  <th scope="col" className={thClassName}>
                    Time Out
                  </th>
                  <th scope="col" className={thClassName}>
                    Deductions
                  </th>
                  <th scope="col" className={thClassName}>
                    Gross Pay
                  </th>
                  <th scope="col" className={thClassName}>
                    Net Pay
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {combinedEntries.map((entry) => {
                  const hasCompensationData =
                    entry.type === "compensation" && !!entry.compensationData;
                  const hasAttendanceData =
                    entry.type === "attendance" && !!entry.attendanceData;

                  return (
                    <tr
                      key={`${entry.timestamp}-${entry.type}`}
                      className="hover:bg-gray-50 transition-colors even:bg-gray-50/50"
                    >
                      <td className="px-2 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                        {entry.type === "compensation" &&
                          entry.compensationData && (
                            <Tooltip
                              content={`Revert compensation to state from ${formatDate(
                                entry.timestamp
                              )}`}
                              position="top"
                            >
                              <button
                                onClick={async () => {
                                  try {
                                    await onRevertCompensation(
                                      day,
                                      entry.compensationData!
                                    );
                                    onClose();
                                  } catch (revertError) {
                                    console.error(
                                      "Compensation revert failed:",
                                      revertError
                                    );
                                  }
                                }}
                                className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-full transition-colors duration-150"
                              >
                                <FaUndo className={`w-4 h-4`} />
                              </button>
                            </Tooltip>
                          )}

                        {entry.type === "attendance" &&
                          entry.attendanceData && (
                            <Tooltip
                              content={`Revert attendance to state from ${formatDate(
                                entry.timestamp
                              )} (${formatTime(
                                entry.attendanceData.timeIn
                              )} - ${formatTime(
                                entry.attendanceData.timeOut
                              )})`}
                              position="top"
                            >
                              <button
                                onClick={async () => {
                                  try {
                                    await onRevertAttendance(
                                      day,
                                      entry.attendanceData!.timeIn,
                                      entry.attendanceData!.timeOut
                                    );
                                    toast.success(
                                      `Attendance reverted to state from ${formatDate(
                                        entry.timestamp
                                      )}`
                                    );
                                    onClose();
                                  } catch (revertError) {
                                    console.error(
                                      "Attendance revert failed:",
                                      revertError
                                    );
                                    toast.error("Failed to revert attendance.");
                                  }
                                }}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors duration-150"
                              >
                                <FaUndo className={`w-4 h-4`} />
                              </button>
                            </Tooltip>
                          )}
                      </td>
                      <td className={tdClassName}>
                        {formatDate(entry.timestamp)}
                      </td>
                      <td className={tdClassName}>
                        {entry.type === "attendance"
                          ? formatTime(entry.attendanceData?.timeIn ?? null)
                          : "-"}
                      </td>
                      <td className={tdClassName}>
                        {entry.type === "attendance"
                          ? formatTime(entry.attendanceData?.timeOut ?? null)
                          : "-"}
                      </td>
                      <td className={tdClassName}>
                        {entry.type === "compensation"
                          ? formatCurrency(
                              entry.compensationData?.deductions ?? null
                            )
                          : "-"}
                      </td>
                      <td className={tdClassName}>
                        {entry.type === "compensation"
                          ? formatCurrency(
                              entry.compensationData?.grossPay ?? null
                            )
                          : "-"}
                      </td>
                      <td className={tdClassName}>
                        {entry.type === "compensation"
                          ? formatCurrency(
                              entry.compensationData?.netPay ?? null
                            )
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors duration-200 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
