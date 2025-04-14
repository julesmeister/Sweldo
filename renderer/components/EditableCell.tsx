import React, { useState, useEffect, useRef } from "react";
import { EmploymentType } from "@/renderer/model/settings";
import { FaCheck, FaSun, FaMoon, FaTimes } from "react-icons/fa"; // Added moon icon for evening times and times icon
import { BsFillSunsetFill } from "react-icons/bs"; // Added sunset icon for afternoon
import { toast } from "sonner";

interface EditableCellProps {
  value: string | number | null;
  column: {
    key: string;
    name: string;
  };
  rowData: any;
  onClick?: (event: React.MouseEvent) => void;
  onSave: (value: string | number, rowData: any) => Promise<void>;
  employmentTypes?: EmploymentType[];
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
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState<string>(value?.toString() || "");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tdRef = useRef<HTMLTableCellElement>(null);
  const [localValue, setLocalValue] = useState<string | number | null>(value);
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">(
    "bottom"
  );

  useEffect(() => {
    setEditValue(value?.toString() || "");
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();

      // Determine dropdown position based on cell position
      const tdRect = tdRef.current?.getBoundingClientRect();
      if (tdRect) {
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - tdRect.bottom;
        setDropdownPosition(spaceBelow < 200 ? "top" : "bottom");
      }
    }
  }, [isEditing]);

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
      onClick(event);
    }
    if (isHovered) {
      setIsEditing(true);
      if (column.key === "timeIn" || column.key === "timeOut") {
        setShowAlternatives(true);
      }
    }
  };

  const handleSave = async () => {
    if (!isEditing) return;

    try {
      await onSave(editValue || "", rowData);
      setIsEditing(false);
      setIsHovered(false);
      setShowAlternatives(false);
      setLocalValue(editValue);
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save changes");
      setEditValue(localValue?.toString() || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setIsHovered(false);
      setShowAlternatives(false);
      setLocalValue(value);
      setEditValue(value?.toString() || "");
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

  const handleCancel = () => {
    setIsEditing(false);
    setIsHovered(false);
    setShowAlternatives(false);
    setEditValue(localValue?.toString() || "");
  };

  const renderTimeOptions = () => {
    if (!rowData.alternativeTimeIns || rowData.alternativeTimeIns.length === 0)
      return null;

    const timesByCategory = rowData.alternativeTimeIns.reduce(
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
                            : "hover:bg-white/80 text-gray-700 hover:shadow-sm"
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

          <div className="grid grid-rows-2 gap-2 pl-2 border-l border-gray-200 w-[100px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSave();
              }}
              className="flex flex-col items-center justify-center gap-1 p-4 bg-gray-50 hover:bg-green-50 text-gray-700 hover:text-green-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-green-200"
            >
              <FaCheck className="w-5 h-5" />
              <span className="font-medium text-sm">Save</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="flex flex-col items-center justify-center gap-1 p-4 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-lg transition-all duration-150 border-2 border-transparent hover:border-red-200"
            >
              <FaTimes className="w-4 h-4" />
              <span className="font-medium text-sm">Cancel</span>
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
