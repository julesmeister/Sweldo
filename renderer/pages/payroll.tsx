"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { createCashAdvanceModel } from "@/renderer/model/cashAdvance";
import { usePayrollDelete } from "@/renderer/hooks/usePayrollDelete";
import { usePayrollStatistics } from "@/renderer/hooks/usePayrollStatistics";
import { createStatisticsModel } from "@/renderer/model/statistics";
import { PDFGeneratorOptions } from "@/renderer/types/payroll";

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
  const { dbPath, logoPath, preparedBy, approvedBy } = useSettingsStore();
  const { selectedEmployeeId } = useEmployeeStore();
  const { dateRange, setDateRange } = useDateRangeStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { deletePayroll, isDeleting } = usePayrollDelete({
    dbPath,
    selectedEmployeeId: selectedEmployeeId!,
    onPayrollDeleted: () => setRefreshPayrolls(true),
  });
  const {
    isGeneratingStatistics,
    generatePayrollStatistics,
    updateMonthStatistics,
  } = usePayrollStatistics();

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
        console.error("Error deleting payroll:", error);
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
      const month = safeStorage.getItem("selectedMonth");
      const year =
        safeStorage.getItem("selectedYear") ||
        new Date().getFullYear().toString();

      if (month) setStoredMonth(month);
      setStoredYear(year);
      safeStorage.setItem("selectedYear", year);

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
          shortDeductions: deductions.shortDeductions,
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
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  const handleGeneratePayslipsForAll = async () => {
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
            .map((summary, index) => {
              // Create variables object for formula evaluation
              const variables = {
                basicPay: Number(summary.basicPay) || 0,
                overtime: Number(summary.overtime) || 0,
                holidayBonus: Number(summary.holidayBonus) || 0,
                undertimeDeduction: Number(summary.undertimeDeduction) || 0,
                lateDeduction: Number(summary.lateDeduction) || 0,
                nightDifferentialPay: Number(summary.nightDifferentialPay) || 0,
                sss: Number(summary.deductions.sss) || 0,
                philHealth: Number(summary.deductions.philHealth) || 0,
                pagIbig: Number(summary.deductions.pagIbig) || 0,
                cashAdvanceDeductions:
                  Number(summary.deductions.cashAdvanceDeductions) || 0,
                shorts: Number(summary.deductions.shortDeductions) || 0,
                others: Number(summary.deductions.others) || 0,
              };

              // Get settings store state
              const settingsState = useSettingsStore.getState();
              const { calculationSettings } = settingsState;

              // Evaluate formulas
              let grossPay = variables.basicPay;
              let totalDeduction = 0;
              let netPay = 0;

              try {
                if (calculationSettings?.grossPay?.formula) {
                  // eslint-disable-next-line no-new-func
                  const grossPayFn = new Function(
                    ...Object.keys(variables),
                    `return ${calculationSettings.grossPay.formula}`
                  );
                  grossPay = grossPayFn(...Object.values(variables));
                }

                if (calculationSettings?.totalDeductions?.formula) {
                  // eslint-disable-next-line no-new-func
                  const totalDeductionsFn = new Function(
                    ...Object.keys(variables),
                    `return ${calculationSettings.totalDeductions.formula}`
                  );
                  totalDeduction = totalDeductionsFn(
                    ...Object.values(variables)
                  );
                } else {
                  // Fallback to sum of all deductions
                  totalDeduction =
                    variables.sss +
                    variables.philHealth +
                    variables.pagIbig +
                    variables.cashAdvanceDeductions +
                    variables.shorts +
                    variables.others;
                }

                if (calculationSettings?.netPay?.formula) {
                  const netPayVariables = {
                    ...variables,
                    grossPay,
                    totalDeductions: totalDeduction,
                  };
                  // eslint-disable-next-line no-new-func
                  const netPayFn = new Function(
                    ...Object.keys(netPayVariables),
                    `return ${calculationSettings.netPay.formula}`
                  );
                  netPay = netPayFn(...Object.values(netPayVariables));
                } else {
                  netPay = grossPay - totalDeduction;
                }
              } catch (error) {
                console.error("Error evaluating formulas:", error);
                // Fallback to basic calculations
                grossPay =
                  variables.basicPay +
                  variables.overtime +
                  variables.holidayBonus -
                  variables.undertimeDeduction;
                netPay = grossPay - totalDeduction;
              }

              return {
                ...summary,
                startDate: summary.startDate.toISOString(),
                endDate: summary.endDate.toISOString(),
                employeeName: employee.name,
                daysWorked: Number(summary.daysWorked) || 15,
                basicPay: variables.basicPay,
                undertimeDeduction: variables.undertimeDeduction,
                lateDeduction: variables.lateDeduction,
                holidayBonus: variables.holidayBonus,
                overtime: variables.overtime,
                grossPay,
                netPay,
                dailyRate: Number(summary.dailyRate) || 0,
                deductions: {
                  sss: variables.sss,
                  philHealth: variables.philHealth,
                  pagIbig: variables.pagIbig,
                  cashAdvanceDeductions: variables.cashAdvanceDeductions,
                  others: variables.others,
                  shortDeductions: variables.shorts,
                  totalDeduction: totalDeduction,
                },
                preparedBy: preparedBy || "",
                approvedBy: approvedBy || "",
                payslipNumber: index + 1,
              };
            });
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

      console.log(
        "Final payroll data for PDF:",
        formattedPayrolls.map((p) => ({
          employeeName: p.employeeName,
          grossPay: p.grossPay,
          deductions: p.deductions,
          netPay: p.netPay,
        }))
      );

      // Get the output directory path
      const outputPath = await window.electron.getPath("documents");
      const pdfOutputPath = path.join(outputPath, "payroll_summaries.pdf");

      // Use logo from settings store
      if (!logoPath) {
        // Skip warning about logo path
      }

      // Get settings store state
      const settingsState = useSettingsStore.getState();

      // Generate PDF with formatted payroll summaries
      const pdfPath = await window.electron.generatePDF(formattedPayrolls, {
        outputPath: pdfOutputPath,
        logoPath: logoPath || "",
        companyName: settingsState.companyName,
        calculationSettings: settingsState.calculationSettings,
        dbPath: dbPath,
      } as PDFGeneratorOptions);

      // Open the generated PDF
      await window.electron.openPath(pdfPath);
      toast.success("PDF generated successfully!");
    } catch (error) {
      toast.error("Failed to generate PDF");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleGeneratePayrollSummariesPDFForAll = async () => {
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

      // Get the month and year from the start date
      const monthIndex = startDate.getMonth() + 1;
      const year = startDate.getFullYear();
      const monthName = startDate.toLocaleString("default", { month: "long" });

      // Load and collect payroll data for each active employee
      const payrollPromises = activeEmployees.map(async (employee) => {
        try {
          const employeePayrolls = await Payroll.loadPayrollSummaries(
            dbPath,
            employee.id,
            year,
            monthIndex
          );

          // Filter payrolls within date range
          return employeePayrolls
            .filter((summary) => {
              const summaryDate = new Date(summary.startDate);
              return summaryDate >= startDate && summaryDate <= endDate;
            })
            .map((summary, index) => {
              // Create variables object for formula evaluation
              const variables = {
                basicPay: Number(summary.basicPay) || 0,
                overtime: Number(summary.overtime) || 0,
                holidayBonus: Number(summary.holidayBonus) || 0,
                undertimeDeduction: Number(summary.undertimeDeduction) || 0,
                lateDeduction: Number(summary.lateDeduction) || 0,
                nightDifferentialPay: Number(summary.nightDifferentialPay) || 0,
                sss: Number(summary.deductions.sss) || 0,
                philHealth: Number(summary.deductions.philHealth) || 0,
                pagIbig: Number(summary.deductions.pagIbig) || 0,
                cashAdvanceDeductions:
                  Number(summary.deductions.cashAdvanceDeductions) || 0,
                shorts: Number(summary.deductions.shortDeductions) || 0,
                others: Number(summary.deductions.others) || 0,
              };

              // Get settings store state
              const settingsState = useSettingsStore.getState();
              const { calculationSettings } = settingsState;

              console.log("Calculation settings:", {
                totalDeductionsFormula:
                  calculationSettings?.totalDeductions?.formula,
                grossPayFormula: calculationSettings?.grossPay?.formula,
                netPayFormula: calculationSettings?.netPay?.formula,
              });

              // Evaluate formulas
              let grossPay = variables.basicPay;
              let totalDeduction = 0;
              let netPay = 0;

              try {
                if (calculationSettings?.grossPay?.formula) {
                  // eslint-disable-next-line no-new-func
                  const grossPayFn = new Function(
                    ...Object.keys(variables),
                    `return ${calculationSettings.grossPay.formula}`
                  );
                  grossPay = grossPayFn(...Object.values(variables));
                } else {
                  // Fallback calculation for gross pay
                  grossPay =
                    variables.basicPay +
                    variables.overtime +
                    variables.holidayBonus +
                    variables.nightDifferentialPay -
                    variables.undertimeDeduction -
                    variables.lateDeduction;
                }

                console.log("Gross pay calculation:", {
                  formula: calculationSettings?.grossPay?.formula || "fallback",
                  result: grossPay,
                  variables,
                });

                // Calculate total deductions using formula if available
                if (calculationSettings?.totalDeductions?.formula) {
                  const deductionVariables = {
                    sss: variables.sss,
                    philHealth: variables.philHealth,
                    pagIbig: variables.pagIbig,
                    cashAdvanceDeductions: variables.cashAdvanceDeductions,
                    others: variables.shorts,
                    lateDeduction: variables.lateDeduction,
                    undertimeDeduction: variables.undertimeDeduction,
                  };

                  console.log("\n=== Deductions Breakdown ===");
                  console.log(`Employee: ${employee.name}`);
                  console.log("Individual Deductions:");
                  console.log(`  SSS: ${deductionVariables.sss}`);
                  console.log(`  PhilHealth: ${deductionVariables.philHealth}`);
                  console.log(`  Pag-IBIG: ${deductionVariables.pagIbig}`);
                  console.log(
                    `  Cash Advance: ${deductionVariables.cashAdvanceDeductions}`
                  );
                  console.log(
                    `  Others (Shorts): ${deductionVariables.others}`
                  );
                  console.log(
                    `  Late Deduction: ${deductionVariables.lateDeduction}`
                  );
                  console.log(
                    `  Undertime: ${deductionVariables.undertimeDeduction}`
                  );
                  console.log(
                    "\nFormula:",
                    calculationSettings.totalDeductions.formula
                  );

                  // eslint-disable-next-line no-new-func
                  const totalDeductionsFn = new Function(
                    ...Object.keys(deductionVariables),
                    `return ${calculationSettings.totalDeductions.formula}`
                  );
                  totalDeduction = totalDeductionsFn(
                    ...Object.values(deductionVariables)
                  );

                  console.log("\nTotal Deduction Calculated:", totalDeduction);
                  console.log("========================");
                } else {
                  // Fallback to sum of all deductions
                  totalDeduction =
                    variables.sss +
                    variables.philHealth +
                    variables.pagIbig +
                    variables.cashAdvanceDeductions +
                    variables.shorts +
                    variables.lateDeduction +
                    variables.undertimeDeduction;

                  console.log("\n=== Deductions Breakdown (Fallback) ===");
                  console.log(`Employee: ${employee.name}`);
                  console.log("Individual Deductions:");
                  console.log(`  SSS: ${variables.sss}`);
                  console.log(`  PhilHealth: ${variables.philHealth}`);
                  console.log(`  Pag-IBIG: ${variables.pagIbig}`);
                  console.log(
                    `  Cash Advance: ${variables.cashAdvanceDeductions}`
                  );
                  console.log(`  Others (Shorts): ${variables.shorts}`);
                  console.log(`  Late Deduction: ${variables.lateDeduction}`);
                  console.log(`  Undertime: ${variables.undertimeDeduction}`);
                  console.log("\nTotal Deduction (Sum):", totalDeduction);
                  console.log("========================");
                }

                // Calculate net pay using formula if available
                if (calculationSettings?.netPay?.formula) {
                  const netPayVariables = {
                    ...variables,
                    grossPay,
                    totalDeductions: totalDeduction,
                  };
                  // eslint-disable-next-line no-new-func
                  const netPayFn = new Function(
                    ...Object.keys(netPayVariables),
                    `return ${calculationSettings.netPay.formula}`
                  );
                  netPay = netPayFn(...Object.values(netPayVariables));
                } else {
                  netPay = grossPay - totalDeduction;
                }

                console.log("Final calculations:", {
                  grossPay,
                  totalDeduction,
                  netPay,
                });
              } catch (error) {
                console.error("Error evaluating formulas:", {
                  error,
                  calculationSettings,
                  variables,
                });
                // Fallback to basic calculations
                grossPay =
                  variables.basicPay +
                  variables.overtime +
                  variables.holidayBonus -
                  variables.undertimeDeduction;
                netPay = grossPay - totalDeduction;
              }

              return {
                ...summary,
                startDate: summary.startDate.toISOString(),
                endDate: summary.endDate.toISOString(),
                employeeName: employee.name,
                daysWorked: Number(summary.daysWorked) || 15,
                basicPay: variables.basicPay,
                undertimeDeduction: variables.undertimeDeduction,
                lateDeduction: variables.lateDeduction,
                holidayBonus: variables.holidayBonus,
                overtime: variables.overtime,
                grossPay,
                netPay,
                dailyRate: Number(summary.dailyRate) || 0,
                deductions: {
                  sss: variables.sss,
                  philHealth: variables.philHealth,
                  pagIbig: variables.pagIbig,
                  cashAdvanceDeductions: variables.cashAdvanceDeductions,
                  others: variables.others,
                  shortDeductions: variables.shorts,
                  totalDeduction: totalDeduction,
                },
                preparedBy: preparedBy || "",
                approvedBy: approvedBy || "",
                payslipNumber: index + 1,
              };
            });
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

      console.log(
        "Final payroll data for PDF:",
        formattedPayrolls.map((p) => ({
          employeeName: p.employeeName,
          grossPay: p.grossPay,
          deductions: p.deductions,
          netPay: p.netPay,
        }))
      );

      // Get the output directory path
      const outputPath = await window.electron.getPath("documents");
      const pdfOutputPath = path.join(
        outputPath,
        "payroll_summaries_landscape.pdf"
      );

      // Get settings store state
      const settingsState = useSettingsStore.getState();

      // Generate PDF with formatted payroll summaries
      const pdfPath = await window.electron.generatePDFLandscape(
        formattedPayrolls,
        {
          outputPath: pdfOutputPath,
          logoPath: logoPath || "",
          companyName: settingsState.companyName,
          columnColors: settingsState.columnColors,
          calculationSettings: settingsState.calculationSettings,
          dbPath: dbPath,
        }
      );

      // Open the generated PDF
      await window.electron.openPath(pdfPath);
      toast.success("PDF generated successfully!");

      // Convert string dates to Date objects for statistics update
      const payrollsForStatistics = formattedPayrolls.map((payroll) => ({
        ...payroll,
        startDate: new Date(payroll.startDate),
        endDate: new Date(payroll.endDate),
      }));

      // Update statistics for this month using the new hook function
      await updateMonthStatistics(
        payrollsForStatistics,
        dbPath,
        monthName,
        year
      );
    } catch (error) {
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
              <DateRangePicker variant="timesheet" />
            </div>
            <div className="flex gap-4">
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
                <>
                  <button
                    onClick={handleGeneratePayslipsForAll}
                    className="px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Generate Payslips PDF
                  </button>
                  <button
                    onClick={handleGeneratePayrollSummariesPDFForAll}
                    className="px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Generate Summary PDF
                  </button>
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
