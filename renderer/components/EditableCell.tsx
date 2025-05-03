import React, { useState, useEffect, useRef } from "react";
import { EmploymentType } from "@/renderer/model/settings";
import { FaCheck, FaSun, FaMoon, FaTimes, FaEraser } from "react-icons/fa"; // Added moon icon for evening times and times icon
import { BsFillSunsetFill } from "react-icons/bs"; // Added sunset icon for afternoon
import { toast } from "sonner";
import { createAttendanceModel } from "@/renderer/model/attendance"; // Import model factory

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
  // Remove internal isEditing state
  // const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState<string>(value?.toString() || "");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [loadedAlternatives, setLoadedAlternatives] = useState<string[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tdRef = useRef<HTMLTableCellElement>(null);
  const [localValue, setLocalValue] = useState<string | number | null>(value);
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">(
    "bottom"
  );
  const cellKey = `${column.key}-${rowData?.day}`; // Calculate cellKey for callbacks

  // Update editValue when external value changes (e.g., parent resets)
  useEffect(() => {
    setEditValue(value?.toString() || "");
    setLocalValue(value);
  }, [value]);

  // Focus input and load alternatives when isEditing prop becomes true
  useEffect(() => {
    if (isEditing) {
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
      // Load alternatives if it's a time column
      const isTimeColumn = column.key === "timeIn" || column.key === "timeOut";
      if (isTimeColumn && dbPath && rowData?.employeeId) {
        const loadAlts = async () => {
          setIsLoadingAlternatives(true);
          setShowAlternatives(true); // Show container (might show loading)
          try {
            const model = createAttendanceModel(dbPath);
            const times = await model.loadAlternativeTimes(rowData.employeeId);
            setLoadedAlternatives(times);
          } catch (error) {
            console.error("Error loading alternative times:", error);
            toast.error("Could not load time suggestions.");
            setLoadedAlternatives([]);
          } finally {
            setIsLoadingAlternatives(false);
          }
        };
        loadAlts();
      } else {
        setShowAlternatives(false);
      }
    } else {
      // Reset alternatives when editing stops
      setShowAlternatives(false);
      setLoadedAlternatives([]);
      setIsLoadingAlternatives(false);
      // Also reset editValue to potentially original value if parent controls it
      setEditValue(value?.toString() || "");
      setLocalValue(value);
    }
  }, [isEditing, dbPath, rowData?.employeeId, column.key, value]); // Dependencies for the effect

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (!isEditing) {
      setIsHovered(false);
    }
  };

  const handleClick = (event: React.MouseEvent) => {
    if (onClick) {
      onClick(event); // Propagate original click if needed
    }
    // If not already editing, call the parent handler to request edit start
    if (!isEditing) {
      onStartEdit(cellKey);
      event.stopPropagation();
    }
  };

  const handleInternalSave = async () => {
    try {
      await onSave(editValue || "", rowData);
      setLocalValue(editValue);
      onStopEdit(); // Notify parent that editing stopped
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save changes");
      // Don't call onStopEdit on error? Or maybe do? Depends on desired UX.
      // For now, keep editing on error.
      // Revert editValue if needed (or rely on parent to reset via `value` prop)
      // setEditValue(localValue?.toString() || "");
    }
  };

  const handleInternalCancel = () => {
    setEditValue(value?.toString() || ""); // Revert to original value prop
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

  const getTimeValidation = () => {
    if (column.key === "timeIn" || column.key === "timeOut") {
      const employmentType = employmentTypes.find(
        (type) => type.type === rowData.employmentType
      );
      if (employmentType) {
        return {
          type: "time",
          min: "00:00",
          max: "23:59",
          step: 300, // 5 minutes
        };
      }
    }
    return {};
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

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Immediately update local input state
    setEditValue("");
    // Trigger the save process with the cleared value
    try {
      await onSave("", rowData); // Use the main onSave prop
      setLocalValue(""); // Update local display value on success
      onStopEdit(); // Notify parent editing is done
    } catch (error) {
      console.error("Error clearing:", error);
      toast.error("Failed to clear value");
      // Revert editValue if save fails?
      // setEditValue(localValue?.toString() || "");
    }
  };

  const renderTimeOptions = () => {
    if (isLoadingAlternatives) {
      return (
        <div className="absolute left-0 w-full p-4 text-center text-sm text-gray-500 bg-white border rounded shadow-lg z-50">
          Loading suggestions...
        </div>
      );
    }
    if (!Array.isArray(loadedAlternatives) || loadedAlternatives.length === 0) {
      return (
        <div className="absolute left-0 w-full p-4 text-center text-sm text-gray-500 bg-white border rounded shadow-lg z-50">
          No time suggestions available.
        </div>
      );
    }
    const timesByCategory = loadedAlternatives.reduce(
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
        className={`absolute ${
          dropdownPosition === "bottom" ? "top-full" : "bottom-full"
        } left-0 bg-white border rounded-lg shadow-lg z-50 p-2 mt-1`}
      >
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
                  <div className="grid grid-cols-2 gap-1">
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
                               ${
                                 editValue === time
                                   ? "bg-blue-100 text-blue-700 font-medium shadow-sm"
                                   : "hover:bg-gray-100 text-gray-700 hover:shadow-sm"
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
            className={`grid ${
              onSwapTimes ? "grid-rows-4" : "grid-rows-3"
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
              <span className="font-medium text-xs leading-tight">Save</span>
            </button>
            {onSwapTimes && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await onSwapTimes(rowData);
                    onStopEdit(); // Close dropdown after swap
                    toast.success("Time In/Out swapped successfully.");
                  } catch (swapError) {
                    console.error("Error swapping times:", swapError);
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
                <span className="font-medium text-xs leading-tight">Swap</span>
              </button>
            )}
            <button
              onClick={handleClear}
              className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 hover:bg-yellow-50 text-gray-700 hover:text-yellow-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-yellow-200"
            >
              <FaEraser className="w-4 h-4" />
              <span className="font-medium text-xs leading-tight">Clear</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleInternalCancel();
              }}
              className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-red-200"
            >
              <FaTimes className="w-4 h-4" />
              <span className="font-medium text-xs leading-tight">Cancel</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <td
      ref={tdRef}
      className={`${
        column.key === "day" ? "sticky left-0 z-10 bg-white" : ""
      } px-6 py-4 whitespace-nowrap text-sm ${
        column.key === "day" ? "font-medium text-gray-900" : "text-gray-500"
      } relative group cursor-pointer transition-colors duration-200 ${
        isHovered ? "bg-gray-50" : ""
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {isEditing ? (
        <div className="flex flex-col relative">
          <div className="flex items-center">
            <input
              ref={inputRef}
              type={column.key.toLowerCase().includes("time") ? "time" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full p-1 border rounded bg-white"
              {...getTimeValidation()}
            />
          </div>
          {showAlternatives && renderTimeOptions()}
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
