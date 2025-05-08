import { useState, useEffect, useCallback } from "react";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useAuthStore } from "@/renderer/stores/authStore"; // To ensure auth is ready
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

interface FetchDataParams {
  year: number;
  month: number; // 0-indexed
  dbPath: string | null;
  companyName: string | null;
}

// T is the type of the data being fetched
function useDateAwareData<T>(
  fetchDataFunction: (params: FetchDataParams) => Promise<T | null>
) {
  const { selectedYear, selectedMonth } = useDateSelectorStore();
  const {
    dbPath,
    companyName,
    isInitialized: settingsAreInitialized,
  } = useSettingsStore();
  const { isAuthInitialized } = useAuthStore(); // Use this to gate initial fetch

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    // Ensure all necessary conditions are met before fetching
    const canFetchDesktop = !isWebEnvironment() && dbPath;
    const canFetchWeb = isWebEnvironment() && companyName;

    if (
      !settingsAreInitialized ||
      !isAuthInitialized ||
      !(canFetchDesktop || canFetchWeb)
    ) {
      // console.log('[useDateAwareData] Conditions not met for fetching:', { settingsAreInitialized, isAuthInitialized, canFetchDesktop, canFetchWeb });
      setData(null); // Clear data if conditions are no longer met
      return;
    }

    setIsLoading(true);
    // console.log(`[useDateAwareData] Fetching for Year: ${selectedYear}, Month: ${selectedMonth}`);
    try {
      const result = await fetchDataFunction({
        year: selectedYear,
        month: selectedMonth, // Pass 0-indexed month
        dbPath,
        companyName,
      });
      setData(result);
    } catch (error) {
      console.error("[useDateAwareData] Error fetching data:", error);
      setData(null); // Reset data on error
      // Optionally, re-throw or handle error (e.g., set an error state)
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedYear,
    selectedMonth,
    dbPath,
    companyName,
    settingsAreInitialized,
    isAuthInitialized,
    fetchDataFunction,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]); // loadData is memoized and contains all dependencies

  return { data, isLoading, refetchData: loadData }; // Expose refetchData
}

export default useDateAwareData;
