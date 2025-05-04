"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Fragment,
} from "react";
import path from "path";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IoShieldOutline,
  IoInformationCircle,
  IoPrintOutline,
  IoWarningOutline,
} from "react-icons/io5";
import RootLayout from "../components/layout";
import { useSettingsStore } from "../stores/settingsStore";
import { useLoadingStore } from "../stores/loadingStore";
import { useEmployeeStore } from "../stores/employeeStore";
import { useDateRangeStore } from "../stores/dateRangeStore";
import { useAuthStore } from "../stores/authStore";
import { Employee, createEmployeeModel } from "../model/employee";
import { Payroll, PayrollSummaryModel } from "../model/payroll";
import { PayrollList } from "../components/PayrollList";
import { PayrollSummary } from "../components/PayrollSummary";
import { DeductionsDialog } from "../components/DeductionsDialog";
import AddButton from "../components/magicui/add-button";
import { DateRangePicker } from "../components/DateRangePicker";
import { usePayrollDelete } from "../hooks/usePayrollDelete";
import { usePayrollStatistics } from "../hooks/usePayrollStatistics";
import { createStatisticsModel } from "../model/statistics";
import { Tooltip } from "@/renderer/components/Tooltip";
import { usePayrollPDFGeneration } from "../hooks/usePayrollPDFGeneration";
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "../lib/utils";

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
  const { dbPath, logoPath, preparedBy, approvedBy } = useSettingsStore();
  const { selectedEmployeeId } = useEmployeeStore();
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
  const [showTooltip, setShowTooltip] = useState(false);
  const [showSummaryTooltip, setShowSummaryTooltip] = useState(false);
  const [showPayslipsTooltip, setShowPayslipsTooltip] = useState(false);
  const [showGenerateTooltip, setShowGenerateTooltip] = useState(false);

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
    if (
      !dateRange.startDate ||
      !dateRange.endDate ||
      !dbPath ||
      !selectedEmployeeId
    ) {
      return;
    }

    try {
      setLoading(true);

      // Create dates and adjust for timezone
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Load employee details
      const employeeModel = createEmployeeModel(dbPath);
      const loadedEmployee = await employeeModel.loadEmployeeById(
        selectedEmployeeId
      );
      setEmployee(loadedEmployee);

      const month = startDate.getMonth() + 1;
      const year = startDate.getFullYear();

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

      setPayrolls(formattedPayrolls);
    } catch (error) {
      toast.error("Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }, [dbPath, selectedEmployeeId, dateRange, setLoading]);

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
    shortDeductions: number;
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-[13px] font-medium text-gray-600">
                  Date Range Picker
                </span>
              </div>
              <DateRangePicker variant="timesheet" />
            </div>
            <div className="flex gap-4">
              {hasAccess("MANAGE_PAYROLL") && employee && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="text-[13px] font-medium text-gray-600">
                      Selected Employee
                    </span>
                  </div>
                  <button
                    onClick={handleDeductionsClick}
                    disabled={!selectedEmployeeId || isLoading}
                    className="h-[42px] px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 relative"
                    onMouseEnter={() => setShowGenerateTooltip(true)}
                    onMouseLeave={() => setShowGenerateTooltip(false)}
                  >
                    Generate Payroll For {employee?.name}
                    {/* Generate Payroll Tooltip */}
                    {showGenerateTooltip && (
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 w-[380px]">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100/20 p-4 relative">
                          {/* Arrow pointing up */}
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"></div>
                          </div>

                          <div className="space-y-3 text-left">
                            <div className="flex items-start gap-2.5">
                              <IoInformationCircle className="w-[18px] h-[18px] text-blue-600 flex-shrink-0 mt-0.5" />
                              <h4 className="text-[15px] font-semibold text-gray-900">
                                Payroll Generation Details
                              </h4>
                            </div>
                            <div className="space-y-2.5 ml-[26px]">
                              <div className="flex gap-2.5 items-start">
                                <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                <p className="text-[13px] text-gray-600 leading-normal">
                                  Summarizes all{" "}
                                  <span className="font-medium text-gray-900">
                                    attendances
                                  </span>
                                  ,{" "}
                                  <span className="font-medium text-gray-900">
                                    compensations
                                  </span>
                                  , and{" "}
                                  <span className="font-medium text-gray-900">
                                    deductions
                                  </span>{" "}
                                  within the selected date range
                                </p>
                              </div>
                              <div className="flex gap-2.5 items-start">
                                <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                <p className="text-[13px] text-gray-600 leading-normal">
                                  Includes available{" "}
                                  <span className="font-medium text-gray-900">
                                    cash advances
                                  </span>
                                  ,{" "}
                                  <span className="font-medium text-gray-900">
                                    shorts
                                  </span>
                                  ,{" "}
                                  <span className="font-medium text-gray-900">
                                    loans
                                  </span>
                                  , and{" "}
                                  <span className="font-medium text-gray-900">
                                    leaves
                                  </span>
                                </p>
                              </div>
                              <div className="flex gap-2.5 items-start">
                                <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                <p className="text-[13px] text-gray-600 leading-normal">
                                  You can select and adjust which deductions to
                                  apply and their amounts in the next step
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              )}
              {hasAccess("GENERATE_REPORTS") && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-3.5 h-3.5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span className="text-[13px] font-medium text-gray-600">
                        {potentialPayrollCount} Employees From{" "}
                        {dateRange.startDate
                          ? new Date(dateRange.startDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : ""}{" "}
                        To{" "}
                        {dateRange.endDate
                          ? new Date(dateRange.endDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : ""}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={generatePayslipsForAll}
                        disabled={isGeneratingPDF}
                        className="h-[42px] px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 relative"
                        onMouseEnter={() => setShowPayslipsTooltip(true)}
                        onMouseLeave={() => setShowPayslipsTooltip(false)}
                      >
                        <span className="flex items-center gap-2">
                          Generate Payslips PDF
                          {potentialPayrollCount > 0 && (
                            <span className="bg-green-400 text-white text-xs font-medium rounded px-1.5 py-0.5">
                              {potentialPayrollCount}
                            </span>
                          )}
                        </span>

                        {/* Payslips Tooltip */}
                        {showPayslipsTooltip && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 w-[340px]">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100/20 p-4 relative">
                              {/* Arrow pointing up */}
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"></div>
                              </div>

                              <div className="space-y-3 text-left">
                                <div className="flex items-start gap-2.5">
                                  <IoPrintOutline className="w-[18px] h-[18px] text-green-600 flex-shrink-0 mt-0.5" />
                                  <h4 className="text-[15px] font-semibold text-gray-900">
                                    Printing Requirements
                                  </h4>
                                </div>
                                <div className="space-y-2.5 ml-[26px]">
                                  <div className="flex gap-2.5 items-start">
                                    <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                    <p className="text-[13px] text-gray-600 leading-normal">
                                      Use{" "}
                                      <span className="font-medium text-gray-900">
                                        long bond paper (8.5" × 13")
                                      </span>{" "}
                                      for optimal printing results
                                    </p>
                                  </div>
                                  <div className="flex gap-2.5 items-start">
                                    <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                    <p className="text-[13px] text-gray-600 leading-normal">
                                      Each payslip is specifically formatted for
                                      this paper size
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </button>

                      <button
                        onClick={generateSummaryForAll}
                        disabled={isGeneratingPDF}
                        className="h-[42px] px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2 relative"
                        onMouseEnter={() => setShowSummaryTooltip(true)}
                        onMouseLeave={() => setShowSummaryTooltip(false)}
                      >
                        <span className="flex items-center gap-2">
                          Generate Summary PDF
                          {potentialPayrollCount > 0 && (
                            <span className="bg-blue-400 text-white text-xs font-medium rounded px-1.5 py-0.5">
                              {potentialPayrollCount}
                            </span>
                          )}
                        </span>

                        {/* Summary Tooltip */}
                        {showSummaryTooltip && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 w-[340px]">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100/20 p-4 relative">
                              {/* Arrow pointing up */}
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"></div>
                              </div>

                              <div className="space-y-3 text-left">
                                <div className="flex items-start gap-2.5">
                                  <IoInformationCircle className="w-[18px] h-[18px] text-blue-600 flex-shrink-0 mt-0.5" />
                                  <h4 className="text-[15px] font-semibold text-gray-900">
                                    Payroll Summary Information
                                  </h4>
                                </div>
                                <div className="space-y-2.5 ml-[26px]">
                                  <div className="flex gap-2.5 items-start">
                                    <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                    <p className="text-[13px] text-gray-600 leading-normal">
                                      Only includes employees with{" "}
                                      <span className="font-medium text-gray-900">
                                        existing payroll records
                                      </span>
                                    </p>
                                  </div>
                                  <div className="flex gap-2.5 items-start">
                                    <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                    <p className="text-[13px] text-gray-600 leading-normal">
                                      Employees without payroll data will not
                                      appear in the summary
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
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
                key={`${selectedEmployeeId}-${refreshPayrolls}`}
                {...payrollListProps}
              />
            )}
          </div>
        )}
      </div>
    </RootLayout>
  );
}
