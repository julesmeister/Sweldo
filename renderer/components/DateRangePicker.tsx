import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDateRangeStore } from "../stores/dateRangeStore";
import DatePicker, { DateObject, Calendar } from "react-multi-date-picker";
import "react-multi-date-picker/styles/layouts/mobile.css";

// Icon for the input field
const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-5 h-5 text-gray-400"
  >
    <path
      fillRule="evenodd"
      d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c0-.414.336-.75.75-.75h10.5a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75H4.75a.75.75 0 01-.75-.75V7.5z"
      clipRule="evenodd"
    />
  </svg>
);

// Icon for the clear button
const ClearIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-5 h-5 text-gray-400 hover:text-gray-600"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
      clipRule="evenodd"
    />
  </svg>
);

export const DateRangePicker: React.FC = () => {
  const { dateRange, setDateRange } = useDateRangeStore();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null); // Ref for the calendar popover

  // State for calendar position
  const [calendarPosition, setCalendarPosition] = useState<{ top: number; left: number } | null>(null);

  // Convert JS Date from store to DateObject for the picker
  const toDateObject = (jsDate: Date | null | undefined): DateObject | undefined => {
    if (!jsDate) return undefined;
    try {
      return new DateObject(jsDate);
    } catch (error) {
      console.error("Error converting JS Date to DateObject:", jsDate, error);
      return undefined;
    }
  };

  // Convert DateObject from picker to JS Date for the store
  const toJSDate = (dateObject: DateObject | null | undefined): Date | null => {
    if (!dateObject) return null;
    try {
      return dateObject.toDate();
    } catch (error) {
      console.error("Error converting DateObject to JS Date:", dateObject, error);
      return null;
    }
  };

  const handleCalendarChange = (selectedDates: DateObject | DateObject[] | null) => {
    let start: Date | null = null;
    let end: Date | null = null;

    if (Array.isArray(selectedDates)) {
      if (selectedDates.length >= 1) start = toJSDate(selectedDates[0]);
      if (selectedDates.length === 2) end = toJSDate(selectedDates[1]);
    } else if (selectedDates instanceof DateObject) {
      start = toJSDate(selectedDates);
    }

    setDateRange(start, end);

    // Close calendar after a range is selected (both start and end dates)
    if (start && end) {
      setIsCalendarOpen(false);
    }
  };

  // Prepare the value for the Calendar
  // It expects an array of DateObjects for range mode, or undefined if no valid range.
  let calendarValue: [DateObject, DateObject] | [DateObject] | undefined = undefined;
  const startDateObj = toDateObject(dateRange?.startDate);
  const endDateObj = toDateObject(dateRange?.endDate);

  if (startDateObj && endDateObj) {
    calendarValue = [startDateObj, endDateObj];
  } else if (startDateObj) {
    calendarValue = [startDateObj]; // Allow single date in value for ongoing range selection
  }

  // Click outside handler - needs to check if the click is outside the calendar too if it's in a portal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current && !wrapperRef.current.contains(event.target as Node) &&
        calendarRef.current && !calendarRef.current.contains(event.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCalendarOpen]);

  // Effect to calculate calendar position when it opens
  useEffect(() => {
    if (isCalendarOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCalendarPosition({
        top: rect.bottom + window.scrollY + 2, // 2px gap below input
        left: rect.left + window.scrollX,
      });
    }
  }, [isCalendarOpen]);

  // Format the displayed value for the input
  const getDisplayValue = () => {
    const formatString = "MMMM D, YYYY";
    if (dateRange?.startDate && dateRange?.endDate) {
      // Ensure DateObjects are created for formatting
      const startDisplay = new DateObject(dateRange.startDate).format(formatString);
      const endDisplay = new DateObject(dateRange.endDate).format(formatString);
      return `${startDisplay} - ${endDisplay}`;
    } else if (dateRange?.startDate) {
      const startDisplay = new DateObject(dateRange.startDate).format(formatString);
      return startDisplay;
    }
    return ""; // Placeholder is handled by the input itself
  };

  const handleClearDates = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent input click from toggling calendar
    setDateRange(null, null);
    setIsCalendarOpen(false); // Optionally close calendar on clear
  };

  const hasSelection = dateRange?.startDate;

  return (
    <div style={{ fontFamily: "sans-serif", width: "100%" }} className="sweldo-datepicker-wrapper relative" ref={wrapperRef}>
      <div className="relative w-full">
        <input
          ref={inputRef}
          readOnly // Make input readOnly to rely on picker for date changes
          value={getDisplayValue()}
          placeholder="Select Date Range"
          onClick={() => setIsCalendarOpen(prev => !prev)} // Toggle on input click
          className={`w-full pl-3 ${hasSelection ? 'pr-16' : 'pr-10'} py-2 text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer`}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {hasSelection && (
            <button
              type="button"
              onClick={handleClearDates}
              className="p-1 mr-1 focus:outline-none"
              aria-label="Clear date range"
            >
              <ClearIcon />
            </button>
          )}
          <div onClick={() => setIsCalendarOpen(prev => !prev)} className="cursor-pointer">
            <CalendarIcon />
          </div>
        </div>
      </div>

      {isCalendarOpen && calendarPosition && document.body && createPortal(
        <div
          ref={calendarRef} // Assign ref to the calendar popover
          style={{
            position: "fixed", // Use fixed for portal positioning relative to viewport
            top: `${calendarPosition.top}px`,
            left: `${calendarPosition.left}px`,
            zIndex: 1050, // Ensure high z-index
          }}
          className="rmdp-container shadow-lg rounded-md border border-gray-200 bg-white"
        // Add a ref here if you need to check clicks on the calendar itself for click-outside
        >
          <Calendar
            value={calendarValue}
            onChange={handleCalendarChange}
            range
            numberOfMonths={2}
            showOtherDays
          />
        </div>,
        document.body // Render into the body
      )}
    </div>
  );
};
