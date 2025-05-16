import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { Payroll } from "../model/payroll";
import { isWebEnvironment } from "../lib/firestoreService";

interface PayrollPeriod {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

interface UsePayrollPeriodsResult {
  periods: PayrollPeriod[];
  isLoading: boolean;
  error: Error | null;
  refreshPeriods: () => Promise<void>;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  availableYears: number[];
}

/**
 * Hook to manage payroll periods
 *
 * This hook provides access to available payroll periods by year and handles
 * loading state and errors. It leverages the existing Payroll class methods.
 */
export function usePayrollPeriods(
  initialYear?: number
): UsePayrollPeriodsResult {
  const { dbPath } = useSettingsStore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(
    initialYear || currentYear
  );
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Generate available years (current year and previous years)
  useEffect(() => {
    const years = [];
    for (let i = 0; i < 6; i++) {
      years.push(currentYear - i);
    }
    setAvailableYears(years);
  }, [currentYear]);

  const loadPayrollPeriods = useCallback(async () => {
    if (!dbPath) {
      setError(new Error("Database path not set"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const periodsResult = await Payroll.getAvailablePayrollPeriods(
        dbPath,
        selectedYear
      );
      setPeriods(periodsResult);
    } catch (err) {
      console.error("Error loading payroll periods:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to load payroll periods")
      );
    } finally {
      setIsLoading(false);
    }
  }, [dbPath, selectedYear]);

  // Load periods when component mounts or year/dbPath changes
  useEffect(() => {
    loadPayrollPeriods();
  }, [loadPayrollPeriods]);

  return {
    periods,
    isLoading,
    error,
    refreshPeriods: loadPayrollPeriods,
    selectedYear,
    setSelectedYear,
    availableYears,
  };
}
