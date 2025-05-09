import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { format, addMonths } from "date-fns";
import { IoRefreshOutline } from "react-icons/io5";
import { useDateRangeStore } from "../stores/dateRangeStore";
import { BorderBeam } from "./magicui/border-beam";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

// Import only types, not the actual implementation
import type { Range, RangeKeyDict } from "react-date-range";

interface DateRangePickerProps {
  variant?: "default" | "timesheet";
  onRefresh?: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  variant = "default",
  onRefresh,
}) => {
  const { dateRange, setDateRange } = useDateRangeStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [dateRangeComponent, setDateRangeComponent] = useState<React.ComponentType<any> | null>(null);

  // Initialize with stored dates or default to today for proper date objects
  const [state, setState] = useState<Range[]>([{
    startDate: dateRange?.startDate ? new Date(dateRange.startDate) : new Date(),
    endDate: dateRange?.endDate ? new Date(dateRange.endDate) : addMonths(new Date(), 1),
    key: "selection"
  }]);

  // Dynamically load styles and component 
  useEffect(() => {
    const loadDateRangeModules = async () => {
      try {
        if (isWebEnvironment() && typeof document !== "undefined") {
          // In web mode, inject CSS using style tags
          try {
            // Fetch CSS content from CDN
            const stylesResponse = await fetch("https://cdn.jsdelivr.net/npm/react-date-range@1.4.0/dist/styles.css");
            const themeResponse = await fetch("https://cdn.jsdelivr.net/npm/react-date-range@1.4.0/dist/theme/default.css");

            if (stylesResponse.ok && themeResponse.ok) {
              const stylesCSS = await stylesResponse.text();
              const themeCSS = await themeResponse.text();

              // Check if styles are already injected
              if (!document.getElementById("react-date-range-styles")) {
                const stylesTag = document.createElement("style");
                stylesTag.id = "react-date-range-styles";
                stylesTag.innerHTML = stylesCSS;
                document.head.appendChild(stylesTag);
              }

              if (!document.getElementById("react-date-range-theme")) {
                const themeTag = document.createElement("style");
                themeTag.id = "react-date-range-theme";
                themeTag.innerHTML = themeCSS;
                document.head.appendChild(themeTag);
              }
            }
          } catch (error) {
            console.error("Failed to load DateRange CSS:", error);
          }

          // Import our dynamic module for the component
          const { getReactDateRange } = await import("@/renderer/utils/mockModules");
          const dateRangeModule = getReactDateRange();

          // Ensure we have a valid component before setting it
          if (typeof dateRangeModule.DateRange === 'function') {
            setDateRangeComponent(() => dateRangeModule.DateRange);
            console.log('Successfully loaded DateRange component for web mode');
          } else {
            console.error('DateRange is not a valid component function');
          }
        } else {
          // In Nextron mode, load component dynamically to avoid static imports
          // This prevents Next.js/webpack from analyzing the import during build
          try {
            // Dynamic function evaluation to avoid webpack analyzing the import
            // @ts-ignore - bypassing TypeScript checking for dynamic evaluation
            const reactDateRangeModule = Function('return require("react-date-range")')();

            // Verify component is a function
            if (typeof reactDateRangeModule.DateRange === 'function') {
              setDateRangeComponent(() => reactDateRangeModule.DateRange);
              console.log('Successfully loaded DateRange component for Nextron mode');
            } else {
              throw new Error('DateRange from react-date-range is not a function component');
            }

            // Inject styles manually
            if (typeof document !== "undefined") {
              // Check if styles are already loaded
              if (!document.getElementById("react-date-range-styles-link")) {
                const stylesLink = document.createElement("link");
                stylesLink.id = "react-date-range-styles-link";
                stylesLink.rel = "stylesheet";
                stylesLink.href = "https://cdn.jsdelivr.net/npm/react-date-range@1.4.0/dist/styles.css";
                document.head.appendChild(stylesLink);
              }

              if (!document.getElementById("react-date-range-theme-link")) {
                const themeLink = document.createElement("link");
                themeLink.id = "react-date-range-theme-link";
                themeLink.rel = "stylesheet";
                themeLink.href = "https://cdn.jsdelivr.net/npm/react-date-range@1.4.0/dist/theme/default.css";
                document.head.appendChild(themeLink);
              }
            }
          } catch (error) {
            console.error("Failed to load DateRange component in Nextron mode:", error);

            // Fall back to the mock implementation if needed
            const { getReactDateRange } = await import("@/renderer/utils/mockModules");
            const dateRangeModule = getReactDateRange();

            if (typeof dateRangeModule.DateRange === 'function') {
              setDateRangeComponent(() => dateRangeModule.DateRange);
              console.log('Successfully loaded fallback DateRange component');
            } else {
              console.error('Fallback DateRange is not a valid component function');
            }
          }
        }
      } catch (error) {
        console.error("Error loading DateRange:", error);
      }
    };

    loadDateRangeModules();
  }, []);

  // Create portal element on mount
  useEffect(() => {
    if (typeof document !== "undefined") {
      // Check if portal container already exists
      let element = document.getElementById("date-range-picker-portal");

      if (!element) {
        element = document.createElement("div");
        element.id = "date-range-picker-portal";
        document.body.appendChild(element);
      }

      setPortalElement(element);

      return () => {
        // Cleanup - only remove if no other pickers are open
        if (element && element.childElementCount === 0) {
          document.body.removeChild(element);
        }
      };
    }
  }, []);

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle date range changes
  const handleSelect = (ranges: RangeKeyDict) => {
    const { selection } = ranges;
    setState([selection]);

    // Update the store with new dates
    if (selection.startDate && selection.endDate) {
      setDateRange(
        new Date(selection.startDate),
        new Date(selection.endDate)
      );
    }
  };

  // Format date for display
  const formatDateDisplay = (date: Date | null) => {
    if (!date) return "";
    try {
      return format(date, "MMM d, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  // Clear date selection
  const handleClear = () => {
    const today = new Date();
    setState([
      {
        startDate: today,
        endDate: addMonths(today, 1),
        key: "selection",
      },
    ]);
    setDateRange(null, null);
    setIsOpen(false);
  };

  // Toggle the date picker
  const toggleDatePicker = () => {
    setIsOpen(!isOpen);
  };

  // Container and button styles based on variant
  const containerClass =
    variant === "timesheet"
      ? "flex items-center w-full bg-gray-100 rounded-xl border border-gray-200 relative"
      : "flex items-center w-full relative";

  const innerContainerClass =
    variant === "timesheet"
      ? "relative flex-1 flex items-center px-1.5 cursor-pointer"
      : "relative flex-1 flex items-center bg-gradient-to-r from-sky-50/50 via-blue-50/50 to-sky-50/50 rounded-xl px-1.5 border border-blue-100/50 cursor-pointer";

  const dateDisplayClass = (hasDate: boolean) => {
    const baseClass = "text-sm font-medium";

    if (variant === "timesheet") {
      return `${baseClass} ${hasDate
        ? "text-gray-900"
        : "text-gray-500"
        }`;
    }

    return `${baseClass} ${hasDate
      ? "text-blue-600"
      : "text-blue-400"
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

  // Create the date range picker portal content
  const renderDateRangePicker = () => {
    if (!isOpen || !portalElement || !dateRangeComponent) return null;

    // Adjusted width to prevent clipping - based on the screenshot
    const calendarWidth = 669; // Increased from 636px to ensure no clipping

    try {
      // Ensure dateRangeComponent is a valid React component function
      const DateRangeComponent = dateRangeComponent;

      if (typeof DateRangeComponent !== 'function') {
        console.error('DateRange component is not a function:', DateRangeComponent);
        return null;
      }

      return ReactDOM.createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            zIndex: 9999999, // Ultra high z-index
          }}
        >
          <div
            ref={pickerRef}
            className="rounded-lg overflow-hidden shadow-2xl border border-blue-300 bg-white"
            style={{
              width: calendarWidth + 'px',
              maxHeight: "calc(100vh - 40px)",
              boxShadow: "0 25px 50px -12px rgba(59, 130, 246, 0.25)"
            }}
          >
            {/* Blue header matching screenshot */}
            <div className="bg-blue-500 px-4 py-3 flex justify-between items-center">
              <h3 className="text-white font-medium">Select Date Range</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-white/80 p-1 rounded-full hover:bg-white/10 transition-colors"
                style={{ color: "white" }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Calendar body with padding to ensure content is fully visible */}
            <div className="rdr-wrapper px-0.5" style={{ overflow: "hidden" }}>
              <DateRangeComponent
                ranges={state}
                onChange={handleSelect}
                moveRangeOnFirstSelection={false}
                months={2}
                direction="horizontal"
                rangeColors={["#3b82f6"]}
                showDateDisplay={false}
                showMonthAndYearPickers={true}
                showPreview={false}
                minDate={undefined}
                color="#3b82f6"
                renderStaticRangeLabel={() => null}
                staticRanges={[]}
                inputRanges={[]}
                editableDateInputs={false}
                showSelectionPreview={false}
                footerContent={null}
              />
            </div>

            {/* Add comprehensive styles to hide any date display elements */}
            <style jsx global>{`
              .rdrDateDisplayWrapper,
              .rdrDateDisplay,
              .rdrDateDisplayItem,
              .rdrStaticRange,
              .rdrDefinedRangesWrapper,
              .rdrInputRanges {
                display: none !important;
              }
              
              /* Specifically target the preview container that might show dates */
              .rdrDateRangePickerWrapper .rdrDateDisplayWrapper,
              .rdrDateRangePickerWrapper .rdrDateDisplay,
              div[class*="DateDisplayItem"],
              div[class*="DateDisplay"],
              div[class*="DateWrapper"],
              div[class*="rdrDateDisplay"] {
                display: none !important;
                height: 0 !important;
                overflow: hidden !important;
                visibility: hidden !important;
              }
              
              /* Add more specific selectors as needed */
              [class*="InputRangeInput"],
              [class*="InputRange"] {
                display: none !important;
              }
              
              /* Hide the static ranges section completely */
              .rdrStaticRanges {
                display: none !important;
              }
            `}</style>

            {/* Bottom bar with apply button - removed the date display text */}
            <div className="bg-gray-50 px-4 py-3 flex w-full border-t border-gray-200">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md w-full hover:bg-blue-600 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        portalElement
      );
    } catch (error) {
      console.error('Error rendering DateRange component:', error);
      return null;
    }
  };

  return (
    <div className={containerClass} ref={containerRef}>
      <div
        className={innerContainerClass}
        onClick={toggleDatePicker}
      >
        <div className="flex-1 px-2 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
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
            <span className={dateDisplayClass(!!dateRange?.startDate)}>
              {dateRange?.startDate ? formatDateDisplay(new Date(dateRange.startDate)) : "Start date"}
            </span>
          </div>

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

          <div className="flex items-center space-x-2">
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
            <span className={dateDisplayClass(!!dateRange?.endDate)}>
              {dateRange?.endDate ? formatDateDisplay(new Date(dateRange.endDate)) : "End date"}
            </span>
          </div>
        </div>

        {/* Refresh Button (Timesheet variant only) */}
        {variant === "timesheet" && onRefresh && (
          <div className="relative ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              className="p-1.5 rounded-md bg-gray-100 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
              disabled={isRefreshing}
            >
              <IoRefreshOutline
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        )}

        {/* Clear Button */}
        {(dateRange?.startDate || dateRange?.endDate) && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
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

      {/* Render portal with date picker */}
      {renderDateRangePicker()}
    </div>
  );
};
