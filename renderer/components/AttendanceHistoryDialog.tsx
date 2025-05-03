import React, { useEffect, useState, useCallback } from "react";
import Papa from "papaparse";
import {
  IoClose,
  IoWarningOutline,
  IoInformationCircleOutline,
} from "react-icons/io5";
import { ImSpinner9 } from "react-icons/im";
import { FaUndo } from "react-icons/fa";
import { toast } from "sonner";
import { Tooltip } from "@/renderer/components/Tooltip";

// Interface for backup entries (matches CSV structure + timestamp)
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

  // Helper function to parse attendance CSV content
  const parseAttendanceBackup = (
    content: string,
    defaultEmployeeId: string,
    defaultMonth: number,
    defaultYear: number
  ): AttendanceBackupEntry[] => {
    if (!content || content.trim().length === 0) return [];

    const results = Papa.parse<any>(content, {
      skipEmptyLines: true,
      newline: "\n",
    });

    if (results.errors.length > 0) {
      console.error("Parsing attendance errors:", results.errors);
      // Decide if we should return empty or throw based on error severity?
      // For now, log and continue, might return partial data.
    }

    if (results.data.length < 2) return []; // No data rows

    const dataRows = results.data.slice(1); // Skip header
    return dataRows
      .map((row) => {
        // Basic validation for row structure could be added here
        if (!Array.isArray(row) || row.length < 7) return null;
        const day = parseInt(row[2], 10);
        if (isNaN(day)) return null; // Skip rows with invalid day
        return {
          timestamp: row[0] || "",
          employeeId: row[1] || defaultEmployeeId,
          day,
          month: parseInt(row[3], 10) || defaultMonth,
          year: parseInt(row[4], 10) || defaultYear,
          timeIn: row[5] || null,
          timeOut: row[6] || null,
        } as AttendanceBackupEntry;
      })
      .filter((entry): entry is AttendanceBackupEntry => entry !== null);
  };

  // Helper function to parse compensation CSV content
  const parseCompensationBackup = (
    content: string,
    defaultEmployeeId: string,
    defaultMonth: number,
    defaultYear: number
  ): CompensationBackupEntry[] => {
    if (!content || content.trim().length === 0) return [];

    const results = Papa.parse<any>(content, {
      skipEmptyLines: true,
      newline: "\n",
    });

    if (results.errors.length > 0) {
      console.error("Parsing compensation errors:", results.errors);
    }

    if (results.data.length < 2) return [];

    const dataRows = results.data.slice(1);
    return dataRows
      .map((row) => {
        // Basic validation
        if (!Array.isArray(row) || row.length < 25) return null; // Check expected column count
        const day = parseInt(row[4], 10);
        if (isNaN(day)) return null;

        const getFloatOrNull = (val: any) => (val ? parseFloat(val) : null);
        const getBoolOrNull = (val: any) =>
          val === "true" || val === "1"
            ? true
            : val === "false" || val === "0"
            ? false
            : null;

        return {
          timestamp: row[0] || "",
          employeeId: row[1] || defaultEmployeeId,
          day,
          month: parseInt(row[2], 10) || defaultMonth,
          year: parseInt(row[3], 10) || defaultYear,
          grossPay: getFloatOrNull(row[17]),
          netPay: getFloatOrNull(row[19]),
          hoursWorked: getFloatOrNull(row[7]),
          dayType: row[5] || null,
          absence: getBoolOrNull(row[22]),
          deductions: getFloatOrNull(row[18]),
          dailyRate: getFloatOrNull(row[6]),
          overtimeMinutes: getFloatOrNull(row[8]),
          overtimePay: getFloatOrNull(row[9]),
          undertimeMinutes: getFloatOrNull(row[10]),
          undertimeDeduction: getFloatOrNull(row[11]),
          lateMinutes: getFloatOrNull(row[12]),
          lateDeduction: getFloatOrNull(row[13]),
          holidayBonus: getFloatOrNull(row[14]),
          leaveType: row[15] || null,
          leavePay: getFloatOrNull(row[16]),
          manualOverride: getBoolOrNull(row[20]),
          notes: row[21] || null,
          nightDifferentialHours: getFloatOrNull(row[23]),
          nightDifferentialPay: getFloatOrNull(row[24]),
        } as CompensationBackupEntry;
      })
      .filter((entry): entry is CompensationBackupEntry => entry !== null);
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
      const attendanceBackupFilePath = `${baseBackupDir}/${year}_${month}_attendance_backup.csv`;
      const compensationBackupFilePath = `${baseBackupDir}/${year}_${month}_compensation_backup.csv`;

      console.log(
        `[AttendanceHistoryDialog] Backup directory: ${baseBackupDir}`
      );

      try {
        // Load attendance backup content
        const attendanceContent = await window.electron
          .readFile(attendanceBackupFilePath)
          .catch(() => null);
        // Parse using helper
        const attendanceData = parseAttendanceBackup(
          attendanceContent || "",
          employeeId,
          month,
          year
        );

        // Load compensation backup content
        const compensationContent = await window.electron
          .readFile(compensationBackupFilePath)
          .catch((err) => {
            console.error(
              `[AttendanceHistoryDialog] Error reading compensation file:`,
              err
            );
            return null;
          });
        // Parse using helper
        const compensationData = parseCompensationBackup(
          compensationContent || "",
          employeeId,
          month,
          year
        );

        // Filter for the specific day (remains the same)
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

        // Create display entries (remains the same)
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

        // Combine and sort (remains the same)
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
