import React, { useState, useMemo, useRef, useEffect, DragEvent } from "react";
import { Employee } from "@/renderer/model/employee";
import {
  EmploymentType,
  MonthSchedule,
  DailySchedule,
} from "@/renderer/model/settings"; // Import necessary types
import {
  IoInformationCircleOutline,
  IoChevronBack,
  IoChevronForward,
  IoClose,
  IoCheckmark,
  IoBan,
  IoPrintOutline,
  IoCopyOutline,
  IoClipboardOutline,
} from "react-icons/io5";
import { toast } from "sonner"; // Import toast
import { globalColorMap } from "@/renderer/lib/colorUtils"; // Import the color map
import { isWebEnvironment } from "@/renderer/lib/firestoreService"; // Import isWebEnvironment
import { generateSchedulePdf as generateWebSchedulePdf } from "./webPDFExport"; // Import web PDF generator using relative path
// Import jsPDF directly as a fallback
import { jsPDF } from "jspdf";

interface RosterScheduleProps {
  employmentTypes: EmploymentType[];
  employeesMap: { [type: string]: Employee[] }; // Map of employees keyed by type name
  allMonthSchedules: Record<string, MonthSchedule | null>; // All loaded schedules for the month
  selectedMonth: Date;
  isLoading: boolean;
  getScheduleForDate: (typeId: string, date: Date) => DailySchedule | null; // Function to get specific day schedule
  onUpdateSchedule: (
    typeId: string,
    employeeId: string,
    date: Date,
    newSchedule: DailySchedule
  ) => Promise<void>;
  viewStartDate: Date;
  viewEndDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onPreviousRange: () => void;
  onNextRange: () => void;
  onCopyRange: () => void;
  onPasteRange: () => Promise<void>;
  isPasteAvailable: boolean;
}

// Helper function to get ALL dates in the month
const getAllDatesInMonth = (selectedMonth: Date): Date[] => {
  const dates: Date[] = [];
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    dates.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

// Fallback function in case the import fails
const generateFallbackPDF = (data: any) => {
  console.log("Using fallback PDF generator");
  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    doc.text("Schedule PDF (Fallback version)", 10, 10);
    doc.text(`Duty Roster - ${data.selectedMonth.toLocaleString("default", {
      month: "long",
      year: "numeric",
    })}`, 10, 20);

    // Basic table
    doc.text("This is a simplified fallback PDF due to an import error.", 10, 30);

    // Save the PDF
    const filename = `Schedule-Fallback-${data.selectedMonth.getFullYear()}-${String(
      data.selectedMonth.getMonth() + 1
    ).padStart(2, "0")}.pdf`;

    doc.save(filename);
    return true;
  } catch (error) {
    console.error("Even fallback PDF failed:", error);
    return false;
  }
};

const RosterSchedule: React.FC<RosterScheduleProps> = ({
  employmentTypes,
  employeesMap,
  allMonthSchedules, // Use this directly or via getScheduleForDate
  selectedMonth,
  isLoading,
  getScheduleForDate,
  onUpdateSchedule,
  viewStartDate,
  viewEndDate,
  onStartDateChange,
  onEndDateChange,
  onPreviousRange,
  onNextRange,
  onCopyRange,
  onPasteRange,
  isPasteAvailable,
}) => {
  const allDates = useMemo(
    () => getAllDatesInMonth(selectedMonth),
    [selectedMonth]
  );
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable div

  // State for inline editing
  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    dateStr: string;
  } | null>(null);
  const [editTimeIn, setEditTimeIn] = useState("");
  const [editTimeOut, setEditTimeOut] = useState("");

  // State for drag-and-drop
  const [draggedSchedule, setDraggedSchedule] = useState<DailySchedule | null>(
    null
  );
  const [draggedCellKey, setDraggedCellKey] = useState<string | null>(null); // Key of the cell being dragged
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null); // Key of the cell being hovered over

  // Filter dates based on selected view range
  const dateRange = useMemo(() => {
    if (!viewStartDate || !viewEndDate) return [];
    const start = new Date(
      viewStartDate.getFullYear(),
      viewStartDate.getMonth(),
      viewStartDate.getDate()
    );
    const end = new Date(
      viewEndDate.getFullYear(),
      viewEndDate.getMonth(),
      viewEndDate.getDate()
    );

    const datesInRange: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      datesInRange.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return datesInRange;
  }, [viewStartDate, viewEndDate]);

  // Group employees by their actual employment type from props
  const groups = useMemo(() => {
    return employmentTypes
      .map((empType) => ({
        groupName: empType.type || "Uncategorized",
        groupEmployees: employeesMap[empType.type] || [],
      }))
      .filter((group) => group.groupEmployees.length > 0); // Filter out types with no employees
  }, [employmentTypes, employeesMap]);

  const formatShift = (schedule: DailySchedule | null): string => {
    if (!schedule || schedule.isOff) return "OFF";
    if (schedule.timeIn && schedule.timeOut) {
      // Basic formatting, assumes HH:MM format
      const formatTime = (time: string) => {
        const [hour, minute] = time.split(":").map(Number);
        const period = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12AM/PM
        return `${hour12}${minute > 0 ? `:${String(minute).padStart(2, "0")}` : ""
          }${period}`;
      };
      return `${formatTime(schedule.timeIn)}-${formatTime(schedule.timeOut)}`;
    }
    return "-"; // Indicate missing data
  };

  const getShiftStyles = (schedule: DailySchedule | null): string => {
    if (!schedule || schedule.isOff) return "bg-gray-200 text-gray-500";

    if (schedule.timeIn && schedule.timeOut) {
      const shiftKey = `${schedule.timeIn}-${schedule.timeOut}`;
      // Use the getColor method from the imported map
      const colorClasses = globalColorMap.getColor(shiftKey);
      if (colorClasses) {
        return colorClasses; // Return the predefined Tailwind classes
      }
      // Fallback for shifts not explicitly in the map
      const startHour = parseInt(schedule.timeIn.split(":")[0], 10);
      if (startHour < 12) return "bg-blue-100 text-blue-800";
      if (startHour < 18) return "bg-green-100 text-green-800";
      return "bg-indigo-100 text-indigo-800";
    }

    return "bg-yellow-100 text-yellow-800"; // Fallback
  };

  const handleCellClick = (
    employeeId: string,
    date: Date,
    currentSchedule: DailySchedule | null
  ) => {
    const dateStr = date.toISOString().split("T")[0];
    setEditingCell({ employeeId, dateStr });
    setEditTimeIn(currentSchedule?.timeIn || "");
    setEditTimeOut(currentSchedule?.timeOut || "");
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const handleSaveEdit = async (
    typeId: string,
    employeeId: string,
    date: Date
  ) => {
    if (
      !editingCell ||
      editingCell.employeeId !== employeeId ||
      editingCell.dateStr !== date.toISOString().split("T")[0]
    )
      return;

    const newSchedule: DailySchedule = {
      timeIn: editTimeIn,
      timeOut: editTimeOut,
      isOff: !editTimeIn && !editTimeOut, // Mark as off if both are empty
    };
    try {
      await onUpdateSchedule(typeId, employeeId, date, newSchedule);
      setEditingCell(null); // Exit editing mode on success
    } catch (error) {
      console.error("Failed to save schedule update:", error);
      // Maybe show a toast error
    }
  };

  const handleMarkAsOff = async (
    typeId: string,
    employeeId: string,
    date: Date
  ) => {
    if (
      !editingCell ||
      editingCell.employeeId !== employeeId ||
      editingCell.dateStr !== date.toISOString().split("T")[0]
    )
      return;
    const newSchedule: DailySchedule = { timeIn: "", timeOut: "", isOff: true };
    try {
      await onUpdateSchedule(typeId, employeeId, date, newSchedule);
      setEditingCell(null); // Exit editing mode
    } catch (error) {
      console.error("Failed to mark as off:", error);
    }
  };

  // --- Drag and Drop Handlers ---

  const handleDragStart = (
    event: DragEvent<HTMLTableCellElement>,
    schedule: DailySchedule | null,
    cellKey: string
  ) => {
    // Allow dragging OFF or empty cells. Create an explicit OFF schedule if null.
    const scheduleToDrag = schedule ?? { timeIn: "", timeOut: "", isOff: true };

    event.dataTransfer.setData(
      "application/json/schedule",
      JSON.stringify(scheduleToDrag)
    );
    event.dataTransfer.effectAllowed = "copy";
    setDraggedSchedule(scheduleToDrag); // Store the potentially created OFF schedule
    setDraggedCellKey(cellKey);
    event.currentTarget.style.opacity = "0.5";
  };

  const handleDragOver = (event: DragEvent<HTMLTableCellElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (
    event: DragEvent<HTMLTableCellElement>,
    cellKey: string
  ) => {
    event.preventDefault();
    if (cellKey !== draggedCellKey) {
      setDropTargetKey(cellKey);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLTableCellElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDropTargetKey(null);
    }
  };

  const handleDrop = async (
    event: DragEvent<HTMLTableCellElement>,
    targetTypeId: string,
    targetEmployeeId: string,
    targetDate: Date
  ) => {
    event.preventDefault();
    const draggedDataString = event.dataTransfer.getData(
      "application/json/schedule"
    );
    setDropTargetKey(null);

    if (draggedDataString) {
      try {
        const droppedSchedule = JSON.parse(draggedDataString) as DailySchedule;
        await onUpdateSchedule(
          targetTypeId,
          targetEmployeeId,
          targetDate,
          droppedSchedule
        );
      } catch (error) {
        console.error("Failed to parse or apply dropped schedule:", error);
      }
    }
  };

  const handleDragEnd = (event: DragEvent<HTMLTableCellElement>) => {
    setDraggedSchedule(null);
    setDraggedCellKey(null);
    setDropTargetKey(null);
    event.currentTarget.style.opacity = "1";
  };

  const handlePrintSchedule = () => {
    console.log("Preparing schedule data for printing...");

    // Debug logs
    console.log("DEBUG: Web environment check:", isWebEnvironment());
    console.log("DEBUG: generateWebSchedulePdf imported:", typeof generateWebSchedulePdf);
    console.log("DEBUG: window.electron available:", typeof window.electron !== 'undefined');

    // Gather all necessary data - including the *filtered* date range
    const scheduleDataForPrint = {
      employmentTypes,
      employeesMap,
      allMonthSchedules,
      selectedMonth,
      // Send the currently displayed date range, not all dates
      dateRange, // Send the filtered array
    };

    // Check if dateRange is empty, maybe prevent printing?
    if (!dateRange || dateRange.length === 0) {
      toast.error("No dates selected in the view range to print.");
      return;
    }

    console.log("Schedule Data being sent:", scheduleDataForPrint);

    // Check if we're in web environment
    try {
      if (isWebEnvironment()) {
        console.log("DEBUG: Using web PDF generator");
        // Wrap in a try/catch to better isolate the error
        try {
          // Directly check if function exists
          if (typeof generateWebSchedulePdf !== 'function') {
            console.error("DEBUG: generateWebSchedulePdf is not a function:", generateWebSchedulePdf);
            throw new Error("PDF generator function not available");
          }

          // Log function details
          console.log("DEBUG: Function details:", {
            name: generateWebSchedulePdf.name,
            length: generateWebSchedulePdf.length,
            toString: generateWebSchedulePdf.toString().substring(0, 100) + "..."
          });

          // Use web PDF generator
          generateWebSchedulePdf(scheduleDataForPrint);
          toast.success("Schedule PDF generated and downloaded successfully!");
        } catch (webError) {
          console.error("DEBUG: Detailed web PDF error:", webError);

          // Try the fallback PDF generator
          console.log("DEBUG: Trying fallback PDF generator");
          const fallbackSuccess = generateFallbackPDF(scheduleDataForPrint);

          if (fallbackSuccess) {
            toast.success("Schedule PDF generated using fallback method");
          } else {
            toast.error("Failed to generate schedule PDF. Check console logs.");
          }
        }
      } else {
        console.log("DEBUG: Using Electron PDF generator");
        // Desktop environment - use Electron IPC
        window.electron
          .generateSchedulePdf(scheduleDataForPrint)
          .then((filePath: string | null) => {
            if (filePath) {
              console.log(`Schedule PDF saved to: ${filePath}`);
              // Use IPC to ask main process to open the path
              window.electron
                .openPath(filePath) // Use the exposed function
                .then(() => console.log(`Opened path: ${filePath}`))
                .catch((openErr: Error) =>
                  console.error(`Failed to open path ${filePath}:`, openErr)
                );
              toast.success("Schedule PDF Generated Successfully!");
            } else {
              console.log("Schedule PDF save was cancelled.");
            }
          })
          .catch((err: Error) => {
            console.error("Error generating schedule PDF:", err);
            toast.error("Failed to generate Schedule PDF. Check console logs.");
          });
      }
    } catch (error) {
      console.error("DEBUG: Fatal error in handlePrintSchedule:", error);
      toast.error("An unexpected error occurred with PDF generation");
    }
  };

  // Add new handlers that call the props
  const handleLocalStartDateChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newDate = new Date(e.target.value + "T00:00:00"); // Adjust for timezone
    if (!isNaN(newDate.getTime())) {
      onStartDateChange(newDate);
    }
  };

  const handleLocalEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value + "T00:00:00"); // Adjust for timezone
    if (!isNaN(newDate.getTime())) {
      onEndDateChange(newDate);
    }
  };

  // Helper to format Date to YYYY-MM-DD for input value
  const formatDateForInput = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200/50 shadow-sm flex flex-col justify-center items-center h-96 min-h-[300px]">
        <div className="relative w-20 h-20 mb-6"> {/* Icon container */}
          {/* Pulsating ring (standard animate-ping) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-full rounded-full bg-blue-400 opacity-75 animate-ping"></div>
          </div>

          {/* Spinner icon container with gradient background */}
          <div className="relative z-10 bg-white rounded-full p-3 border border-gray-200 flex items-center justify-center w-full h-full shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-full opacity-50"></div>
            <svg
              className="animate-spin h-10 w-10 text-blue-600 relative z-10" // Spinner SVG
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>

        {/* Text messages */}
        <p className="text-xl font-semibold text-gray-700">Loading Roster Data</p>
        <p className="text-md text-gray-500 mt-2">Please wait while we fetch the schedule...</p>
      </div>
    );
  }

  return (
    <div className="">
      <div className=" flex justify-between items-center mb-4 px-1 py-2   ">
        <h4 className="text-lg font-semibold text-gray-800">
          Duty Roster -{" "}
          {viewStartDate.toLocaleString("default", {
            month: "short",
            day: "numeric",
          })}{" "}
          -{" "}
          {viewEndDate.toLocaleString("default", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </h4>
        <div className="flex items-center gap-2">
          {/* Date Range Inputs */}
          <span className="text-sm text-gray-600 mr-1">View Range:</span>
          {/* Previous Button */}
          <button
            onClick={onPreviousRange}
            title="Previous Period"
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed h-8"
          >
            <IoChevronBack className="w-4 h-4" />
          </button>
          {/* Start Date Input */}
          <input
            type="date"
            value={formatDateForInput(viewStartDate)}
            onChange={handleLocalStartDateChange}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-8 w-32"
          />
          <span className="text-sm text-gray-600">to</span>
          {/* End Date Input */}
          <input
            type="date"
            value={formatDateForInput(viewEndDate)}
            onChange={handleLocalEndDateChange}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 h-8 w-32"
          />
          {/* Next Button */}
          <button
            onClick={onNextRange}
            title="Next Period"
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed h-8"
          >
            <IoChevronForward className="w-4 h-4" />
          </button>

          {/* Separator */}
          <div className="border-l border-gray-300 h-6 mx-2"></div>

          {/* Copy Button */}
          <button
            onClick={onCopyRange}
            title="Copy Visible Range Schedule"
            className="p-1.5 rounded-md text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors h-8"
          >
            <IoCopyOutline className="w-5 h-5" />
          </button>

          {/* Paste Button */}
          <button
            onClick={onPasteRange}
            title="Paste Copied Schedule to Current Start Date"
            disabled={!isPasteAvailable}
            className="p-1.5 rounded-md text-gray-500 hover:bg-green-100 hover:text-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-8"
          >
            <IoClipboardOutline className="w-5 h-5" />
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrintSchedule}
            title="Print Schedule to PDF"
            className="ml-2 p-1.5 rounded-md text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-8"
          >
            <IoPrintOutline className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Table Container */}
      <div ref={scrollContainerRef} className="overflow-x-auto scrollbar-thin">
        <div className="min-w-max overflow-hidden rounded-lg border border-gray-300">
          {groups.length > 0 && dateRange.length > 0 ? (
            <table className="w-full border-collapse ">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b border-gray-300 p-2 font-medium text-sm text-gray-700 w-40 sticky left-0 bg-gray-100 z-10">
                    NAME / TYPE
                  </th>
                  {dateRange.map((date, index) => (
                    <th
                      key={date.toISOString()}
                      className={`border-b border-gray-300 p-1 font-medium text-xs text-gray-600 min-w-[60px] ${index > 0 ? "border-l" : ""
                        }`}
                    >
                      <div>{date.getDate()}</div>
                      <div className="text-xs font-normal">
                        {daysOfWeek[date.getDay()]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(({ groupName, groupEmployees }) => (
                  <React.Fragment key={groupName}>
                    {groupEmployees.map((employee, rowIndex) => (
                      <tr
                        key={employee.id}
                        className={`hover:bg-gray-50 h-10 ${rowIndex > 0 ? "border-t border-gray-300" : ""
                          }`}
                      >
                        <td className="border-r border-gray-300 p-2 text-sm font-medium text-gray-800 sticky left-0 bg-white group-hover:bg-gray-50 z-10 whitespace-nowrap">
                          {employee.name}
                          <span className="text-xs text-gray-500 ml-2">
                            / {groupName.toUpperCase()}
                          </span>
                        </td>
                        {dateRange.map((date, colIndex) => {
                          const dateStr = date.toISOString().split("T")[0];
                          const cellKey = `${employee.id}-${dateStr}`;
                          const isEditing =
                            editingCell?.employeeId === employee.id &&
                            editingCell?.dateStr === dateStr;
                          const schedule =
                            allMonthSchedules[groupName]?.[dateStr] || null;
                          const shiftText = formatShift(schedule);
                          const styles = getShiftStyles(schedule);
                          const isDropTarget = dropTargetKey === cellKey;

                          return (
                            <td
                              key={dateStr}
                              className={`text-xs text-center relative ${styles} ${isEditing
                                ? "p-0.5"
                                : "p-0 font-mono cursor-grab"
                                } ${isDropTarget
                                  ? "ring-2 ring-blue-500 ring-inset"
                                  : ""
                                } border-l border-gray-300`}
                              style={{ minHeight: "2.5rem" }}
                              onClick={() =>
                                !isEditing &&
                                handleCellClick(employee.id, date, schedule)
                              }
                              draggable={!isEditing}
                              onDragStart={(e) =>
                                handleDragStart(e, schedule, cellKey)
                              }
                              onDragOver={handleDragOver}
                              onDrop={(e) =>
                                handleDrop(e, groupName, employee.id, date)
                              }
                              onDragEnter={(e) => handleDragEnter(e, cellKey)}
                              onDragLeave={handleDragLeave}
                              onDragEnd={handleDragEnd}
                            >
                              {isEditing ? (
                                <div className="flex flex-col items-center justify-center h-full w-full gap-0.5 bg-white bg-opacity-90 rounded-sm">
                                  <div className="flex gap-1 w-full px-0.5">
                                    <input
                                      type="time"
                                      value={editTimeIn}
                                      onChange={(e) =>
                                        setEditTimeIn(e.target.value)
                                      }
                                      className="w-full text-xs border border-gray-300 rounded px-1 py-0 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                    <input
                                      type="time"
                                      value={editTimeOut}
                                      onChange={(e) =>
                                        setEditTimeOut(e.target.value)
                                      }
                                      className="w-full text-xs border border-gray-300 rounded px-1 py-0 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div className="flex justify-center gap-1 w-full">
                                    <button
                                      title="Save Changes"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveEdit(
                                          groupName,
                                          employee.id,
                                          date
                                        );
                                      }}
                                      className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                    >
                                      <IoCheckmark className="w-3 h-3" />
                                    </button>
                                    <button
                                      title="Mark as OFF"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkAsOff(
                                          groupName,
                                          employee.id,
                                          date
                                        );
                                      }}
                                      className="p-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                    >
                                      <IoBan className="w-3 h-3" />
                                    </button>
                                    <button
                                      title="Cancel Edit"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit();
                                      }}
                                      className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                    >
                                      <IoClose className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                shiftText
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-6 px-4 border border-dashed border-gray-300 rounded-lg flex flex-col items-center">
              {isLoading ? (
                <p>Loading Roster Data...</p>
              ) : dateRange.length === 0 ? (
                <>
                  <IoInformationCircleOutline className="w-8 h-8 text-gray-400 mb-2" />
                  <p>Invalid date range selected.</p>
                  <p className="text-xs">
                    Please select a valid start and end date.
                  </p>
                </>
              ) : (
                <>
                  <IoInformationCircleOutline className="w-8 h-8 text-gray-400 mb-2" />
                  <p>No employees found for the current employment types.</p>
                  <p className="text-xs">
                    Ensure employees are assigned to types in the Employees
                    section.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RosterSchedule;
