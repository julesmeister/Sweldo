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
import { createStatisticsModel, Statistics, DailyRateHistory } from "../model/statistics";
import { getStatisticsFirestore, updateDailyRateHistoryFirestore } from "../model/statistics_firestore";
import { useSettingsStore } from "../stores/settingsStore";
import { toast } from "sonner";
import { createEmployeeModel, Employee } from "../model/employee";
import { loadEmployeesFirestore } from "../model/employee_firestore";
import { Payroll, PayrollSummaryModel } from "../model/payroll";
import { useDateSelectorStore } from "../components/DateSelector";
import { usePayrollStatistics } from "../hooks/usePayrollStatistics";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";
import YearPickerDropdown from "../components/YearPickerDropdown";
import Waves from '../components/magicui/Waves';

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
  <div className="bg-white bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2710%27%20height%3D%2710%27%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%3E%3Cpath%20d%3D%27M-1%201%20l2-2%20M0%2010%20l10-10%20M9%2011%20l2-2%27%20stroke%3D%27rgba(0%2C0%2C0%2C0.04)%27%20stroke-width%3D%270.5%27%2F%3E%3C%2Fsvg%3E')] rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] relative overflow-hidden">
    <Waves lineColor="#f1f1f1" />
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
              className={`text-sm font-medium ${trendUp ? "text-green-600" : "text-red-600"
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
  data: (DailyRateHistory & { groupKey: string; displayName: string })[];
}) => {
  // Group data by the consistent 'groupKey'
  const employeeGroups = data.reduce((groups, item) => {
    const key = item.groupKey; // Use the new groupKey
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
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

      {Object.entries(employeeGroups).map(([groupKey, historyItems]) => {
        // Sort history by date in descending order (most recent first)
        const sortedHistory = [...historyItems].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Display name should come from the first item in the sorted history
        const employeeDisplayName = sortedHistory[0]?.displayName || groupKey;

        return (
          <div key={groupKey} className="mb-8 last:mb-0">
            <h4 className="text-md font-medium text-gray-700 mb-4">
              {employeeDisplayName}
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
  const { selectedYear, setSelectedYear, selectedMonth, setSelectedMonth } = useDateSelectorStore();
  const [isLoading, setIsLoading] = useState(false);
  const [statisticsData, setStatisticsData] = useState<Statistics | null>(null);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);

  // Convert selectedMonth (number 0-11) to month name string
  const getMonthName = (monthIndex: number): string => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[monthIndex] || "";
  };

  const currentMonthName = getMonthName(selectedMonth);

  const years = Array.from(
    { length: new Date().getFullYear() - 2024 + 1 },
    (_, i) => 2024 + i
  ).reverse();

  // Get necessary identifiers from store
  const { dbPath, companyName, isInitialized } = useSettingsStore();
  const { updateMonthStatistics } = usePayrollStatistics();

  // Helper to initialize/update daily rate history (modified)
  const initializeOrUpdateDailyRateHistory = async (currentStats: Statistics | null) => {
    if (!currentStats) return false;

    let employees: Employee[] = [];
    let newEntriesAdded = false;

    try {
      if (isWebEnvironment()) {
        if (!companyName) {
          console.warn("[Stats Rate Init] Web mode: Company name missing.");
          return false;
        }
        employees = await loadEmployeesFirestore(companyName);
      } else {
        if (!dbPath) {
          console.warn("[Stats Rate Init] Desktop mode: dbPath missing.");
          return false;
        }
        const employeeModel = createEmployeeModel(dbPath);
        employees = await employeeModel.loadEmployees();
      }

      const rateHistoryUpdates: Promise<void>[] = [];

      for (const employee of employees) {
        if (employee.dailyRate && employee.dailyRate > 0) {
          const hasExistingHistory = currentStats.dailyRateHistory.some(
            (history) => history.employee === employee.name // Assuming name is the key for now
          );

          if (!hasExistingHistory) {
            newEntriesAdded = true;
            const newEntry: DailyRateHistory = {
              employee: employee.name,
              date: new Date().toISOString(), // Use current date for initial entry
              rate: Number(employee.dailyRate),
            };

            if (isWebEnvironment()) {
              // Use Firestore update function
              rateHistoryUpdates.push(
                updateDailyRateHistoryFirestore(employee.id, newEntry.rate, selectedYear, companyName!)
              );
            } else {
              // Use model update function (needs instance)
              const statisticsModel = createStatisticsModel(dbPath!, selectedYear);
              rateHistoryUpdates.push(
                statisticsModel.updateDailyRateHistory(employee.id, newEntry.rate)
              );
            }
          }
        }
      }

      await Promise.all(rateHistoryUpdates);

      if (newEntriesAdded) {
        toast.success("New daily rates added to history");
        // Indicate that a refresh might be needed to see the updated history in the state
        // Or return true to trigger a reload in the calling function
        return true;
      }
    } catch (error) {
      toast.error("Failed to initialize daily rate history");
      console.error("Error initializing rate history:", error);
    }
    return false;
  };

  // Combined load and initialize function
  const loadAndInitializeData = async () => {
    setIsLoading(true);
    let data: Statistics | null = null;
    let needsRefreshAfterRateInit = false;

    try {
      // Fetch employees first
      let fetchedEmployees: Employee[] = [];
      if (isWebEnvironment()) {
        if (companyName) {
          fetchedEmployees = await loadEmployeesFirestore(companyName);
        } else {
          console.warn("[Stats Page] Web mode: Company name missing for employee load.");
        }
      } else {
        if (dbPath) {
          const employeeModel = createEmployeeModel(dbPath);
          fetchedEmployees = await employeeModel.loadEmployees();
        } else {
          console.warn("[Stats Page] Desktop mode: dbPath missing for employee load.");
        }
      }
      setEmployeeList(fetchedEmployees);

      if (isWebEnvironment()) {
        if (!companyName) throw new Error("Company not selected.");
        data = await getStatisticsFirestore(selectedYear, companyName);
      } else {
        if (!dbPath) throw new Error("Database path not set.");
        const statisticsModel = createStatisticsModel(dbPath, selectedYear);
        data = await statisticsModel.getStatistics();
      }

      needsRefreshAfterRateInit = await initializeOrUpdateDailyRateHistory(data);

      if (needsRefreshAfterRateInit) {
        // Reload the statistics data to include the newly added rate history
        if (isWebEnvironment()) {
          data = await getStatisticsFirestore(selectedYear, companyName!);
        } else {
          const statisticsModel = createStatisticsModel(dbPath!, selectedYear);
          data = await statisticsModel.getStatistics();
        }
      }

      setStatisticsData(data);
      toast.success("Statistics data loaded.");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Error loading statistics: ${errorMessage}`);
      setStatisticsData(null); // Reset data on error
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on initial mount and when year/identifiers/month change
  useEffect(() => {
    if (isInitialized && (dbPath || companyName)) { // Check if required identifier is present
      loadAndInitializeData();
    }
    // Dependency array now includes selectedMonth
  }, [selectedYear, selectedMonth, isInitialized, dbPath, companyName]); // Added selectedMonth

  // Manual refresh handler
  const handleRefresh = async () => {
    const loadingToast = toast.loading("Refreshing statistics data...");
    await loadAndInitializeData(); // Reuse the combined loading logic
    toast.dismiss(loadingToast);
  };

  // Simplified Refresh Month handler - just refreshes all data for now
  const handleRefreshMonth = async (monthName: string) => {
    const loadingToast = toast.loading(`Refreshing data including ${monthName}...`);
    // TODO: Implement web-compatible recalculation logic using Firestore payroll data if needed
    // For now, just reload the existing yearly stats
    console.warn("Full month recalculation not implemented for web mode yet. Refreshing current stats.");
    await handleRefresh(); // Reload all stats
    toast.dismiss(loadingToast);
    toast.success(`Statistics view refreshed.`);
    // Original logic requiring payroll model adaptation commented out:
    /*
    try {
        // ... load employees based on env ...
        // ... load payroll summaries based on env (needs firestore version) ...
        // ... call updateMonthStatistics (needs adaptation?) ...
        await handleRefresh();
        toast.success(`Statistics for ${monthName} refreshed successfully`);
      } catch (error) {
        console.error("Error refreshing month statistics:", error);
        toast.error(`Failed to refresh statistics for ${monthName}`);
    }
    */
  };

  // Create memoized maps for employee ID/Name lookups
  const idToNameMap = React.useMemo(() => new Map(employeeList.map(e => [e.id, e.name])), [employeeList]);
  const nameToIdMap = React.useMemo(() => new Map(employeeList.map(e => [e.name, e.id])), [employeeList]);

  // Process dailyRateHistory to ensure consistent grouping and display names
  const processedDailyRateHistory = React.useMemo(() => {
    if (!statisticsData?.dailyRateHistory) return [];

    return statisticsData.dailyRateHistory.map(item => {
      let groupKey: string = ''; // This will be the consistent key, ideally employee ID
      let displayName: string = ''; // This will be the employee's name for display

      // Scenario 1: item.employee is a known ID
      if (idToNameMap.has(item.employee)) {
        groupKey = item.employee;
        displayName = idToNameMap.get(item.employee)!;
      }
      // Scenario 2: item.employee is a known Name
      else if (nameToIdMap.has(item.employee)) {
        groupKey = nameToIdMap.get(item.employee)!;
        displayName = item.employee;
      }
      // Scenario 3: Fallback (item.employee might be an unknown ID or a name not in current employeeList)
      else {
        groupKey = item.employee; // Use as is for grouping
        displayName = item.employee; // Use as is for display
      }
      return { ...item, groupKey, displayName }; // Add groupKey and displayName to each history item
    });
  }, [statisticsData?.dailyRateHistory, idToNameMap, nameToIdMap]);

  // Debug output
  useEffect(() => {
    console.log("Current statistics data:", statisticsData);
    console.log("Processed daily rate history:", processedDailyRateHistory);
    console.log("Employee List for ID/Name mapping:", employeeList);
  }, [statisticsData, processedDailyRateHistory, employeeList]);

  // Function to open the refresh dialog
  const openRefreshDialog = (month: string) => {
    setRefreshDialogOpen(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-0"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-200"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-400"></div>
          </div>
          <div className="text-gray-700 font-medium">Loading statistics... Please wait.</div>
          <div className="text-xs text-gray-500">Crunching numbers and generating insights.</div>
        </div>
      </div>
    );
  }

  // Show message if required path/company is not set
  const identifierMissing = isWebEnvironment() ? !companyName : !dbPath;
  if (identifierMissing && isInitialized) { // Also check isInitialized to avoid flashing message on load
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50/60 to-white">
        <div className="bg-white/90 rounded-2xl shadow-xl border border-blue-100 px-8 py-12 flex flex-col items-center max-w-lg w-full">
          <div className="bg-yellow-100 p-6 rounded-full mb-6 shadow-sm flex items-center justify-center">
            <IoWalletOutline className="w-16 h-16 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center drop-shadow-sm">
            {isWebEnvironment() ? "Company Not Selected" : "Database Path Not Set"}
          </h2>
          <p className="text-gray-600 text-center mb-6 text-lg">
            {isWebEnvironment()
              ? "To view payroll statistics, please select your company during login or in settings."
              : "To view payroll statistics, please configure your database path in the Settings page first."}
          </p>
          <a
            href={isWebEnvironment() ? "/" : "/settings"} // Link to login/company select or settings
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors text-base mt-2"
          >
            <IoBarChartOutline className="w-5 h-5" />
            {isWebEnvironment() ? "Go to Company Selection" : "Go to Settings"}
          </a>
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
                    className="flex items-center justify-between cursor-pointer border border-gray-300 rounded-full pl-3 pr-1.5 py-1 bg-white hover:bg-gray-50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto"
                    title="Refresh statistics data"
                    disabled={isLoading}
                  >
                    <span className="text-gray-700 font-medium mr-1.5">Refresh</span>
                    <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
                      <IoRefreshOutline
                        className={`w-3 h-3 text-white ${isLoading ? "animate-spin" : ""}`}
                      />
                    </div>
                  </button>
                  <YearPickerDropdown
                    selectedYear={selectedYear}
                    onSelectYear={setSelectedYear}
                    years={years}
                    className="w-20"
                  />
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
                <Timeline data={processedDailyRateHistory} />
              </div>
            </div>
          </div>
        </div>
      </MagicCard>

      {/* Refresh Month Dialog */}
      <RefreshMonthDialog
        isOpen={refreshDialogOpen}
        onClose={() => setRefreshDialogOpen(false)}
        onConfirm={() => handleRefreshMonth(currentMonthName)}
        month={currentMonthName}
      />
    </main>
  );
}
