import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { formatDate } from "@/renderer/lib/utils";
import { Payroll, PayrollSummaryModel } from "@/renderer/model/payroll";
import { MonthPicker } from "@/renderer/components/MonthPicker";
import { PayrollSummary } from "@/renderer/components/PayrollSummary";
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import { useAuthStore } from "@/renderer/stores/authStore";
import { MagicCard } from "@/renderer/components/magicui/magic-card";
import { PayrollDeleteDialog } from "@/renderer/components/payroll/PayrollDeleteDialog";
import { isWebEnvironment, getCompanyName } from "@/renderer/lib/firestoreService";
import { debugFirestorePayrolls } from "@/renderer/lib/employeeUtils";
import { useDateRangeStore } from "@/renderer/stores/dateRangeStore";
import NoDataPlaceholder from "./NoDataPlaceholder";

interface PayrollListProps {
  payrolls: PayrollSummaryModel[];
  onSelectPayroll: (payroll: PayrollSummaryModel) => void;
  onPayrollDeleted: () => void;
  selectedEmployeeId: string;
  dbPath: string;
  employee?: Employee | null;
  canEdit?: boolean;
  onDeletePayroll?: (payrollId: string) => Promise<void>;
  dateRange?: {
    startDate: Date | string | null;
    endDate: Date | string | null;
  };
}

export const PayrollList: React.FC<PayrollListProps> = React.memo(
  ({
    payrolls: initialPayrolls,
    onSelectPayroll,
    onPayrollDeleted,
    selectedEmployeeId,
    dbPath,
    employee,
    canEdit = false,
    onDeletePayroll,
    dateRange,
  }) => {
    const { hasAccess } = useAuthStore();
    const hasDeleteAccess = hasAccess("MANAGE_PAYROLL");
    const [filterType, setFilterType] = useState<
      "3months" | "6months" | "year" | "custom"
    >("3months");
    const [month, setMonth] = useState<Date | null>(null);
    const [payrolls, setPayrolls] = useState<PayrollSummaryModel[]>([]);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [selectedPayroll, setSelectedPayroll] =
      useState<PayrollSummaryModel | null>(null);
    const [payrollToDelete, setPayrollToDelete] =
      useState<PayrollSummaryModel | null>(null);
    const [showDebug, setShowDebug] = useState(false);
    const { setDateRange } = useDateRangeStore();

    // Add a ref to track if the initial load has happened
    const initialLoadComplete = useRef(false);
    // Track previous employee ID and filter type to detect changes
    const prevEmployeeId = useRef<string | null>(null);
    const prevFilterType = useRef<string | null>(null);

    // Modify the click outside handler to use a ref for the month picker
    const monthPickerRef = useRef<HTMLDivElement>(null);

    // Define all callbacks before any conditional returns
    const handleMonthSelect = useCallback((selectedMonth: Date) => {
      setMonth(selectedMonth);
      setShowMonthPicker(false);
    }, []);

    const toggleMonthPicker = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMonthPicker((prev) => !prev);
      setFilterType("custom");
    }, []);

    useEffect(() => {
      if (!showMonthPicker) return;

      const handleClickOutside = (event: MouseEvent) => {
        if (
          monthPickerRef.current &&
          !monthPickerRef.current.contains(event.target as Node)
        ) {
          setShowMonthPicker(false);
        }
      };

      // Only add listener when month picker is shown
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [showMonthPicker]);

    // Memoize the loadPayrolls function
    const loadPayrolls = useCallback(async () => {
      // Skip loading on initial render if filter buttons are going to load directly
      if (initialLoadComplete.current) {
        return;
      }

      // Use "web" as dbPath in web mode to prevent errors
      const isWeb = typeof window !== "undefined" && !window.electron;
      const effectiveDbPath = isWeb ? "web" : dbPath;

      if (!effectiveDbPath || !selectedEmployeeId || !employee) {
        console.log("[PayrollList] Missing required data, cannot load payrolls", {
          dbPath: !!effectiveDbPath,
          selectedEmployeeId: !!selectedEmployeeId,
          employee: !!employee
        });
        return;
      }

      // Log operating environment
      console.log(`[PayrollList] Operating in ${isWeb ? 'web' : 'desktop'} mode`);
      console.log(`[PayrollList] Filter type: ${filterType}, selected employee: ${selectedEmployeeId}`);

      try {
        // DEBUG: Inspect Firestore structure for payrolls
        if (isWeb) {
          const companyName = await getCompanyName();
          console.log(`[PayrollList] Debugging Firestore structure for company: ${companyName}`);
          await debugFirestorePayrolls(companyName);
        }

        const now = new Date();
        let allPayrolls: PayrollSummaryModel[] = [];

        // For any filter type, load more data to ensure we catch all payrolls
        let monthsToLoad = 3; // Default to at least 3 months of data

        // Match constants to what's in the JSX buttons
        if (filterType === "3months") {
          monthsToLoad = 3;
        } else if (filterType === "6months") {
          monthsToLoad = 6;
        } else if (filterType === "year") {
          monthsToLoad = 12;
        } else if (filterType === "custom" && month) {
          // For custom month, load that specific month plus adjacent months
          monthsToLoad = 3;

          console.log(`[PayrollList] Loading payrolls for custom month: ${month.getFullYear()}-${month.getMonth() + 1}`);

          // Load the selected month and one month before/after
          for (let i = -1; i <= 1; i++) {
            const targetDate = new Date(month);
            targetDate.setMonth(month.getMonth() + i);

            const monthPayrolls = await Payroll.loadPayrollSummaries(
              dbPath,
              selectedEmployeeId,
              targetDate.getFullYear(),
              targetDate.getMonth() + 1
            );

            console.log(`[PayrollList] Loaded ${monthPayrolls.length} payrolls for ${targetDate.getFullYear()}-${targetDate.getMonth() + 1}`);

            // Add to combined payrolls array, removing duplicates
            if (monthPayrolls.length > 0) {
              const existingIds = new Set(allPayrolls.map(p => p.id));
              for (const payroll of monthPayrolls) {
                if (!existingIds.has(payroll.id)) {
                  allPayrolls.push(payroll);
                }
              }
            }
          }
        } else {
          console.log(`[PayrollList] Loading payrolls for last ${monthsToLoad} months`);

          // For regular filter types, load multiple months
          for (let i = 0; i < monthsToLoad; i++) {
            const targetDate = new Date(now);
            targetDate.setMonth(targetDate.getMonth() - i);

            console.log(`[PayrollList] Loading month ${targetDate.getFullYear()}-${targetDate.getMonth() + 1}`);

            const payrollData = await Payroll.loadPayrollSummaries(
              dbPath,
              selectedEmployeeId,
              targetDate.getFullYear(),
              targetDate.getMonth() + 1
            );

            if (payrollData.length > 0) {
              // Check for duplicates before adding
              const existingIds = new Set(allPayrolls.map(p => p.id));
              for (const payroll of payrollData) {
                if (!existingIds.has(payroll.id)) {
                  allPayrolls.push(payroll);
                }
              }
            }
          }
        }

        console.log(`[PayrollList] Loaded ${allPayrolls.length} payroll summaries`);
        if (allPayrolls.length > 0) {
          console.log(`[PayrollList] First few payrolls:`, allPayrolls.slice(0, 3).map(p => ({
            id: p.id,
            startDate: p.startDate instanceof Date ? p.startDate.toISOString() : p.startDate,
            endDate: p.endDate instanceof Date ? p.endDate.toISOString() : p.endDate,
            employeeId: p.employeeId,
            netPay: p.netPay
          })));
        }

        // Debug the date range we're filtering on
        if (dateRange) {
          const startDateObj = typeof dateRange.startDate === 'string'
            ? new Date(dateRange.startDate)
            : dateRange.startDate;
          const endDateObj = typeof dateRange.endDate === 'string'
            ? new Date(dateRange.endDate)
            : dateRange.endDate;

          console.log(`[PayrollList] Date range filter: ${startDateObj?.toISOString()} to ${endDateObj?.toISOString()}`);
          console.log(`[PayrollList] Filter type: ${filterType}`);
        }

        // Apply generous date filtering to catch more potential matches
        let filteredPayrolls = allPayrolls;

        if (dateRange && dateRange.startDate && dateRange.endDate) {
          console.log(`[PayrollList] Applying date range filter with ${allPayrolls.length} payrolls`);

          // Normalize and parse dates for more reliable comparison
          const normalizeDate = (date: Date | string | null): Date => {
            if (!date) return new Date(0);

            try {
              let parsedDate: Date;

              // If already a Date object
              if (date instanceof Date) {
                parsedDate = new Date(date);
              } else if (typeof date === 'string') {
                // Try to parse as regular date string
                parsedDate = new Date(date);

                // If invalid, try as timestamp
                if (isNaN(parsedDate.getTime()) && !isNaN(Number(date))) {
                  parsedDate = new Date(Number(date));
                }

                // If still invalid, check for Firestore timestamp format
                if (isNaN(parsedDate.getTime()) && date.includes('seconds')) {
                  try {
                    const timestampObj = JSON.parse(date);
                    if (timestampObj && timestampObj.seconds) {
                      parsedDate = new Date(timestampObj.seconds * 1000);
                    }
                  } catch (e) {
                    // Ignore parsing errors and continue
                  }
                }
              } else {
                // Default to current date for unexpected types
                parsedDate = new Date();
              }

              // Reset time component for date-only comparison
              if (!isNaN(parsedDate.getTime())) {
                parsedDate.setHours(0, 0, 0, 0);
                return parsedDate;
              }

              // Fallback to epoch if parsing fails
              return new Date(0);
            } catch (e) {
              console.error(`[PayrollList] Error normalizing date:`, e, date);
              return new Date(0);
            }
          };

          const filterStartDate = normalizeDate(dateRange.startDate);
          const filterEndDate = normalizeDate(dateRange.endDate);

          // Expand filter range by 1 day on each side to catch edge cases
          filterStartDate.setDate(filterStartDate.getDate() - 1);
          filterEndDate.setDate(filterEndDate.getDate() + 1);

          console.log(`[PayrollList] Normalized filter date range: ${filterStartDate.toDateString()} to ${filterEndDate.toDateString()}`);

          filteredPayrolls = allPayrolls.filter(payroll => {
            try {
              // First try dates from the payroll object
              const payrollStartDate = normalizeDate(payroll.startDate);
              const payrollEndDate = normalizeDate(payroll.endDate);

              // Log the first payroll's dates for debugging
              if (payroll === allPayrolls[0]) {
                console.log(`[PayrollList] First payroll date check:`, {
                  id: payroll.id,
                  rawStartDate: payroll.startDate,
                  normalizedStartDate: payrollStartDate.toDateString(),
                  rawEndDate: payroll.endDate,
                  normalizedEndDate: payrollEndDate.toDateString(),
                  withinRange: (payrollStartDate <= filterEndDate && payrollEndDate >= filterStartDate)
                });
              }

              // Check if payroll period overlaps with filter period at all
              // (payroll starts before filter ends AND payroll ends after filter starts)
              const overlaps = (
                payrollStartDate <= filterEndDate &&
                payrollEndDate >= filterStartDate
              );

              // As a fallback, try to extract dates from the ID
              let idBasedOverlap = false;
              if (!overlaps && typeof payroll.id === 'string' && payroll.id.includes('_')) {
                const parts = payroll.id.split('_');
                if (parts.length >= 3) {
                  const startTimestamp = Number(parts[1]);
                  const endTimestamp = Number(parts[2]);

                  if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) {
                    const idStartDate = normalizeDate(new Date(startTimestamp));
                    const idEndDate = normalizeDate(new Date(endTimestamp));
                    idBasedOverlap = (
                      idStartDate <= filterEndDate &&
                      idEndDate >= filterStartDate
                    );

                    // Log ID-based dates for the first payroll
                    if (payroll === allPayrolls[0] && !overlaps) {
                      console.log(`[PayrollList] First payroll ID-based date check:`, {
                        id: payroll.id,
                        idStartTimestamp: startTimestamp,
                        idStartDate: idStartDate.toDateString(),
                        idEndTimestamp: endTimestamp,
                        idEndDate: idEndDate.toDateString(),
                        withinRange: idBasedOverlap
                      });
                    }
                  }
                }
              }

              const shouldInclude = overlaps || idBasedOverlap;
              if (shouldInclude) {
                console.log(`[PayrollList] Including payroll ${payroll.id} with date range ${payrollStartDate.toDateString()} to ${payrollEndDate.toDateString()}`);
              }
              return shouldInclude;
            } catch (error) {
              console.error(`[PayrollList] Error comparing dates for payroll ${payroll.id}:`, error);
              // Include payrolls with date parsing errors rather than exclude them
              return true;
            }
          });
        }

        console.log(`[PayrollList] Final filtered payroll count: ${filteredPayrolls.length} payrolls`);

        // Update the state with the filtered payrolls
        setPayrolls(filteredPayrolls);

        // Mark initial load as complete
        initialLoadComplete.current = true;
        prevEmployeeId.current = selectedEmployeeId;
        prevFilterType.current = filterType;

      } catch (error) {
        console.error("[PayrollList] Error loading payrolls:", error);
        toast.error("Failed to load payrolls. Please try again.");
        setPayrolls([]);
      }
    }, [dbPath, selectedEmployeeId, employee, filterType, month, dateRange]);

    // Effect for initial load and filter changes
    useEffect(() => {
      // Reset initialLoadComplete if employee or filter type changes
      if (prevEmployeeId.current !== selectedEmployeeId ||
        prevFilterType.current !== filterType) {
        console.log("[PayrollList] Key dependency changed, resetting load state");
        initialLoadComplete.current = false;
        setPayrolls([]);
      }

      // If we have initial payrolls from props (parent component already loaded them),
      // don't try to load again
      if (initialPayrolls && initialPayrolls.length > 0) {
        console.log("[PayrollList] Using initial payrolls from props:", initialPayrolls.length);
        setPayrolls(initialPayrolls);
        initialLoadComplete.current = true;
        prevEmployeeId.current = selectedEmployeeId;
        prevFilterType.current = filterType;
        return;
      }

      loadPayrolls();
    }, [loadPayrolls, selectedEmployeeId, filterType, dateRange, initialPayrolls]);

    useEffect(() => {
      setPayrolls(initialPayrolls);
    }, [initialPayrolls]);

    const handlePayrollSelect = useCallback(
      (payroll: PayrollSummaryModel) => {
        // Ensure dates are valid Date objects
        const ensureValidDate = (dateInput: any): Date => {
          try {
            // If it's already a valid Date
            if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
              return dateInput;
            }

            // Try regular date parsing for strings
            if (typeof dateInput === 'string') {
              const dateFromString = new Date(dateInput);
              if (!isNaN(dateFromString.getTime())) {
                return dateFromString;
              }

              // Try as timestamp
              if (!isNaN(Number(dateInput))) {
                const dateFromNum = new Date(Number(dateInput));
                if (!isNaN(dateFromNum.getTime())) {
                  return dateFromNum;
                }
              }

              // Try Firestore timestamp format
              if (dateInput.includes('seconds')) {
                try {
                  const timestampObj = JSON.parse(dateInput);
                  if (timestampObj.seconds) {
                    const dateFromTs = new Date(timestampObj.seconds * 1000);
                    if (!isNaN(dateFromTs.getTime())) {
                      return dateFromTs;
                    }
                  }
                } catch (e) {
                  // Continue with other methods on parse error
                }
              }
            }

            // Extract from ID as last resort
            if (typeof payroll.id === 'string' && payroll.id.includes('_')) {
              const parts = payroll.id.split('_');
              if (parts.length >= 3) {
                const timestamp = Number(parts[1]); // Start timestamp
                if (!isNaN(timestamp)) {
                  const dateFromId = new Date(timestamp);
                  if (!isNaN(dateFromId.getTime())) {
                    return dateFromId;
                  }
                }
              }
            }

            // Default fallback
            return new Date();
          } catch (e) {
            console.error("Error ensuring valid date:", e, dateInput);
            return new Date();
          }
        };

        const completePayroll: PayrollSummaryModel = {
          ...payroll,
          // Ensure dates are properly parsed
          startDate: ensureValidDate(payroll.startDate),
          endDate: ensureValidDate(payroll.endDate),
          deductions: {
            sss: payroll.deductions?.sss || 0,
            philHealth: payroll.deductions?.philHealth || 0,
            pagIbig: payroll.deductions?.pagIbig || 0,
            cashAdvanceDeductions:
              payroll.deductions?.cashAdvanceDeductions || 0,
            shortDeductions: payroll.deductions?.shortDeductions || 0,
            others: payroll.deductions?.others || 0,
          },
          shortIDs: payroll.shortIDs || [],
          cashAdvanceIDs: payroll.cashAdvanceIDs || [],
          overtimeMinutes: payroll.overtimeMinutes || 0,
          undertimeMinutes: payroll.undertimeMinutes || 0,
          lateMinutes: payroll.lateMinutes || 0,
          holidayBonus: payroll.holidayBonus || 0,
          leavePay: payroll.leavePay || 0,
          dayType: payroll.dayType || "Regular",
          leaveType: payroll.leaveType || "None",
        };

        setSelectedPayroll(completePayroll);
        onSelectPayroll(completePayroll);
      },
      [onSelectPayroll]
    );

    const handleDeleteClick = (payroll: PayrollSummaryModel) => {
      console.log("[PayrollList] Setting up payroll for deletion:", {
        id: payroll.id,
        cashAdvanceIDs: payroll.cashAdvanceIDs,
        cashAdvanceDeductions: payroll.deductions?.cashAdvanceDeductions,
        shortIDs: payroll.shortIDs,
        shortDeductions: payroll.deductions?.shortDeductions,
        loanDeductionIds: payroll.loanDeductionIds,
        loanDeductions: payroll.deductions?.loanDeductions,
      });

      setPayrollToDelete({
        ...payroll,
        deductions: {
          sss: payroll.deductions?.sss || 0,
          philHealth: payroll.deductions?.philHealth || 0,
          pagIbig: payroll.deductions?.pagIbig || 0,
          cashAdvanceDeductions: payroll.deductions?.cashAdvanceDeductions || 0,
          shortDeductions: payroll.deductions?.shortDeductions || 0,
          loanDeductions: payroll.deductions?.loanDeductions || 0,
          others: payroll.deductions?.others || 0,
        },
        cashAdvanceIDs: payroll.cashAdvanceIDs || [],
        shortIDs: payroll.shortIDs || [],
        loanDeductionIds: payroll.loanDeductionIds || [],
      });
    };

    const handleConfirmDelete = async () => {
      if (!payrollToDelete) return;

      try {
        console.log("[PayrollList] Attempting to delete payroll:", {
          id: payrollToDelete.id,
          startDate: payrollToDelete.startDate,
          endDate: payrollToDelete.endDate,
          employeeId: payrollToDelete.employeeId,
          cashAdvanceIDs: payrollToDelete.cashAdvanceIDs,
          cashAdvanceDeductions:
            payrollToDelete.deductions?.cashAdvanceDeductions,
          shortIDs: payrollToDelete.shortIDs,
          shortDeductions: payrollToDelete.deductions?.shortDeductions,
          loanDeductionIds: payrollToDelete.loanDeductionIds,
          loanDeductions: payrollToDelete.deductions?.loanDeductions,
        });

        // Make sure we're passing the correct ID format
        const startDateTimestamp = new Date(
          payrollToDelete.startDate
        ).getTime();
        const endDateTimestamp = new Date(payrollToDelete.endDate).getTime();
        const formattedId = `${payrollToDelete.employeeId}_${startDateTimestamp}_${endDateTimestamp}`;

        await onDeletePayroll?.(formattedId);

        // Refresh the payrolls list after successful deletion
        initialLoadComplete.current = false;
        loadPayrolls();

        setPayrollToDelete(null);
        onPayrollDeleted();
      } catch (error) {
        console.error("[PayrollList] Error deleting payroll:", error);
        toast.error("Failed to delete payroll record");
      }
    };

    // Add a debug function to manually trigger Firestore inspection
    const handleDebugClick = async () => {
      try {
        const isWeb = typeof window !== "undefined" && !window.electron;
        if (isWeb) {
          const companyName = await getCompanyName();
          console.log(`[Debug] Manually inspecting Firestore structure for company: ${companyName}`);
          const results = await debugFirestorePayrolls(companyName);
          console.log(`[Debug] Found ${results.length} payroll documents`);
          toast.success(`Found ${results.length} payroll documents. Check console logs for details.`);
        } else {
          toast.error("Debug function only available in web mode");
        }
      } catch (err) {
        console.error("[Debug] Error:", err);
        toast.error("Error debugging Firestore structure");
      }
    };

    // Add a function to set date range to show all payrolls
    const handleShowAllPayrolls = async () => {
      try {
        const isWeb = typeof window !== "undefined" && !window.electron;
        if (isWeb) {
          // Get all payrolls for this employee
          const companyName = await getCompanyName();
          const now = new Date();

          // Load last 12 months of payrolls
          let allPayrolls: PayrollSummaryModel[] = [];
          for (let i = 0; i < 12; i++) {
            const targetDate = new Date();
            targetDate.setMonth(now.getMonth() - i);

            const payrollData = await Payroll.loadPayrollSummaries(
              dbPath,
              selectedEmployeeId,
              targetDate.getFullYear(),
              targetDate.getMonth() + 1
            );

            if (payrollData.length > 0) {
              const existingIds = new Set(allPayrolls.map(p => p.id));
              for (const payroll of payrollData) {
                if (!existingIds.has(payroll.id)) {
                  allPayrolls.push(payroll);
                }
              }
            }
          }

          if (allPayrolls.length === 0) {
            toast.error("No payrolls found to set date range");
            return;
          }

          // Find min and max dates from all payrolls
          let minDate = new Date();
          let maxDate = new Date(0); // Epoch time

          allPayrolls.forEach(payroll => {
            // Try using date from ID first
            if (typeof payroll.id === 'string' && payroll.id.includes('_')) {
              const parts = payroll.id.split('_');
              if (parts.length >= 3) {
                const startTimestamp = Number(parts[1]);
                const endTimestamp = Number(parts[2]);

                if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) {
                  const startDate = new Date(startTimestamp);
                  const endDate = new Date(endTimestamp);

                  if (startDate < minDate) minDate = startDate;
                  if (endDate > maxDate) maxDate = endDate;
                  return;
                }
              }
            }

            // Fall back to payroll start/end dates
            const startDate = new Date(payroll.startDate);
            const endDate = new Date(payroll.endDate);

            if (startDate < minDate) minDate = startDate;
            if (endDate > maxDate) maxDate = endDate;
          });

          // Add padding to the date range
          minDate.setDate(minDate.getDate() - 7); // One week before
          maxDate.setDate(maxDate.getDate() + 7); // One week after

          // Set the date range
          console.log(`[Debug] Setting date range to ${minDate.toDateString()} - ${maxDate.toDateString()}`);
          setDateRange(minDate, maxDate);
          toast.success("Date range set to show all payrolls");
        } else {
          toast.error("Function only available in web mode");
        }
      } catch (err) {
        console.error("[Debug] Error setting date range:", err);
        toast.error("Error setting date range");
      }
    };

    // Memoize the filter buttons
    const filterButtons = useMemo(
      () => (
        <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
          {[
            { type: "3months", label: "Last 3 Months" },
            { type: "6months", label: "Last 6 Months" },
            { type: "year", label: "Last Year" },
          ].map(({ type, label }) => (
            <button
              key={type}
              onClick={() => {
                // Set the filter type first
                setFilterType(type as typeof filterType);

                // Then immediately load payrolls for this filter type
                // This ensures we don't wait for the effect to run
                (async () => {
                  try {
                    const isWeb = typeof window !== "undefined" && !window.electron;
                    // Use "web" as dbPath in web mode to prevent errors
                    const effectiveDbPath = isWeb ? "web" : dbPath;

                    if (!effectiveDbPath || !selectedEmployeeId || !employee) {
                      console.log("[PayrollList] Cannot load payrolls - missing data:", {
                        dbPath: !!effectiveDbPath,
                        selectedEmployeeId: !!selectedEmployeeId,
                        employee: !!employee
                      });
                      return;
                    }

                    const now = new Date();
                    let monthsToLoad = 3;

                    if (type === "3months") {
                      monthsToLoad = 3;
                    } else if (type === "6months") {
                      monthsToLoad = 6;
                    } else if (type === "year") {
                      monthsToLoad = 12;
                    }

                    console.log(`[PayrollList] Loading payrolls for last ${monthsToLoad} months`);

                    const allPayrolls: PayrollSummaryModel[] = [];

                    // Load the required number of months
                    for (let i = 0; i < monthsToLoad; i++) {
                      const targetDate = new Date(now);
                      targetDate.setMonth(targetDate.getMonth() - i);

                      console.log(`[PayrollList] Loading month ${targetDate.getFullYear()}-${targetDate.getMonth() + 1}`);

                      const payrollData = await Payroll.loadPayrollSummaries(
                        effectiveDbPath,
                        selectedEmployeeId,
                        targetDate.getFullYear(),
                        targetDate.getMonth() + 1
                      );

                      if (payrollData.length > 0) {
                        // Add non-duplicate payrolls
                        const existingIds = new Set(allPayrolls.map(p => p.id));
                        for (const payroll of payrollData) {
                          if (!existingIds.has(payroll.id)) {
                            allPayrolls.push(payroll);
                          }
                        }
                      }
                    }

                    console.log(`[PayrollList] Loaded ${allPayrolls.length} payrolls for ${type}`);

                    // Update state directly instead of waiting for effect
                    setPayrolls(allPayrolls);
                  } catch (error) {
                    console.error("[PayrollList] Error loading payrolls for filter:", error);
                    toast.error("Failed to load payrolls");
                  }
                })();
              }}
              className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 ${filterType === type
                ? "bg-blue-100 text-blue-700"
                : "hover:bg-gray-100"
                }`}
            >
              {label}
            </button>
          ))}

          {/* Add Show All button */}
          <button
            onClick={async () => {
              try {
                // Show all payrolls without filtering
                console.log("[PayrollList] Loading all payrolls without date filtering");

                // Get current date
                const now = new Date();
                const allPayrolls: PayrollSummaryModel[] = [];

                // Use "web" as dbPath in web mode to prevent errors
                const isWeb = typeof window !== "undefined" && !window.electron;
                const effectiveDbPath = isWeb ? "web" : dbPath;

                // Load a full year of data to ensure we get everything
                for (let i = 0; i < 12; i++) {
                  const targetDate = new Date(now);
                  targetDate.setMonth(targetDate.getMonth() - i);

                  const payrollData = await Payroll.loadPayrollSummaries(
                    effectiveDbPath,
                    selectedEmployeeId,
                    targetDate.getFullYear(),
                    targetDate.getMonth() + 1
                  );

                  if (payrollData.length > 0) {
                    console.log(`[PayrollList] Found ${payrollData.length} payrolls for ${targetDate.getFullYear()}-${targetDate.getMonth() + 1}`);

                    // Add non-duplicate payrolls
                    const existingIds = new Set(allPayrolls.map(p => p.id));
                    for (const payroll of payrollData) {
                      if (!existingIds.has(payroll.id)) {
                        allPayrolls.push(payroll);
                      }
                    }
                  }
                }

                // Update state with all payrolls
                console.log(`[PayrollList] Showing all ${allPayrolls.length} payrolls without filtering`);
                setPayrolls(allPayrolls);
                toast.success(`Found ${allPayrolls.length} payrolls. Displaying all.`);
              } catch (error) {
                console.error("[PayrollList] Error loading all payrolls:", error);
                toast.error("Failed to load all payrolls");
              }
            }}
            className="ml-2 px-3 py-1 text-sm font-medium text-orange-700 bg-orange-100 rounded-md hover:bg-orange-200"
          >
            Show All
          </button>

          {/* Add debug buttons */}
          {typeof window !== "undefined" && !window.electron && (
            <>
              <button
                onClick={handleDebugClick}
                className="ml-2 px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200"
                title="Debug Firestore"
              >
                🔍
              </button>
              <button
                onClick={handleShowAllPayrolls}
                className="ml-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                title="Show All Payrolls"
              >
                📅
              </button>
            </>
          )}
        </div>
      ),
      [filterType, dbPath, selectedEmployeeId, employee, handleDebugClick, handleShowAllPayrolls]
    );

    // Memoize the payroll rows
    const payrollRows = useMemo(
      () =>
        payrolls.map((payroll) => {
          // Ensure we have proper date objects
          const formatPayrollDate = (dateInput: any) => {
            try {
              // Handle different date formats
              if (!dateInput) return "Unknown Date";

              // If it's already a Date object
              if (dateInput instanceof Date) {
                if (isNaN(dateInput.getTime())) return "Invalid Date";
                return formatDate(dateInput);
              }

              // If it's a timestamp (number or numeric string)
              if (typeof dateInput === 'number' || !isNaN(Number(dateInput))) {
                const dateFromTimestamp = new Date(Number(dateInput));
                if (!isNaN(dateFromTimestamp.getTime())) {
                  return formatDate(dateFromTimestamp);
                }
              }

              // If it's a string date
              if (typeof dateInput === 'string') {
                // Try regular date parsing first
                const dateFromString = new Date(dateInput);
                if (!isNaN(dateFromString.getTime())) {
                  return formatDate(dateFromString);
                }

                // Try to parse Firestore timestamp format if it's an object
                if (dateInput.includes('seconds') && dateInput.includes('nanoseconds')) {
                  try {
                    const firestoreTimestamp = JSON.parse(dateInput);
                    if (firestoreTimestamp && firestoreTimestamp.seconds) {
                      const dateFromFirestore = new Date(firestoreTimestamp.seconds * 1000);
                      if (!isNaN(dateFromFirestore.getTime())) {
                        return formatDate(dateFromFirestore);
                      }
                    }
                  } catch (e) {
                    console.error("Error parsing Firestore timestamp:", e);
                  }
                }
              }

              // Try extracting dates from payroll ID as fallback
              if (payroll.id && typeof payroll.id === 'string' && payroll.id.includes('_')) {
                const parts = payroll.id.split('_');
                if (parts.length >= 3) {
                  const startTimestamp = Number(parts[1]);
                  if (!isNaN(startTimestamp)) {
                    const dateFromId = new Date(startTimestamp);
                    if (!isNaN(dateFromId.getTime())) {
                      return formatDate(dateFromId);
                    }
                  }
                }
              }

              // Last resort - original formatting attempt
              return formatDate(dateInput);
            } catch (e) {
              console.error("Error formatting date:", e, dateInput);
              return "Invalid Date";
            }
          };

          return (
            <tr
              key={payroll.id}
              onClick={() => handlePayrollSelect(payroll)}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatPayrollDate(payroll.startDate)} - {formatPayrollDate(payroll.endDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className="text-emerald-600 font-medium">
                  ₱{payroll.netPay.toLocaleString()}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatPayrollDate(payroll.paymentDate)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await handleDeleteClick(payroll);
                  }}
                  className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md ${hasDeleteAccess
                    ? "text-red-700 bg-red-100 hover:bg-red-200"
                    : "text-gray-400 bg-gray-100 cursor-not-allowed"
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 ease-in-out`}
                >
                  Delete
                </button>
              </td>
            </tr>
          )
        }),
      [payrolls, handlePayrollSelect, handleDeleteClick, hasDeleteAccess]
    );

    if (employee == null) {
      return null;
    }

    return (
      <div className="sm:px-0">
        <MagicCard
          className="p-0.5 rounded-lg col-span-2 overflow-hidden"
          gradientSize={200}
          gradientColor="#9E7AFF"
          gradientOpacity={0.8}
          gradientFrom="#9E7AFF"
          gradientTo="#FE8BBB"
        >
          <div className="bg-white rounded-lg shadow overflow-hidden z-10">
            {selectedPayroll && (
              <div className="relative z-10">
                <PayrollSummary
                  data={{
                    ...selectedPayroll,
                    employeeName: employee?.name || "Unknown Employee",
                  }}
                  onClose={() => setSelectedPayroll(null)}
                  canEdit={canEdit}
                />
              </div>
            )}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                {employee?.name || "Loading..."}'s Generated Payrolls
              </h2>
              <div className="flex items-center space-x-2">
                {filterButtons}
                <div className="relative overflow-visible" ref={monthPickerRef}>
                  <button
                    onClick={toggleMonthPicker}
                    className={`px-3 py-1.5 text-sm border rounded-md transition-colors duration-150 relative z-40 ${filterType === "custom"
                      ? "bg-blue-100 text-blue-700 border-blue-200"
                      : "border-gray-200 hover:bg-gray-100"
                      }`}
                  >
                    {filterType === "custom"
                      ? month?.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      }) || "Select Month"
                      : "Select Month"}
                  </button>
                  {filterType === "custom" && showMonthPicker && (
                    <div className="absolute right-0 mt-2 z-50">
                      <MonthPicker
                        selectedMonth={month}
                        onMonthChange={handleMonthSelect}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto relative">
              {initialLoadComplete.current && payrolls.length === 0 ? (
                <NoDataPlaceholder
                  employeeName={employee.name}
                  dataType="payroll records"
                  actionText="generate new payroll records"
                  onActionClick={() => {
                    console.log("[PayrollList] Placeholder action click: Intend to generate payroll.");
                  }}
                  onSelectEmployeeClick={() => {
                    console.log("[PayrollList] Placeholder select employee click: Not applicable here.");
                  }}
                />
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Date Range
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Net Pay
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Payment Date
                      </th>
                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                      >
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payrolls.length > 0 ? (
                      payrollRows
                    ) : (
                      <tr>
                        <td colSpan={4}>
                          <div className="text-center py-12 px-4">
                            <svg
                              className="mx-auto h-12 w-12 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <h3 className="mt-4 text-lg font-medium text-gray-900">
                              No payrolls generated yet
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Select a date range and click 'Generate Payroll' to
                              create a new payroll record.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          {payrollToDelete && (
            <PayrollDeleteDialog
              isOpen={!!payrollToDelete}
              onClose={() => setPayrollToDelete(null)}
              onConfirm={handleConfirmDelete}
              payrollData={{
                id: payrollToDelete?.id || "",
                startDate: payrollToDelete?.startDate.toISOString() || "",
                endDate: payrollToDelete?.endDate.toISOString() || "",
                employeeName: payrollToDelete?.employeeName || "",
                employeeId: payrollToDelete?.employeeId || "",
                shortIDs: payrollToDelete?.shortIDs || [],
                cashAdvanceIDs: payrollToDelete?.cashAdvanceIDs || [],
                shortDeductions: payrollToDelete?.deductions?.shortDeductions,
                cashAdvanceDeductions:
                  payrollToDelete?.deductions?.cashAdvanceDeductions,
                loanDeductionIds: payrollToDelete?.loanDeductionIds || [],
                loanDeductions: payrollToDelete?.deductions?.loanDeductions,
              }}
              dbPath={dbPath}
            />
          )}
        </MagicCard>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.payrolls === nextProps.payrolls &&
      prevProps.selectedEmployeeId === nextProps.selectedEmployeeId &&
      prevProps.employee?.id === nextProps.employee?.id &&
      prevProps.canEdit === nextProps.canEdit &&
      prevProps.dbPath === nextProps.dbPath
    );
  }
);

// Add display name for debugging
PayrollList.displayName = "PayrollList";
