/**
 * This file provides mock modules that replace problematic dependencies in web mode
 * It helps us avoid CSS loader issues in Next.js 14.2.26
 */
import React from "react";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

// No direct imports of react-datepicker
// Everything is loaded dynamically at runtime

// Create a simple date input component as a replacement for react-datepicker
interface SimpleDatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  startDate?: Date | null;
  endDate?: Date | null;
  minDate?: Date | null;
  selectsStart?: boolean;
  selectsEnd?: boolean;
  showPopperArrow?: boolean;
  className?: string;
  placeholderText?: string;
  dateFormat?: string;
  open?: boolean;
  onCalendarOpen?: () => void;
  onCalendarClose?: () => void;
  customInput?: React.ReactElement;
  [key: string]: any; // For any other props we haven't explicitly listed
}

const SimpleDatePicker: React.FC<SimpleDatePickerProps> = ({
  selected,
  onChange,
  className,
  placeholderText,
  customInput,
  minDate,
  ...props
}) => {
  // Format the date for the input
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return "";
    try {
      // Accept Date, string, or number
      const d = date instanceof Date ? date : new Date(date as any);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  // Handle date change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const date = e.target.value ? new Date(e.target.value) : null;
      onChange(date);
    } catch (error) {
      console.error("Error handling date change:", error);
    }
  };

  // If a custom input is provided, clone it with our props
  if (customInput) {
    // We use the provided custom input but attach a click handler
    // that will show our native date input when clicked
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleCustomInputClick = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.click();
      }
    };

    return (
      <div className="relative" onClick={handleCustomInputClick}>
        {React.cloneElement(customInput, { onClick: handleCustomInputClick })}
        <input
          ref={inputRef}
          type="date"
          value={formatDateForInput(selected)}
          onChange={handleChange}
          className={`absolute opacity-0 inset-0 w-full h-full cursor-pointer ${className || ""
            }`}
          placeholder={placeholderText}
          min={minDate ? formatDateForInput(minDate) : undefined}
        />
      </div>
    );
  }

  // Default input if no custom input is provided
  return (
    <input
      type="date"
      value={formatDateForInput(selected)}
      onChange={handleChange}
      className={className}
      placeholder={placeholderText}
      min={minDate ? formatDateForInput(minDate) : undefined}
    />
  );
};

// Cache for the real DatePicker
let realDatePicker: any = null;

export const getReactDatepicker = () => {
  // For web mode, always use the simple implementation
  if (isWebEnvironment()) {
    return {
      default: SimpleDatePicker,
    };
  }

  // For Nextron mode, dynamically load the real component at runtime
  if (!isWebEnvironment() && typeof window !== "undefined") {
    // Use a cache to avoid multiple initialization
    if (!realDatePicker) {
      try {
        // Dynamically load the module without webpack knowing
        // @ts-ignore
        const DatePickerModule = Function(
          'return require("react-datepicker")'
        )();
        realDatePicker = {
          default: DatePickerModule.default || DatePickerModule,
        };
        console.log("Successfully loaded real react-datepicker");
      } catch (err) {
        console.error("Error loading real DatePicker:", err);
        // Fallback to our simple implementation
        realDatePicker = {
          default: SimpleDatePicker,
        };
      }
    }
    return realDatePicker;
  }

  // Default fallback for server-side rendering
  return {
    default: SimpleDatePicker,
  };
};
