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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!isOpen || !employeeId || !year || !month || !day || !dbPath) {
        setHistoryEntries([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      setHistoryEntries([]); // Clear previous entries

      const backupFilePath = `${dbPath}/SweldoDB/attendances/${employeeId}/${year}_${month}_attendance_backup.csv`;

      try {
        const fileContent = await window.electron.readFile(backupFilePath);

        if (!fileContent || fileContent.trim().length === 0) {
          setError("No backup history found for this month.");
          setIsLoading(false);
          return;
        }

        const results = Papa.parse<any>(fileContent, {
          skipEmptyLines: true,
          newline: "\n",
        });

        if (results.errors.length > 0) {
          console.error("Parsing errors:", results.errors);
          setError("Error parsing backup file. Check console for details.");
          toast.error(
            "Could not parse the backup history file. See console for details."
          );
        }

        // Check if we have at least a header and one data row
        if (results.data.length < 2) {
          setError("No history data found in the backup file.");
          setIsLoading(false);
          return;
        }

        // Manually process rows, skipping the header (index 0)
        const dataRows = results.data.slice(1);

        const mappedData = dataRows
          .map((row) => {
            return {
              timestamp: row[0] || "",
              employeeId: row[1] || employeeId,
              day: parseInt(row[2], 10), // Manual parsing needed now
              month: parseInt(row[3], 10) || month,
              year: parseInt(row[4], 10) || year,
              timeIn: row[5] || null,
              timeOut: row[6] || null,
            } as AttendanceBackupEntry;
          })
          .filter((entry) => entry !== null && !isNaN(entry.day)); // Filter out skipped rows and rows where day is NaN

        // Filter for the specific day
        const filteredData = mappedData.filter((entry) => entry.day === day);

        // Sort by timestamp descending (most recent first)
        filteredData.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setHistoryEntries(filteredData);

        if (filteredData.length === 0) {
          setError(`No history found for day ${day} in the backup file.`);
        }
      } catch (err: any) {
        console.error(
          `Error reading or processing backup file ${backupFilePath}:`,
          err
        );
        // Handle file not found specifically maybe? For now, general error.
        if (err.message?.includes("ENOENT")) {
          // Check if it's a 'File not found' error
          setError("Backup file not found for this month.");
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

  return (
    // Using similar styling as CompensationDialog for consistency
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" // Lighter backdrop
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden" // Light background, light border
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          {" "}
          {/* Light header bg and border */}
          <h3 className="text-lg font-medium text-gray-800">
            {" "}
            {/* Darker text */}
            Attendance History for {headerDate} {/* Use formatted date */}
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
          {!isLoading && !error && historyEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <IoInformationCircleOutline className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium text-center px-4">
                No attendance changes found for this day in the backup log.
              </p>
            </div>
          )}
          {!isLoading && !error && historyEntries.length > 0 && (
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
                    Timestamp (Change Saved)
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyEntries.map((entry) => (
                  <tr
                    key={entry.timestamp}
                    className="hover:bg-gray-50 transition-colors even:bg-gray-50/50"
                  >
                    <td className="px-3 py-4 whitespace-nowrap text-center text-sm text-gray-700">
                      <button
                        onClick={async () => {
                          try {
                            await onRevert(day, entry.timeIn, entry.timeOut);
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
                          entry.timeIn
                        )} - ${formatTime(
                          entry.timeOut
                        )}) saved on ${formatDate(entry.timestamp)}`}
                      >
                        <FaUndo className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(entry.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatTime(entry.timeIn)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatTime(entry.timeOut)}
                    </td>
                  </tr>
                ))}
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
