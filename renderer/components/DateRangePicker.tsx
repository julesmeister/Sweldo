import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { BorderBeam } from "./magicui/border-beam";
import { useDateRangeStore } from "../stores/dateRangeStore";
import { IoRefreshOutline } from "react-icons/io5";

interface DateRangePickerProps {
  variant?: "default" | "timesheet";
  onRefresh?: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  variant = "default",
  onRefresh,
}) => {
  const { dateRange, setDateRange } = useDateRangeStore();
  const startDate = dateRange?.startDate || null;
  const endDate = dateRange?.endDate || null;
  const [isStartDateOpen, setIsStartDateOpen] = React.useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const formatDateDisplay = (date: Date | null) => {
    if (!date) return "";

    try {
      // Ensure we have a valid Date object
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        console.error("Invalid date provided to formatDateDisplay");
        return "";
      }

      return dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  const containerClass =
    variant === "timesheet"
      ? "flex items-center w-full bg-gray-100 rounded-xl border border-gray-200"
      : "flex items-center w-full";

  const innerContainerClass =
    variant === "timesheet"
      ? "relative flex-1 flex items-center px-1.5"
      : "relative flex-1 flex items-center bg-gradient-to-r from-sky-50/50 via-blue-50/50 to-sky-50/50 rounded-xl px-1.5 border border-blue-100/50";

  const buttonClass = (date: Date | null) => {
    const baseClass = "relative group flex items-center px-4 py-2.5";

    if (variant === "timesheet") {
      return `${baseClass} ${
        date
          ? "text-gray-900 font-medium hover:text-gray-700"
          : "text-gray-500 hover:text-gray-600"
      }`;
    }

    return `${baseClass} rounded-lg ${
      date
        ? "text-blue-400 font-medium hover:text-blue-500"
        : "text-blue-300 hover:text-blue-400"
    }`;
  };

  const arrowIconClass =
    variant === "timesheet" ? "w-5 h-5 text-gray-400" : "w-5 h-5 text-blue-400";

  const calendarIconClass =
    variant === "timesheet"
      ? "w-4 h-4 mr-2.5 text-gray-400 group-hover:text-gray-500 transition-colors"
      : "w-4 h-4 mr-2.5 text-blue-400 group-hover:text-blue-500 transition-colors";

  const clearButtonClass =
    variant === "timesheet"
      ? "relative px-2 py-1 text-sm text-gray-500 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-all active:scale-95 active:bg-gray-300 overflow-hidden"
      : "relative px-2 py-1 text-sm text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all active:scale-95 active:bg-blue-100 overflow-hidden";

  const handleStartDateChange = (date: Date | null) => {
    try {
      const validDate = date ? new Date(date) : null;
      if (validDate && !isNaN(validDate.getTime())) {
        // If end date is earlier than the new start date, set it to the day after start date
        if (endDate && endDate <= validDate) {
          const nextDay = new Date(validDate);
          nextDay.setDate(validDate.getDate() + 1);
          setDateRange(validDate, nextDay);
        } else {
          setDateRange(validDate, endDate);
        }
        // Close start date picker and open end date picker
        setIsStartDateOpen(false);
        setIsEndDateOpen(true);
      } else if (date === null) {
        setDateRange(null, endDate);
        setIsStartDateOpen(false);
      } else {
        console.error("Invalid start date selected");
      }
    } catch (error) {
      console.error("Error handling start date change:", error);
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    try {
      const validDate = date ? new Date(date) : null;
      if (validDate && !isNaN(validDate.getTime())) {
        setDateRange(startDate, validDate);
        setIsEndDateOpen(false);
      } else if (date === null) {
        setDateRange(startDate, null);
        setIsEndDateOpen(false);
      } else {
        console.error("Invalid end date selected");
      }
    } catch (error) {
      console.error("Error handling end date change:", error);
      setIsEndDateOpen(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  return (
    <div className={containerClass}>
      <div className={innerContainerClass}>
        <div className="relative z-50 flex-1">
          <DatePicker
            selected={startDate}
            onChange={handleStartDateChange}
            startDate={startDate}
            endDate={endDate}
            selectsStart
            showPopperArrow
            className="w-full bg-transparent focus:outline-none"
            placeholderText="Start date"
            dateFormat="MMM d, yyyy"
            open={isStartDateOpen}
            onCalendarOpen={() => setIsStartDateOpen(true)}
            onCalendarClose={() => setIsStartDateOpen(false)}
            customInput={
              <button type="button" className={buttonClass(startDate)}>
                <svg
                  className={calendarIconClass}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {startDate ? formatDateDisplay(startDate) : "Start date"}
              </button>
            }
          />
        </div>
        <div className="flex items-center px-3">
          <svg
            className={arrowIconClass}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </div>
        <div className="relative z-50 flex-1">
          <DatePicker
            selected={endDate}
            onChange={handleEndDateChange}
            startDate={startDate}
            endDate={endDate}
            minDate={startDate || new Date()}
            selectsEnd
            showPopperArrow
            className="w-full bg-transparent focus:outline-none"
            placeholderText="End date"
            dateFormat="MMM d, yyyy"
            open={isEndDateOpen}
            onCalendarOpen={() => setIsEndDateOpen(true)}
            onCalendarClose={() => setIsEndDateOpen(false)}
            customInput={
              <button type="button" className={buttonClass(endDate)}>
                <svg
                  className={calendarIconClass}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {endDate ? formatDateDisplay(endDate) : "End date"}
              </button>
            }
          />
        </div>
        {variant === "timesheet" && onRefresh && (
          <div className="relative ml-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="p-1.5 rounded-md bg-gray-100 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
              disabled={isRefreshing}
            >
              <IoRefreshOutline
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        )}
        {(startDate || endDate) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDateRange(null, null)}
              className={clearButtonClass}
            >
              Clear
              <BorderBeam
                duration={2}
                size={20}
                colorFrom={variant === "timesheet" ? "#9ca3af" : "#60a5fa"}
                colorTo={variant === "timesheet" ? "#4b5563" : "#3b82f6"}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
