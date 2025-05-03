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
}

// Combined backup for display
interface CombinedBackupEntry {
  timestamp: string;
  attendanceData: {
    timeIn: string | null;
    timeOut: string | null;
  };
  compensationData: {
    grossPay: number | null;
    netPay: number | null;
    hoursWorked: number | null;
    dayType: string | null;
    absence: boolean | null;
    deductions: number | null;
  } | null;
}

interface AttendanceHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  year: number;
  month: number;
  day: number; // Specific day to show history for
  dbPath: string;
  onRevert: (
    day: number,
    timeIn: string | null,
    timeOut: string | null
  ) => Promise<void>;
}

export const AttendanceHistoryDialog: React.FC<
  AttendanceHistoryDialogProps
> = ({ isOpen, onClose, employeeId, year, month, day, dbPath, onRevert }) => {
  const [historyEntries, setHistoryEntries] = useState<AttendanceBackupEntry[]>(
    []
  );
  const [compensationEntries, setCompensationEntries] = useState<
    CompensationBackupEntry[]
  >([]);
  const [combinedEntries, setCombinedEntries] = useState<CombinedBackupEntry[]>(
    []
  );
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
      setHistoryEntries([]); // Clear previous entries
      setCompensationEntries([]);
      setCombinedEntries([]);

      // --- Refactored Path Construction ---
      const baseBackupDir = `${dbPath}/SweldoDB/attendances/${employeeId}`;
      const attendanceBackupFilePath = `${baseBackupDir}/${year}_${month}_attendance_backup.csv`;
      const compensationBackupFilePath = `${baseBackupDir}/${year}_${month}_compensation_backup.csv`; // Now uses the same base directory

      console.log(
        `[AttendanceHistoryDialog] Backup directory: ${baseBackupDir}`
      );
      // Removed individual path logs
      // --- End Refactored Path Construction ---

      try {
        // Load attendance backup
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

          // Check if we have data rows
          if (attendanceResults.data.length >= 2) {
            // Manually process rows, skipping the header (index 0)
            const dataRows = attendanceResults.data.slice(1);

            console.log(
              `[AttendanceHistoryDialog] Attendance data rows: ${dataRows.length}`
            );

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

        // Load compensation backup
        console.log(
          `[AttendanceHistoryDialog] Attempting to load compensation backup...`
        );

        // === ADDED: Explicit file existence check ===
        try {
          const exists = await window.electron.fileExists(
            compensationBackupFilePath
          );
          console.log(
            `[AttendanceHistoryDialog] fileExists check for compensation backup returned: ${exists}`
          );
        } catch (checkError) {
          console.error(
            `[AttendanceHistoryDialog] Error during fileExists check:`,
            checkError
          );
        }
        // === END ADDED ===

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

          // Check if we have data rows
          if (compensationResults.data.length >= 2) {
            // Manually process rows, skipping the header (index 0)
            const dataRows = compensationResults.data.slice(1);
            console.log(
              `[AttendanceHistoryDialog] Compensation data rows: ${dataRows.length}`
            );

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

        // Create combined entries with both attendance and compensation data
        const allTimestamps = new Set([
          ...filteredAttendanceData.map((entry) => entry.timestamp),
          ...filteredCompensationData.map((entry) => entry.timestamp),
        ]);

        console.log(
          `[AttendanceHistoryDialog] Unique timestamps: ${
            Array.from(allTimestamps).length
          }`
        );

        const combined = Array.from(allTimestamps).map((timestamp) => {
          const attendanceEntry = filteredAttendanceData.find(
            (entry) => entry.timestamp === timestamp
          );
          const compensationEntry = filteredCompensationData.find(
            (entry) => entry.timestamp === timestamp
          );

          return {
            timestamp,
            attendanceData: {
              timeIn: attendanceEntry?.timeIn || null,
              timeOut: attendanceEntry?.timeOut || null,
            },
            compensationData: compensationEntry
              ? {
                  grossPay: compensationEntry.grossPay,
                  netPay: compensationEntry.netPay,
                  hoursWorked: compensationEntry.hoursWorked,
                  dayType: compensationEntry.dayType,
                  absence: compensationEntry.absence,
                  deductions: compensationEntry.deductions,
                }
              : null,
          };
        });

        if (combined.length > 0) {
          console.log(
            `[AttendanceHistoryDialog] Sample combined entry:`,
            combined[0]
          );
        }

        // Sort by timestamp descending (most recent first)
        combined.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setHistoryEntries(filteredAttendanceData);
        setCompensationEntries(filteredCompensationData);
        setCombinedEntries(combined);

        if (combined.length === 0) {
          setError(`No history found for day ${day} in the backup files.`);
        }
      } catch (err: any) {
        console.error(
          `[AttendanceHistoryDialog] Error reading or processing backup files:`,
          err
        );
        // Handle file not found specifically maybe? For now, general error.
        if (err.message?.includes("ENOENT")) {
          // Check if it's a 'File not found' error
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
  }, [isOpen, employeeId, year, month, day, dbPath]); // Dependencies

  if (!isOpen) return null;

  // Format the date for the header
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
      return dateString; // Fallback to original string if parsing fails
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
    // Using similar styling as CompensationDialog for consistency
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" // Lighter backdrop
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-4xl overflow-hidden" // Light background, light border, wider dialog
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          {" "}
          {/* Light header bg and border */}
          <h3 className="text-lg font-medium text-gray-800">
            {" "}
            {/* Darker text */}
            Attendance & Compensation History for {headerDate}{" "}
            {/* Use formatted date */}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none" // Adjusted text colors
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
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
                    className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Revert
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Timestamp
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Time In
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Time Out
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Deductions
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Gross Pay
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                  >
                    Net Pay
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {combinedEntries.map((entry) => {
                  // Find matching attendance entry to use for revert
                  const matchingAttendance = historyEntries.find(
                    (att) => att.timestamp === entry.timestamp
                  );

                  return (
                    <tr
                      key={entry.timestamp}
                      className="hover:bg-gray-50 transition-colors even:bg-gray-50/50"
                    >
                      <td className="px-3 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                        <button
                          onClick={async () => {
                            try {
                              if (!matchingAttendance) {
                                toast.error(
                                  "No attendance data available to revert"
                                );
                                return;
                              }

                              await onRevert(
                                day,
                                matchingAttendance.timeIn,
                                matchingAttendance.timeOut
                              );
                              toast.success(
                                `Attendance reverted to state from ${formatDate(
                                  entry.timestamp
                                )}`
                              );
                              onClose();
                            } catch (revertError) {
                              console.error("Revert failed:", revertError);
                              toast.error("Failed to revert attendance.");
                            }
                          }}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors duration-150"
                          title={`Revert to this state (${formatTime(
                            entry.attendanceData.timeIn
                          )} - ${formatTime(
                            entry.attendanceData.timeOut
                          )}) saved on ${formatDate(entry.timestamp)}`}
                          disabled={!matchingAttendance}
                        >
                          <FaUndo
                            className={`w-4 h-4 ${
                              !matchingAttendance ? "opacity-50" : ""
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(entry.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatTime(entry.attendanceData.timeIn)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatTime(entry.attendanceData.timeOut)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {entry.compensationData
                          ? formatCurrency(entry.compensationData.deductions)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {entry.compensationData
                          ? formatCurrency(entry.compensationData.grossPay)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {entry.compensationData
                          ? formatCurrency(entry.compensationData.netPay)
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          {" "}
          {/* Light footer bg and border */}
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 transition-colors duration-200 text-sm" // Adjusted button style
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
