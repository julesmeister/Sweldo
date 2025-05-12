import React, { useState, useEffect, useRef, useMemo } from "react";
import { EmploymentType } from "@/renderer/model/settings";
import { FaCheck, FaSun, FaMoon, FaTimes, FaEraser, FaSpinner } from "react-icons/fa"; // Added FaSpinner for loading
import { BsFillSunsetFill } from "react-icons/bs"; // Added sunset icon for afternoon
import { toast } from "sonner";
import { createAttendanceModel } from "@/renderer/model/attendance"; // Import model factory
import { isWebEnvironment } from "@/renderer/lib/firestoreService"; // Import to detect web mode

interface EditableCellProps {
  value: string | number | null;
  column: {
    key: string;
    name: string;
  };
  rowData: any; // Contains employeeId needed for loading alternatives
  onClick?: (event: React.MouseEvent) => void; // Propagate original click if needed
  onSave: (value: string | number, rowData: any) => Promise<void>;
  employmentTypes?: EmploymentType[];
  dbPath: string; // Added dbPath prop
  // Props for single edit mode controlled by parent
  isEditing: boolean;
  onStartEdit: (cellKey: string) => void;
  onStopEdit: () => void;
  onSwapTimes?: (rowData: any) => Promise<void>; // Add optional swap handler prop
}

const getTimeCategory = (time: string): "morning" | "afternoon" | "evening" => {
  const hour = parseInt(time.split(":")[0]);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
};

const getTimeColor = (time: string): string => {
  const category = getTimeCategory(time);
  switch (category) {
    case "morning":
      return "bg-yellow-100 hover:bg-yellow-200 border-yellow-300";
    case "afternoon":
      return "bg-orange-100 hover:bg-orange-200 border-orange-300";
    case "evening":
      return "bg-blue-100 hover:bg-blue-200 border-blue-300";
    default:
      return "bg-gray-100 hover:bg-gray-200 border-gray-300";
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "morning":
      return <FaSun className="text-yellow-500 w-3 h-3" />;
    case "afternoon":
      return <BsFillSunsetFill className="text-orange-500 w-3 h-3" />;
    case "evening":
      return <FaMoon className="text-blue-500 w-3 h-3" />;
    default:
      return null;
  }
};

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  column,
  rowData,
  onClick,
  onSave,
  employmentTypes = [],
  dbPath,
  // Destructure new props
  isEditing,
  onStartEdit,
  onStopEdit,
  onSwapTimes, // Destructure new prop
}) => {
  // Check if we're in web mode
  const isWebMode = useMemo(() => isWebEnvironment(), []);

  // Remove internal isEditing state
  // const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState<string>(value?.toString() || "");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [loadedAlternatives, setLoadedAlternatives] = useState<string[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // New state for save operations
  const inputRef = useRef<HTMLInputElement>(null);
  const tdRef = useRef<HTMLTableCellElement>(null);
  const [localValue, setLocalValue] = useState<string | number | null>(value);
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">(
    "bottom"
  );
  const cellKey = `${column.key}-${rowData?.day}`;
  // console.log(`EditableCell [${cellKey}]: Initial render. isEditing prop: ${isEditing}, value: ${value}`);

  // Update editValue when external value changes (e.g., parent resets)
  useEffect(() => {
    setEditValue(value?.toString() || "");
    setLocalValue(value);
  }, [value]);

  // Focus input and load alternatives when isEditing prop becomes true
  useEffect(() => {
    // console.log(`EditableCell [${cellKey}]: isEditing effect. Current isEditing: ${isEditing}`);
    if (isEditing) {
      // console.log(`EditableCell [${cellKey}]: Entering edit mode.`);
      if (inputRef.current) {
        inputRef.current.focus();
      }
      // Determine dropdown position
      const tdRect = tdRef.current?.getBoundingClientRect();
      if (tdRect) {
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - tdRect.bottom;
        setDropdownPosition(spaceBelow < 200 ? "top" : "bottom");
      }
      // Always show the dropdown with common times in web mode, even if there are no alternatives 
      if (isWebMode && isEditing) {
        // console.log("[EditableCell-Web] Showing default time options in web mode");
        setShowAlternatives(true); // Show the dropdown container
        // No need to explicitly load alternatives if web mode is just showing common times by default here
      }
      // Load alternatives if it's a time column
      const isTimeColumn = column.key === "timeIn" || column.key === "timeOut";
      if (isTimeColumn &&
        // Only require dbPath in non-web mode, but always require the other fields
        (isWebMode || dbPath) &&
        rowData?.employeeId &&
        typeof rowData?.year === 'number' &&
        typeof rowData?.month === 'number') {
        const loadAlts = async () => {
          setIsLoadingAlternatives(true);
          setShowAlternatives(true); // Show container (might show loading)
          try {
            if (isWebMode) {
              // console.log(`[EditableCell-Web] Loading alternatives for ${rowData.employeeId} ${rowData.year}-${rowData.month}`);
            }
            const model = createAttendanceModel(isWebMode ? "" : dbPath || "");
            // Use year and month from rowData
            const alts = await model.loadAlternativeTimes(
              rowData.employeeId,
              rowData.year,
              rowData.month
            );
            if (isWebMode) {
              // console.log("[EditableCell-Web] Loaded", alts.length, "alternatives");
            }
            setLoadedAlternatives(alts);
          } catch (error) {
            // console.error("Error loading alternative times:", error);
            if (isWebMode) {
              console.error(`[EditableCell-Web] Error loading alternatives:`, error);
            }
            toast.error("Could not load time suggestions.");
            setLoadedAlternatives([]);
          } finally {
            setIsLoadingAlternatives(false);
          }
        };
        loadAlts();
      } else {
        if (isTimeColumn) {
          console.warn("EditableCell: Not loading alternatives. Missing dbPath, employeeId, year, or month in rowData.",
            { dbPath, employeeId: rowData?.employeeId, year: rowData?.year, month: rowData?.month, isWebMode });
        }
        setShowAlternatives(false);
      }
    } else {
      // console.log(`EditableCell [${cellKey}]: Exiting edit mode.`);
      // Reset alternatives when editing stops
      setShowAlternatives(false);
      setLoadedAlternatives([]);
      setIsLoadingAlternatives(false);
      // Also reset editValue to potentially original value if parent controls it
      setEditValue(value?.toString() || "");
      setLocalValue(value);
    }
  }, [isEditing, dbPath, rowData?.employeeId, rowData?.year, rowData?.month, column.key, value, cellKey, isWebMode]); // Dependencies for the effect

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (!isEditing) {
      setIsHovered(false);
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    // console.log(`EditableCell [${cellKey}]: handleClick. Current isEditing: ${isEditing}. Target:`, event.target);

    // Always stop event propagation to prevent row click handler from firing
    event.stopPropagation();

    // If already editing, handle clicks differently
    if (isEditing) {
      if (event.target === inputRef.current) {
        // console.log(`EditableCell [${cellKey}]: Click target is the input ref while editing, just focusing.`);
        inputRef.current?.focus();
        return;
      }
      // Clicks elsewhere in the cell while editing should not trigger any action
      // console.log(`EditableCell [${cellKey}]: Already in edit mode.`);
      return;
    }

    // If not editing, notify parent component to start editing
    // console.log(`EditableCell [${cellKey}]: Not editing, calling onStartEdit.`);
    if (onStartEdit) {
      onStartEdit(cellKey);
    }

    // Call optional onClick callback
    if (onClick) {
      onClick(event);
    }
  };

  const handleInternalSave = async () => {
    console.log(`EditableCell [${cellKey}]: handleInternalSave triggered. Value: ${editValue}`);
    setIsSaving(true); // Set saving state to true
    setShowAlternatives(false); // Hide alternatives while saving
    try {
      await onSave(editValue || "", rowData);
      setLocalValue(editValue);
      setIsHovered(false); // Reset hover state after successful save
      onStopEdit(); // Notify parent that editing stopped
    } catch (error) {
      console.error(`EditableCell [${cellKey}]: Error in handleInternalSave:`, error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false); // Reset saving state
    }
  };

  const handleInternalCancel = () => {
    setEditValue(value?.toString() || ""); // Revert to original value prop
    setIsHovered(false); // Reset hover state when cancelling edit
    onStopEdit(); // Notify parent that editing stopped
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInternalSave();
    } else if (e.key === "Escape") {
      handleInternalCancel();
    }
  };

  const handleAlternativeClick = (time: string) => {
    setEditValue(time);
  };

  // Memoize the time validation object
  const timeValidationProps = useMemo(() => {
    if (column.key === "timeIn" || column.key === "timeOut") {
      // Find employmentType based on rowData, not the whole array
      const employmentType = employmentTypes.find(
        (type) =>
          type.type.toLowerCase() === rowData?.employmentType?.toLowerCase()
      );
      if (employmentType?.requiresTimeTracking) {
        // Check requiresTimeTracking
        return {
          type: "time",
          min: "00:00",
          max: "23:59",
          step: 300, // 5 minutes
        };
      }
    }
    return {}; // Return empty object if not a time column or no tracking
  }, [column.key, rowData?.employmentType, employmentTypes]); // Dependencies

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

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Immediately update local input state
    setEditValue("");
    // Trigger the save process with the cleared value
    try {
      await onSave("", rowData); // Use the main onSave prop
      setLocalValue(""); // Update local display value on success
      setIsHovered(false); // Reset hover state after clearing value
      onStopEdit(); // Notify parent editing is done
    } catch (error) {
      // console.error("Error clearing:", error);
      toast.error("Failed to clear value");
      // Revert editValue if save fails?
      // setEditValue(localValue?.toString() || "");
    }
  };

  const renderTimeOptions = () => {
    if (isLoadingAlternatives) {
      return (
        <div
          className="absolute left-0 w-full min-w-[200px] p-3 text-center text-sm bg-white border rounded-lg shadow-lg z-[9999] flex flex-col items-center justify-center gap-2"
          style={{
            position: 'absolute',
            zIndex: 9999,
            isolation: 'isolate',
            height: '80px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            borderColor: '#e2e8f0',
            background: 'linear-gradient(to bottom, #ffffff, #f9fafb)'
          }}>
          <FaSpinner className="text-blue-500 w-5 h-5 animate-spin" />
          <span className="text-gray-600 font-medium">Loading suggestions...</span>
        </div>
      );
    }

    // Generate default times when no alternatives are available
    let timesToDisplay = loadedAlternatives;
    if (!Array.isArray(loadedAlternatives) || loadedAlternatives.length === 0) {
      // Generate common work times - more selective approach
      timesToDisplay = [
        // Morning times (start times)
        "05:00", "05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
        "10:00", "10:30", "11:00", "11:30",
        // Afternoon times (lunch and afternoon)
        "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30",
        // Evening times (overtime and end times)
        "18:00", "18:30", "19:00", "19:30", "20:00", "21:00", "22:00", "23:00"
      ];

      // If this is a timeOut column, add a few minutes after common start times
      if (column.key === "timeOut") {
        timesToDisplay = [
          "12:00", "12:30", "13:00", "14:00", "15:00", "16:00", "16:30", "17:00", "17:30",
          "18:00", "18:30", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"
        ];
      }
    }

    const timesByCategory = timesToDisplay.reduce(
      (acc: any, time: string) => {
        const category = getTimeCategory(time);
        if (!acc[category]) acc[category] = [];
        acc[category].push(time);
        return acc;
      },
      {}
    );

    return (
      <div
        className={`absolute ${dropdownPosition === "bottom" ? "top-full" : "bottom-full"
          } left-0 bg-white border rounded-lg shadow-lg z-[9999] p-2 mt-1`}
        style={{
          position: 'absolute',
          zIndex: 9999,
          // Ensure the position is correct and visible
          width: 'auto',
          minWidth: '550px',
          // Force the dropdown to the top layer in web mode
          isolation: 'isolate',
          // Add extra styles specifically for web mode
          ...(isWebMode ? {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
          } : {})
        }}
      >
        {(!Array.isArray(loadedAlternatives) || loadedAlternatives.length === 0) && (
          <div className="px-2 py-1 mb-1 text-xs text-gray-500 border-b border-gray-200">
            Select from common times below. Your selections will be saved for future use.
          </div>
        )}
        <div className="flex gap-2">
          <div className="grid grid-cols-3 gap-2 min-w-[450px]">
            {Object.entries(timesByCategory).map(
              ([category, times]: [string, any]) => (
                <div key={category} className="bg-gray-50/50 rounded-lg p-2">
                  <div className="flex items-center mb-2 pb-1 border-b border-gray-200">
                    {getCategoryIcon(category)}
                    <span className="text-[11px] font-medium text-gray-600 uppercase ml-1.5">
                      {category}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-[220px] overflow-y-auto scrollbar-thin">
                    {times.map((time: string, index: number) => (
                      <button
                        key={index}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAlternativeClick(time);
                        }}
                        className={`
                               px-2.5 py-1.5 text-xs rounded
                               transition-all duration-150
                               ${editValue === time
                            ? "bg-blue-100 text-blue-700 font-medium shadow-sm"
                            : "hover:bg-gray-300 text-gray-900 hover:shadow-sm"
                          }
                             `}
                      >
                        {formatTime(time)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
          <div
            className={`grid ${onSwapTimes ? "grid-rows-4" : "grid-rows-3"
              } gap-2 pl-2 border-l border-gray-200 w-[100px]`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleInternalSave();
              }}
              className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 hover:bg-green-50 text-gray-700 hover:text-green-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-green-200"
            >
              <FaCheck className="w-4 h-4" />
              <span className="font-medium text-sm leading-tight">Save</span>
            </button>
            {onSwapTimes && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await onSwapTimes(rowData);
                    setIsHovered(false); // Reset hover state after swapping
                    onStopEdit(); // Close dropdown after swap
                    toast.success("Time In/Out swapped successfully.");
                  } catch (swapError) {
                    // console.error("Error swapping times:", swapError);
                    toast.error("Failed to swap times.");
                  }
                }}
                className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-blue-200"
                title="Swap Time In and Time Out for this day"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  ></path>
                </svg>
                <span className="font-medium text-sm leading-tight">Swap</span>
              </button>
            )}
            <button
              onClick={handleClear}
              className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 hover:bg-yellow-50 text-gray-700 hover:text-yellow-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-yellow-200"
            >
              <FaEraser className="w-4 h-4" />
              <span className="font-medium text-sm leading-tight">Clear</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleInternalCancel();
              }}
              className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-red-200"
            >
              <FaTimes className="w-4 h-4" />
              <span className="font-medium text-sm leading-tight">Cancel</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <td
      ref={tdRef}
      className={`${column.key === "day" ? "sticky left-0 z-10 bg-white" : ""
        } px-6 py-4 whitespace-nowrap text-sm ${column.key === "day" ? "font-medium text-gray-900" : "text-gray-500"
        } relative group cursor-pointer transition-colors duration-200 ${isHovered ? "bg-gray-50" : ""
        } editable-cell-container`}
      style={{
        position: 'relative', // Ensure positioning context is properly established
        ...(isWebMode && isEditing ? { overflow: 'visible' } : {}), // Prevent clipping in web mode
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <>
        {(() => {
          // console.log(`EditableCell [${cellKey}]: RENDERING. isEditing: ${isEditing}`);
          return null;
        })()}
      </>
      {isEditing ? (
        <div className="flex flex-col relative" style={{ position: 'relative' }}>
          <div className="flex items-center">
            {isSaving ? (
              <div className="w-full p-2 flex items-center justify-center gap-2 border rounded bg-blue-50 text-blue-600">
                <FaSpinner className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Saving...</span>
              </div>
            ) : (
              <input
                ref={inputRef}
                type={timeValidationProps.type || "text"} // Use memoized type or default to text
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-1 border rounded bg-white"
                {...timeValidationProps} // Spread memoized validation props
              />
            )}
          </div>
          {showAlternatives && !isSaving && renderTimeOptions()}
        </div>
      ) : (
        <>
          <span>
            {column.key.includes("time")
              ? formatTime(localValue as string)
              : localValue || "-"}
          </span>
          {isHovered && !isEditing && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-600 bg-opacity-75 transition-opacity">
              <span className="text-xs text-white">Click to edit</span>
            </div>
          )}
        </>
      )}
    </td>
  );
};
