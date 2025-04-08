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

interface PayrollListProps {
  payrolls: PayrollSummaryModel[];
  onSelectPayroll: (payroll: PayrollSummaryModel) => void;
  onPayrollDeleted: () => void;
  selectedEmployeeId: string;
  dbPath: string;
  employee?: Employee | null;
  canEdit?: boolean;
  onDeletePayroll?: (payrollId: string) => Promise<void>;
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

    // Add a ref to track if the initial load has happened
    const initialLoadComplete = useRef(false);

    // Modify the click outside handler to use a ref for the month picker
    const monthPickerRef = useRef<HTMLDivElement>(null);

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
      if (!dbPath || !selectedEmployeeId || !employee) {
        return;
      }

      // Skip if initial load is complete and nothing has changed
      if (initialLoadComplete.current && payrolls.length > 0) {
        return;
      }

      try {
        const now = new Date();
        let allPayrolls: PayrollSummaryModel[] = [];

        if (filterType === "custom" && month) {
          const payrollData = await Payroll.loadPayrollSummaries(
            dbPath,
            selectedEmployeeId,
            month.getFullYear(),
            month.getMonth() + 1
          );
          allPayrolls = payrollData;
        } else {
          const monthsToLoad =
            filterType === "3months" ? 3 : filterType === "6months" ? 6 : 12;

          const payrollPromises = [];

          for (let i = 0; i < monthsToLoad; i++) {
            const targetDate = new Date(
              now.getFullYear(),
              now.getMonth() - i,
              1
            );
            payrollPromises.push(
              Payroll.loadPayrollSummaries(
                dbPath,
                selectedEmployeeId,
                targetDate.getFullYear(),
                targetDate.getMonth() + 1
              )
            );
          }

          const results = await Promise.all(payrollPromises);
          allPayrolls = results.flat();
        }

        const uniquePayrolls = Array.from(
          new Map(allPayrolls.map((item) => [item.id, item])).values()
        ).sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() -
            new Date(a.paymentDate).getTime()
        );

        setPayrolls(uniquePayrolls);
        initialLoadComplete.current = true;
      } catch (error) {
        console.error("Error loading payrolls:", error);
        toast.error("Failed to load payroll data");
      }
    }, [dbPath, selectedEmployeeId, filterType, month, employee]);

    // Effect for initial load and filter changes
    useEffect(() => {
      initialLoadComplete.current = false; // Reset on dependency changes
      loadPayrolls();
    }, [filterType, month, selectedEmployeeId, dbPath, employee]);

    useEffect(() => {
      setPayrolls(initialPayrolls);
    }, [initialPayrolls]);

    if (employee == null) {
      return null;
    }

    const handleMonthSelect = useCallback((selectedMonth: Date) => {
      setMonth(selectedMonth);
      setShowMonthPicker(false);
    }, []);

    const toggleMonthPicker = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setShowMonthPicker((prev) => !prev);
      setFilterType("custom");
    }, []);

    const handlePayrollSelect = useCallback(
      (payroll: PayrollSummaryModel) => {
        const completePayroll: PayrollSummaryModel = {
          ...payroll,
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

    const handleDeletePayroll = async (payrollId: string) => {
      if (!hasDeleteAccess) {
        toast.error("You don't have permission to delete payroll records");
        return;
      }

      if (
        window.confirm("Are you sure you want to delete this payroll record?")
      ) {
        try {
          const payroll = payrolls.find(
            (p) => p.id === payrollId // Change this to match by ID instead of date
          );

          if (!payroll) {
            toast.error("Payroll record not found");
            return;
          }

          console.log("Attempting to delete payroll:", {
            id: payroll.id,
            dbPath,
            employeeId: selectedEmployeeId,
            startDate: payroll.startDate,
            endDate: payroll.endDate,
          });

          await Payroll.deletePayrollSummary(
            dbPath,
            selectedEmployeeId,
            new Date(payroll.startDate),
            new Date(payroll.endDate)
          );

          // Remove the deleted payroll from the local state
          setPayrolls((currentPayrolls) =>
            currentPayrolls.filter((p) => p.id !== payrollId)
          );

          // Notify parent component
          onPayrollDeleted();
          toast.success("Payroll record deleted successfully");
          // Refresh will happen via onPayrollDeleted callback
        } catch (error) {
          console.error("Error deleting payroll:", error);
          toast.error(
            `Failed to delete payroll record: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
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
              onClick={() => setFilterType(type as typeof filterType)}
              className={`px-3 py-1 text-sm rounded-md transition-colors duration-150 ${
                filterType === type
                  ? "bg-blue-100 text-blue-700"
                  : "hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ),
      [filterType]
    );

    // Memoize the payroll rows
    const payrollRows = useMemo(
      () =>
        payrolls.map((payroll) => (
          <tr
            key={payroll.id}
            onClick={() => handlePayrollSelect(payroll)}
            className="hover:bg-gray-50 cursor-pointer"
          >
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {formatDate(payroll.startDate)} - {formatDate(payroll.endDate)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
              <span className="text-emerald-600 font-medium">
                ₱{payroll.netPay.toLocaleString()}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {new Date(payroll.paymentDate.split("T")[0]).toLocaleString(
                "en-PH",
                {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await handleDeletePayroll(payroll.id);
                }}
                className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md ${
                  hasDeleteAccess
                    ? "text-red-700 bg-red-100 hover:bg-red-200"
                    : "text-gray-400 bg-gray-100 cursor-not-allowed"
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 ease-in-out`}
              >
                Delete
              </button>
            </td>
          </tr>
        )),
      [payrolls, handlePayrollSelect, handleDeletePayroll, hasDeleteAccess]
    );

    return (
      <div className="bg-white rounded-lg shadow overflow-visible z-10">
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
                className={`px-3 py-1.5 text-sm border rounded-md transition-colors duration-150 relative z-40 ${
                  filterType === "custom"
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
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
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
        </div>
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
