import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface DateRangePickerProps {
  dateRange: {
    startDate: Date | null;
    endDate: Date | null;
  };
  onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onDateRangeChange,
}) => {
  const { startDate, endDate } = dateRange;

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

  const buttonClass = (date: Date | null) => `
    relative group flex items-center px-4 py-2.5 rounded-lg
    ${
      date
        ? "text-blue-400 font-medium hover:text-blue-500"
        : "text-blue-300 hover:text-blue-400"
    }
  `;

  const handleStartDateChange = (date: Date | null) => {
    try {
      const validDate = date ? new Date(date) : null;
      if (validDate && !isNaN(validDate.getTime())) {
        // If end date is earlier than the new start date, set it to the day after start date
        if (endDate && endDate <= validDate) {
          const nextDay = new Date(validDate);
          nextDay.setDate(validDate.getDate() + 1);
          onDateRangeChange(validDate, nextDay);
        } else {
          onDateRangeChange(validDate, endDate);
        }
      } else if (date === null) {
        onDateRangeChange(null, endDate);
      } else {
        console.error("Invalid start date selected");
      }
    } catch (error) {
      console.error("Error handling start date change:", error);
    }
  };

  return (
    <div className="flex items-center w-full">
      <div className="relative flex-1 flex items-center bg-gradient-to-r from-sky-50/50 via-blue-50/50 to-sky-50/50 rounded-xl px-1.5 border border-blue-100/50">
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
            customInput={
              <button type="button" className={buttonClass(startDate)}>
                <svg
                  className="w-4 h-4 mr-2.5 text-blue-400 group-hover:text-blue-500 transition-colors"
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
            className="w-5 h-5 text-blue-400"
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
            onChange={(date: Date | null) => {
              try {
                const validDate = date ? new Date(date) : null;
                if (validDate && !isNaN(validDate.getTime())) {
                  onDateRangeChange(startDate, validDate);
                } else if (date === null) {
                  onDateRangeChange(startDate, null);
                } else {
                  console.error("Invalid end date selected");
                }
              } catch (error) {
                console.error("Error handling end date change:", error);
              }
            }}
            startDate={startDate}
            endDate={endDate}
            minDate={startDate || new Date()}
            className="w-full bg-transparent focus:outline-none"
            placeholderText="End date"
            dateFormat="MMM d, yyyy"
            customInput={
              <button type="button" className={buttonClass(endDate)}>
                <svg
                  className="w-4 h-4 mr-2.5 text-blue-400 group-hover:text-blue-500 transition-colors"
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
      </div>
    </div>
  );
};
