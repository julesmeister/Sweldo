"use client";
import React, { useState, useEffect } from "react";
import { MagicCard } from "../components/magicui/magic-card";
import {
  IoBarChartOutline,
  IoPieChartOutline,
  IoTimeOutline,
  IoWalletOutline,
  IoPeopleOutline,
  IoCalendarOutline,
  IoArrowUpOutline,
  IoArrowDownOutline,
  IoTrendingUpOutline,
  IoTrendingDownOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import { MdOutlineDataset } from "react-icons/md";
import { createStatisticsModel, Statistics } from "../model/statistics";
import { useSettingsStore } from "../stores/settingsStore";
import { toast } from "sonner";
import { createEmployeeModel } from "../model/employee";
import { Payroll, PayrollSummaryModel } from "../model/payroll";
import { useDateSelectorStore } from "../components/DateSelector";
import { usePayrollStatistics } from "../hooks/usePayrollStatistics";

// Stat card component
const StatCard = ({
  title,
  value,
  icon,
  trend,
  trendUp,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}) => (
  <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] relative overflow-hidden">
    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full opacity-20 -mr-12 -mt-12"></div>
    <div className="flex items-center justify-between relative z-10">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          {value}
        </p>
        {trend && (
          <div className="flex items-center mt-2">
            <span
              className={`text-sm font-medium ${
                trendUp ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend}
            </span>
            {trendUp ? (
              <IoArrowUpOutline className="w-4 h-4 text-green-600 ml-1" />
            ) : (
              <IoArrowDownOutline className="w-4 h-4 text-red-600 ml-1" />
            )}
          </div>
        )}
      </div>
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-full text-white shadow-md">
        {icon}
      </div>
    </div>
  </div>
);

// Chart component (mock)
const Chart = ({
  title,
  data,
  type = "bar",
}: {
  title: string;
  data: any[];
  type?: "bar" | "pie";
}) => (
  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
      <div className="text-center p-4">
        <div className="text-gray-400 mb-2">
          {type === "bar" ? (
            <IoBarChartOutline className="w-12 h-12 mx-auto" />
          ) : (
            <IoPieChartOutline className="w-12 h-12 mx-auto" />
          )}
        </div>
        <p className="text-gray-500">Chart visualization would appear here</p>
        <p className="text-xs text-gray-400 mt-2">
          (Using data: {data.length} data points)
        </p>
      </div>
    </div>
  </div>
);

// Table component
const Table = ({
  title,
  headers,
  data,
}: {
  title: string;
  headers: string[];
  data: Record<string, string | number>[];
}) => (
  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    <div className="overflow-x-auto relative">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {Object.values(row).map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Timeline component for daily rate changes
const Timeline = ({
  data,
}: {
  data: { employee: string; date: string; rate: number }[];
}) => {
  // Group data by employee
  const employeeGroups = data.reduce((groups, item) => {
    if (!groups[item.employee]) {
      groups[item.employee] = [];
    }
    groups[item.employee].push(item);
    return groups;
  }, {} as Record<string, typeof data>);

  // If no data, show a message
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Daily Rate History
        </h3>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="bg-blue-50 p-4 rounded-full mb-4">
            <IoWalletOutline className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-lg font-medium text-gray-700 mb-2">
            No Daily Rate History
          </p>
          <p className="text-gray-500 text-center max-w-md">
            There are no daily rate changes recorded for this year. Daily rate
            changes will appear here when they are added.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Daily Rate History
      </h3>

      {Object.entries(employeeGroups).map(([employee, history]) => {
        // Sort history by date in descending order (most recent first)
        const sortedHistory = [...history].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return (
          <div key={employee} className="mb-8 last:mb-0">
            <h4 className="text-md font-medium text-gray-700 mb-4">
              {employee}
            </h4>
            <div className="overflow-x-auto">
              <div className="relative flex items-start min-w-max">
                {sortedHistory.map((item, index) => (
                  <div key={index} className="flex-none mr-8 last:mr-0">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                        <IoWalletOutline className="w-4 h-4" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          ₱{item.rate.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.date).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      {index < sortedHistory.length - 1 && (
                        <div className="h-0.5 bg-gray-200 w-8 ml-3"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Add DeductionsTimeline component
const DeductionsTimeline = ({
  data,
}: {
  data: {
    type: string;
    changes: { date: string; amount: number; employee: string }[];
  }[];
}) => {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Deductions History
        </h3>
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="bg-blue-50 p-4 rounded-full mb-4">
            <IoWalletOutline className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-lg font-medium text-gray-700 mb-2">
            No Deductions History
          </p>
          <p className="text-gray-500 text-center max-w-md mb-4">
            There are no deductions recorded for this year. Deduction changes
            will appear here when they are added.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 w-full max-w-md">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Common Deduction Types:
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                <span>
                  <span className="font-medium">SSS</span> - Social Security
                  System contributions
                </span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                <span>
                  <span className="font-medium">PhilHealth</span> - Philippine
                  Health Insurance Corporation
                </span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                <span>
                  <span className="font-medium">Pag-IBIG</span> - Home
                  Development Mutual Fund
                </span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                <span>
                  <span className="font-medium">Withholding Tax</span> - Income
                  tax deductions
                </span>
              </li>
            </ul>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Deduction rates typically update annually or when government
                policies change. The system will automatically track these
                changes when they are recorded.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Deductions History
      </h3>

      {data.map((deduction) => {
        // Sort changes by date in descending order (most recent first)
        const sortedChanges = [...deduction.changes].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return (
          <div key={deduction.type} className="mb-8 last:mb-0">
            <h4 className="text-md font-medium text-gray-700 mb-4">
              {deduction.type}
            </h4>
            <div className="overflow-x-auto">
              <div className="relative flex items-start min-w-max">
                {sortedChanges.map((change, index) => (
                  <div key={index} className="flex-none mr-8 last:mr-0">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                        <IoWalletOutline className="w-4 h-4" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          ₱{change.amount.toLocaleString()}
                        </p>
                        <div className="space-y-0.5">
                          <p className="text-xs text-gray-500">
                            {new Date(change.date).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-xs text-gray-600 italic">
                            Updated {change.employee || "Unknown"}
                          </p>
                        </div>
                      </div>
                      {index < sortedChanges.length - 1 && (
                        <div className="h-0.5 bg-gray-200 w-8 ml-3"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Add RefreshMonthDialog component
const RefreshMonthDialog = ({
  isOpen,
  onClose,
  onConfirm,
  month,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  month: string;
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <IoRefreshOutline className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Refresh Data for {month}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    This will recalculate all payroll data for {month} using the
                    latest information. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function StatisticsPage() {
  // Replace the local state with the DateSelector's store
  const { selectedYear, setSelectedYear } = useDateSelectorStore();
  const [isLoading, setIsLoading] = useState(false);
  const [statisticsData, setStatisticsData] = useState<Statistics | null>(null);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");

  // Get years from the DateSelector's logic
  const years = Array.from(
    { length: new Date().getFullYear() - 2024 + 1 },
    (_, i) => 2024 + i
  ).reverse();

  const { dbPath, isInitialized, initialize } = useSettingsStore();
  const { updateMonthStatistics } = usePayrollStatistics();

  // Initialize settings store when component mounts
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Initialize daily rate history if empty
  const initializeDailyRateHistory = async (statisticsModel: any) => {
    try {
      const employeeModel = createEmployeeModel(dbPath);
      const employees = await employeeModel.loadEmployees();
      let newEntriesAdded = false;

      // For each employee with a daily rate, add to history
      for (const employee of employees) {
        if (employee.dailyRate && employee.dailyRate > 0) {
          // First check if employee already has history
          const currentStats = await statisticsModel.getStatistics();
          const hasExistingHistory = currentStats.dailyRateHistory.some(
            (history: any) => history.employee === employee.name
          );

          if (!hasExistingHistory) {
            newEntriesAdded = true;
            // Add current daily rate to history
            await statisticsModel.updateDailyRateHistory(
              employee.name,
              Number(employee.dailyRate)
            );
          }
        }
      }

      if (newEntriesAdded) {
        toast.success("New daily rates added to history");
      }
    } catch (error) {
      toast.error("Failed to initialize daily rate history");
    }
  };

  // Load statistics data function for manual refresh
  const handleRefresh = async () => {
    setIsLoading(true);
    const loadingToast = toast.loading("Refreshing statistics data...");

    try {
      if (!dbPath) {
        throw new Error(
          "Database path is not set. Please configure your settings first."
        );
      }

      const statisticsModel = createStatisticsModel(dbPath, selectedYear);
      const data = await statisticsModel.getStatistics();

      // Always initialize daily rates to ensure all employees are included
      await initializeDailyRateHistory(statisticsModel);

      // Reload statistics after initialization
      const updatedData = await statisticsModel.getStatistics();
      setStatisticsData(updatedData);

      toast.success("Statistics data refreshed successfully!", {
        id: loadingToast,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Error: ${errorMessage}`, {
        id: loadingToast,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize and load data when year changes
  useEffect(() => {
    if (!isInitialized || !dbPath) return;

    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const statisticsModel = createStatisticsModel(dbPath, selectedYear);
        const data = await statisticsModel.getStatistics();

        // Always initialize daily rates to ensure all employees are included
        await initializeDailyRateHistory(statisticsModel);

        // Reload statistics after initialization
        const updatedData = await statisticsModel.getStatistics();
        setStatisticsData(updatedData);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        toast.error(`Error: ${errorMessage}`);

        // Initialize with empty data if loading fails
        setStatisticsData({
          dailyRateHistory: [],
          monthlyPayrolls: [],
          deductionsHistory: [],
          totalEmployees: 0,
          totalPayroll: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          totalOvertime: 0,
          totalAbsences: 0,
          yearlyTotal: 0,
          yearlyAverage: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [selectedYear, isInitialized, dbPath]);

  // Filter data based on selected year
  const filteredDailyRateHistory = statisticsData?.dailyRateHistory || [];

  // Debug output
  useEffect(() => {
    console.log("Current statistics data:", statisticsData);
    console.log("Filtered daily rate history:", filteredDailyRateHistory);
  }, [statisticsData, filteredDailyRateHistory]);

  // Function to open the refresh dialog
  const openRefreshDialog = (month: string) => {
    setSelectedMonth(month);
    setRefreshDialogOpen(true);
  };

  // Function to refresh data for a specific month
  const handleRefreshMonth = async (monthName: string) => {
    try {
      // Load active employees
      const employeeModel = createEmployeeModel(dbPath);
      const employees = await employeeModel.loadActiveEmployees();

      // Convert month name to number (1-12)
      const monthIndex =
        new Date(Date.parse(`${monthName} 1, 2000`)).getMonth() + 1;

      // Collect all payrolls for the month
      const allPayrolls: PayrollSummaryModel[] = [];
      for (const employee of employees) {
        const payrolls = await Payroll.loadPayrollSummaries(
          dbPath,
          employee.id,
          selectedYear,
          monthIndex
        );
        allPayrolls.push(...payrolls);
      }

      // Update statistics for the month
      await updateMonthStatistics(allPayrolls, dbPath, monthName, selectedYear);

      // Refresh the statistics display
      await handleRefresh();

      toast.success(`Statistics for ${monthName} refreshed successfully`);
    } catch (error) {
      console.error("Error refreshing month statistics:", error);
      toast.error(`Failed to refresh statistics for ${monthName}`);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600 mx-auto"></div>
          <div className="text-gray-600">Loading statistics...</div>
        </div>
      </div>
    );
  }

  // Show message if database path is not set
  if (!dbPath) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="bg-yellow-50 p-4 rounded-full mb-4">
            <IoWalletOutline className="w-8 h-8 text-yellow-500 mx-auto" />
          </div>
          <div className="text-lg font-medium text-gray-700">
            Database Path Not Set
          </div>
          <div className="text-gray-600 max-w-md">
            Please configure your database path in the settings before viewing
            statistics.
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-12xl mx-auto py-20 sm:px-6 lg:px-8">
      <MagicCard
        className="p-0.5 rounded-2xl col-span-2"
        gradientSize={400}
        gradientColor="#9E7AFF"
        gradientOpacity={0.8}
        gradientFrom="#9E7AFF"
        gradientTo="#FE8BBB"
      >
        <div className="px-4 sm:px-0">
          <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50">
                <div className="flex items-center gap-2">
                  <MdOutlineDataset className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Payroll Statistics
                  </h2>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRefresh}
                    className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center gap-1"
                    title="Refresh statistics data"
                    disabled={isLoading}
                  >
                    <IoRefreshOutline
                      className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                    />
                    <span>Refresh</span>
                  </button>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6">
              {/* Monthly Payroll Section */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 w-1 h-6 rounded-full mr-3"></span>
                  Monthly Payroll Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <StatCard
                    title="Yearly Total"
                    value={new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(
                      statisticsData?.monthlyPayrolls.reduce(
                        (sum, item) => sum + item.amount,
                        0
                      ) || 0
                    )}
                    icon={<IoWalletOutline className="w-6 h-6" />}
                  />
                  <StatCard
                    title="Monthly Average"
                    value={new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(
                      (statisticsData?.monthlyPayrolls.reduce(
                        (sum, item) => sum + item.amount,
                        0
                      ) || 0) / (statisticsData?.monthlyPayrolls.length || 1)
                    )}
                    icon={<IoCalendarOutline className="w-6 h-6" />}
                  />
                </div>
                <div className="mt-6">
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900">
                        Monthly Payroll Details
                      </h3>
                    </div>
                    <div className="overflow-x-auto relative">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Month
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Amount
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Working Days
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Employees
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Absences
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {statisticsData?.monthlyPayrolls.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-6 py-4 text-center text-sm text-gray-500"
                              >
                                No payroll data available for this year
                              </td>
                            </tr>
                          ) : (
                            statisticsData?.monthlyPayrolls.map(
                              (item, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {item.month}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                                    ₱{item.amount.toLocaleString()}
                                    <button
                                      onClick={() =>
                                        openRefreshDialog(item.month)
                                      }
                                      className="ml-2 text-gray-400 hover:text-blue-500 transition-colors"
                                      title={`Refresh data for ${item.month}`}
                                    >
                                      <IoRefreshOutline className="w-4 h-4" />
                                    </button>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {item.days}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {item.employees}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {item.absences}
                                  </td>
                                </tr>
                              )
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deductions History Section */}
              <div className="mt-8">
                <DeductionsTimeline
                  data={statisticsData?.deductionsHistory || []}
                />
              </div>

              {/* Daily Rate History Section */}
              <div className="mt-8">
                <Timeline data={filteredDailyRateHistory} />
              </div>
            </div>
          </div>
        </div>
      </MagicCard>

      {/* Refresh Month Dialog */}
      <RefreshMonthDialog
        isOpen={refreshDialogOpen}
        onClose={() => setRefreshDialogOpen(false)}
        onConfirm={() => handleRefreshMonth(selectedMonth)}
        month={selectedMonth}
      />
    </main>
  );
}
