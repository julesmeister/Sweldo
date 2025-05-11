"use client";
import React, { useState, useEffect, useMemo } from "react";
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
import { getStatisticsFirestore, updateDailyRateHistoryFirestore, updatePayrollStatisticsFirestore } from "../model/statistics_firestore";
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
import DecryptedText from "../styles/DecryptedText/DecryptedText";
import { RefreshMonthDialog } from "../components/statistics/RefreshMonthDialog";
import { StatCard } from "../components/statistics/StatCard";
import { MonthlyPayrollSection } from "../components/statistics/MonthlyPayrollSection";
import { useStatisticsPageData } from "../hooks/statistics/useStatisticsPageData";
import Chart from "../components/statistics/Chart";
import Table from "../components/statistics/Table";
import Timeline from "../components/statistics/Timeline";
import DeductionsTimeline from "../components/statistics/DeductionsTimeline";
import StatisticsPageHeader from "../components/statistics/StatisticsPageHeader";

// Table component
// const Table = ({ ... entire definition removed ... }); // Removed Table definition

// Timeline component for daily rate changes
// const Timeline = ({ ... definition around line 42 removed ... });

// Placeholder for locally defined StatisticsPageHeader if it wasn't extracted
// interface StatisticsPageHeaderProps { ... entire definition removed ... };
// const StatisticsPageHeader: React.FC<StatisticsPageHeaderProps> = ({ ... entire definition removed ... });

export default function StatisticsPage() {
  const { selectedYear, setSelectedYear, selectedMonth } = useDateSelectorStore();
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [monthToRefresh, setMonthToRefresh] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const getMonthName = (monthIndex: number): string => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[monthIndex] || "";
  };

  const years = useMemo(() => Array.from(
    { length: new Date().getFullYear() - 2024 + 1 },
    (_, i) => 2024 + i
  ).reverse(), []);

  const { dbPath, companyName, isInitialized } = useSettingsStore();

  const {
    statisticsData,
    isLoading,
    refreshStatistics,
    processedDailyRateHistory,
  } = useStatisticsPageData({
    selectedYear,
    dbPath,
    companyName,
    isInitialized,
  });

  const handleRefresh = async () => {
    const loadingToast = toast.loading("Refreshing statistics data...");
    await refreshStatistics();
    toast.dismiss(loadingToast);
  };

  const handleRefreshMonth = async (selectedPayrollIds: string[]) => {
    if (!selectedPayrollIds || selectedPayrollIds.length === 0) {
      toast.error("No payrolls selected for processing.");
      return;
    }

    try {
      setIsUpdating(true);
      toast.info(`Processing ${selectedPayrollIds.length} payrolls for ${monthToRefresh} ${selectedYear}...`);

      // Fetch the actual payroll objects for the selected IDs
      const payrollPromises = selectedPayrollIds.map(async (payrollId) => {
        try {
          // In a real implementation, we would split the ID to get employee ID
          // Assume format: employeeId_startDate (you may need to adjust this based on actual ID format)
          const parts = payrollId.split('_');
          const employeeId = parts[0];

          // Get the payroll from the database
          // We'll implement this by loading all payrolls for the employee and finding the matching one
          const employeePayrolls = await Payroll.loadPayrollSummaries(
            isWebEnvironment() ? companyName : dbPath,
            employeeId,
            selectedYear,
            0 // Pass 0 to get all months
          );

          return employeePayrolls.find(p => p.id === payrollId);
        } catch (error) {
          console.error(`Failed to load payroll ${payrollId}:`, error);
          return null;
        }
      });

      const payrolls = (await Promise.all(payrollPromises)).filter(Boolean);

      if (payrolls.length === 0) {
        throw new Error("Failed to load any of the selected payrolls");
      }

      // Update local statistics if in desktop mode
      if (!isWebEnvironment() && dbPath) {
        const statsModel = createStatisticsModel(dbPath, selectedYear);
        await statsModel.updatePayrollStatistics(payrolls);
        toast.success(`Local statistics updated for ${monthToRefresh} ${selectedYear}`);
      }

      // Update Firestore statistics if in web mode
      if (isWebEnvironment() && companyName) {
        await updatePayrollStatisticsFirestore(payrolls, selectedYear, companyName);
        toast.success(`Firestore statistics updated for ${monthToRefresh} ${selectedYear}`);
      }

      // Since we've updated stats, refresh the display
      await refreshStatistics();

      toast.success(`Successfully recalculated statistics for ${monthToRefresh} ${selectedYear}.`);
    } catch (error) {
      console.error("Error updating statistics:", error);
      toast.error(`Failed to update statistics: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUpdating(false);
      setRefreshDialogOpen(false);
    }
  };

  const openRefreshDialog = (monthClicked: string) => {
    setMonthToRefresh(monthClicked);
    setRefreshDialogOpen(true);
  };

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

  const identifierMissing = isWebEnvironment() ? !companyName : !dbPath;
  if (identifierMissing && isInitialized && !isLoading) {
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
            href={isWebEnvironment() ? "/" : "/settings"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors text-base mt-2"
          >
            <MdOutlineDataset className="w-5 h-5" />
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
            <StatisticsPageHeader
              isLoading={isLoading}
              onRefresh={handleRefresh}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              years={years}
            />
            <div className="p-6">
              <MonthlyPayrollSection
                monthlyPayrolls={statisticsData?.monthlyPayrolls}
                onOpenRefreshDialog={openRefreshDialog}
              />
              <div className="mt-8">
                <DeductionsTimeline
                  data={statisticsData?.deductionsHistory || []}
                />
              </div>
              <div className="mt-8">
                <Timeline data={processedDailyRateHistory} />
              </div>
            </div>
          </div>
        </div>
      </MagicCard>
      {refreshDialogOpen && (
        <RefreshMonthDialog
          isOpen={refreshDialogOpen}
          onClose={() => setRefreshDialogOpen(false)}
          onConfirm={handleRefreshMonth}
          monthName={monthToRefresh}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          dbPath={dbPath}
          companyName={companyName}
        />
      )}
    </main>
  );
}
