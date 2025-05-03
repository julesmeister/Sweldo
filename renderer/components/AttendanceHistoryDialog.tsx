import React, { useEffect, useState } from "react";
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
  const [historyEntries, setHistoryEntries] = useState<AttendanceBackupEntry[]>(
    []
  );
  const [compensationEntries, setCompensationEntries] = useState<
    CompensationBackupEntry[]
  >([]);
  const [combinedEntries, setCombinedEntries] = useState<DisplayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isOpen || !employeeId || !year || !month || !day || !dbPath) {
        setHistoryEntries([]);
        setCompensationEntries([]);
        setCombinedEntries([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      setHistoryEntries([]);
      setCompensationEntries([]);
      setCombinedEntries([]);

      const baseBackupDir = `${dbPath}/SweldoDB/attendances/${employeeId}`;
      const attendanceBackupFilePath = `${baseBackupDir}/${year}_${month}_attendance_backup.csv`;
      const compensationBackupFilePath = `${baseBackupDir}/${year}_${month}_compensation_backup.csv`;

      console.log(
        `[AttendanceHistoryDialog] Backup directory: ${baseBackupDir}`
      );

      try {
        const attendanceContent = await window.electron.readFile(
          attendanceBackupFilePath
        );
        let attendanceData: AttendanceBackupEntry[] = [];

        if (attendanceContent && attendanceContent.trim().length > 0) {
          const attendanceResults = Papa.parse<any>(attendanceContent, {
            skipEmptyLines: true,
            newline: "\n",
          });

          if (attendanceResults.errors.length > 0) {
            console.error(
              "Parsing attendance errors:",
              attendanceResults.errors
            );
          }

          if (attendanceResults.data.length >= 2) {
            const dataRows = attendanceResults.data.slice(1);

            if (dataRows.length > 0) {
              console.log(
                "[AttendanceHistoryDialog] Sample attendance row:",
                dataRows[0]
              );
            }

            attendanceData = dataRows
              .map((row) => {
                return {
                  timestamp: row[0] || "",
                  employeeId: row[1] || employeeId,
                  day: parseInt(row[2], 10),
                  month: parseInt(row[3], 10) || month,
                  year: parseInt(row[4], 10) || year,
                  timeIn: row[5] || null,
                  timeOut: row[6] || null,
                } as AttendanceBackupEntry;
              })
              .filter((entry) => entry !== null && !isNaN(entry.day));
          }
        }

        const compensationContent = await window.electron
          .readFile(compensationBackupFilePath)
          .catch((err) => {
            console.error(
              `[AttendanceHistoryDialog] Error reading compensation file:`,
              err
            );
            return null;
          });

        console.log(
          `[AttendanceHistoryDialog] Compensation content loaded:`,
          compensationContent
            ? `${compensationContent.substring(0, 100)}... (${
                compensationContent.length
              } chars)`
            : "null"
        );

        let compensationData: CompensationBackupEntry[] = [];

        if (compensationContent && compensationContent.trim().length > 0) {
          const compensationResults = Papa.parse<any>(compensationContent, {
            skipEmptyLines: true,
            newline: "\n",
          });

          if (compensationResults.errors.length > 0) {
            console.error(
              "[AttendanceHistoryDialog] Parsing compensation errors:",
              compensationResults.errors
            );
          }

          console.log(
            `[AttendanceHistoryDialog] Compensation parsed results:`,
            {
              rowCount: compensationResults.data.length,
              errors: compensationResults.errors.length,
              firstRow:
                compensationResults.data.length > 0
                  ? compensationResults.data[0]
                  : "none",
            }
          );

          if (compensationResults.data.length >= 2) {
            const dataRows = compensationResults.data.slice(1);

            if (dataRows.length > 0) {
              console.log(
                "[AttendanceHistoryDialog] Sample compensation row:",
                dataRows[0]
              );
            }

            compensationData = dataRows
              .map((row) => {
                const entry = {
                  timestamp: row[0] || "",
                  employeeId: row[1] || employeeId,
                  day: parseInt(row[4], 10),
                  month: parseInt(row[2], 10) || month,
                  year: parseInt(row[3], 10) || year,
                  grossPay: row[17] ? parseFloat(row[17]) : null,
                  netPay: row[19] ? parseFloat(row[19]) : null,
                  hoursWorked: row[7] ? parseFloat(row[7]) : null,
                  dayType: row[5] || null,
                  absence: row[22] === "true" || row[22] === "1" || null,
                  deductions: row[18] ? parseFloat(row[18]) : null,
                  dailyRate: row[6] ? parseFloat(row[6]) : null,
                  overtimeMinutes: row[8] ? parseFloat(row[8]) : null,
                  overtimePay: row[9] ? parseFloat(row[9]) : null,
                  undertimeMinutes: row[10] ? parseFloat(row[10]) : null,
                  undertimeDeduction: row[11] ? parseFloat(row[11]) : null,
                  lateMinutes: row[12] ? parseFloat(row[12]) : null,
                  lateDeduction: row[13] ? parseFloat(row[13]) : null,
                  holidayBonus: row[14] ? parseFloat(row[14]) : null,
                  leaveType: row[15] || null,
                  leavePay: row[16] ? parseFloat(row[16]) : null,
                  manualOverride: row[20] === "true" || row[20] === "1" || null,
                  notes: row[21] || null,
                  nightDifferentialHours: row[23] ? parseFloat(row[23]) : null,
                  nightDifferentialPay: row[24] ? parseFloat(row[24]) : null,
                } as CompensationBackupEntry;

                return entry;
              })
              .filter((entry) => entry !== null && !isNaN(entry.day));
          }
        } else {
          console.log(
            `[AttendanceHistoryDialog] No compensation content available or empty`
          );
        }

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

        setHistoryEntries(filteredAttendanceData);
        setCompensationEntries(filteredCompensationData);
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

  const formatDate = (dateString: string) => {
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
  };

  const formatTime = (time: string | null): string => {
    if (!time) return "-";
    const parts = time.split(":");
    if (parts.length !== 2) return "-";

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (isNaN(hours) || isNaN(minutes)) return "-";

    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null || isNaN(Number(amount))) return "-";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatHours = (hours: number | null): string => {
    if (hours === null || isNaN(Number(hours))) return "-";
    return hours.toFixed(2);
  };

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
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Timestamp
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Time In
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Time Out
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Deductions
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Gross Pay
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
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
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(entry.timestamp)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {entry.type === "attendance"
                          ? formatTime(entry.attendanceData?.timeIn ?? null)
                          : "-"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {entry.type === "attendance"
                          ? formatTime(entry.attendanceData?.timeOut ?? null)
                          : "-"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {entry.type === "compensation"
                          ? formatCurrency(
                              entry.compensationData?.deductions ?? null
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {entry.type === "compensation"
                          ? formatCurrency(
                              entry.compensationData?.grossPay ?? null
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
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
