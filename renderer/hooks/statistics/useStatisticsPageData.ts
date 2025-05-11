import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  createStatisticsModel,
  Statistics,
  DailyRateHistory,
} from "../../model/statistics";
import {
  getStatisticsFirestore,
  updateDailyRateHistoryFirestore,
} from "../../model/statistics_firestore";
import { createEmployeeModel, Employee } from "../../model/employee";
import { loadEmployeesFirestore } from "../../model/employee_firestore";
import { isWebEnvironment } from "../../lib/firestoreService";

interface UseStatisticsPageDataProps {
  selectedYear: number;
  dbPath: string | null;
  companyName: string | null;
  isInitialized: boolean; // To ensure dbPath/companyName are ready
}

const initializeOrUpdateDailyRateHistoryInternal = async (
  currentStats: Statistics | null,
  passedEmployees: Employee[],
  localDbPath: string | null,
  localCompanyName: string | null,
  yearForHistory: number
) => {
  if (!currentStats) return false;
  let newEntriesAdded = false;
  try {
    const rateHistoryUpdates: Promise<void>[] = [];
    for (const employee of passedEmployees) {
      if (employee.dailyRate && employee.dailyRate > 0) {
        const hasExistingHistory = currentStats.dailyRateHistory.some(
          (history) => history.employee === employee.name
        );
        if (!hasExistingHistory) {
          newEntriesAdded = true;
          const newEntry: DailyRateHistory = {
            employee: employee.name,
            date: new Date().toISOString(),
            rate: Number(employee.dailyRate),
          };
          if (isWebEnvironment()) {
            if (!localCompanyName) {
              console.warn(
                "[Stats Rate Init Hook] Web mode: Company name missing for Firestore update."
              );
              continue;
            }
            rateHistoryUpdates.push(
              updateDailyRateHistoryFirestore(
                employee.id,
                newEntry.rate,
                yearForHistory,
                localCompanyName
              )
            );
          } else {
            if (!localDbPath) {
              console.warn(
                "[Stats Rate Init Hook] Desktop mode: dbPath missing for model update."
              );
              continue;
            }
            const statisticsModel = createStatisticsModel(
              localDbPath,
              yearForHistory
            );
            rateHistoryUpdates.push(
              statisticsModel.updateDailyRateHistory(employee.id, newEntry.rate)
            );
          }
        }
      }
    }
    await Promise.all(rateHistoryUpdates);
    if (newEntriesAdded) {
      toast.success("New daily rates added to history from hook");
      return true;
    }
  } catch (error) {
    toast.error("Failed to initialize daily rate history from hook");
    console.error("Error initializing rate history from hook:", error);
  }
  return false;
};

export const useStatisticsPageData = ({
  selectedYear,
  dbPath,
  companyName,
  isInitialized,
}: UseStatisticsPageDataProps) => {
  const [statisticsData, setStatisticsData] = useState<Statistics | null>(null);
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isInitialized || (isWebEnvironment() ? !companyName : !dbPath)) {
      // Don't fetch if essential identifiers are not ready
      return;
    }

    setIsLoading(true);
    let data: Statistics | null = null;
    let needsRefreshAfterRateInit = false;
    const currentDbPath = dbPath;
    const currentCompanyName = companyName;
    const currentSelectedYear = selectedYear;

    try {
      let fetchedEmployees: Employee[] = [];
      if (isWebEnvironment()) {
        if (currentCompanyName) {
          fetchedEmployees = await loadEmployeesFirestore(currentCompanyName);
        }
      } else {
        if (currentDbPath) {
          const employeeModel = createEmployeeModel(currentDbPath);
          fetchedEmployees = await employeeModel.loadEmployees();
        }
      }
      setEmployeeList(fetchedEmployees);

      if (isWebEnvironment()) {
        if (!currentCompanyName) throw new Error("Company not selected.");
        data = await getStatisticsFirestore(
          currentSelectedYear,
          currentCompanyName
        );
      } else {
        if (!currentDbPath) throw new Error("Database path not set.");
        const statisticsModel = createStatisticsModel(
          currentDbPath,
          currentSelectedYear
        );
        data = await statisticsModel.getStatistics();
      }

      needsRefreshAfterRateInit =
        await initializeOrUpdateDailyRateHistoryInternal(
          data,
          fetchedEmployees,
          currentDbPath,
          currentCompanyName,
          currentSelectedYear
        );

      if (needsRefreshAfterRateInit) {
        if (isWebEnvironment()) {
          if (!currentCompanyName)
            throw new Error("Company not selected for refresh.");
          data = await getStatisticsFirestore(
            currentSelectedYear,
            currentCompanyName
          );
        } else {
          if (!currentDbPath)
            throw new Error("Database path not set for refresh.");
          const statisticsModel = createStatisticsModel(
            currentDbPath,
            currentSelectedYear
          );
          data = await statisticsModel.getStatistics();
        }
      }
      setStatisticsData(data);
      if (data) {
        // Only toast success if data was actually loaded/attempted
        toast.success("Statistics data loaded by hook.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Error loading statistics via hook: ${errorMessage}`);
      setStatisticsData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, dbPath, companyName, isInitialized]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived state calculations
  const idToNameMap = useMemo(
    () => new Map(employeeList.map((e) => [e.id, e.name])),
    [employeeList]
  );
  const nameToIdMap = useMemo(
    () => new Map(employeeList.map((e) => [e.name, e.id])),
    [employeeList]
  );

  const processedDailyRateHistory = useMemo(() => {
    if (!statisticsData?.dailyRateHistory) return [];
    return statisticsData.dailyRateHistory.map((item) => {
      let groupKey: string = "";
      let displayName: string = "";
      if (idToNameMap.has(item.employee)) {
        groupKey = item.employee;
        displayName = idToNameMap.get(item.employee)!;
      } else if (nameToIdMap.has(item.employee)) {
        groupKey = nameToIdMap.get(item.employee)!;
        displayName = item.employee;
      } else {
        groupKey = item.employee;
        displayName = item.employee;
      }
      return { ...item, groupKey, displayName };
    });
  }, [statisticsData?.dailyRateHistory, idToNameMap, nameToIdMap]);

  return {
    statisticsData,
    employeeList,
    isLoading,
    refreshStatistics: fetchData, // Expose fetchData as refreshStatistics
    processedDailyRateHistory,
    idToNameMap, // Optionally expose these if needed directly by the page
    nameToIdMap, // though processedDailyRateHistory might be sufficient
  };
};
