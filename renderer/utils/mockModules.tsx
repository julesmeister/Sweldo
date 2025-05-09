/**
 * This file provides mock modules that replace problematic dependencies in web mode
 * It helps us avoid CSS loader issues in Next.js 14.2.26
 */
import React from "react";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { addMonths } from "date-fns";

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

// Add support for react-date-range component in web mode
interface SimpleDateRangeDayProps {
  day: Date;
  onDayClick?: (day: Date) => void;
  isInRange: boolean;
  isSelected: boolean;
  isDisabled?: boolean;
  [key: string]: any;
}

// Simple day component for the date range
const SimpleDateRangeDay: React.FC<SimpleDateRangeDayProps> = ({
  day,
  onDayClick,
  isInRange = false,
  isSelected = false,
  isDisabled = false,
}) => {
  const dayClass = `
    p-2 m-1 text-center cursor-pointer rounded-md text-sm
    ${isSelected ? 'bg-blue-500 text-white' : ''}
    ${isInRange && !isSelected ? 'bg-blue-100' : ''}
    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${!isSelected && !isInRange && !isDisabled ? 'hover:bg-gray-100' : ''}
  `;

  const handleClick = () => {
    if (!isDisabled && onDayClick) {
      onDayClick(day);
    }
  };

  return (
    <div className={dayClass} onClick={handleClick}>
      {day.getDate()}
    </div>
  );
};

// Simple date range implementation for web mode
interface SimpleDateRangeProps {
  ranges: Array<{
    startDate: Date | null;
    endDate: Date | null;
    key: string;
  }>;
  onChange: (ranges: any) => void;
  months?: number;
  direction?: 'horizontal' | 'vertical';
  [key: string]: any;
}

const SimpleDateRange: React.FC<SimpleDateRangeProps> = (props) => {
  // Extract props with defaults to prevent null/undefined issues
  const {
    ranges = [],
    onChange = () => { },
    months = 1,
    direction = 'horizontal',
    ...otherProps
  } = props || {};

  // Create a default range if none provided or empty
  const defaultRange = { startDate: new Date(), endDate: addMonths(new Date(), 1), key: 'selection' };
  const selectedRange = Array.isArray(ranges) && ranges.length > 0 ? ranges[0] : defaultRange;
  const [selectingStart, setSelectingStart] = React.useState(!selectedRange.startDate);

  // Generate days for a month
  const getDaysForMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  // Get current month grid
  const getCurrentMonthDays = () => {
    const today = new Date();
    return getDaysForMonth(today.getFullYear(), today.getMonth());
  };

  // Get days for current month and next month
  const monthDays = getCurrentMonthDays();

  // Handle day click
  const handleDayClick = (day: Date) => {
    if (selectingStart) {
      onChange({
        selection: {
          startDate: day,
          endDate: selectedRange.endDate,
          key: 'selection'
        }
      });
      setSelectingStart(false);
    } else {
      // Make sure end date is after start date
      if (selectedRange.startDate && day < selectedRange.startDate) {
        onChange({
          selection: {
            startDate: day,
            endDate: selectedRange.startDate,
            key: 'selection'
          }
        });
      } else {
        onChange({
          selection: {
            startDate: selectedRange.startDate,
            endDate: day,
            key: 'selection'
          }
        });
      }
      setSelectingStart(true);
    }
  };

  // Fixed return type for day checks - ensure they are definitely boolean
  const isDayInRange = (day: Date): boolean => {
    if (!selectedRange.startDate || !selectedRange.endDate) return false;
    return Boolean(day >= selectedRange.startDate && day <= selectedRange.endDate);
  };

  const isDaySelected = (day: Date): boolean => {
    if (!selectedRange.startDate && !selectedRange.endDate) return false;

    // Explicit boolean casting for type safety
    const isStartDay = selectedRange.startDate ? day.getTime() === selectedRange.startDate.getTime() : false;
    const isEndDay = selectedRange.endDate ? day.getTime() === selectedRange.endDate.getTime() : false;

    return isStartDay || isEndDay;
  };

  // Format month name
  const formatMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Get date for the currently displayed month
  const currentMonthDate = new Date();

  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <div className={`flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} gap-4`}>
        {/* Current month */}
        <div className="flex-1">
          <div className="text-center font-medium mb-4">
            {formatMonthName(currentMonthDate)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* Day names */}
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayName) => (
              <div key={dayName} className="text-center text-sm font-medium text-gray-500 py-1">
                {dayName}
              </div>
            ))}

            {/* Empty cells for days before the 1st of the month */}
            {Array.from({ length: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1).getDay() }).map((_, i) => (
              <div key={`empty-start-${i}`} />
            ))}

            {/* Month days */}
            {monthDays.map((day) => (
              <SimpleDateRangeDay
                key={day.toString()}
                day={day}
                onDayClick={handleDayClick}
                isInRange={isDayInRange(day)}
                isSelected={isDaySelected(day)}
              />
            ))}
          </div>
        </div>

        {/* Next month (if months > 1) */}
        {months > 1 && (
          <div className="flex-1">
            <div className="text-center font-medium mb-4">
              {formatMonthName(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Day names */}
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayName) => (
                <div key={dayName} className="text-center text-sm font-medium text-gray-500 py-1">
                  {dayName}
                </div>
              ))}

              {/* Empty cells for days before the 1st of the next month */}
              {Array.from({ length: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1).getDay() }).map((_, i) => (
                <div key={`empty-next-${i}`} />
              ))}

              {/* Next month days */}
              {getDaysForMonth(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1).map((day) => (
                <SimpleDateRangeDay
                  key={day.toString()}
                  day={day}
                  onDayClick={handleDayClick}
                  isInRange={isDayInRange(day)}
                  isSelected={isDaySelected(day)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Date display */}
      <div className="mt-4 text-sm text-gray-600">
        <div>
          Start: {selectedRange.startDate ? selectedRange.startDate.toLocaleDateString() : 'Not selected'}
        </div>
        <div>
          End: {selectedRange.endDate ? selectedRange.endDate.toLocaleDateString() : 'Not selected'}
        </div>
      </div>
    </div>
  );
};

// Cache for the real DateRange
let realDateRange: any = null;

export const getReactDateRange = () => {
  // For web mode, use the simple implementation to avoid CSS issues
  if (isWebEnvironment()) {
    try {
      // Return the component function directly, not wrapped in an object with property 'DateRange'
      return {
        // Ensure we're returning a function component, not a JSX element
        DateRange: function DateRangeComponent(props: any) {
          // Validate and provide defaults for all required props
          const safeProps = {
            ...props,
            ranges: Array.isArray(props?.ranges) ? props.ranges : [],
            onChange: typeof props?.onChange === 'function' ? props.onChange : () => { },
          };
          return <SimpleDateRange {...safeProps} />;
        }
      };
    } catch (error) {
      console.error("Error creating SimpleDateRange:", error);
      // Return a very simple fallback component as a function
      return {
        DateRange: function FallbackDateRange() {
          return (
            <div className="p-4 border border-gray-200 rounded">
              <p>Date Range Picker (fallback)</p>
            </div>
          );
        }
      };
    }
  }

  // For Nextron mode, dynamically load the real component at runtime
  if (!isWebEnvironment() && typeof window !== "undefined") {
    // Use cache to avoid multiple initialization
    if (!realDateRange) {
      try {
        // Dynamically load the module without webpack knowing
        // @ts-ignore
        const DateRangeModule = Function(
          'return require("react-date-range")'
        )();

        // Make sure we're returning the component correctly
        if (typeof DateRangeModule.DateRange === 'function') {
          realDateRange = DateRangeModule;
        } else {
          throw new Error('DateRange is not a function component');
        }
        console.log("Successfully loaded real react-date-range");
      } catch (err) {
        console.error("Error loading real DateRange:", err);
        // Fallback to simple implementation with proper function component
        realDateRange = {
          DateRange: function FallbackDateRange(props: any) {
            return <SimpleDateRange {...props} />;
          }
        };
      }
    }
    return realDateRange;
  }

  // Default fallback for server-side rendering - return a function, not an element
  return {
    DateRange: function SSRFallback() {
      return null;
    }
  };
};
