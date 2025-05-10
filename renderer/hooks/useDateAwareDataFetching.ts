import { useState, useEffect } from "react";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import { useLoadingStore } from "@/renderer/stores/loadingStore";

/**
 * A custom hook for fetching data based on the global date selector
 * This hook handles common patterns for components that need to load data
 * for a specific month and year, and automatically refetch when those values change.
 */
export function useDateAwareDataFetching<T>(
  fetchFunction: (year: number, month: number) => Promise<T>,
  initialData: T,
  dependencies: any[] = []
): {
  data: T;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { selectedMonth, selectedYear } = useDateSelectorStore();
  const { setLoading } = useLoadingStore();
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Convert selectedMonth to 1-based index for API calls
  const monthForApi = selectedMonth + 1;

  const fetchData = async () => {
    if (!selectedYear) return;

    try {
      setIsLoading(true);
      setLoading(true);
      setError(null);

      const result = await fetchFunction(selectedYear, monthForApi);
      setData(result);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, ...dependencies]);

  const refetch = async () => {
    await fetchData();
  };

  return { data, isLoading, error, refetch };
}
 