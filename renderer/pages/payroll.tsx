"use client";

import React, { useState, useEffect } from "react";
import { PayrollSummary } from "@/renderer/components/PayrollSummary";
import { PayrollList } from "@/renderer/components/PayrollList";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { useDateRangeStore } from "@/renderer/stores/dateRangeStore";
import { Payroll, PayrollSummaryModel } from "@/renderer/model/payroll";
import { DateRangePicker } from "@/renderer/components/DateRangePicker";
import { DeductionsDialog } from "@/renderer/components/DeductionsDialog";
import { usePathname, useRouter } from "next/navigation";
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import RootLayout from "@/renderer/components/layout";
import AddButton from "@/renderer/components/magicui/add-button";
import { useAuthStore } from "@/renderer/stores/authStore";
import { IoShieldOutline } from "react-icons/io5";
import { toast } from "sonner";
import path from "path";

// Helper function for safe localStorage access
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined") {
        return localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      console.warn("Failed to access localStorage:", e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("Failed to write to localStorage:", e);
    }
  },
};

export default function PayrollPage() {
  const { hasAccess } = useAuthStore();
  const [payrolls, setPayrolls] = useState<PayrollSummaryModel[]>([]);
  const [selectedPayroll, setSelectedPayroll] =
    useState<PayrollSummaryModel | null>(null);
  const [payrollSummary, setPayrollSummary] =
    useState<PayrollSummaryModel | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [refreshPayrolls, setRefreshPayrolls] = useState(false);
  const [showDeductionsDialog, setShowDeductionsDialog] = useState(false);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove?: boolean;
  } | null>(null);
  const { isLoading, setLoading, setActiveLink } = useLoadingStore();
  const { dbPath, logoPath } = useSettingsStore();
  const { selectedEmployeeId } = useEmployeeStore();
  const { dateRange, setDateRange } = useDateRangeStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Initialize date range from storage
  useEffect(() => {
    const month = safeStorage.getItem("selectedMonth");
    const year = safeStorage.getItem("selectedYear");

    if (month !== null) setStoredMonth(month);
    if (year !== null) setStoredYear(year);
  }, []);

  // Set default year if not present
  useEffect(() => {
    if (!storedYear) {
      const currentYear = new Date().getFullYear().toString();
      safeStorage.setItem("selectedYear", currentYear);
      setStoredYear(currentYear);
    }
  }, [storedYear]);

  // Update date range when month/year are available
  useEffect(() => {
    if (storedMonth && storedYear && !dateRange.startDate) {
      const month = parseInt(storedMonth, 10);
      const year = parseInt(storedYear, 10);
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      setDateRange(startDate, endDate);
    }
  }, [storedMonth, storedYear, dateRange.startDate, setDateRange]);

  const loadPayrolls = async () => {
    try {
      setLoading(true);

      if (!dateRange.startDate || !dateRange.endDate || !dbPath) {
        console.log("Missing date range or database path");
        return;
      }

      if (!selectedEmployeeId) {
        console.log("No employee selected");
        setPayrolls([]);
        return;
      }

      // Create dates and adjust for timezone
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Log the actual dates we're using
      console.log("Date debugging:", {
        rawStartDate: dateRange.startDate,
        parsedStartDate: startDate,
        month: startDate.getMonth() + 1, // Add 1 because getMonth() returns 0-11
        year: startDate.getFullYear(),
      });

      // Load employee details
      const employeeModel = createEmployeeModel(dbPath);
      const loadedEmployee = await employeeModel.loadEmployeeById(
        selectedEmployeeId
      );
      setEmployee(loadedEmployee);

      // Use the correct month from the startDate
      const month = startDate.getMonth() + 1; // Add 1 because getMonth() returns 0-11
      const year = startDate.getFullYear();

      // Load payroll data with the correct month
      const employeePayrolls = await Payroll.loadPayrollSummaries(
        dbPath,
        selectedEmployeeId,
        year,
        month
      );

      // Filter payrolls within date range
      const filteredPayrolls = employeePayrolls.filter(
        (summary: PayrollSummaryModel) => {
          const summaryDate = new Date(summary.startDate);
          return summaryDate >= startDate && summaryDate <= endDate;
        }
      );

      // Add employee name to payroll data
      const formattedPayrolls = filteredPayrolls.map(
        (summary: PayrollSummaryModel) => ({
          ...summary,
          employeeName: loadedEmployee?.name || "Unknown Employee",
        })
      );

      console.log("Loaded payroll data:", formattedPayrolls);
      setPayrolls(formattedPayrolls);
    } catch (error) {
      console.error("Error loading payrolls:", error);
      toast.error("Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrolls();
  }, [dbPath, selectedEmployeeId, setLoading, refreshPayrolls, dateRange]);

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

    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 400; // Approximate height of dialog
    const dialogWidth = 800; // Width of the dialog
    const spacing = 8; // Space between dialog and trigger

    // Calculate vertical position
    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove ? rect.top - spacing : rect.bottom + spacing;

    // Calculate horizontal position
    let left = rect.left + rect.width / 2 - dialogWidth / 2;

    // Keep dialog within window bounds
    left = Math.max(
      spacing,
      Math.min(left, windowWidth - dialogWidth - spacing)
    );

    // Calculate caret position relative to the dialog

    setClickPosition({
      top,
      left,
      showAbove,
    });

    setShowDeductionsDialog(true);
  };

  const handleConfirmDeductions = async (deductions: {
    sss: number;
    philHealth: number;
    pagIbig: number;
    cashAdvanceDeductions: number;
  }) => {
    if (!hasAccess("MANAGE_PAYROLL")) {
      toast.error("You don't have permission to modify payroll");
      return;
    }

    console.log(
      "[PayrollPage] Confirming deductions at",
      new Date().toTimeString(),
      ":",
      deductions
    );
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
        }
      );

      console.log(
        "[PayrollPage] Payroll summary generated at",
        new Date().toTimeString(),
        ":",
        summary
      );
      setPayrollSummary(summary);
    } catch (error: any) {
      console.error("[PayrollPage] Error generating payroll:", error);
      toast.error("Failed to generate payroll. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    console.log("Setting loading state to true");
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  const handleGeneratePDFForAll = async () => {
    if (!hasAccess("GENERATE_REPORTS")) {
      toast.error("You don't have permission to generate reports");
      return;
    }

    if (!dateRange.startDate || !dateRange.endDate) {
      toast.error("Please select a date range");
      return;
    }

    try {
      setIsGeneratingPDF(true);

      // Load all active employees
      const employeeModel = createEmployeeModel(dbPath);
      const allEmployees = await employeeModel.loadEmployees();
      const activeEmployees = allEmployees.filter((e) => e.status === "active");

      if (activeEmployees.length === 0) {
        toast.error("No active employees found");
        return;
      }

      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Load and collect payroll data for each active employee
      const payrollPromises = activeEmployees.map(async (employee) => {
        try {
          const employeePayrolls = await Payroll.loadPayrollSummaries(
            dbPath,
            employee.id,
            startDate.getFullYear(),
            startDate.getMonth() + 1
          );

          // Filter payrolls within date range
          return employeePayrolls
            .filter((summary) => {
              const summaryDate = new Date(summary.startDate);
              return summaryDate >= startDate && summaryDate <= endDate;
            })
            .map((summary, index) => ({
              ...summary,
              startDate: summary.startDate.toISOString(),
              endDate: summary.endDate.toISOString(),
              employeeName: employee.name,
              daysWorked: Number(summary.daysWorked) || 15,
              basicPay: Number(summary.basicPay) || 0,
              undertimeDeduction: Number(summary.undertimeDeduction) || 0,
              holidayBonus: Number(summary.holidayBonus) || 0,
              overtime: Number(summary.overtime) || 0,
              grossPay: Number(summary.grossPay) || 0,
              netPay: Number(summary.netPay) || 0,
              dailyRate: Number(summary.dailyRate) || 0,
              legalHoliday: 0,
              specialHoliday: 0,
              otPay: Number(summary.overtime) || 0,
              deductions: {
                sss: Number(summary.deductions.sss) || 0,
                philHealth: Number(summary.deductions.philHealth) || 0,
                pagIbig: Number(summary.deductions.pagIbig) || 0,
                cashAdvanceDeductions:
                  Number(summary.deductions.cashAdvanceDeductions) || 0,
                others: Number(summary.deductions.others) || 0,
                sssLoan: 0,
                pagibigLoan: 0,
                ca: Number(summary.deductions.cashAdvanceDeductions) || 0,
                partial: 0,
                totalDeduction:
                  Number(summary.deductions.sss || 0) +
                  Number(summary.deductions.philHealth || 0) +
                  Number(summary.deductions.pagIbig || 0) +
                  Number(summary.deductions.cashAdvanceDeductions || 0) +
                  Number(summary.deductions.others || 0),
              },
              preparedBy: "Penelope Sarah Tan",
              approvedBy: "Ruth Sy Lee",
              payslipNumber: index + 1,
            }));
        } catch (error) {
          console.log(
            `No payroll found for employee ${employee.name} (${employee.id})`
          );
          return [];
        }
      });

      // Wait for all payroll data to be collected
      const payrollResults = await Promise.all(payrollPromises);
      const formattedPayrolls = payrollResults
        .flat()
        .filter((payroll) => payroll !== null);

      // Check if there's any data to generate PDF
      if (formattedPayrolls.length === 0) {
        toast.error("No payroll data found for the selected date range");
        return;
      }

      // Get the output directory path
      const outputPath = await window.electron.getPath("documents");
      const pdfOutputPath = path.join(outputPath, "payroll_summaries.pdf");

      // Use logo from settings store
      if (!logoPath) {
        console.warn("Logo path not set in settings");
      }

      // Generate PDF with formatted payroll summaries
      const pdfPath = await window.electron.generatePDF(formattedPayrolls, {
        outputPath: pdfOutputPath,
        logoPath: logoPath || "",
      });

      // Open the generated PDF
      await window.electron.openPath(pdfPath);
      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Check if user has basic access to view payroll
  if (!hasAccess("VIEW_REPORTS")) {
    return (
      <RootLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
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
        <div className="bg-white/40 backdrop-blur-sm rounded-lg shadow-sm border border-blue-100 p-3 mb-4 relative z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={(startDate, endDate) =>
                  setDateRange(startDate, endDate)
                }
              />
            </div>
            {hasAccess("MANAGE_PAYROLL") && employee && (
              <button
                onClick={handleDeductionsClick}
                disabled={!selectedEmployeeId || isLoading}
                className="px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Generate Payroll For {employee?.name}
              </button>
            )}
            {hasAccess("GENERATE_REPORTS") && (
              <button
                onClick={handleGeneratePDFForAll}
                className="px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Generate PDF For All Employees
              </button>
            )}
          </div>
        </div>

        {showDeductionsDialog && hasAccess("MANAGE_PAYROLL") && (
          <>
            <div className="fixed inset-0 bg-black opacity-50 z-40" />
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
          </>
        )}

        {payrollSummary ? (
          <div className="relative z-10">
            <PayrollSummary
              data={payrollSummary}
              onClose={() => setPayrollSummary(null)}
              canEdit={hasAccess("MANAGE_PAYROLL")}
            />
          </div>
        ) : (
          <div className="relative z-10">
            {selectedEmployeeId === null ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="mb-6">
                  <svg
                    className="mx-auto h-24 w-24 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="mt-2 text-xl font-semibold text-gray-900">
                  No Employee Selected
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Please select an employee from the dropdown menu to view their
                  payroll details.
                </p>
                <div className="mt-6">
                  <AddButton
                    text="Select Employee"
                    onClick={() => handleLinkClick("/")}
                  />
                </div>
              </div>
            ) : (
              <PayrollList
                employee={employee}
                payrolls={payrolls}
                onSelectPayroll={setSelectedPayroll}
                selectedEmployeeId={selectedEmployeeId!}
                dbPath={dbPath}
                onPayrollDeleted={() => setRefreshPayrolls(true)}
                canEdit={hasAccess("MANAGE_PAYROLL")}
                accessCodes={
                  hasAccess("MANAGE_PAYROLL") ? ["MANAGE_PAYROLL"] : []
                }
                onDeletePayroll={async (payrollId: string) => {
                  const payroll = payrolls.find((p) => p.id === payrollId);
                  if (!payroll) {
                    toast.error("Payroll record not found");
                    return;
                  }

                  await Payroll.deletePayrollSummary(
                    dbPath,
                    selectedEmployeeId!,
                    new Date(payroll.startDate),
                    new Date(payroll.endDate)
                  );

                  // Remove the deleted payroll from the local state
                  setPayrolls((currentPayrolls) =>
                    currentPayrolls.filter((p) => p.id !== payrollId)
                  );

                  // Notify parent component
                  setRefreshPayrolls(true);
                }}
              />
            )}
          </div>
        )}
      </div>
    </RootLayout>
  );
}
