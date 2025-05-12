import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import path from "path"; // Use Node.js path module if available in Electron
import { useSettingsStore } from "../stores/settingsStore";
import { useDateRangeStore } from "../stores/dateRangeStore";
import { Employee, createEmployeeModel } from "../model/employee";
import { Payroll, PayrollSummaryModel } from "../model/payroll";
import { usePayrollStatistics } from "./usePayrollStatistics";
import { evaluatePayrollFormulas } from "../utils/payrollCalculations";
import { PDFGeneratorOptions } from "@/renderer/types/payroll"; // Use type from renderer
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";
// Add imports for PDF generation in web
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateWebPDF } from "@/renderer/components/payroll/web/hooks/payrollPDFUtils";

interface UsePayrollPDFGenerationProps {
  dbPath: string;
}

// Helper type for formatted payroll data for PDF
export type FormattedPayrollPDFData = Omit<
  PayrollSummaryModel,
  "startDate" | "endDate" | "deductions"
> & {
  startDate: string;
  endDate: string;
  employeeName: string;
  grossPay: number;
  netPay: number;
  deductions: { totalDeduction: number } & PayrollSummaryModel["deductions"]; // Keep original deductions + total
  preparedBy: string;
  approvedBy: string;
  payslipNumber: number;
};

export function usePayrollPDFGeneration({
  dbPath,
}: UsePayrollPDFGenerationProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [potentialPayrollCount, setPotentialPayrollCount] = useState(0);
  const { dateRange } = useDateRangeStore();
  const {
    logoPath,
    companyName,
    columnColors,
    calculationSettings,
    preparedBy,
    approvedBy,
  } = useSettingsStore();
  const { updateMonthStatistics } = usePayrollStatistics();

  // --- Internal Helper 1: Fetch and Filter Payroll Data ---
  const fetchAndFilterPayrolls = useCallback(
    async (startDate: Date, endDate: Date): Promise<PayrollSummaryModel[]> => {
      if (!dbPath && !isWebEnvironment()) return [];

      let activeEmployees: Employee[] = [];

      // Use different approaches for web vs desktop mode
      if (isWebEnvironment()) {
        try {
          // Get company name from settings
          if (!companyName) {
            return [];
          }

          // Use the same approach as EmployeeList for web mode
          const firestoreEmployees = await loadActiveEmployeesFirestore(
            companyName
          );
          activeEmployees = firestoreEmployees;
        } catch (error) {
          console.error("[PDF] Error loading employees from Firestore:", error);
          return [];
        }
      } else {
        // Desktop mode - use local database
        try {
          const employeeModel = createEmployeeModel(dbPath);
          const allEmployees = await employeeModel.loadEmployees();
          activeEmployees = allEmployees.filter((e) => e.status === "active");
        } catch (error) {
          console.error("[PDF] Error loading employees from local DB:", error);
          return [];
        }
      }

      if (activeEmployees.length === 0) {
        return [];
      }

      // Determine months in range
      const months: { month: number; year: number }[] = [];
      const currentDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      );
      const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      while (currentDate <= endMonth) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Fetch payrolls for all employees and months
      const payrollPromises = activeEmployees.map(async (employee) => {
        try {
          const monthlyPayrollPromises = months.map(({ month, year }) =>
            Payroll.loadPayrollSummaries(dbPath, employee.id, year, month)
          );
          const monthlyPayrolls = await Promise.all(monthlyPayrollPromises);
          // Add employee name here before filtering
          return monthlyPayrolls
            .flat()
            .map((summary) => ({ ...summary, employeeName: employee.name }));
        } catch (error) {
          console.error(
            `Error fetching payrolls for employee ${employee.id}:`,
            error
          );
          return []; // Return empty for this employee on error
        }
      });

      const allPayrollsNested = await Promise.all(payrollPromises);
      const allPayrolls = allPayrollsNested.flat();

      // Filter by exact date range
      const filteredPayrolls = allPayrolls.filter((summary) => {
        const summaryStartDate = new Date(summary.startDate);
        const summaryEndDate = new Date(summary.endDate);
        // Normalize dates
        const normStartDate = new Date(startDate);
        normStartDate.setHours(0, 0, 0, 0);
        const normEndDate = new Date(endDate);
        normEndDate.setHours(23, 59, 59, 999);
        const normSummaryStart = new Date(summaryStartDate);
        normSummaryStart.setHours(0, 0, 0, 0);
        const normSummaryEnd = new Date(summaryEndDate);
        normSummaryEnd.setHours(23, 59, 59, 999);

        return (
          normSummaryStart >= normStartDate &&
          normSummaryStart <= normEndDate &&
          normSummaryEnd >= normStartDate &&
          normSummaryEnd <= normEndDate
        );
      });

      return filteredPayrolls;
    },
    [dbPath, companyName]
  ); // Dependencies: dbPath, companyName

  // --- Internal Helper 2: Format Payroll Data for PDF ---
  const formatPayrollsForPDF = useCallback(
    (payrolls: PayrollSummaryModel[]): FormattedPayrollPDFData[] => {
      return payrolls.map((summary, index) => {
        const variables = {
          basicPay: Number(summary.basicPay) || 0,
          overtime: Number(summary.overtime) || 0,
          holidayBonus: Number(summary.holidayBonus) || 0,
          undertimeDeduction: Number(summary.undertimeDeduction) || 0,
          lateDeduction: Number(summary.lateDeduction) || 0,
          nightDifferentialPay: Number(summary.nightDifferentialPay) || 0,
          sss: Number(summary.deductions?.sss) || 0, // Add checks for deductions obj
          philHealth: Number(summary.deductions?.philHealth) || 0,
          pagIbig: Number(summary.deductions?.pagIbig) || 0,
          cashAdvanceDeductions:
            Number(summary.deductions?.cashAdvanceDeductions) || 0,
          shorts: Number(summary.deductions?.shortDeductions) || 0,
          others: Number(summary.deductions?.others) || 0,
        };
        const calculatedPays = evaluatePayrollFormulas(
          variables,
          calculationSettings
        );

        // Ensure deductions object exists before spreading
        const originalDeductions = summary.deductions || {};

        return {
          ...summary,
          startDate: new Date(summary.startDate).toISOString(),
          endDate: new Date(summary.endDate).toISOString(),
          employeeName: summary.employeeName || "Unknown Employee",
          daysWorked: Number(summary.daysWorked) || 15, // Default or consider calculating
          basicPay: variables.basicPay,
          undertimeDeduction: variables.undertimeDeduction,
          lateDeduction: variables.lateDeduction,
          holidayBonus: variables.holidayBonus,
          overtime: variables.overtime,
          grossPay: calculatedPays.grossPay,
          netPay: calculatedPays.netPay,
          dailyRate: Number(summary.dailyRate) || 0,
          deductions: {
            // Reconstruct deductions object safely
            ...originalDeductions,
            sss: variables.sss,
            philHealth: variables.philHealth,
            pagIbig: variables.pagIbig,
            cashAdvanceDeductions: variables.cashAdvanceDeductions,
            shorts: variables.shorts,
            others: variables.others,
            totalDeduction: calculatedPays.totalDeductions,
          },
          preparedBy: preparedBy || "",
          approvedBy: approvedBy || "",
          payslipNumber: index + 1,
        };
      });
    },
    [calculationSettings, preparedBy, approvedBy]
  ); // Dependencies: calculationSettings, preparedBy, approvedBy

  // --- Internal Helper 3: Update Statistics ---
  const updateStatisticsForRange = useCallback(
    async (payrolls: PayrollSummaryModel[], startDate: Date, endDate: Date) => {
      const months: { month: number; year: number }[] = [];
      const currentDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      );
      const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      while (currentDate <= endMonth) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Use the original payrolls (with Date objects) for stats
      const payrollsForStats = payrolls.map((p) => ({
        ...p,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      }));

      for (const { month, year } of months) {
        const monthName = new Date(year, month - 1, 1).toLocaleString(
          "default",
          { month: "long" }
        );
        await updateMonthStatistics(
          payrollsForStats.filter((p) => {
            const pMonth = p.startDate.getMonth() + 1;
            const pYear = p.startDate.getFullYear();
            return pMonth === month && pYear === year;
          }),
          dbPath,
          monthName,
          year
        );
      }
    },
    [dbPath, updateMonthStatistics]
  ); // Dependencies: dbPath, updateMonthStatistics

  // --- Exposed Function 1: Calculate Potential Count ---
  const calculatePotentialPayrollCount = useCallback(async () => {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      setPotentialPayrollCount(0);
      return;
    }
    try {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      const filteredPayrolls = await fetchAndFilterPayrolls(startDate, endDate);
      setPotentialPayrollCount(filteredPayrolls.length);
    } catch (error) {
      console.error("Error calculating potential payroll count:", error);
      setPotentialPayrollCount(0);
      toast.error("Failed to calculate potential payroll count.");
    }
  }, [dateRange, fetchAndFilterPayrolls]); // Dependencies: dateRange, fetchAndFilterPayrolls helper

  // --- Exposed Function 2: Generate Payslips PDF ---
  const generatePayslipsForAll = useCallback(async () => {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      toast.error("Please select a date range");
      return;
    }

    setIsGeneratingPDF(true);
    const loadingToast = toast.loading("Generating Payslips...");
    try {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Step 1: Fetch and Filter
      const filteredPayrolls = await fetchAndFilterPayrolls(startDate, endDate);
      if (filteredPayrolls.length === 0) {
        toast.error("No payroll data found for the selected date range", {
          id: loadingToast,
        });
        setIsGeneratingPDF(false); // Stop loading if no data
        return; // Early exit
      }

      // Step 2: Format
      const formattedPayrolls = formatPayrollsForPDF(filteredPayrolls);

      // Step 3: Generate based on environment
      if (isWebEnvironment()) {
        // Web environment: Generate PDF
        const result = await generateWebPDF(
          formattedPayrolls,
          false,
          companyName || "Default Company"
        );

        if (result.success) {
          toast.success("Payslips PDF generated and downloaded!", {
            id: loadingToast,
          });
        } else {
          toast.error(`Failed to generate payslips PDF: ${result.error}`, {
            id: loadingToast,
          });
        }
      } else {
        // Nextron/Electron environment: Generate PDF
        // Step 3: Prepare PDF Options
        const outputPath = await window.electron.getPath("documents");
        const pdfOutputPath = path.join(outputPath, "payroll_payslips.pdf");
        const pdfOptions: PDFGeneratorOptions = {
          outputPath: pdfOutputPath,
          logoPath: logoPath || "",
          companyName: companyName || "Default Company", // Provide a fallback
          calculationSettings: calculationSettings,
          dbPath: dbPath,
          columnColors: columnColors || {}, // Provide a fallback
          preparedBy: preparedBy || "",
          approvedBy: approvedBy || "",
        };

        // Step 4: Call IPC for PDF Generation
        const pdfPath = await window.electron.generatePDF(
          formattedPayrolls,
          pdfOptions
        );

        // Step 5: Open PDF and show success
        await window.electron.openPath(pdfPath);
        toast.success("Payslips PDF generated successfully!", {
          id: loadingToast,
        });
      }

      // Step 6: Update Statistics
      await updateStatisticsForRange(filteredPayrolls, startDate, endDate);
    } catch (error) {
      console.error("Failed to generate payslips:", error);
      toast.error(
        `Failed to generate payslips: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { id: loadingToast }
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [
    dbPath,
    dateRange,
    fetchAndFilterPayrolls,
    formatPayrollsForPDF,
    updateStatisticsForRange,
    logoPath,
    companyName,
    calculationSettings,
    generateWebPDF,
    preparedBy,
    approvedBy,
    columnColors, // Ensure all used variables are dependencies
  ]);

  // --- Exposed Function 3: Generate Summary PDF ---
  const generateSummaryForAll = useCallback(async () => {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      toast.error("Please select a date range");
      return;
    }

    setIsGeneratingPDF(true);
    const loadingToast = toast.loading("Generating Summary...");
    try {
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Step 1: Fetch and Filter
      const filteredPayrolls = await fetchAndFilterPayrolls(startDate, endDate);
      if (filteredPayrolls.length === 0) {
        toast.error("No payroll data found for the selected date range", {
          id: loadingToast,
        });
        setIsGeneratingPDF(false); // Stop loading if no data
        return; // Early exit
      }

      // Step 2: Format
      const formattedPayrolls = formatPayrollsForPDF(filteredPayrolls);

      // Step 3: Generate based on environment
      if (isWebEnvironment()) {
        // Web environment: Generate PDF
        const result = await generateWebPDF(
          formattedPayrolls,
          true,
          companyName || "Default Company"
        );

        if (result.success) {
          toast.success("Summary PDF generated and downloaded!", {
            id: loadingToast,
          });
        } else {
          toast.error(`Failed to generate summary PDF: ${result.error}`, {
            id: loadingToast,
          });
        }
      } else {
        // Nextron/Electron environment: Generate PDF
        // Step 3: Prepare PDF Options
        const outputPath = await window.electron.getPath("documents");
        const pdfOutputPath = path.join(
          outputPath,
          "payroll_summaries_landscape.pdf"
        );
        const pdfOptions: PDFGeneratorOptions = {
          outputPath: pdfOutputPath,
          logoPath: logoPath || "",
          companyName: companyName || "Default Company", // Provide a fallback
          columnColors: columnColors || {}, // Provide a fallback
          calculationSettings: calculationSettings,
          dbPath: dbPath,
          preparedBy: preparedBy || "",
          approvedBy: approvedBy || "",
        };

        // Step 4: Call IPC for PDF Generation (Landscape)
        const pdfPath = await window.electron.generatePDFLandscape(
          formattedPayrolls,
          pdfOptions
        );

        // Step 5: Open PDF and show success
        await window.electron.openPath(pdfPath);
        toast.success("Summary PDF generated successfully!", {
          id: loadingToast,
        });
      }

      // Step 6: Update Statistics
      await updateStatisticsForRange(filteredPayrolls, startDate, endDate);
    } catch (error) {
      console.error("Failed to generate summary:", error);
      toast.error(
        `Failed to generate summary: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { id: loadingToast }
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [
    dbPath,
    dateRange,
    fetchAndFilterPayrolls,
    formatPayrollsForPDF,
    updateStatisticsForRange,
    logoPath,
    companyName,
    columnColors,
    calculationSettings,
    generateWebPDF,
    preparedBy,
    approvedBy, // Ensure all used variables are dependencies
  ]);

  return {
    isGeneratingPDF,
    potentialPayrollCount,
    calculatePotentialPayrollCount, // Expose to allow triggering calculation
    generatePayslipsForAll,
    generateSummaryForAll,
  };
}
