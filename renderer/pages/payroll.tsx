"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { IoShieldOutline } from "react-icons/io5";
import RootLayout from "../components/layout";
import { useSettingsStore } from "../stores/settingsStore";
import { useLoadingStore } from "../stores/loadingStore";
import { useEmployeeStore } from "../stores/employeeStore";
import { useDateRangeStore } from "../stores/dateRangeStore";
import { useAuthStore } from "../stores/authStore";
import { Employee, createEmployeeModel } from "../model/employee";
import { Payroll, PayrollSummaryModel } from "../model/payroll";
import { DeductionsDialog } from "../components/DeductionsDialog";
import { usePayrollDelete } from "../hooks/usePayrollDelete";
import { usePayrollStatistics } from "../hooks/usePayrollStatistics";
import { usePayrollPDFGeneration } from "../hooks/usePayrollPDFGeneration";
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "../lib/utils";
import { isWebEnvironment, getCompanyName } from "@/renderer/lib/firestoreService";
import { PayrollControls, PayrollView } from "@/renderer/components/payroll";

// Add this function to debug Firestore
const DEBUG_MODE = false; // Set to true to enable debug features

export default function PayrollPage() {
  const { hasAccess } = useAuthStore();
  const [payrolls, setPayrolls] = useState<PayrollSummaryModel[]>([]);
  const [selectedPayroll, setSelectedPayroll] =
    useState<PayrollSummaryModel | null>(null);
  const [payrollSummary, setPayrollSummary] =
    useState<PayrollSummaryModel | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [refreshPayrolls, setRefreshPayrolls] = useState(false);
  const [showDeductionsDialog, setShowDeductionsDialog] = useState(false);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove?: boolean;
  } | null>(null);
  const { isLoading, setLoading, setActiveLink } = useLoadingStore();
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const { dateRange, setDateRange } = useDateRangeStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { deletePayroll, isDeleting } = usePayrollDelete({
    dbPath,
    selectedEmployeeId: selectedEmployeeId!,
    onPayrollDeleted: () => setRefreshPayrolls(true),
  });
  const { isGeneratingStatistics, updateMonthStatistics } =
    usePayrollStatistics();
  const {
    isGeneratingPDF,
    potentialPayrollCount,
    calculatePotentialPayrollCount,
    generatePayslipsForAll,
    generateSummaryForAll,
  } = usePayrollPDFGeneration({ dbPath });

  // Move callback declarations to the top level
  const handlePayrollDeleted = useCallback(() => {
    setRefreshPayrolls(true);
  }, []);

  const handleDeletePayrollItem = useCallback(
    async (payrollId: string) => {
      setLoading(true);
      try {
        await deletePayroll(payrollId, payrolls);
        setPayrolls((currentPayrolls) =>
          currentPayrolls.filter((p) => p.id !== payrollId)
        );
        
        // CRITICAL: Simulate focus context reset that fixes the issue (like Alt+Tab)
        setTimeout(() => {
          if (window.electron && window.electron.blurWindow) {
            window.electron.blurWindow();
            setTimeout(() => {
              window.electron.focusWindow();
            }, 50);
          } else {
            window.blur();
            setTimeout(() => {
              window.focus();
              document.body.focus();
            }, 50);
          }
        }, 200);
      } catch (error) {
        toast.error("Failed to delete payroll");
      } finally {
        setLoading(false);
      }
    },
    [deletePayroll, payrolls, setLoading]
  );

  // Then use the callbacks in useMemo
  const payrollListProps = useMemo(
    () => ({
      employee,
      payrolls,
      onSelectPayroll: setSelectedPayroll,
      selectedEmployeeId: selectedEmployeeId!,
      dbPath,
      onPayrollDeleted: handlePayrollDeleted,
      canEdit: hasAccess("MANAGE_PAYROLL"),
      onDeletePayroll: handleDeletePayrollItem,
    }),
    [
      employee,
      payrolls,
      setSelectedPayroll,
      selectedEmployeeId,
      dbPath,
      hasAccess,
      handlePayrollDeleted,
      handleDeletePayrollItem,
    ]
  );

  // Memoize the loadPayrolls function
  const loadPayrolls = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      console.log("[Payroll] Date range not set, cannot load payrolls");
      return;
    }

    if (!selectedEmployeeId) {
      console.log("[Payroll] No employee selected, cannot load payrolls");
      return;
    }

    try {
      setLoading(true);
      console.log(`[Payroll] Loading payrolls for employee ${selectedEmployeeId}`);

      // Create dates and adjust for timezone
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      console.log(`[Payroll] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Load employee details
      let loadedEmployee: Employee | null = null;

      // First try to find employee in the already loaded employees list
      if (employees.length > 0) {
        loadedEmployee = employees.find(e => e.id === selectedEmployeeId) || null;
      }

      // If not found in the list, try to load it directly
      if (!loadedEmployee) {
        const isWeb = isWebEnvironment();
        if (isWeb) {
          const companyName = await getCompanyName();
          // Import fetchEmployees function dynamically
          const { fetchEmployeeById } = await import("@/renderer/lib/employeeUtils");
          loadedEmployee = await fetchEmployeeById(selectedEmployeeId, companyName);
        } else if (dbPath) {
          const employeeModel = createEmployeeModel(dbPath);
          loadedEmployee = await employeeModel.loadEmployeeById(selectedEmployeeId);
        }
      }

      setEmployee(loadedEmployee);
      console.log(`[Payroll] Employee loaded:`, loadedEmployee);

      if (!loadedEmployee) {
        console.warn(`[Payroll] Could not load details for employee ${selectedEmployeeId}`);
        toast.error("Employee not found");
        setPayrolls([]);
        return;
      }

      // IMPORTANT: For web mode, we don't need actual dbPath as Firestore uses company name
      const effectiveDbPath = isWebEnvironment() ? "web" : (dbPath || "");
      console.log(`[Payroll] Using database path: ${effectiveDbPath}, web mode: ${isWebEnvironment()}`);

      // IMPORTANT: Get payrolls for a wider date range to ensure we catch all payrolls
      // Load previous 3 months to current month to ensure we catch everything
      const allPayrolls: PayrollSummaryModel[] = [];

      // Start from current month and go back 3 months
      for (let i = 0; i < 3; i++) {
        const targetDate = new Date(startDate);
        targetDate.setMonth(targetDate.getMonth() - i);
        const month = targetDate.getMonth() + 1;
        const year = targetDate.getFullYear();

        console.log(`[Payroll] Loading payroll summaries for ${year}-${month}`);
        const payrollsForMonth = await Payroll.loadPayrollSummaries(
          effectiveDbPath,
          selectedEmployeeId,
          year,
          month
        );

        console.log(`[Payroll] Loaded ${payrollsForMonth.length} payroll summaries for ${year}-${month}`);

        // Add to combined payrolls, avoiding duplicates
        if (payrollsForMonth.length > 0) {
          const existingIds = new Set(allPayrolls.map(p => p.id));
          for (const payroll of payrollsForMonth) {
            if (!existingIds.has(payroll.id)) {
              allPayrolls.push(payroll);
            }
          }
        }
      }

      console.log(`[Payroll] Combined total: ${allPayrolls.length} payroll summaries`);

      // Use more flexible date comparison to fix filtering issues
      const filteredPayrolls = allPayrolls.filter((summary: PayrollSummaryModel) => {
        try {
          // Extract dates for comparison
          const payrollStart = new Date(summary.startDate);
          const payrollEnd = new Date(summary.endDate);

          // Normalize dates to remove time component
          const normalizeDate = (date: Date) => {
            const newDate = new Date(date);
            newDate.setHours(0, 0, 0, 0);
            return newDate;
          };

          const normalizedPayrollStart = normalizeDate(payrollStart);
          const normalizedPayrollEnd = normalizeDate(payrollEnd);
          const normalizedFilterStart = normalizeDate(startDate);
          const normalizedFilterEnd = normalizeDate(endDate);

          // A payroll is relevant if it overlaps with the filter period at all
          // (payroll starts before filter ends AND payroll ends after filter starts)
          const overlaps = normalizedPayrollStart <= normalizedFilterEnd &&
            normalizedPayrollEnd >= normalizedFilterStart;

          // Log details for debug
          if (overlaps) {
            console.log(`[Payroll] Including payroll: ${summary.id} with date range: ${normalizedPayrollStart.toDateString()} - ${normalizedPayrollEnd.toDateString()}`);
          }

          return overlaps;
        } catch (error) {
          console.error(`[Payroll] Date comparison error for payroll:`, error, summary);
          // Include problematic payrolls rather than filtering them out
          return true;
        }
      });

      console.log(`[Payroll] Filtered to ${filteredPayrolls.length} payrolls within date range`);

      // Add employee name to payroll data
      const formattedPayrolls = filteredPayrolls.map(
        (summary: PayrollSummaryModel) => ({
          ...summary,
          employeeName: loadedEmployee?.name || "Unknown Employee",
        })
      );

      setPayrolls(formattedPayrolls);
      console.log(`[Payroll] Payrolls set to state: ${formattedPayrolls.length} items`);
    } catch (error) {
      console.error("[Payroll] Failed to load payroll data:", error);
      toast.error("Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }, [dbPath, selectedEmployeeId, dateRange, setLoading, employees]);

  // Modify the refresh handling
  useEffect(() => {
    if (refreshPayrolls) {
      loadPayrolls().then(() => {
        setRefreshPayrolls(false); // Reset the refresh flag after loading
      });
    }
  }, [refreshPayrolls, loadPayrolls]);

  // Initial load effect
  useEffect(() => {
    loadPayrolls();
  }, [loadPayrolls]);

  // Remove the date range initialization effects and combine them
  useEffect(() => {
    if (!storedMonth || !storedYear) {
      // Use utility functions
      const month = safeLocalStorageGetItem("selectedMonth");
      const year =
        safeLocalStorageGetItem("selectedYear") ||
        new Date().getFullYear().toString();
      safeLocalStorageSetItem("selectedYear", year); // Set year using util

      if (month) setStoredMonth(month);
      if (year) setStoredYear(year);

      if (month && year && !dateRange.startDate) {
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        const startDate = new Date(yearNum, monthNum, 1);
        const endDate = new Date(yearNum, monthNum + 1, 0);
        setDateRange(startDate, endDate);
      }
    }
  }, [storedMonth, storedYear, dateRange.startDate, setDateRange]);

  // Add effect to load all employees
  useEffect(() => {
    const loadAllEmployees = async () => {
      if (!dbPath) return;
      try {
        const employeeModel = createEmployeeModel(dbPath);
        const loadedEmployees = await employeeModel.loadActiveEmployees();
        setEmployees(loadedEmployees);
      } catch (error) {
        toast.error("Error loading employees");
      }
    };

    loadAllEmployees();
  }, [dbPath]);

  const handleDeductionsClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to generate payroll");
      return;
    }

    if (!dateRange.startDate || !dateRange.endDate || !selectedEmployeeId) {
      toast.error("Please select a date range");
      return;
    }

    // For bottom sheet layout, we don't need complex positioning
    // Just pass a minimal position object for backward compatibility
    setClickPosition({
      top: window.innerHeight - 20,
      left: window.innerWidth / 2,
      showAbove: false
    });

    setShowDeductionsDialog(true);
  };

  const handleConfirmDeductions = async (deductions: {
    sss: number;
    philHealth: number;
    pagIbig: number;
    cashAdvanceDeductions: number;
    shortDeductions: number;
    loanDeductions?: number;
    loanDeductionIds?: { loanId: string; deductionId: string; amount: number }[];
  }) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to modify payroll");
      return;
    }

    setShowDeductionsDialog(false);
    setLoading(true);

    try {
      const payroll = new Payroll([], "xlsx", dbPath);
      // Ensure we have valid Date objects
      const startDate = dateRange.startDate
        ? new Date(dateRange.startDate)
        : null;
      const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null;

      if (!startDate || !endDate) {
        throw new Error("Please select valid start and end dates");
      }

      const summary = await payroll.generatePayrollSummary(
        selectedEmployeeId!,
        startDate,
        endDate,
        {
          sss: deductions.sss,
          philHealth: deductions.philHealth,
          pagIbig: deductions.pagIbig,
          cashAdvanceDeductions: deductions.cashAdvanceDeductions,
          shortDeductions: deductions.shortDeductions,
          loanDeductions: deductions.loanDeductions,
          loanDeductionIds: deductions.loanDeductionIds,
        }
      );

      setPayrollSummary(summary);
    } catch (error: any) {
      toast.error("Failed to generate payroll. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  // Call the calculation function from the hook when date range changes
  useEffect(() => {
    calculatePotentialPayrollCount();
  }, [calculatePotentialPayrollCount, dateRange]);

  // Check if user has basic access to view payroll
  if (!hasAccess("VIEW_REPORTS")) {
    return (
      <RootLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <IoShieldOutline className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Access Restricted
            </h2>
            <p className="text-gray-500">
              You don't have permission to view payroll information.
            </p>
          </div>
        </div>
      </RootLayout>
    );
  }

  return (
    <RootLayout>
      <div className="space-y-4 py-12 p-4 mt-4">
        {/* Control Bar */}
        <PayrollControls
          employees={employees}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          handleDeductionsClick={handleDeductionsClick}
          potentialPayrollCount={potentialPayrollCount}
          generatePayslipsForAll={generatePayslipsForAll}
          generateSummaryForAll={generateSummaryForAll}
          isGeneratingPDF={isGeneratingPDF}
          isLoading={isLoading}
          hasManageAccess={hasAccess("MANAGE_PAYROLL")}
          hasReportAccess={hasAccess("GENERATE_REPORTS")}
          dateRange={dateRange}
          employee={employee}
        />

        {/* Deductions Dialog */}
        {showDeductionsDialog && hasAccess("MANAGE_PAYROLL") && (
          <DeductionsDialog
            isOpen={showDeductionsDialog}
            onClose={() => {
              setShowDeductionsDialog(false);
              setClickPosition(null);
            }}
            sss={employee?.sss || 0}
            philHealth={employee?.philHealth || 0}
            pagIbig={employee?.pagIbig || 0}
            onConfirm={handleConfirmDeductions}
            employeeId={selectedEmployeeId!}
            dbPath={dbPath}
            startDate={
              typeof dateRange.startDate === "string"
                ? new Date(dateRange.startDate)
                : dateRange.startDate || new Date()
            }
            endDate={
              typeof dateRange.endDate === "string"
                ? new Date(dateRange.endDate)
                : dateRange.endDate || new Date()
            }
            position={clickPosition}
          />
        )}

        {/* Payroll View */}
        <PayrollView
          selectedEmployeeId={selectedEmployeeId}
          payrollSummary={payrollSummary}
          payrollListProps={{
            ...payrollListProps,
            key: `${selectedEmployeeId}-${refreshPayrolls}`
          }}
          onCloseSummary={() => setPayrollSummary(null)}
          canEdit={hasAccess("MANAGE_PAYROLL")}
          onNavigate={handleLinkClick}
        />
      </div>
    </RootLayout>
  );
}